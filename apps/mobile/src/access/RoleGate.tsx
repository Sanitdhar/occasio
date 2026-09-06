import { Button, EmptyState, Screen, Skeleton, SkeletonGroup } from '@occasio/ui';
import type { ReactNode } from 'react';
import type { TenantId } from '@occasio/core';
import { useRole, type Role } from './useRole';

/**
 * One line at a layout, gating a whole subtree.
 *
 * **This is UX, not enforcement, and the difference is not a detail.** Everything below runs on
 * a device somebody else controls: the bundle can be edited, the check can be deleted, and the
 * request that follows is made by their machine either way. What actually stops a guest reading
 * the moderation queue is row-level security in the database, which is why every repository
 * method takes a tenant and why the eventual RLS policies are the thing to review. The gate is
 * here so that people are not shown doors they cannot open — a screen that loads, flashes and
 * then errors is worse than one that was never offered.
 *
 * The role comes from the data layer per tenant (see useRole), never from the session, so
 * revoking somebody's access takes effect on their next read rather than on their next sign-in.
 */

export type RoleGateProps = {
  readonly tenantId: TenantId | null;
  /** The roles that may see this subtree. Written out, so widening it is a visible change. */
  readonly allow: readonly Role[];
  /** Offered on the refused screen, when there is somewhere to go. */
  readonly onLeave?: (() => void) | undefined;
  readonly leaveLabel?: string | undefined;
  readonly children: ReactNode;
};

export function RoleGate({ tenantId, allow, onLeave, leaveLabel, children }: RoleGateProps) {
  const role = useRole(tenantId);

  /*
   * Nothing is rendered while the answer is unknown — not the subtree, and not the refusal.
   *
   * Rendering the children first and hiding them on refusal is the failure this exists to
   * prevent: the request they make has already left, and on a slow connection somebody sees the
   * admin screen for a second. Rendering the refusal first is the opposite mistake, telling a
   * genuine organiser they have no access every time they open the page.
   */
  if (tenantId === null || role.isPending) {
    return (
      <Screen testID="role-gate-loading">
        <SkeletonGroup label="Checking your access">
          <Skeleton width="70%" height={28} />
          <Skeleton width="100%" height={120} />
        </SkeletonGroup>
      </Screen>
    );
  }

  if (role.isError) {
    /* A failed read is not a refusal. Saying "you do not have access" when the network dropped
       sends an organiser to ask somebody for a permission they already have. */
    return (
      <Screen testID="role-gate-error">
        <EmptyState
          title="Could not check your access"
          message="Something went wrong reaching the server. It may be the connection."
          action={
            <Button
              label="Try again"
              onPress={() => {
                void role.refetch();
              }}
            />
          }
        />
      </Screen>
    );
  }

  if (role.data === null || !allow.includes(role.data)) {
    /*
     * One screen for "not in this event" and "in it, but not as an organiser". They are
     * different facts and the same answer: this is not yours to open, and the way forward is to
     * ask somebody who can. Distinguishing them here would tell a stranger which events exist
     * and who runs them.
     */
    return (
      <Screen testID="role-gate-refused">
        <EmptyState
          title="You do not have access to this"
          message="Ask an organiser of this event to give you access, and it will appear here."
          action={
            onLeave === undefined ? undefined : (
              <Button label={leaveLabel ?? 'Go back'} onPress={onLeave} />
            )
          }
        />
      </Screen>
    );
  }

  return <>{children}</>;
}
