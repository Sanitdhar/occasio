import type { TenantId } from '@occasio/core';
import type { MembershipRole } from '@occasio/data';
import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { useAdapter } from '../data/AdapterProvider';
import { useCurrentUserId } from '../data/useCurrentUserId';
import { queryKeys } from '../data/queryKeys';

/**
 * What this person is in this event.
 *
 * **From the data layer, per tenant, and never from a session.** A token is issued once and
 * believed until it expires, so a role revoked at 9am is still in a token minted at 8:50 — and a
 * claim inside a token is a client-side fact, which makes it a client-side decision. `AuthUser`
 * carries no role for that reason (#43), and this is the other half of the arrangement: the role
 * is a row, read with the tenant in hand, invalidated with everything else about that event.
 *
 * `null` means "not in this event", which is a different answer from "not loaded" and from "not
 * signed in". Every caller that gates on it has to tell them apart, which is why this returns
 * the query rather than the role.
 */

export type Role = MembershipRole;

/**
 * An active membership only.
 *
 * A membership that is invited-but-not-accepted, or revoked, is a row that exists and a person
 * who is not in the event. Treating either as a role would let a revoked organiser keep an admin
 * screen until their next reload.
 */
export const useRole = (tenantId: TenantId | null): UseQueryResult<Role | null> => {
  const adapter = useAdapter();
  const userId = useCurrentUserId();

  return useQuery({
    /* The tenant prefix is what stops a role cached for one event answering for another — the
       failure the whole key convention exists to prevent, at its most consequential. There is no
       key for "no tenant" because there is nothing to cache: the query is disabled. */
    queryKey:
      tenantId === null
        ? ['tenant', 'unresolved', 'memberships', 'forUser', userId]
        : queryKeys.memberships.forUser(tenantId, userId),
    queryFn: async () => {
      if (tenantId === null) return null;
      const membership = await adapter.memberships.findForUser(tenantId, userId);
      return membership?.status === 'active' ? membership.role : null;
    },
    enabled: tenantId !== null,
    /*
     * Short, and deliberately shorter than the tenant's own config. A role is the one piece of
     * this app that is revoked rather than edited, and the gap between it changing and a screen
     * noticing is exactly the window this cache decides the size of.
     */
    staleTime: 30_000,
  });
};
