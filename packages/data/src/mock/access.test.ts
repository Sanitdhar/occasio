import { describe, expect, it } from '@jest/globals';
import { membershipId, tenantId, userId } from '@occasio/core';
import { ForbiddenError } from '../errors';
import {
  MEMBERSHIP_ROLES,
  type MembershipRole,
  type MembershipRow,
  type MembershipStatus,
} from '../rows';
import {
  ADMIN_ROLES,
  CREW_ROLES,
  MODERATOR_ROLES,
  findActiveMembership,
  hasRole,
  requireMembership,
  requireRole,
} from './access';

const WEDDING = tenantId('t_wedding');
const FESTIVAL = tenantId('t_festival');
const GUEST = userId('u_guest');

const NOW: MembershipRow['created_at'] = '2026-06-01T12:00:00.000Z';

const membership = (
  over: Partial<MembershipRow> & {
    readonly role: MembershipRole;
    readonly status: MembershipStatus;
  },
): MembershipRow => ({
  id: membershipId('m_1'),
  tenant_id: WEDDING,
  user_id: GUEST,
  invited_email: null,
  invited_phone: null,
  invited_by: null,
  invited_at: null,
  accepted_at: null,
  created_at: NOW,
  updated_at: NOW,
  ...over,
});

describe('findActiveMembership', () => {
  it('finds the row for this user in this tenant', () => {
    const rows = [membership({ role: 'attendee', status: 'active' })];
    expect(findActiveMembership(rows, WEDDING, GUEST)?.id).toBe(membershipId('m_1'));
  });

  it('does not count an invitation as membership', () => {
    /* The reason `status` is checked at all. An invited row exists before the person accepts --
       it is a promise of access -- and treating it as membership would hand the guest list and
       the moderation queue to anyone holding a pending invite. */
    const invited = [membership({ role: 'event_admin', status: 'invited' })];
    expect(findActiveMembership(invited, WEDDING, GUEST)).toBeNull();
  });

  it('does not count a revoked membership', () => {
    const revoked = [membership({ role: 'event_admin', status: 'revoked' })];
    expect(findActiveMembership(revoked, WEDDING, GUEST)).toBeNull();
  });

  it('does not let a membership in one tenant read another', () => {
    /* The whole point of the simulated policy: this is the cross-tenant leak, and it has to be
       a null here rather than a row that happens to belong to the wrong event. */
    const rows = [membership({ role: 'event_admin', status: 'active' })];
    expect(findActiveMembership(rows, FESTIVAL, GUEST)).toBeNull();
  });

  it('does not match an invitation row that has no user yet', () => {
    /* `user_id` is null until the invite is accepted, and `undefined === null` is false, but a
       lookup for a user who is genuinely absent must not land on one of these. */
    const rows = [membership({ role: 'attendee', status: 'active', user_id: null })];
    expect(findActiveMembership(rows, WEDDING, GUEST)).toBeNull();
  });
});

describe('requireMembership', () => {
  it('returns the membership when there is one', () => {
    const rows = [membership({ role: 'crew', status: 'active' })];
    expect(requireMembership(rows, WEDDING, GUEST, 'sessions.list').role).toBe('crew');
  });

  it('throws with the tenant and the action, which is what makes the failure readable', () => {
    /* "sessions.list on tenant t_festival" raised from a screen rendering a wedding is a
       diagnosis. "Forbidden" is a shrug. */
    expect.assertions(2);
    try {
      requireMembership([], FESTIVAL, GUEST, 'sessions.list');
      throw new Error('requireMembership returned instead of throwing');
    } catch (error) {
      /* `instanceof` rather than a cast: D16 allows no assertions outside mappers.ts and
         ids.ts, and rethrowing anything else keeps the test honest if the type changes. */
      if (!(error instanceof ForbiddenError)) throw error;
      expect(error.tenantId).toBe(FESTIVAL);
      expect(error.action).toBe('sessions.list');
    }
  });
});

describe('role sets', () => {
  it('widens from admin to moderator to crew, and each level keeps the ones above it', () => {
    /* Written as containment rather than as three literal lists: the property that matters is
       that an event admin can do everything a moderator can, which is easy to break by editing
       one list and not the others. */
    expect(MODERATOR_ROLES).toEqual(expect.arrayContaining([...ADMIN_ROLES]));
    expect(CREW_ROLES).toEqual(expect.arrayContaining([...MODERATOR_ROLES]));
  });

  it('never admits a vendor or an attendee to a privileged set', () => {
    for (const roles of [ADMIN_ROLES, MODERATOR_ROLES, CREW_ROLES]) {
      expect(roles).not.toContain('vendor');
      expect(roles).not.toContain('attendee');
    }
  });

  it('names only roles that exist', () => {
    /* A typo in one of these lists is a permission that silently never matches. */
    for (const role of [...ADMIN_ROLES, ...MODERATOR_ROLES, ...CREW_ROLES]) {
      expect(MEMBERSHIP_ROLES).toContain(role);
    }
  });
});

describe('requireRole', () => {
  it('lets a held role through and turns a missing one into the same answer as no membership', () => {
    const admin = membership({ role: 'event_admin', status: 'active' });
    const attendee = membership({ role: 'attendee', status: 'active' });

    expect(requireRole(admin, MODERATOR_ROLES, WEDDING, 'gossip.moderate')).toBe(admin);
    expect(() => requireRole(attendee, MODERATOR_ROLES, WEDDING, 'gossip.moderate')).toThrow(
      ForbiddenError,
    );
  });

  it('agrees with hasRole for every role', () => {
    /* Two ways to ask the same question, and a screen that hides a button with one while the
       repository enforces the other is how a dead-end UI happens. */
    for (const role of MEMBERSHIP_ROLES) {
      const row = membership({ role, status: 'active' });
      const allowed = hasRole(row, CREW_ROLES);
      if (allowed) {
        expect(requireRole(row, CREW_ROLES, WEDDING, 'tasks.list')).toBe(row);
      } else {
        expect(() => requireRole(row, CREW_ROLES, WEDDING, 'tasks.list')).toThrow(ForbiddenError);
      }
    }
  });
});
