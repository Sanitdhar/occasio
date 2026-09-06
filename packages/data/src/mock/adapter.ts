import {
  announcementId as toAnnouncementId,
  approvalRequestId,
  assignmentId as toAssignmentId,
  gossipPostId as toGossipPostId,
  membershipId as toMembershipId,
  personaId as toPersonaId,
  taskId as toTaskId,
  type AnnouncementId,
  type AssignmentId,
  type GossipPostId,
  type MediaId,
  type MembershipId,
  type PersonId,
  type PersonaId,
  type SessionId,
  type TaskId,
  type TenantId,
  type UnitId,
  type UserId,
  type VenueId,
} from '@occasio/core';
import type { TenantConfig } from '../config';
import type {
  Announcement,
  Assignment,
  GossipPost,
  MediaAsset,
  Membership,
  NotificationPreferences,
  Person,
  Persona,
  Rsvp,
  Session,
  Tenant,
  Unit,
  Venue,
} from '../domain';
import { NotFoundError, ValidationError, type ValidationIssue } from '../errors';
import {
  toAnnouncement,
  toApprovalRequest,
  toAssignment,
  toGossipPost,
  toMediaAsset,
  toMembership,
  toNotificationPreferences,
  toPerson,
  toPersona,
  toRsvp,
  toSession,
  toSessionPerson,
  toTask,
  toTenant,
  toTenantConfigRecord,
  toUnit,
  toUser,
  toVenue,
} from '../mappers';
import type { Page, PageRequest } from '../pagination';
import type {
  ApprovalDecision,
  DataAdapter,
  GossipChange,
  GossipModeration,
  GossipQuery,
  MembershipInvite,
  MembershipQuery,
  NewAnnouncement,
  NewAssignment,
  NewGossipPost,
  NewTask,
  NotificationPreferencesInput,
  RsvpInput,
  RsvpQuery,
  SessionQuery,
  TaskQuery,
  UnitQuery,
  Unsubscribe,
  AnnouncementQuery,
  AssignmentQuery,
  MediaQuery,
} from '../repositories';
import type {
  AnnouncementRow,
  ApprovalRequestId,
  ApprovalRequestRow,
  AssignmentRow,
  GossipPostRow,
  MediaAssetRow,
  MembershipRow,
  ModerationStatus,
  NotificationPreferenceRow,
  PersonRow,
  PersonaRow,
  RsvpRow,
  SessionRow,
  TaskRow,
  TaskStatus,
  TenantConfigRow,
  TenantRow,
  UnitRow,
  UserRow,
  VenueRow,
} from '../rows';
import {
  CREW_ROLES,
  ADMIN_ROLES,
  MODERATOR_ROLES,
  findActiveMembership,
  hasRole,
  requireMembership,
  requireRole,
} from './access';
import { createDefaultStorage } from './defaultStorage';
import { createAvatarKey, createDeviceId, createPersonaLabel, deviceHashFor } from './identity';
import {
  DEFAULT_LATENCY,
  createDelay,
  realSleep,
  type LatencyRange,
  type Random,
  type Sleep,
} from './latency';
import { cloneJson as clone, parseSnapshot, serialiseSnapshot } from './mappers';
import { numericKey, paginate, timestampKey } from './paging';
import type { MockStorage } from './storage';
import {
  EMPTY_TABLES,
  MOCK_SNAPSHOT_VERSION,
  MOCK_STORAGE_KEY,
  type MockSeed,
  type MockTables,
} from './tables';

/**
 * The mock adapter (D4): a full `DataAdapter` backed by fixture rows, a real store and a
 * deliberate delay.
 *
 * Three properties make it worth more than an array of stubs, and each of them exists to make
 * the prototype fail the way production will:
 *
 *  1. **Writes persist.** The demo dataset is loaded from storage, mutated in place and written
 *     back, so approving a gossip post or publishing a theme survives a reload. Without that,
 *     the theme editor is a toy — every change is gone the moment you check it on a phone.
 *  2. **Every call is slow on purpose.** 80–240ms, before it succeeds *or* fails. See
 *     `latency.ts`: a loading state that was never visible during development is a loading state
 *     that was never built.
 *  3. **Access is checked, not assumed.** A `tenantId` the caller has no active membership in is
 *     a `ForbiddenError`, from the first commit rather than from whenever Supabase arrives. See
 *     `access.ts`.
 *
 * **Visibility is filtered; permission is thrown.** The distinction runs through every method
 * below and it is the one Postgres makes. A row-level security policy does not raise an error
 * when you ask for rows you cannot see — it returns fewer rows. So an attendee asking for the
 * moderation queue gets the approved posts they are allowed to see, and an attendee asking for
 * draft sessions gets the published ones; only an *operation* they may not perform — publishing a
 * config, moderating a post, inviting a member — throws `ForbiddenError`. Screens written against
 * an adapter that threw for a read would be screens full of error branches that Supabase then
 * never takes.
 */

/* ---------------------------------------------------------------------------------------------
 * Options and the returned adapter
 * ------------------------------------------------------------------------------------------- */

export type MockAdapterOptions = {
  /**
   * Who is asking. Every access check is against this user, so it is the mock's stand-in for
   * `auth.uid()` and the reason a demo can be viewed as an admin and then as a guest.
   */
  readonly currentUserId: UserId;
  /** The dataset a first run — or a reset — starts from. The fixture events (#35) are one. */
  readonly seed: MockSeed;
  /** Defaults to the platform store: `localStorage` on web, memory elsewhere. */
  readonly storage?: MockStorage | undefined;
  /** Overridable so two adapters in one test do not share a key. */
  readonly storageKey?: string | undefined;
  /** `{ minMs: 0, maxMs: 0 }` turns the delay off, which is what the suites do. */
  readonly latency?: LatencyRange | undefined;
  readonly random?: Random | undefined;
  readonly sleep?: Sleep | undefined;
  /** Injected so a test can assert what was stamped rather than that it looks recent. */
  readonly now?: (() => Date) | undefined;
};

/**
 * `DataAdapter` plus the two things only a mock has.
 *
 * Screens are handed the `DataAdapter` half and cannot reach either, which is what stops a
 * "reset demo data" button being wired somewhere it would ship.
 */
export type MockAdapter = DataAdapter & {
  /**
   * Throws away every write and reloads the seed — the entry point behind the dev-menu action.
   *
   * It exists because the alternative, once someone has rejected the wrong post or dragged the
   * seed colour somewhere unusable, is talking a person through clearing site data in browser
   * devtools five minutes before a demo.
   */
  readonly resetDemoData: () => Promise<void>;
  /** Resolves once the snapshot has been read (or seeded). Useful to warm before a first paint. */
  readonly ready: () => Promise<void>;
};

/* ---------------------------------------------------------------------------------------------
 * Internals
 * ------------------------------------------------------------------------------------------- */

type MockState = { tables: MockTables; deviceId: string; nextId: number };

/** A stand-in for the `CHECK` constraint the column will carry. */
const MAX_GOSSIP_BODY_LENGTH = 600;

/**
 * D31 — reports above this auto-hide an approved post pending review, rather than waiting for a
 * moderator to notice. Low, because a demo has to be able to reach it.
 */
const REPORT_HIDE_THRESHOLD = 3;

const QUIET_HOURS = /^(?:[01]\d|2[0-3]):[0-5]\d$/;

const trimmed = (value: string): string => value.trim();

export const createMockAdapter = (options: MockAdapterOptions): MockAdapter => {
  const storage = options.storage ?? createDefaultStorage();
  const storageKey = options.storageKey ?? MOCK_STORAGE_KEY;
  const random = options.random ?? Math.random;
  const sleep = options.sleep ?? realSleep;
  const clock = options.now ?? ((): Date => new Date());
  const delay = createDelay({ range: options.latency ?? DEFAULT_LATENCY, random, sleep });
  const me = options.currentUserId;

  let state: MockState | null = null;
  let loading: Promise<MockState> | null = null;

  const nowIso = (): string => clock().toISOString();

  const freshState = (): MockState => ({
    /*
     * Cloned, because the seed is a module-level constant shared by every adapter in the
     * process. A mock that mutated it would leak one test's writes into the next, and one
     * browser tab's into another after a hot reload.
     */
    tables: { ...EMPTY_TABLES, ...clone(options.seed) },
    deviceId: createDeviceId(random),
    nextId: 1,
  });

  /**
   * The tail of the write chain. Every `persist` joins it, so writes reach the store in the
   * order they were issued rather than in whatever order the store finishes them.
   *
   * Ordering is what makes the reset guard in `commit` complete. Without it the guard only
   * closes half the race: a commit that passed the check can still have its `storage.write`
   * in flight when `resetDemoData` writes the fresh snapshot, and if the older write finishes
   * last the pre-reset tables are what survive on disk. The guard decides *whether* to write;
   * this decides *when*, and both are needed to say the reset wins.
   */
  let writes: Promise<void> = Promise.resolve();

  /**
   * Not `async`: the payload is serialised and the write is queued in the same synchronous turn
   * as the call. That is what gives the ordering its meaning — a commit that passed the guard
   * has necessarily queued before `resetDemoData` could change `state` and queue its own write,
   * so the reset's snapshot is always the later one.
   */
  const persist = (current: MockState): Promise<void> => {
    const payload = serialiseSnapshot({
      version: MOCK_SNAPSHOT_VERSION,
      deviceId: current.deviceId,
      nextId: current.nextId,
      tables: current.tables,
    });
    /* A rejected write must not poison the queue for every write after it, but the caller that
       issued it still sees its own failure. */
    writes = writes.then(
      () => storage.write(storageKey, payload),
      () => storage.write(storageKey, payload),
    );
    return writes;
  };

  const readState = async (): Promise<MockState> => {
    const raw = await storage.read(storageKey);
    const snapshot = raw === null ? null : parseSnapshot(raw);
    if (snapshot !== null) {
      return { tables: snapshot.tables, deviceId: snapshot.deviceId, nextId: snapshot.nextId };
    }
    const fresh = freshState();
    await persist(fresh);
    return fresh;
  };

  /**
   * Memoised on the promise rather than on the result, so two repository calls racing on first
   * paint read storage once. Reading it twice would seed twice and lose whichever write lost.
   */
  const load = async (): Promise<MockState> => {
    if (state !== null) return state;
    loading ??= readState();
    state = await loading;
    return state;
  };

  const commit = async (current: MockState, patch: Partial<MockTables>): Promise<boolean> => {
    /*
     * A write belongs to the state it was read from. `resetDemoData` replaces `state` wholesale,
     * and every operation is holding its `current` across a simulated delay of up to 240 ms — so
     * a moderation that started before the reset would otherwise resume afterwards and persist
     * its pre-reset tables over the fresh snapshot. In-memory state would still look reset and
     * the next reload would restore the dataset the user asked to throw away, which is the worst
     * shape a bug can have: invisible until the app restarts.
     *
     * Dropping the write is the whole fix. The operation was issued against a dataset that no
     * longer exists, so there is nothing to merge it into and nothing to tell the caller — a
     * reset is a discard, and this write is part of what was discarded.
     */
    if (current !== state) return false;
    current.tables = { ...current.tables, ...patch };
    await persist(current);
    return true;
  };

  /**
   * Ids for rows the demo creates. The counter is persisted with the tables, so a reload does not
   * hand out an id a previous session already used — and the `m` marks a row as one a person made
   * rather than one the fixtures shipped, which is what makes a demo dataset readable afterwards.
   */
  const mint = (current: MockState, prefix: string): string => {
    current.nextId += 1;
    return `${prefix}_m${current.nextId.toString().padStart(5, '0')}`;
  };

  /** The delay is paid before the access check, because a real request fails slowly too. */
  const scope = async (
    tenantId: TenantId,
    action: string,
  ): Promise<{ readonly current: MockState; readonly membership: MembershipRow }> => {
    const current = await load();
    await delay();
    const membership = requireMembership(current.tables.memberships, tenantId, me, action);
    return { current, membership };
  };

  /*
   * Annotated on the binding rather than only on the arrow: TypeScript narrows control flow past
   * a never-returning call only when the callee is a name with an explicit type annotation. Drop
   * the annotation and every `if (x === undefined) invalid(…)` below stops narrowing `x`.
   */
  const invalid: (issues: readonly ValidationIssue[]) => never = (issues) => {
    throw new ValidationError(issues);
  };

  const requireText = (value: string, path: string, maxLength: number): string => {
    const text = trimmed(value);
    if (text.length === 0) invalid([{ path, message: 'Must not be empty' }]);
    if (text.length > maxLength) {
      invalid([{ path, message: `Must be at most ${String(maxLength)} characters` }]);
    }
    return text;
  };

  const inTenant = <TRow extends { readonly tenant_id: TenantId }>(
    rows: readonly TRow[],
    tenantId: TenantId,
  ): readonly TRow[] => rows.filter((row) => row.tenant_id === tenantId);

  const found = <TRow>(row: TRow | undefined, entity: string, id: string): TRow => {
    if (row === undefined) throw new NotFoundError({ entity, id });
    return row;
  };

  const mapPage = <TRow, TItem>(page: Page<TRow>, map: (row: TRow) => TItem): Page<TItem> => ({
    items: page.items.map(map),
    nextCursor: page.nextCursor,
  });

  const replace = <TRow>(
    rows: readonly TRow[],
    match: (row: TRow) => boolean,
    next: TRow,
  ): readonly TRow[] => rows.map((row) => (match(row) ? next : row));

  /* -------------------------------------------------------------------------------------------
   * Personas — resolved lazily, because a device that has never posted still has to have a mask
   * before the composer can show it.
   * ----------------------------------------------------------------------------------------- */

  const currentPersona = async (current: MockState, tenantId: TenantId): Promise<PersonaRow> => {
    const hash = deviceHashFor(current.deviceId, tenantId);
    const existing = current.tables.personas.find(
      (row) => row.tenant_id === tenantId && row.device_hash === hash && row.retired_at === null,
    );
    if (existing !== undefined) return existing;

    const persona: PersonaRow = {
      id: toPersonaId(mint(current, 'pa')),
      tenant_id: tenantId,
      label: createPersonaLabel(random),
      avatar_key: createAvatarKey(random),
      device_hash: hash,
      retired_at: null,
      created_at: nowIso(),
    };
    await commit(current, { personas: [...current.tables.personas, persona] });
    return persona;
  };

  /* -------------------------------------------------------------------------------------------
   * Visibility helpers. Each returns the rows a caller with this membership may see, which is
   * always a subset of what they asked for and never an error.
   * ----------------------------------------------------------------------------------------- */

  const visibleModeration = (
    membership: MembershipRow,
    asked: readonly ModerationStatus[],
  ): readonly ModerationStatus[] =>
    hasRole(membership, MODERATOR_ROLES) ? asked : asked.filter((status) => status === 'approved');

  const seesEveryTask = (membership: MembershipRow): boolean => hasRole(membership, CREW_ROLES);

  const taskVisible = (row: TaskRow, membership: MembershipRow): boolean =>
    seesEveryTask(membership) || row.visibility === 'public' || row.assignee_user_id === me;

  /* -------------------------------------------------------------------------------------------
   * Repositories
   * ----------------------------------------------------------------------------------------- */

  const tenantById = (current: MockState, tenantId: TenantId): TenantRow =>
    found(
      current.tables.tenants.find((row) => row.id === tenantId),
      'tenant',
      tenantId,
    );

  const directory: DataAdapter['directory'] = {
    bySlug: async (slug: string): Promise<Tenant> => {
      const current = await load();
      await delay();
      const tenant = current.tables.tenants.find((row) => row.slug === slug);
      /*
       * A private event is invisible to anyone outside it, and invisible means "no such slug"
       * rather than "forbidden" — telling an outsider the row exists is the leak. A member
       * resolves it normally, which is what the eventual policy says and what lets an admin open
       * their own unlisted event.
       */
      if (
        tenant === undefined ||
        (tenant.visibility === 'private' &&
          findActiveMembership(current.tables.memberships, tenant.id, me) === null)
      ) {
        throw new NotFoundError({ entity: 'tenant', id: slug });
      }
      return toTenant(tenant);
    },

    listForUser: async (userId: UserId, page?: PageRequest): Promise<Page<Tenant>> => {
      const current = await load();
      await delay();
      /*
       * Cross-tenant by definition, so there is no tenant to check membership in — but "which
       * events am I in" must not become "which events is anyone in". A policy would filter to
       * `auth.uid()`, so this returns nothing for anybody else rather than throwing.
       */
      const mine =
        userId === me
          ? current.tables.memberships.filter(
              (row) => row.user_id === userId && row.status === 'active',
            )
          : [];
      const ids = new Set(mine.map((row) => row.tenant_id));
      return mapPage(
        paginate({
          items: current.tables.tenants.filter((row) => ids.has(row.id)),
          sortKey: (row) => `${row.starts_on ?? '9999-12-31'}|${row.name}`,
          id: (row) => row.id,
          order: 'asc',
          page,
        }),
        toTenant,
      );
    },
  };

  const configRow = (current: MockState, tenantId: TenantId): TenantConfigRow =>
    found(
      current.tables.tenantConfigs.find((row) => row.tenant_id === tenantId),
      'tenant_config',
      tenantId,
    );

  const tenants: DataAdapter['tenants'] = {
    byId: async (tenantId: TenantId): Promise<Tenant> => {
      const { current } = await scope(tenantId, 'tenants.byId');
      return toTenant(tenantById(current, tenantId));
    },

    config: async (tenantId: TenantId) => {
      const { current } = await scope(tenantId, 'tenants.config');
      return toTenantConfigRecord(configRow(current, tenantId));
    },

    saveDraftConfig: async (tenantId: TenantId, draft: TenantConfig) => {
      const { current, membership } = await scope(tenantId, 'tenants.saveDraftConfig');
      requireRole(membership, ADMIN_ROLES, tenantId, 'tenants.saveDraftConfig');
      /*
       * No version check: `TenantConfig.version` is the literal `1`, so a document with any other
       * version cannot be constructed to pass in. When version 2 arrives it becomes a union and a
       * migration belongs here — `@typescript-eslint/no-unnecessary-condition` will point at this
       * comment the moment the check stops being dead code.
       */
      const row = configRow(current, tenantId);
      const next: TenantConfigRow = { ...row, draft_config: draft, updated_at: nowIso() };
      await commit(current, {
        tenantConfigs: replace(
          current.tables.tenantConfigs,
          (candidate) => candidate.tenant_id === tenantId,
          next,
        ),
      });
      return toTenantConfigRecord(next);
    },

    publishConfig: async (tenantId: TenantId, publishedBy: UserId) => {
      const { current, membership } = await scope(tenantId, 'tenants.publishConfig');
      requireRole(membership, ADMIN_ROLES, tenantId, 'tenants.publishConfig');
      const row = configRow(current, tenantId);
      const next: TenantConfigRow = {
        ...row,
        /* Cloned: draft and published must not end up sharing one object that later edits mutate. */
        published_config: clone(row.draft_config),
        published_at: nowIso(),
        published_by: publishedBy,
        updated_at: nowIso(),
      };
      await commit(current, {
        tenantConfigs: replace(
          current.tables.tenantConfigs,
          (candidate) => candidate.tenant_id === tenantId,
          next,
        ),
      });
      return toTenantConfigRecord(next);
    },
  };

  /**
   * Who is in this event's directory: active members, and nobody else.
   *
   * `status` is the whole point. `access.ts` already refuses an invitation as membership, and
   * `directory.listForUser` already filters on `active` — this helper missing the same check is
   * what let a person keep their entry in the guest list after `memberships.revoke`, which is
   * the one operation whose entire purpose is to take it away.
   */
  const memberUserIds = (current: MockState, tenantId: TenantId): ReadonlySet<UserId> =>
    new Set(
      current.tables.memberships
        .filter((row) => row.tenant_id === tenantId && row.status === 'active')
        .flatMap((row) => (row.user_id === null ? [] : [row.user_id])),
    );

  const users: DataAdapter['users'] = {
    byId: async (tenantId: TenantId, userId: UserId) => {
      const { current } = await scope(tenantId, 'users.byId');
      /*
       * You may read a person because you share an event with them. A user with no membership
       * here is not "forbidden", they are simply not in this event's directory — which is the
       * same answer the policy gives, and keeps the guest list from becoming a platform-wide one.
       */
      if (!memberUserIds(current, tenantId).has(userId)) {
        throw new NotFoundError({ entity: 'user', id: userId });
      }
      return toUser(
        found(
          current.tables.users.find((row) => row.id === userId),
          'user',
          userId,
        ),
      );
    },

    list: async (tenantId: TenantId, page?: PageRequest) => {
      const { current } = await scope(tenantId, 'users.list');
      const ids = memberUserIds(current, tenantId);
      return mapPage(
        paginate({
          items: current.tables.users.filter((row: UserRow) => ids.has(row.id)),
          sortKey: (row) => row.display_name.toLowerCase(),
          id: (row) => row.id,
          order: 'asc',
          page,
        }),
        toUser,
      );
    },
  };

  const membershipById = (
    current: MockState,
    tenantId: TenantId,
    id: MembershipId,
  ): MembershipRow =>
    found(
      current.tables.memberships.find((row) => row.id === id && row.tenant_id === tenantId),
      'membership',
      id,
    );

  const saveMembership = (current: MockState, next: MembershipRow): Promise<boolean> =>
    commit(current, {
      memberships: replace(current.tables.memberships, (row) => row.id === next.id, next),
    });

  /**
   * An invitation's email and phone number are the one piece of personal data in this schema
   * that belongs to somebody who has not joined yet, and who therefore never agreed to be in
   * this event's directory. Only an event admin sees them.
   *
   * Redacting rather than filtering for the accepted rows: a membership keeps `invited_email`
   * after it is accepted, so filtering only `invited` rows would still have handed every
   * member's contact address to any attendee who asked for `statuses: ['active']`.
   */
  const withoutInviteContact = (row: MembershipRow): MembershipRow => ({
    ...row,
    invited_email: null,
    invited_phone: null,
  });

  const memberships: DataAdapter['memberships'] = {
    list: async (
      tenantId: TenantId,
      query: MembershipQuery,
      page?: PageRequest,
    ): Promise<Page<Membership>> => {
      const { current, membership } = await scope(tenantId, 'memberships.list');
      /*
       * Not `requireRole`: a member listing the people at an event is ordinary, and the guest
       * list is not the secret. The pending invitations are — an invited row is a person who has
       * not joined, so a non-admin does not see the row at all, and never sees contact details.
       */
      const admin = hasRole(membership, ADMIN_ROLES);
      return mapPage(
        paginate({
          items: inTenant(current.tables.memberships, tenantId)
            .filter(
              (row) =>
                query.roles.includes(row.role) &&
                query.statuses.includes(row.status) &&
                (admin || row.status !== 'invited'),
            )
            .map((row) => (admin ? row : withoutInviteContact(row))),
          sortKey: (row) => timestampKey(row.created_at, 'membership.created_at'),
          id: (row) => row.id,
          order: 'asc',
          page,
        }),
        toMembership,
      );
    },

    /**
     * Deliberately outside `scope()`. "Am I in this event?" is the question the join screen asks
     * *before* it knows, and answering it with `ForbiddenError` would make the one method that
     * exists to detect non-membership fail for every non-member.
     */
    findForUser: async (tenantId: TenantId, userId: UserId): Promise<Membership | null> => {
      const current = await load();
      await delay();
      if (userId !== me) {
        requireMembership(current.tables.memberships, tenantId, me, 'memberships.findForUser');
      }
      const row = current.tables.memberships.find(
        (candidate) => candidate.tenant_id === tenantId && candidate.user_id === userId,
      );
      if (row === undefined) return null;
      /* Your own membership is yours to read in full; anyone else's contact details are the
         admin's, by the same rule `memberships.list` applies. */
      const caller = findActiveMembership(current.tables.memberships, tenantId, me);
      const admin = caller !== null && hasRole(caller, ADMIN_ROLES);
      return toMembership(admin || row.user_id === me ? row : withoutInviteContact(row));
    },

    invite: async (tenantId: TenantId, invite: MembershipInvite): Promise<Membership> => {
      const { current, membership } = await scope(tenantId, 'memberships.invite');
      requireRole(membership, ADMIN_ROLES, tenantId, 'memberships.invite');
      const email = invite.email === null ? null : trimmed(invite.email);
      const phone = invite.phone === null ? null : trimmed(invite.phone);
      if ((email === null || email === '') && (phone === null || phone === '')) {
        invalid([
          { path: 'invite.email', message: 'An invite needs an email or a phone number' },
          { path: 'invite.phone', message: 'An invite needs an email or a phone number' },
        ]);
      }
      const at = nowIso();
      const row: MembershipRow = {
        id: toMembershipId(mint(current, 'mb')),
        tenant_id: tenantId,
        user_id: null,
        invited_email: email === '' ? null : email,
        invited_phone: phone === '' ? null : phone,
        role: invite.role,
        status: 'invited',
        invited_by: me,
        invited_at: at,
        accepted_at: null,
        created_at: at,
        updated_at: at,
      };
      await commit(current, { memberships: [...current.tables.memberships, row] });
      return toMembership(row);
    },

    setRole: async (tenantId: TenantId, id: MembershipId, role): Promise<Membership> => {
      const { current, membership } = await scope(tenantId, 'memberships.setRole');
      requireRole(membership, ADMIN_ROLES, tenantId, 'memberships.setRole');
      const next: MembershipRow = {
        ...membershipById(current, tenantId, id),
        role,
        updated_at: nowIso(),
      };
      await saveMembership(current, next);
      return toMembership(next);
    },

    revoke: async (tenantId: TenantId, id: MembershipId): Promise<Membership> => {
      const { current, membership } = await scope(tenantId, 'memberships.revoke');
      requireRole(membership, ADMIN_ROLES, tenantId, 'memberships.revoke');
      const next: MembershipRow = {
        ...membershipById(current, tenantId, id),
        status: 'revoked',
        updated_at: nowIso(),
      };
      await saveMembership(current, next);
      return toMembership(next);
    },
  };

  const approvals: DataAdapter['approvals'] = {
    list: async (tenantId: TenantId, page?: PageRequest) => {
      const { current, membership } = await scope(tenantId, 'approvals.list');
      requireRole(membership, ADMIN_ROLES, tenantId, 'approvals.list');
      return mapPage(
        paginate({
          items: inTenant(current.tables.approvalRequests, tenantId),
          sortKey: (row) => timestampKey(row.requested_at, 'approvalRequest.requested_at'),
          id: (row) => row.id,
          order: 'desc',
          page,
        }),
        toApprovalRequest,
      );
    },

    submit: async (tenantId: TenantId, note: string | null) => {
      const { current, membership } = await scope(tenantId, 'approvals.submit');
      requireRole(membership, ADMIN_ROLES, tenantId, 'approvals.submit');
      const at = nowIso();
      const row: ApprovalRequestRow = {
        id: approvalRequestId(mint(current, 'ar')),
        tenant_id: tenantId,
        status: 'pending',
        requested_by: me,
        requested_at: at,
        reviewed_by: null,
        reviewed_at: null,
        note: note === null ? null : trimmed(note),
        created_at: at,
      };
      await commit(current, { approvalRequests: [...current.tables.approvalRequests, row] });
      return toApprovalRequest(row);
    },

    decide: async (
      tenantId: TenantId,
      requestId: ApprovalRequestId,
      decision: ApprovalDecision,
    ) => {
      const { current, membership } = await scope(tenantId, 'approvals.decide');
      requireRole(membership, ADMIN_ROLES, tenantId, 'approvals.decide');
      const row = found(
        current.tables.approvalRequests.find(
          (candidate) => candidate.id === requestId && candidate.tenant_id === tenantId,
        ),
        'approval_request',
        requestId,
      );
      if (row.status !== 'pending') {
        invalid([{ path: 'requestId', message: `Request was already ${row.status}` }]);
      }
      const next: ApprovalRequestRow = {
        ...row,
        status: decision.status,
        reviewed_by: me,
        reviewed_at: nowIso(),
        note: decision.note === null ? null : trimmed(decision.note),
      };
      await commit(current, {
        approvalRequests: replace(
          current.tables.approvalRequests,
          (candidate) => candidate.id === requestId,
          next,
        ),
      });
      return toApprovalRequest(next);
    },
  };

  const venues: DataAdapter['venues'] = {
    list: async (tenantId: TenantId, page?: PageRequest): Promise<Page<Venue>> => {
      const { current } = await scope(tenantId, 'venues.list');
      return mapPage(
        paginate({
          items: inTenant(current.tables.venues, tenantId),
          sortKey: (row: VenueRow) => numericKey(row.sort_order, 'venue.sort_order'),
          id: (row) => row.id,
          order: 'asc',
          page,
        }),
        toVenue,
      );
    },

    byId: async (tenantId: TenantId, venueId: VenueId): Promise<Venue> => {
      const { current } = await scope(tenantId, 'venues.byId');
      return toVenue(
        found(
          current.tables.venues.find((row) => row.id === venueId && row.tenant_id === tenantId),
          'venue',
          venueId,
        ),
      );
    },
  };

  /** Published sessions are all a non-crew member ever sees, whatever `statuses` asked for. */
  const sessionsVisibleTo = (
    current: MockState,
    tenantId: TenantId,
    membership: MembershipRow,
  ): readonly SessionRow[] =>
    inTenant(current.tables.sessions, tenantId).filter(
      (row) => hasRole(membership, CREW_ROLES) || row.status === 'published',
    );

  const sessions: DataAdapter['sessions'] = {
    list: async (
      tenantId: TenantId,
      query: SessionQuery,
      page?: PageRequest,
    ): Promise<Page<Session>> => {
      const { current, membership } = await scope(tenantId, 'sessions.list');
      return mapPage(
        paginate({
          items: sessionsVisibleTo(current, tenantId, membership).filter(
            (row) =>
              query.statuses.includes(row.status) &&
              (query.track === null || row.track === query.track),
          ),
          sortKey: (row) =>
            `${timestampKey(row.starts_at, 'session.starts_at')}|${numericKey(row.sort_order, 'session.sort_order')}`,
          id: (row) => row.id,
          order: 'asc',
          page,
        }),
        toSession,
      );
    },

    byId: async (tenantId: TenantId, id: SessionId): Promise<Session> => {
      const { current, membership } = await scope(tenantId, 'sessions.byId');
      return toSession(
        found(
          sessionsVisibleTo(current, tenantId, membership).find((row) => row.id === id),
          'session',
          id,
        ),
      );
    },

    peopleFor: async (tenantId: TenantId, id: SessionId, page?: PageRequest) => {
      const { current, membership } = await scope(tenantId, 'sessions.peopleFor');
      found(
        sessionsVisibleTo(current, tenantId, membership).find((row) => row.id === id),
        'session',
        id,
      );
      return mapPage(
        paginate({
          items: current.tables.sessionPeople.filter(
            (row) => row.tenant_id === tenantId && row.session_id === id,
          ),
          sortKey: (row) => numericKey(row.sort_order, 'sessionPerson.sort_order'),
          id: (row) => row.person_id,
          order: 'asc',
          page,
        }),
        toSessionPerson,
      );
    },
  };

  const people: DataAdapter['people'] = {
    list: async (tenantId: TenantId, page?: PageRequest): Promise<Page<Person>> => {
      const { current } = await scope(tenantId, 'people.list');
      return mapPage(
        paginate({
          items: inTenant(current.tables.people, tenantId),
          sortKey: (row: PersonRow) => numericKey(row.sort_order, 'person.sort_order'),
          id: (row) => row.id,
          order: 'asc',
          page,
        }),
        toPerson,
      );
    },

    byId: async (tenantId: TenantId, personId: PersonId): Promise<Person> => {
      const { current } = await scope(tenantId, 'people.byId');
      return toPerson(
        found(
          current.tables.people.find((row) => row.id === personId && row.tenant_id === tenantId),
          'person',
          personId,
        ),
      );
    },
  };

  const media: DataAdapter['media'] = {
    list: async (
      tenantId: TenantId,
      query: MediaQuery,
      page?: PageRequest,
    ): Promise<Page<MediaAsset>> => {
      const { current, membership } = await scope(tenantId, 'media.list');
      const statuses = visibleModeration(membership, query.statuses);
      return mapPage(
        paginate({
          items: inTenant(current.tables.mediaAssets, tenantId).filter((row: MediaAssetRow) =>
            statuses.includes(row.status),
          ),
          sortKey: (row) => timestampKey(row.created_at, 'mediaAsset.created_at'),
          id: (row) => row.id,
          order: 'desc',
          page,
        }),
        toMediaAsset,
      );
    },

    byId: async (tenantId: TenantId, id: MediaId): Promise<MediaAsset> => {
      const { current, membership } = await scope(tenantId, 'media.byId');
      const row = current.tables.mediaAssets.find(
        (candidate) => candidate.id === id && candidate.tenant_id === tenantId,
      );
      const visible =
        row !== undefined && (hasRole(membership, MODERATOR_ROLES) || row.status === 'approved');
      return toMediaAsset(found(visible ? row : undefined, 'media_asset', id));
    },
  };

  const personas: DataAdapter['personas'] = {
    current: async (tenantId: TenantId): Promise<Persona> => {
      const { current } = await scope(tenantId, 'personas.current');
      return toPersona(await currentPersona(current, tenantId));
    },

    /**
     * A new mask is a new row (`rows.ts`): the old persona is retired and its posts keep pointing
     * at it. Editing the label in place would rewrite the author of everything already posted.
     */
    reset: async (tenantId: TenantId): Promise<Persona> => {
      const { current } = await scope(tenantId, 'personas.reset');
      const previous = await currentPersona(current, tenantId);
      const retired: PersonaRow = { ...previous, retired_at: nowIso() };
      const next: PersonaRow = {
        id: toPersonaId(mint(current, 'pa')),
        tenant_id: tenantId,
        label: createPersonaLabel(random),
        avatar_key: createAvatarKey(random),
        device_hash: previous.device_hash,
        retired_at: null,
        created_at: nowIso(),
      };
      await commit(current, {
        personas: [
          ...replace(current.tables.personas, (row) => row.id === previous.id, retired),
          next,
        ],
      });
      return toPersona(next);
    },

    byId: async (tenantId: TenantId, id: PersonaId): Promise<Persona> => {
      const { current } = await scope(tenantId, 'personas.byId');
      return toPersona(
        found(
          current.tables.personas.find((row) => row.id === id && row.tenant_id === tenantId),
          'persona',
          id,
        ),
      );
    },
  };

  /**
   * Registered listeners. `subscribe()` below hands them out and takes them back; delivering to
   * them is #36, which owns the emitter and the tests that prove an unsubscribe leaks nothing.
   */
  /**
   * A subscription is a read, so it carries the scope the read had.
   *
   * Tenant, because a listener on one event must never see another's posts — the same rule every
   * query obeys, and the one place it would be easiest to forget, since a listener is registered
   * once and fires forever afterwards.
   *
   * Statuses, resolved through `visibleModeration` at subscribe time rather than taken from the
   * query as written: a guest asking to watch `pending` would otherwise receive other people's
   * unapproved posts live, which is the moderation guarantee (D3) leaking through the one door
   * that is not a query.
   */
  type GossipSubscription = {
    readonly tenantId: TenantId;
    readonly statuses: readonly ModerationStatus[];
    readonly listener: (change: GossipChange) => void;
  };

  const gossipListeners = new Set<GossipSubscription>();

  /**
   * Delivered synchronously, after the write has been persisted.
   *
   * Synchronous because the alternative -- a microtask or a timer -- makes "the post appeared"
   * something a test has to wait for and a screen has to tolerate arriving late. Iterating a
   * copy because a listener is entitled to unsubscribe from inside its own callback, which is
   * what a React effect does when the change it just received unmounts the component.
   */
  const emitGossip = (tenant: TenantId, change: GossipChange): void => {
    for (const subscription of [...gossipListeners]) {
      if (subscription.tenantId !== tenant) continue;
      /* A deletion has no status to filter on. Nothing deletes a gossip post today -- removal
         is `hidden`, which is an update -- so this is the branch that keeps the filter honest
         rather than one anything reaches. */
      if (change.kind !== 'deleted' && !subscription.statuses.includes(change.item.status)) {
        continue;
      }
      subscription.listener(change);
    }
  };

  const gossip: DataAdapter['gossip'] = {
    list: async (
      tenantId: TenantId,
      query: GossipQuery,
      page?: PageRequest,
    ): Promise<Page<GossipPost>> => {
      const { current, membership } = await scope(tenantId, 'gossip.list');
      const statuses = visibleModeration(membership, query.statuses);
      return mapPage(
        paginate({
          items: inTenant(current.tables.gossipPosts, tenantId).filter((row: GossipPostRow) =>
            statuses.includes(row.status),
          ),
          sortKey: (row) => timestampKey(row.created_at, 'gossipPost.created_at'),
          id: (row) => row.id,
          order: 'desc',
          page,
        }),
        toGossipPost,
      );
    },

    byId: async (tenantId: TenantId, id: GossipPostId): Promise<GossipPost> => {
      const { current, membership } = await scope(tenantId, 'gossip.byId');
      const row = current.tables.gossipPosts.find(
        (candidate) => candidate.id === id && candidate.tenant_id === tenantId,
      );
      const visible =
        row !== undefined && (hasRole(membership, MODERATOR_ROLES) || row.status === 'approved');
      return toGossipPost(found(visible ? row : undefined, 'gossip_post', id));
    },

    /**
     * `status` is forced to `pending` and is not a parameter (D3). The eventual `BEFORE INSERT`
     * trigger does the same thing for the same reason: a client that can choose its own
     * moderation status is a client that can skip moderation.
     */
    create: async (tenantId: TenantId, post: NewGossipPost): Promise<GossipPost> => {
      const { current } = await scope(tenantId, 'gossip.create');
      const body = requireText(post.body, 'post.body', MAX_GOSSIP_BODY_LENGTH);
      if (post.mediaId !== null) {
        const attachment = current.tables.mediaAssets.find(
          (row) => row.id === post.mediaId && row.tenant_id === tenantId,
        );
        if (attachment === undefined) {
          invalid([{ path: 'post.mediaId', message: 'No such media in this event' }]);
        }
      }
      const persona = await currentPersona(current, tenantId);
      const row: GossipPostRow = {
        id: toGossipPostId(mint(current, 'gp')),
        tenant_id: tenantId,
        body,
        media_id: post.mediaId,
        persona_id: persona.id,
        author_device_hash: persona.device_hash,
        status: 'pending',
        moderated_by: null,
        moderated_at: null,
        rejection_reason: null,
        reaction_counts: {},
        report_count: 0,
        created_at: nowIso(),
      };
      const created = toGossipPost(row);
      /* Only when the write actually landed. `commit` discards a write whose state a reset has
         replaced, and announcing a post that was never stored would put it on every open board
         until the next reload contradicted it. */
      if (await commit(current, { gossipPosts: [...current.tables.gossipPosts, row] })) {
        emitGossip(tenantId, { kind: 'created', item: created });
      }
      return created;
    },

    moderate: async (
      tenantId: TenantId,
      id: GossipPostId,
      decision: GossipModeration,
    ): Promise<GossipPost> => {
      const { current, membership } = await scope(tenantId, 'gossip.moderate');
      requireRole(membership, MODERATOR_ROLES, tenantId, 'gossip.moderate');
      const row = found(
        current.tables.gossipPosts.find(
          (candidate) => candidate.id === id && candidate.tenant_id === tenantId,
        ),
        'gossip_post',
        id,
      );
      const reason =
        decision.status === 'approved'
          ? null
          : requireText(decision.reason, 'decision.reason', 280);
      const next: GossipPostRow = {
        ...row,
        status: decision.status,
        moderated_by: me,
        moderated_at: nowIso(),
        rejection_reason: reason,
      };
      const moderated = toGossipPost(next);
      if (
        await commit(current, {
          gossipPosts: replace(
            current.tables.gossipPosts,
            (candidate) => candidate.id === id,
            next,
          ),
        })
      ) {
        /*
         * The demo this feature exists for: a post in the queue, approved, appearing on the
         * board without a refresh. It is `updated` rather than `created` even though it is new
         * to the approved list, because the post existed and its status changed -- a board
         * receiving `updated` for something it has not got can insert it, and a queue receiving
         * it for something it has can remove it, which is not true the other way round.
         */
        emitGossip(tenantId, { kind: 'updated', item: moderated });
      }
      return moderated;
    },

    /**
     * Returns nothing, so the reporter never learns the post's `reportCount` and "report this"
     * cannot become a scoreboard. D31's threshold hides an approved post pending review.
     */
    report: async (tenantId: TenantId, id: GossipPostId): Promise<void> => {
      const { current } = await scope(tenantId, 'gossip.report');
      const row = found(
        current.tables.gossipPosts.find(
          (candidate) => candidate.id === id && candidate.tenant_id === tenantId,
        ),
        'gossip_post',
        id,
      );
      const reportCount = row.report_count + 1;
      const next: GossipPostRow = {
        ...row,
        report_count: reportCount,
        status:
          row.status === 'approved' && reportCount >= REPORT_HIDE_THRESHOLD ? 'hidden' : row.status,
      };
      if (
        await commit(current, {
          gossipPosts: replace(
            current.tables.gossipPosts,
            (candidate) => candidate.id === id,
            next,
          ),
        })
      ) {
        /* A report can auto-hide a post (D31), and the board holding it has to hear about that
           as promptly as it would hear about a moderator's decision. */
        emitGossip(tenantId, { kind: 'updated', item: toGossipPost(next) });
      }
    },

    /**
     * Registers a listener and hands back an unsubscribe that is safe to call twice — which React
     * effects do. **Nothing is delivered yet:** the emitter is #36, and building it here would
     * put two issues in one PR (D35). What this does provide is the handshake the signature
     * promises — the promise resolves once the subscription exists, so "connected and quiet" is
     * already distinguishable from "never connected".
     */
    subscribe: async (
      tenantId: TenantId,
      query: GossipQuery,
      listener: (change: GossipChange) => void,
    ): Promise<Unsubscribe> => {
      const { membership } = await scope(tenantId, 'gossip.subscribe');
      const subscription: GossipSubscription = {
        tenantId,
        statuses: visibleModeration(membership, query.statuses),
        listener,
      };
      gossipListeners.add(subscription);

      let closed = false;
      return () => {
        /* Safe to call twice, which React effects do -- and it removes the one registration
           rather than every registration by this callback, so the same function subscribed to
           two events keeps the other. */
        if (closed) return;
        closed = true;
        gossipListeners.delete(subscription);
      };
    },
  };

  const tasks: DataAdapter['tasks'] = {
    list: async (tenantId: TenantId, query: TaskQuery, page?: PageRequest) => {
      const { current, membership } = await scope(tenantId, 'tasks.list');
      return mapPage(
        paginate({
          items: inTenant(current.tables.tasks, tenantId).filter(
            (row) =>
              taskVisible(row, membership) &&
              query.statuses.includes(row.status) &&
              query.visibilities.includes(row.visibility) &&
              (query.assigneeUserId === null || row.assignee_user_id === query.assigneeUserId),
          ),
          sortKey: (row) => numericKey(row.sort_order, 'task.sort_order'),
          id: (row) => row.id,
          order: 'asc',
          page,
        }),
        toTask,
      );
    },

    byId: async (tenantId: TenantId, id: TaskId) => {
      const { current, membership } = await scope(tenantId, 'tasks.byId');
      const row = current.tables.tasks.find(
        (candidate) => candidate.id === id && candidate.tenant_id === tenantId,
      );
      return toTask(
        found(row !== undefined && taskVisible(row, membership) ? row : undefined, 'task', id),
      );
    },

    create: async (tenantId: TenantId, task: NewTask) => {
      const { current, membership } = await scope(tenantId, 'tasks.create');
      requireRole(membership, CREW_ROLES, tenantId, 'tasks.create');
      const title = requireText(task.title, 'task.title', 200);
      if (
        task.sessionId !== null &&
        !current.tables.sessions.some(
          (row) => row.id === task.sessionId && row.tenant_id === tenantId,
        )
      ) {
        invalid([{ path: 'task.sessionId', message: 'No such session in this event' }]);
      }
      if (task.dueAt !== null && Number.isNaN(Date.parse(task.dueAt))) {
        invalid([{ path: 'task.dueAt', message: 'Not an ISO 8601 timestamp' }]);
      }
      if (
        task.remindBeforeMinutes !== null &&
        (!Number.isInteger(task.remindBeforeMinutes) || task.remindBeforeMinutes < 0)
      ) {
        invalid([{ path: 'task.remindBeforeMinutes', message: 'Expected an integer >= 0' }]);
      }
      const at = nowIso();
      const row: TaskRow = {
        id: toTaskId(mint(current, 'tk')),
        tenant_id: tenantId,
        title,
        notes: task.notes === null ? null : trimmed(task.notes),
        assignee_user_id: task.assigneeUserId,
        created_by: me,
        session_id: task.sessionId,
        due_at: task.dueAt,
        remind_before_minutes: task.remindBeforeMinutes,
        status: 'todo',
        visibility: task.visibility,
        priority: task.priority,
        /* New tasks land at the end of the board rather than silently on top of somebody's day. */
        sort_order:
          inTenant(current.tables.tasks, tenantId).reduce(
            (highest, candidate) => Math.max(highest, candidate.sort_order),
            0,
          ) + 1,
        created_at: at,
        updated_at: at,
      };
      await commit(current, { tasks: [...current.tables.tasks, row] });
      return toTask(row);
    },

    /** The assignee may move their own task; everyone else needs a crew role. */
    setStatus: async (tenantId: TenantId, id: TaskId, status: TaskStatus) => {
      const { current, membership } = await scope(tenantId, 'tasks.setStatus');
      const row = found(
        current.tables.tasks.find(
          (candidate) => candidate.id === id && candidate.tenant_id === tenantId,
        ),
        'task',
        id,
      );
      if (row.assignee_user_id !== me) {
        requireRole(membership, CREW_ROLES, tenantId, 'tasks.setStatus');
      }
      const next: TaskRow = { ...row, status, updated_at: nowIso() };
      await commit(current, {
        tasks: replace(current.tables.tasks, (candidate) => candidate.id === id, next),
      });
      return toTask(next);
    },
  };

  const units: DataAdapter['units'] = {
    list: async (tenantId: TenantId, query: UnitQuery, page?: PageRequest): Promise<Page<Unit>> => {
      const { current } = await scope(tenantId, 'units.list');
      return mapPage(
        paginate({
          items: inTenant(current.tables.units, tenantId).filter((row: UnitRow) =>
            query.kinds.includes(row.kind),
          ),
          sortKey: (row) => `${row.kind}|${numericKey(row.sort_order, 'unit.sort_order')}`,
          id: (row) => row.id,
          order: 'asc',
          page,
        }),
        toUnit,
      );
    },

    byId: async (tenantId: TenantId, id: UnitId): Promise<Unit> => {
      const { current } = await scope(tenantId, 'units.byId');
      return toUnit(
        found(
          current.tables.units.find((row) => row.id === id && row.tenant_id === tenantId),
          'unit',
          id,
        ),
      );
    },
  };

  const assignments: DataAdapter['assignments'] = {
    /** Where a guest sleeps is not public. Only the crew sees anyone's placement but their own. */
    list: async (
      tenantId: TenantId,
      query: AssignmentQuery,
      page?: PageRequest,
    ): Promise<Page<Assignment>> => {
      const { current, membership } = await scope(tenantId, 'assignments.list');
      const everyone = hasRole(membership, CREW_ROLES);
      return mapPage(
        paginate({
          items: inTenant(current.tables.assignments, tenantId).filter(
            (row: AssignmentRow) =>
              (everyone || row.user_id === me) &&
              (query.unitId === null || row.unit_id === query.unitId) &&
              (query.userId === null || row.user_id === query.userId),
          ),
          sortKey: (row) => timestampKey(row.created_at, 'assignment.created_at'),
          id: (row) => row.id,
          order: 'asc',
          page,
        }),
        toAssignment,
      );
    },

    assign: async (tenantId: TenantId, assignment: NewAssignment): Promise<Assignment> => {
      const { current, membership } = await scope(tenantId, 'assignments.assign');
      requireRole(membership, CREW_ROLES, tenantId, 'assignments.assign');
      const unit = current.tables.units.find(
        (row) => row.id === assignment.unitId && row.tenant_id === tenantId,
      );
      if (unit === undefined) {
        invalid([{ path: 'assignment.unitId', message: 'No such unit in this event' }]);
      }
      if (findActiveMembership(current.tables.memberships, tenantId, assignment.userId) === null) {
        invalid([{ path: 'assignment.userId', message: 'That person is not in this event' }]);
      }
      const occupants = current.tables.assignments.filter(
        (row) => row.tenant_id === tenantId && row.unit_id === assignment.unitId,
      );
      if (occupants.some((row) => row.user_id === assignment.userId)) {
        invalid([{ path: 'assignment.userId', message: 'Already assigned to this unit' }]);
      }
      /* Null capacity is uncapped; zero would mean nobody fits, which is a different statement. */
      if (unit.capacity !== null && occupants.length >= unit.capacity) {
        invalid([
          {
            path: 'assignment.unitId',
            message: `${unit.label} is full (${String(unit.capacity)})`,
          },
        ]);
      }
      const row: AssignmentRow = {
        id: toAssignmentId(mint(current, 'as')),
        tenant_id: tenantId,
        unit_id: assignment.unitId,
        user_id: assignment.userId,
        note: assignment.note === null ? null : trimmed(assignment.note),
        assigned_by: me,
        created_at: nowIso(),
      };
      await commit(current, { assignments: [...current.tables.assignments, row] });
      return toAssignment(row);
    },

    unassign: async (tenantId: TenantId, id: AssignmentId): Promise<void> => {
      const { current, membership } = await scope(tenantId, 'assignments.unassign');
      requireRole(membership, CREW_ROLES, tenantId, 'assignments.unassign');
      found(
        current.tables.assignments.find((row) => row.id === id && row.tenant_id === tenantId),
        'assignment',
        id,
      );
      await commit(current, {
        assignments: current.tables.assignments.filter((row) => row.id !== id),
      });
    },
  };

  const announcements: DataAdapter['announcements'] = {
    /** Drafts belong to whoever is composing them; `publishedOnly: false` only widens for them. */
    list: async (
      tenantId: TenantId,
      query: AnnouncementQuery,
      page?: PageRequest,
    ): Promise<Page<Announcement>> => {
      const { current, membership } = await scope(tenantId, 'announcements.list');
      const drafts = !query.publishedOnly && hasRole(membership, MODERATOR_ROLES);
      return mapPage(
        paginate({
          items: inTenant(current.tables.announcements, tenantId).filter(
            (row: AnnouncementRow) => drafts || row.published_at !== null,
          ),
          /*
           * Pinned first, then newest. A draft has no `published_at`, so it sorts by when it was
           * created — which is where its author expects to find it.
           */
          sortKey: (row) =>
            `${row.pinned ? '1' : '0'}|${timestampKey(row.published_at ?? row.created_at, 'announcement.published_at')}`,
          id: (row) => row.id,
          order: 'desc',
          page,
        }),
        toAnnouncement,
      );
    },

    byId: async (tenantId: TenantId, id: AnnouncementId): Promise<Announcement> => {
      const { current, membership } = await scope(tenantId, 'announcements.byId');
      const row = current.tables.announcements.find(
        (candidate) => candidate.id === id && candidate.tenant_id === tenantId,
      );
      const visible =
        row !== undefined && (row.published_at !== null || hasRole(membership, MODERATOR_ROLES));
      return toAnnouncement(found(visible ? row : undefined, 'announcement', id));
    },

    create: async (tenantId: TenantId, announcement: NewAnnouncement): Promise<Announcement> => {
      const { current, membership } = await scope(tenantId, 'announcements.create');
      requireRole(membership, ADMIN_ROLES, tenantId, 'announcements.create');
      const at = nowIso();
      const row: AnnouncementRow = {
        id: toAnnouncementId(mint(current, 'an')),
        tenant_id: tenantId,
        title: requireText(announcement.title, 'announcement.title', 120),
        body: requireText(announcement.body, 'announcement.body', 2000),
        published_at: null,
        pinned: announcement.pinned,
        created_by: me,
        created_at: at,
        updated_at: at,
      };
      await commit(current, { announcements: [...current.tables.announcements, row] });
      return toAnnouncement(row);
    },

    publish: async (tenantId: TenantId, id: AnnouncementId): Promise<Announcement> => {
      const { current, membership } = await scope(tenantId, 'announcements.publish');
      requireRole(membership, ADMIN_ROLES, tenantId, 'announcements.publish');
      const row = found(
        current.tables.announcements.find(
          (candidate) => candidate.id === id && candidate.tenant_id === tenantId,
        ),
        'announcement',
        id,
      );
      if (row.published_at !== null) {
        invalid([{ path: 'announcementId', message: 'Already published' }]);
      }
      const at = nowIso();
      const next: AnnouncementRow = { ...row, published_at: at, updated_at: at };
      await commit(current, {
        announcements: replace(
          current.tables.announcements,
          (candidate) => candidate.id === id,
          next,
        ),
      });
      return toAnnouncement(next);
    },
  };

  const rsvps: DataAdapter['rsvps'] = {
    list: async (tenantId: TenantId, query: RsvpQuery, page?: PageRequest): Promise<Page<Rsvp>> => {
      const { current, membership } = await scope(tenantId, 'rsvps.list');
      const everyone = hasRole(membership, CREW_ROLES);
      return mapPage(
        paginate({
          items: inTenant(current.tables.rsvps, tenantId).filter(
            (row: RsvpRow) =>
              (everyone || row.user_id === me) &&
              query.statuses.includes(row.status) &&
              (query.sessionId === null || row.session_id === query.sessionId),
          ),
          sortKey: (row) => timestampKey(row.responded_at, 'rsvp.responded_at'),
          id: (row) => `${row.user_id}|${row.session_id}`,
          order: 'desc',
          page,
        }),
        toRsvp,
      );
    },

    findForUser: async (tenantId: TenantId, userId: UserId, sessionId: SessionId) => {
      const { current, membership } = await scope(tenantId, 'rsvps.findForUser');
      if (userId !== me) requireRole(membership, CREW_ROLES, tenantId, 'rsvps.findForUser');
      const row = current.tables.rsvps.find(
        (candidate) =>
          candidate.tenant_id === tenantId &&
          candidate.user_id === userId &&
          candidate.session_id === sessionId,
      );
      return row === undefined ? null : toRsvp(row);
    },

    /** An upsert: changing your mind is the normal case, not an edit of a record. */
    set: async (tenantId: TenantId, userId: UserId, rsvp: RsvpInput): Promise<Rsvp> => {
      const { current, membership } = await scope(tenantId, 'rsvps.set');
      if (userId !== me) requireRole(membership, CREW_ROLES, tenantId, 'rsvps.set');
      if (!Number.isInteger(rsvp.guestCount) || rsvp.guestCount < 0) {
        invalid([{ path: 'rsvp.guestCount', message: 'Expected an integer >= 0' }]);
      }
      if (
        !current.tables.sessions.some(
          (row) => row.id === rsvp.sessionId && row.tenant_id === tenantId,
        )
      ) {
        invalid([{ path: 'rsvp.sessionId', message: 'No such session in this event' }]);
      }
      const row: RsvpRow = {
        tenant_id: tenantId,
        user_id: userId,
        session_id: rsvp.sessionId,
        status: rsvp.status,
        guest_count: rsvp.guestCount,
        responded_at: nowIso(),
      };
      const isSame = (candidate: RsvpRow): boolean =>
        candidate.tenant_id === tenantId &&
        candidate.user_id === userId &&
        candidate.session_id === rsvp.sessionId;
      await commit(current, {
        rsvps: current.tables.rsvps.some(isSame)
          ? replace(current.tables.rsvps, isSame, row)
          : [...current.tables.rsvps, row],
      });
      return toRsvp(row);
    },
  };

  const notificationPreferences: DataAdapter['notificationPreferences'] = {
    /**
     * Never `null`. A user who has not opened the settings screen has the event's defaults, and
     * modelling that as a missing row would make every caller reimplement them.
     */
    get: async (tenantId: TenantId, userId: UserId): Promise<NotificationPreferences> => {
      const { current, membership } = await scope(tenantId, 'notificationPreferences.get');
      if (userId !== me) {
        requireRole(membership, ADMIN_ROLES, tenantId, 'notificationPreferences.get');
      }
      const row = current.tables.notificationPreferences.find(
        (candidate) => candidate.tenant_id === tenantId && candidate.user_id === userId,
      );
      if (row !== undefined) return toNotificationPreferences(row);
      return {
        tenantId,
        userId,
        channels: ['in_app'],
        mutedCategories: [],
        defaultReminderMinutes: null,
        quietHours: null,
      };
    },

    save: async (
      tenantId: TenantId,
      userId: UserId,
      preferences: NotificationPreferencesInput,
    ): Promise<NotificationPreferences> => {
      const { current, membership } = await scope(tenantId, 'notificationPreferences.save');
      if (userId !== me) {
        requireRole(membership, ADMIN_ROLES, tenantId, 'notificationPreferences.save');
      }
      if (
        preferences.defaultReminderMinutes !== null &&
        (!Number.isInteger(preferences.defaultReminderMinutes) ||
          preferences.defaultReminderMinutes < 0)
      ) {
        invalid([
          { path: 'preferences.defaultReminderMinutes', message: 'Expected an integer >= 0' },
        ]);
      }
      const quiet = preferences.quietHours;
      if (quiet !== null && (!QUIET_HOURS.test(quiet.start) || !QUIET_HOURS.test(quiet.end))) {
        invalid([{ path: 'preferences.quietHours', message: 'Expected local HH:MM, both ends' }]);
      }
      const at = nowIso();
      const existing = current.tables.notificationPreferences.find(
        (candidate) => candidate.tenant_id === tenantId && candidate.user_id === userId,
      );
      const row: NotificationPreferenceRow = {
        tenant_id: tenantId,
        user_id: userId,
        channels: preferences.channels,
        muted_categories: preferences.mutedCategories,
        default_reminder_minutes: preferences.defaultReminderMinutes,
        quiet_hours_start: quiet === null ? null : quiet.start,
        quiet_hours_end: quiet === null ? null : quiet.end,
        created_at: existing?.created_at ?? at,
        updated_at: at,
      };
      const isSame = (candidate: NotificationPreferenceRow): boolean =>
        candidate.tenant_id === tenantId && candidate.user_id === userId;
      await commit(current, {
        notificationPreferences:
          existing === undefined
            ? [...current.tables.notificationPreferences, row]
            : replace(current.tables.notificationPreferences, isSame, row),
      });
      return toNotificationPreferences(row);
    },
  };

  return {
    directory,
    tenants,
    users,
    memberships,
    approvals,
    venues,
    sessions,
    people,
    media,
    personas,
    gossip,
    tasks,
    units,
    assignments,
    announcements,
    rsvps,
    notificationPreferences,

    ready: async (): Promise<void> => {
      await load();
    },

    resetDemoData: async (): Promise<void> => {
      /*
       * The in-memory state is replaced before the write, so a screen that re-reads while the
       * store is still being written sees the reset dataset rather than the wreck it replaced.
       */
      const fresh = freshState();
      state = fresh;
      loading = Promise.resolve(fresh);
      gossipListeners.clear();
      await persist(fresh);
    },
  };
};
