import { Button, EmptyState, Screen, Skeleton, SkeletonGroup } from '@occasio/ui';
import { userId, type UserId } from '@occasio/core';
import type { ReactNode } from 'react';
import { useAuth } from '../auth/AuthProvider';

/**
 * The super-admin area, which is cross-tenant and therefore not a membership question.
 *
 * **There is no platform-level role in the data model.** `MEMBERSHIP_ROLES` is per event —
 * `event_admin` runs one wedding, not the platform — and `UserRow` carries no staff flag. So
 * this is an allow-list of user ids: a constant that is honest about being one, rather than a
 * schema field invented in a feature PR. Adding a platform role touches `rows.ts`, which mirrors
 * the eventual Postgres tables exactly, and it should arrive with the policy that enforces it.
 *
 * It reads the **session**, not `useCurrentUserId`. That distinction is the whole gate: the
 * latter is a placeholder constant that answers the same thing whether or not anybody has signed
 * in, so comparing it to an allow-list let a signed-out visitor straight through. Nobody is a
 * platform administrator until they are somebody.
 *
 * Like `RoleGate`, this is UX and not enforcement: it decides what is offered, and the database
 * will decide what is allowed.
 */

/** The demo account, so the super-admin screens are reachable in the prototype at all. */
const PLATFORM_ADMINS: readonly UserId[] = [userId('u_sanit')];

export function PlatformGate({
  onLeave,
  leaveLabel,
  children,
}: {
  readonly onLeave?: (() => void) | undefined;
  readonly leaveLabel?: string | undefined;
  readonly children: ReactNode;
}) {
  const { state } = useAuth();

  /* Nothing while storage is still answering — rendering the refusal first would tell a platform
     administrator they have no access every time they open the page. */
  if (state.status === 'restoring') {
    return (
      <Screen testID="platform-gate-loading">
        <SkeletonGroup label="Checking your access">
          <Skeleton width="70%" height={28} />
          <Skeleton width="100%" height={120} />
        </SkeletonGroup>
      </Screen>
    );
  }

  const allowed = state.status === 'signed-in' && PLATFORM_ADMINS.includes(state.session.user.id);

  if (!allowed) {
    return (
      <Screen testID="platform-gate-refused">
        <EmptyState
          title="You do not have access to this"
          message="These screens are for platform administrators."
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
