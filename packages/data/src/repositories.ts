import type {
  AnnouncementId,
  AssignmentId,
  GossipPostId,
  MediaId,
  MembershipId,
  PersonId,
  PersonaId,
  SessionId,
  TenantId,
  TaskId,
  UnitId,
  UserId,
  VenueId,
} from '@occasio/core';
import type { TenantConfig } from './config';
import type {
  Announcement,
  ApprovalRequest,
  Assignment,
  GossipPost,
  MediaAsset,
  Membership,
  NotificationPreferences,
  Person,
  Persona,
  Rsvp,
  Session,
  SessionPerson,
  Task,
  Tenant,
  TenantConfigRecord,
  Unit,
  User,
  Venue,
} from './domain';
import type { Page, PageRequest } from './pagination';
import type {
  ApprovalRequestId,
  ApprovalRequestStatus,
  MembershipRole,
  MembershipStatus,
  ModerationStatus,
  RsvpStatus,
  SessionStatus,
  TaskPriority,
  TaskStatus,
  TaskVisibility,
  Timestamptz,
  UnitKind,
} from './rows';

/**
 * The repository interfaces — the seam that is supposed to make swapping the mock adapter for
 * Supabase a change to one folder and nothing else (D5, D29).
 *
 * There is no implementation here on purpose. The mock arrives in #34, the contract suite that
 * runs against every implementation in #38. What matters at this stage is the shape, because a
 * shape is what the twenty files above the data layer are written against, and every one of the
 * five rules below is cheap now and a repo-wide refactor later:
 *
 *  1. **`tenantId` is the first argument of every method.** Even where it could be read from a
 *     context, a closure or the session. Passing it explicitly mirrors how a row-level security
 *     policy works — the tenant is an argument to the query, not an ambient fact — and it turns
 *     the branded-id types into a compile-time guard: a screen holding the wrong `TenantId` will
 *     not typecheck rather than quietly rendering another event's data. The one exception is
 *     `TenantDirectory`, below, and it exists because you have to find the tenant before you can
 *     pass it.
 *
 *  2. **Every method is `async`.** Including the ones the mock could answer from an array. A
 *     synchronous read is a loading state nobody built, and it is the reason prototypes look
 *     instant in development and broken on a phone at a venue with two bars of signal.
 *
 *  3. **Every collection is a `Page<T>`**, with `PageRequest` as the final argument. Never a
 *     bare array — see `pagination.ts` for why retrofitting this is the expensive one.
 *
 *  4. **`subscribe()` exists on the gossip repository now**, with no implementation behind it
 *     (the mock emitter is #36). Gossip moderation is the realtime demo — a post lands in the
 *     admin's queue live, approval pops it onto the board — and a subscription bolted on later
 *     lands as a second data path beside the queries rather than through them.
 *
 *  5. **Failures are typed** (`errors.ts`). `NotFoundError` when a `byId` finds nothing,
 *     `ForbiddenError` when the caller has no membership in the `tenantId` it passed — the
 *     simulated RLS check — and `ValidationError` for input the adapter refuses.
 *
 * A naming convention runs through everything below, and it is the difference between an
 * expected outcome and a bug: **`byId` throws `NotFoundError`, `find…` returns `T | null`.** A
 * missing session is a broken link; a missing RSVP is somebody who has not answered yet.
 */

/* ---------------------------------------------------------------------------------------------
 * Realtime
 * ------------------------------------------------------------------------------------------- */

/** Closes a subscription. Must be safe to call twice — React effects do exactly that. */
export type Unsubscribe = () => void;

/**
 * One realtime change.
 *
 * A delete carries only the id, because that is all Postgres logical replication hands over
 * unless the table is switched to `REPLICA IDENTITY FULL`. Designing the union around the
 * generous case and discovering the constraint later would mean every listener that read
 * `change.item` on a delete had to be rewritten.
 */
export type Change<TItem, TId extends string> =
  | { readonly kind: 'created'; readonly item: TItem }
  | { readonly kind: 'updated'; readonly item: TItem }
  | { readonly kind: 'deleted'; readonly id: TId };

/* ---------------------------------------------------------------------------------------------
 * The one cross-tenant surface
 * ------------------------------------------------------------------------------------------- */

/**
 * How a caller obtains a `TenantId` in the first place — and therefore the only type in this
 * file whose methods do not start with one.
 *
 * It is a separate type rather than two more methods on `TenantRepository` so that the exception
 * is countable at a glance. Both methods are the moment tenancy is established: `bySlug`
 * resolves `/e/[slug]` (D9), and `listForUser` answers "which events am I in", which is
 * cross-tenant by definition. Everything reachable from either takes the id explicitly.
 *
 * This mirrors `rows.ts`, where the same three tables that carry no `tenant_id` are the ones
 * tenancy is defined in terms of.
 */
export type TenantDirectory = {
  /** Throws `NotFoundError` for an unknown slug, including one that exists but is private. */
  readonly bySlug: (slug: string) => Promise<Tenant>;
  readonly listForUser: (userId: UserId, page?: PageRequest) => Promise<Page<Tenant>>;
};

/* ---------------------------------------------------------------------------------------------
 * The event and its configuration
 * ------------------------------------------------------------------------------------------- */

export type TenantRepository = {
  readonly byId: (tenantId: TenantId) => Promise<Tenant>;
  /** Both halves of D2's draft/published pair — the admin edits one and attendees read the other. */
  readonly config: (tenantId: TenantId) => Promise<TenantConfigRecord>;
  readonly saveDraftConfig: (
    tenantId: TenantId,
    draft: TenantConfig,
  ) => Promise<TenantConfigRecord>;
  /** Copies draft over published and stamps who did it. Throws `ForbiddenError` below admin. */
  readonly publishConfig: (tenantId: TenantId, publishedBy: UserId) => Promise<TenantConfigRecord>;
};

/* ---------------------------------------------------------------------------------------------
 * People and access
 * ------------------------------------------------------------------------------------------- */

/**
 * A user is one account across every event (`UserRow` carries no `tenant_id`), but reading one
 * still takes a `tenantId`: you may see a person because you share an event with them, which is
 * exactly what the eventual RLS policy will say. Scoping the read this way keeps the guest list
 * from becoming a directory of everyone on the platform.
 */
export type UserRepository = {
  readonly byId: (tenantId: TenantId, userId: UserId) => Promise<User>;
  readonly list: (tenantId: TenantId, page?: PageRequest) => Promise<Page<User>>;
};

export type MembershipQuery = {
  readonly roles: readonly MembershipRole[];
  readonly statuses: readonly MembershipStatus[];
};

/** An invite with neither an email nor a phone is a `ValidationError`, not an empty row. */
export type MembershipInvite = {
  readonly email: string | null;
  readonly phone: string | null;
  readonly role: MembershipRole;
};

export type MembershipRepository = {
  readonly list: (
    tenantId: TenantId,
    query: MembershipQuery,
    page?: PageRequest,
  ) => Promise<Page<Membership>>;
  /** `null` for someone who is not in this event — the answer the join screen is asking for. */
  readonly findForUser: (tenantId: TenantId, userId: UserId) => Promise<Membership | null>;
  readonly invite: (tenantId: TenantId, invite: MembershipInvite) => Promise<Membership>;
  readonly setRole: (
    tenantId: TenantId,
    membershipId: MembershipId,
    role: MembershipRole,
  ) => Promise<Membership>;
  readonly revoke: (tenantId: TenantId, membershipId: MembershipId) => Promise<Membership>;
};

/** A decision is never `pending` — that is the state a request starts in, not one it is given. */
export type ApprovalDecision = {
  readonly status: Exclude<ApprovalRequestStatus, 'pending'>;
  readonly note: string | null;
};

/** D25 — the provisioning machine exists from day one even while only a super admin drives it. */
export type ApprovalRequestRepository = {
  readonly list: (tenantId: TenantId, page?: PageRequest) => Promise<Page<ApprovalRequest>>;
  readonly submit: (tenantId: TenantId, note: string | null) => Promise<ApprovalRequest>;
  readonly decide: (
    tenantId: TenantId,
    requestId: ApprovalRequestId,
    decision: ApprovalDecision,
  ) => Promise<ApprovalRequest>;
};

/* ---------------------------------------------------------------------------------------------
 * The schedule (D6, D11)
 * ------------------------------------------------------------------------------------------- */

export type VenueRepository = {
  readonly list: (tenantId: TenantId, page?: PageRequest) => Promise<Page<Venue>>;
  readonly byId: (tenantId: TenantId, venueId: VenueId) => Promise<Venue>;
};

/**
 * `statuses` is required rather than defaulted. The attendee schedule wants `['published']` and
 * the admin editor wants all three, and a default would make the attendee case the one nobody
 * writes down — which is how an unpublished session ends up on the public board.
 */
export type SessionQuery = {
  readonly statuses: readonly SessionStatus[];
  /** A conference track, or `null` for every track. */
  readonly track: string | null;
};

export type SessionRepository = {
  readonly list: (
    tenantId: TenantId,
    query: SessionQuery,
    page?: PageRequest,
  ) => Promise<Page<Session>>;
  readonly byId: (tenantId: TenantId, sessionId: SessionId) => Promise<Session>;
  /** Paged like everything else, even though a session has a handful of speakers today. */
  readonly peopleFor: (
    tenantId: TenantId,
    sessionId: SessionId,
    page?: PageRequest,
  ) => Promise<Page<SessionPerson>>;
};

export type PersonRepository = {
  readonly list: (tenantId: TenantId, page?: PageRequest) => Promise<Page<Person>>;
  readonly byId: (tenantId: TenantId, personId: PersonId) => Promise<Person>;
};

/* ---------------------------------------------------------------------------------------------
 * Media (D22, D27)
 * ------------------------------------------------------------------------------------------- */

export type MediaQuery = { readonly statuses: readonly ModerationStatus[] };

/**
 * Reads only. Uploading goes through the `StorageAdapter` (D27) because the bytes never pass
 * through this layer — the client uploads to storage and this repository learns about the row
 * afterwards. Putting a `upload()` here would make the adapter boundary a lie the first time
 * media moved from Supabase Storage to R2.
 */
export type MediaRepository = {
  readonly list: (
    tenantId: TenantId,
    query: MediaQuery,
    page?: PageRequest,
  ) => Promise<Page<MediaAsset>>;
  readonly byId: (tenantId: TenantId, mediaId: MediaId) => Promise<MediaAsset>;
};

/* ---------------------------------------------------------------------------------------------
 * Gossips (D3, D12, D31 — ADR-0006)
 * ------------------------------------------------------------------------------------------- */

/**
 * The mask this device wears. No method takes a device hash, and that is the whole design: the
 * salted hash is derived inside the adapter, never travels through a signature, and so cannot be
 * logged, cached or rendered by anything above this layer. `current()` is "who am I on this
 * board", `reset()` is the poster retiring a persona and getting a new one.
 */
export type PersonaRepository = {
  readonly current: (tenantId: TenantId) => Promise<Persona>;
  readonly reset: (tenantId: TenantId) => Promise<Persona>;
  readonly byId: (tenantId: TenantId, personaId: PersonaId) => Promise<Persona>;
};

/** `['approved']` is the board, `['pending']` is the moderation queue. */
export type GossipQuery = { readonly statuses: readonly ModerationStatus[] };

/**
 * What a poster supplies, and nothing else. No `status` — every post enters the queue as
 * `pending` and the adapter forces it, exactly as the eventual `BEFORE INSERT` trigger will,
 * because a client that can choose its own moderation status is a client that can skip
 * moderation (D3). No `personaId` and no device hash either; both are the adapter's business.
 */
export type NewGossipPost = { readonly body: string; readonly mediaId: MediaId | null };

/** Rejecting and hiding require a reason; approving does not. */
export type GossipModeration =
  | { readonly status: 'approved' }
  | { readonly status: 'rejected'; readonly reason: string }
  | { readonly status: 'hidden'; readonly reason: string };

export type GossipChange = Change<GossipPost, GossipPostId>;

export type GossipRepository = {
  readonly list: (
    tenantId: TenantId,
    query: GossipQuery,
    page?: PageRequest,
  ) => Promise<Page<GossipPost>>;
  readonly byId: (tenantId: TenantId, gossipPostId: GossipPostId) => Promise<GossipPost>;
  readonly create: (tenantId: TenantId, post: NewGossipPost) => Promise<GossipPost>;
  readonly moderate: (
    tenantId: TenantId,
    gossipPostId: GossipPostId,
    decision: GossipModeration,
  ) => Promise<GossipPost>;
  /**
   * D31. Returns nothing on purpose: handing the reporter back the post would hand them its
   * `reportCount`, which turns "report this" into a scoreboard.
   */
  readonly report: (tenantId: TenantId, gossipPostId: GossipPostId) => Promise<void>;
  /**
   * Live changes matching `query`, for as long as the returned `Unsubscribe` is uncalled.
   *
   * Async because opening a channel is a network handshake, not a registration — Supabase
   * Realtime resolves once the server has acknowledged the subscription, and a caller that
   * cannot await that cannot tell "connected and quiet" from "never connected".
   */
  readonly subscribe: (
    tenantId: TenantId,
    query: GossipQuery,
    listener: (change: GossipChange) => void,
  ) => Promise<Unsubscribe>;
};

/* ---------------------------------------------------------------------------------------------
 * Tasks (D13)
 * ------------------------------------------------------------------------------------------- */

export type TaskQuery = {
  readonly statuses: readonly TaskStatus[];
  /** `['public']` is the attendee's action list; `['crew', 'private']` is the crew board. */
  readonly visibilities: readonly TaskVisibility[];
  /** `null` for every assignee, including unassigned. */
  readonly assigneeUserId: UserId | null;
};

export type NewTask = {
  readonly title: string;
  readonly notes: string | null;
  readonly assigneeUserId: UserId | null;
  /** The link that makes a reminder personal (D13) — "your speech is in 30 minutes". */
  readonly sessionId: SessionId | null;
  readonly dueAt: Timestamptz | null;
  readonly remindBeforeMinutes: number | null;
  readonly visibility: TaskVisibility;
  readonly priority: TaskPriority;
};

export type TaskRepository = {
  readonly list: (tenantId: TenantId, query: TaskQuery, page?: PageRequest) => Promise<Page<Task>>;
  readonly byId: (tenantId: TenantId, taskId: TaskId) => Promise<Task>;
  readonly create: (tenantId: TenantId, task: NewTask) => Promise<Task>;
  readonly setStatus: (tenantId: TenantId, taskId: TaskId, status: TaskStatus) => Promise<Task>;
};

/* ---------------------------------------------------------------------------------------------
 * Assignments — seating, rooms, shuttles (D24)
 * ------------------------------------------------------------------------------------------- */

export type UnitQuery = { readonly kinds: readonly UnitKind[] };

export type UnitRepository = {
  readonly list: (tenantId: TenantId, query: UnitQuery, page?: PageRequest) => Promise<Page<Unit>>;
  readonly byId: (tenantId: TenantId, unitId: UnitId) => Promise<Unit>;
};

export type AssignmentQuery = {
  readonly unitId: UnitId | null;
  readonly userId: UserId | null;
};

export type NewAssignment = {
  readonly unitId: UnitId;
  readonly userId: UserId;
  readonly note: string | null;
};

export type AssignmentRepository = {
  readonly list: (
    tenantId: TenantId,
    query: AssignmentQuery,
    page?: PageRequest,
  ) => Promise<Page<Assignment>>;
  readonly assign: (tenantId: TenantId, assignment: NewAssignment) => Promise<Assignment>;
  readonly unassign: (tenantId: TenantId, assignmentId: AssignmentId) => Promise<void>;
};

/* ---------------------------------------------------------------------------------------------
 * Announcements and RSVPs (D22)
 * ------------------------------------------------------------------------------------------- */

/** Attendees pass `true`; the admin composer passes `false` to see its own drafts. */
export type AnnouncementQuery = { readonly publishedOnly: boolean };

export type NewAnnouncement = {
  readonly title: string;
  readonly body: string;
  readonly pinned: boolean;
};

export type AnnouncementRepository = {
  readonly list: (
    tenantId: TenantId,
    query: AnnouncementQuery,
    page?: PageRequest,
  ) => Promise<Page<Announcement>>;
  readonly byId: (tenantId: TenantId, announcementId: AnnouncementId) => Promise<Announcement>;
  readonly create: (tenantId: TenantId, announcement: NewAnnouncement) => Promise<Announcement>;
  readonly publish: (tenantId: TenantId, announcementId: AnnouncementId) => Promise<Announcement>;
};

export type RsvpQuery = {
  readonly sessionId: SessionId | null;
  readonly statuses: readonly RsvpStatus[];
};

export type RsvpInput = {
  readonly sessionId: SessionId;
  readonly status: RsvpStatus;
  readonly guestCount: number;
};

export type RsvpRepository = {
  readonly list: (tenantId: TenantId, query: RsvpQuery, page?: PageRequest) => Promise<Page<Rsvp>>;
  /** `null` is "has not answered", which is a different screen from "said no". */
  readonly findForUser: (
    tenantId: TenantId,
    userId: UserId,
    sessionId: SessionId,
  ) => Promise<Rsvp | null>;
  /** Upsert — an attendee changing their mind is the normal case, not an edit of a record. */
  readonly set: (tenantId: TenantId, userId: UserId, rsvp: RsvpInput) => Promise<Rsvp>;
};

/* ---------------------------------------------------------------------------------------------
 * Notification preferences
 * ------------------------------------------------------------------------------------------- */

/** The row's identity is `(tenant, user)`, so the writable half is everything else. */
export type NotificationPreferencesInput = Omit<NotificationPreferences, 'tenantId' | 'userId'>;

/**
 * Preferences only. Deliveries themselves are the outbox (D26) — written by `pg_cron` and an
 * Edge Function, never by a client — so there is deliberately no `NotificationDeliveryRepository`
 * here. Device tokens land with push in Phase 2 (D22) and belong to a user rather than an event,
 * which is why they are not in this file's tenant-first shape.
 */
export type NotificationPreferenceRepository = {
  readonly get: (tenantId: TenantId, userId: UserId) => Promise<NotificationPreferences>;
  readonly save: (
    tenantId: TenantId,
    userId: UserId,
    preferences: NotificationPreferencesInput,
  ) => Promise<NotificationPreferences>;
};

/* ---------------------------------------------------------------------------------------------
 * The swap point
 * ------------------------------------------------------------------------------------------- */

/**
 * Everything the layer above is allowed to reach, in one value.
 *
 * This is what §6 means by "the single swap point": the mock adapter and the Supabase adapter
 * each produce one of these, the app is handed one at its root, and swapping them changes no
 * screen, no hook and no query key — only which factory was called. Because the object is
 * assembled rather than imported, a test can also hand a screen a partial fake without the
 * module mocking that makes suites brittle.
 */
export type DataAdapter = {
  readonly directory: TenantDirectory;
  readonly tenants: TenantRepository;
  readonly users: UserRepository;
  readonly memberships: MembershipRepository;
  readonly approvals: ApprovalRequestRepository;
  readonly venues: VenueRepository;
  readonly sessions: SessionRepository;
  readonly people: PersonRepository;
  readonly media: MediaRepository;
  readonly personas: PersonaRepository;
  readonly gossip: GossipRepository;
  readonly tasks: TaskRepository;
  readonly units: UnitRepository;
  readonly assignments: AssignmentRepository;
  readonly announcements: AnnouncementRepository;
  readonly rsvps: RsvpRepository;
  readonly notificationPreferences: NotificationPreferenceRepository;
};
