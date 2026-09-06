import type { TenantId, UserId } from '@occasio/core';
import { ForbiddenError } from '../errors';
import type { MembershipRole, MembershipRow } from '../rows';

/**
 * The simulated row-level security check (§6, `errors.ts`).
 *
 * Every tenant-scoped repository method runs through here before it touches a row, and throws
 * `ForbiddenError` when the caller has no active membership in the `tenantId` it passed. That is
 * the whole reason `tenantId` is the first argument of every method: the check mirrors what the
 * eventual Postgres policy does, so a cross-tenant read is a loud failure in a prototype instead
 * of a silent data leak in production, six months after the screen that caused it was written.
 *
 * It runs from the first commit rather than from whenever Supabase arrives, and that ordering is
 * the point. A prototype built against an adapter with no access control is a prototype whose
 * screens all quietly assume they can see everything.
 */

/**
 * `invited` does not count.
 *
 * An invitation is a row that exists before the person does (`rows.ts`) — a promise of access,
 * not access. Treating it as membership would let anyone with a pending invite read the guest
 * list, the crew board and the moderation queue of an event they have not joined.
 */
export const findActiveMembership = (
  memberships: readonly MembershipRow[],
  tenantId: TenantId,
  userId: UserId,
): MembershipRow | null =>
  memberships.find(
    (row) => row.tenant_id === tenantId && row.user_id === userId && row.status === 'active',
  ) ?? null;

/**
 * The gate. `action` is spelled `repository.method` because the pair `(action, tenantId)` is what
 * makes a cross-tenant bug readable — "sessions.list on tenant t_devcon" raised from a screen
 * rendering a wedding is a diagnosis, and "Forbidden" is a shrug.
 */
export const requireMembership = (
  memberships: readonly MembershipRow[],
  tenantId: TenantId,
  userId: UserId,
  action: string,
): MembershipRow => {
  const membership = findActiveMembership(memberships, tenantId, userId);
  if (membership === null) throw new ForbiddenError({ tenantId, action });
  return membership;
};

/** Roles that may change the event itself: config, invitations, announcements, approvals. */
export const ADMIN_ROLES: readonly MembershipRole[] = ['event_admin'];

/** Roles that may see and act on the moderation queue (D3) — gossip posts and media alike. */
export const MODERATOR_ROLES: readonly MembershipRole[] = ['event_admin', 'moderator'];

/** Roles that run the event on the day: the crew board, seating, room and shuttle assignments. */
export const CREW_ROLES: readonly MembershipRole[] = ['event_admin', 'moderator', 'crew'];

/**
 * A second gate for the operations a member holds a membership for but not the role.
 *
 * `errors.ts` is explicit that `ForbiddenError` covers both "no membership in this tenant" and
 * "a role it does not hold", and the two are genuinely the same answer to a screen: sign in as
 * somebody else, or you are in the wrong place.
 */
export const requireRole = (
  membership: MembershipRow,
  allowed: readonly MembershipRole[],
  tenantId: TenantId,
  action: string,
): MembershipRow => {
  if (!allowed.includes(membership.role)) throw new ForbiddenError({ tenantId, action });
  return membership;
};

export const hasRole = (membership: MembershipRow, allowed: readonly MembershipRole[]): boolean =>
  allowed.includes(membership.role);
