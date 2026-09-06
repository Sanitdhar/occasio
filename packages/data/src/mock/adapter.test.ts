import { describe, expect, it } from '@jest/globals';
import { membershipId, tenantId, userId } from '@occasio/core';
import { MEMBERSHIP_ROLES } from '../rows';
import type { MembershipRole, MembershipRow, MembershipStatus, UserRow } from '../rows';
import { createMockAdapter, type MockAdapter } from './adapter';
import { createMemoryStorage } from './storage';
import { EMPTY_TABLES, type MockSeed } from './tables';

/**
 * Behavioural tests for the adapter, run against an in-memory store with the latency turned off.
 *
 * They cover the decisions that are invisible in the types and expensive to get wrong: who
 * appears in a directory, who may read an invitation, and what happens to a write whose dataset
 * was thrown away while it was in flight.
 */

const WEDDING = tenantId('t_wedding');
const ADMIN = userId('u_admin');
const GUEST = userId('u_guest');
const GONE = userId('u_gone');
const AT: MembershipRow['created_at'] = '2026-06-01T12:00:00.000Z';

const user = (id: UserRow['id'], name: string): UserRow => ({
  id,
  email: `${name}@example.test`,
  display_name: name,
  avatar_media_id: null,
  locale: null,
  created_at: AT,
  updated_at: AT,
});

const member = (
  id: string,
  who: MembershipRow['user_id'],
  role: MembershipRole,
  status: MembershipStatus,
  invited?: { readonly email: string | null; readonly phone: string | null },
): MembershipRow => ({
  id: membershipId(id),
  tenant_id: WEDDING,
  user_id: who,
  invited_email: invited?.email ?? null,
  invited_phone: invited?.phone ?? null,
  role,
  status,
  invited_by: null,
  invited_at: null,
  accepted_at: null,
  created_at: AT,
  updated_at: AT,
});

const SEED: MockSeed = {
  ...EMPTY_TABLES,
  users: [user(ADMIN, 'admin'), user(GUEST, 'guest'), user(GONE, 'gone')],
  memberships: [
    member('mb_admin', ADMIN, 'event_admin', 'active'),
    member('mb_guest', GUEST, 'attendee', 'active', { email: 'guest@example.test', phone: null }),
    member('mb_gone', GONE, 'attendee', 'revoked'),
    member('mb_invite', null, 'attendee', 'invited', {
      email: 'not-yet@example.test',
      phone: '+15550001111',
    }),
  ],
};

const adapterFor = (
  who: typeof ADMIN,
  over: { readonly sleep?: () => Promise<void> } = {},
): MockAdapter =>
  createMockAdapter({
    currentUserId: who,
    seed: SEED,
    storage: createMemoryStorage(),
    /* Off by default: these tests are about what the adapter decides, not how long it waits. */
    latency: { minMs: 0, maxMs: 0 },
    ...over,
  });

const ALL_ROLES = { roles: MEMBERSHIP_ROLES, statuses: ['invited', 'active', 'revoked'] } as const;

describe('the event directory', () => {
  it('lists the active members', async () => {
    const names = (await adapterFor(GUEST).users.list(WEDDING)).items.map((u) => u.displayName);
    expect(names).toEqual(['admin', 'guest']);
  });

  it('drops a member whose access was revoked', async () => {
    /* `memberships.revoke` exists to take someone out of the event. A directory that still
       lists them is the operation silently not working -- and `users.byId` returning their
       record is the same leak reached by a different door. */
    const adapter = adapterFor(GUEST);
    const listed = (await adapter.users.list(WEDDING)).items.map((u) => u.id);

    expect(listed).not.toContain(GONE);
    await expect(adapter.users.byId(WEDDING, GONE)).rejects.toThrow();
  });
});

describe('invitation contact details', () => {
  it('shows an admin the pending invitations, contacts and all', async () => {
    const page = await adapterFor(ADMIN).memberships.list(WEDDING, ALL_ROLES);
    const invite = page.items.find((row) => row.status === 'invited');

    expect(invite?.invitedEmail).toBe('not-yet@example.test');
    expect(invite?.invitedPhone).toBe('+15550001111');
  });

  it('hides them from a member who is not an admin', async () => {
    /* An invited row is a person who has not joined and never agreed to be in this event's
       directory. Their email is the one piece of personal data here that belongs to somebody
       outside the event. */
    const page = await adapterFor(GUEST).memberships.list(WEDDING, ALL_ROLES);

    expect(page.items.some((row) => row.status === 'invited')).toBe(false);
    for (const row of page.items) {
      expect(row.invitedEmail).toBeNull();
      expect(row.invitedPhone).toBeNull();
    }
  });

  it('still hides the contact of an accepted membership from a non-admin', async () => {
    /* The reason the rows are redacted rather than only filtered: a membership keeps
       `invited_email` after it is accepted, so filtering `invited` alone would have handed
       every member's address to anyone who asked for the active ones. */
    const page = await adapterFor(GUEST).memberships.list(WEDDING, {
      roles: MEMBERSHIP_ROLES,
      statuses: ['active'],
    });
    const guest = page.items.find((row) => row.userId === GUEST);

    expect(guest).toBeDefined();
    expect(guest?.invitedEmail).toBeNull();
  });

  it('lets a member read their own membership in full', async () => {
    const own = await adapterFor(GUEST).memberships.findForUser(WEDDING, GUEST);
    expect(own?.invitedEmail).toBe('guest@example.test');
  });

  it('redacts another member read through findForUser', async () => {
    const other = await adapterFor(GUEST).memberships.findForUser(WEDDING, ADMIN);
    expect(other).not.toBeNull();
    expect(other?.invitedEmail).toBeNull();
  });
});

describe('resetDemoData against a write already in flight', () => {
  it('discards the write rather than restoring the dataset on the next reload', async () => {
    /*
     * The window is the simulated latency -- up to 240ms in the app, which is long enough to
     * hit by hand. Without the guard the resumed write persists its pre-reset tables over the
     * fresh snapshot: memory looks reset, storage does not, and the dataset the user threw away
     * comes back at the next reload, far from anything that would explain it.
     */
    /* Held only while the invite is in flight; the assertions afterwards make their own calls,
       and those have to be able to finish. */
    const releases: (() => void)[] = [];
    let holding = true;
    /* Shared with the second adapter below: the corruption is in the store, not in memory. */
    const storage = createMemoryStorage();
    const adapter = createMockAdapter({
      currentUserId: ADMIN,
      seed: SEED,
      storage,
      sleep: () =>
        holding
          ? new Promise<void>((resolve) => {
              releases.push(resolve);
            })
          : Promise.resolve(),
    });

    /** One turn of the event loop, so an operation reaches the delay it is about to wait on. */
    const settle = async (): Promise<void> => {
      await new Promise<void>((resolve) => {
        setTimeout(resolve, 0);
      });
    };

    await adapter.ready();

    const inFlight = adapter.memberships.invite(WEDDING, {
      email: 'late@example.test',
      phone: null,
      role: 'attendee',
    });
    await settle();
    expect(releases).toHaveLength(1);

    /* The reset lands while the invite is still waiting on its delay. */
    await adapter.resetDemoData();

    holding = false;
    for (;;) {
      const release = releases.shift();
      if (release === undefined) break;
      release();
      await settle();
    }
    await inFlight.catch(() => undefined);

    /*
     * Asserted through a second adapter over the same store, because that is the only place the
     * bug is visible. The running adapter's `state` is the fresh object either way, so a check
     * against `adapter` passes whether or not the guard exists -- which is what the first
     * version of this test did, and why it caught nothing.
     */
    const reloaded = createMockAdapter({
      currentUserId: ADMIN,
      seed: SEED,
      storage,
      latency: { minMs: 0, maxMs: 0 },
    });
    const after = await reloaded.memberships.list(WEDDING, ALL_ROLES);

    expect(after.items.some((row) => row.invitedEmail === 'late@example.test')).toBe(false);
  });

  it('never leaves two writes in flight, so the reset is the one that lands', async () => {
    /*
     * The half of the race the `commit` guard does not close. The guard decides *whether* a
     * superseded write happens; it cannot decide when a write already handed to the store
     * finishes. With two writes in flight the store may complete them in either order, and if
     * the older finishes last the pre-reset tables survive on disk -- the same
     * invisible-until-reload corruption, reached by a different route.
     *
     * So the store here holds every write open until released, and they are released
     * newest-first: the completion order a slow store is entitled to produce, and the one that
     * loses the data. `maxInFlight` is the assertion that matters -- while writes are
     * serialised, the store is never in a position to invert anything.
     */
    let stored: string | null = null;
    let inFlight = 0;
    let maxInFlight = 0;
    const gates: (() => void)[] = [];
    const heldStorage = {
      read: () => Promise.resolve(stored),
      write: async (_key: string, value: string) => {
        inFlight += 1;
        maxInFlight = Math.max(maxInFlight, inFlight);
        await new Promise<void>((resolve) => {
          gates.push(resolve);
        });
        stored = value;
        inFlight -= 1;
      },
      remove: () => {
        stored = null;
        return Promise.resolve();
      },
    };

    const settle = async (): Promise<void> => {
      await new Promise<void>((resolve) => {
        setTimeout(resolve, 0);
      });
    };
    /** Waits for a condition rather than for a fixed number of turns, which is guesswork. */
    const waitFor = async (what: string, ready: () => boolean): Promise<void> => {
      for (let guard = 0; guard < 50; guard += 1) {
        if (ready()) return;
        await settle();
      }
      throw new Error(`timed out waiting for ${what}`);
    };

    /** Finishes the outstanding writes newest-first, including any queued while draining. */
    const drainNewestFirst = async (): Promise<void> => {
      for (let guard = 0; guard < 20; guard += 1) {
        const gate = gates.pop();
        if (gate === undefined) return;
        gate();
        await settle();
      }
      throw new Error('writes never stopped queueing');
    };

    const adapter = createMockAdapter({
      currentUserId: ADMIN,
      seed: SEED,
      storage: heldStorage,
      latency: { minMs: 0, maxMs: 0 },
    });

    /* First load seeds the store; let that write finish so it is not part of the race. */
    const ready = adapter.ready();
    await waitFor('the seeding write', () => gates.length > 0);
    await drainNewestFirst();
    await ready;

    /* The invite runs all the way into its write, which is then held open. */
    const invite = adapter.memberships.invite(WEDDING, {
      email: 'late@example.test',
      phone: null,
      role: 'attendee',
    });
    await waitFor("the invite's write to reach the store", () => gates.length === 1);

    /* The reset lands while that write is still in flight. */
    const reset = adapter.resetDemoData();
    await settle();

    await drainNewestFirst();
    await Promise.all([invite.catch(() => undefined), reset]);

    expect(maxInFlight).toBe(1);
    expect(stored).not.toBeNull();
    expect(stored).not.toContain('late@example.test');
  });
});
