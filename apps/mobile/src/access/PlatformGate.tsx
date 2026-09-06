import { Button, EmptyState, Screen } from '@occasio/ui';
import { userId, type UserId } from '@occasio/core';
import type { ReactNode } from 'react';
import { useCurrentUserId } from '../data/useCurrentUserId';

/**
 * The super-admin area, which is cross-tenant and therefore not a membership question.
 *
 * **There is no platform-level role in the data model.** `MEMBERSHIP_ROLES` is per event —
 * `event_admin` runs one wedding, not the platform — and `UserRow` carries no staff flag. So
 * this gate is an allow-list of user ids, in the same spirit as `useCurrentUserId`: a constant
 * that is honest about being one, rather than a schema field invented in a feature PR.
 *
 * That gap is real and worth naming rather than papering over. Adding a platform role touches
 * `rows.ts`, which mirrors the eventual Postgres tables exactly, and it is the sort of change
 * that should arrive with the RLS policy that enforces it — not with a screen that wants to be
 * hidden. Until then this fails closed for everybody not named below, which is the right
 * direction for a gate to be wrong in.
 *
 * Like `RoleGate`, this is UX and not enforcement: it decides what is offered, and the database
 * decides what is allowed.
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
  const me = useCurrentUserId();

  if (!PLATFORM_ADMINS.includes(me)) {
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
