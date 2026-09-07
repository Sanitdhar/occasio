import { Button, EmptyState, Screen, Skeleton, SkeletonGroup } from '@occasio/ui';
import type { ReactNode } from 'react';
import { RoleGate } from '../../access/RoleGate';
import { useTenantBySlug } from '../../data/hooks';
import { useTenantResolution } from '../../tenant/TenantProvider';

/**
 * Who may open the admin screens for the event currently being viewed.
 *
 * The layout used to do this. Resolving the tenant and choosing which roles are allowed are both
 * business decisions, and route files here are thin adapters — read params, compose providers,
 * render a screen. The layout keeps the router callback and nothing else.
 *
 * `event_admin` only. A moderator moderates a queue and does not edit the theme or the schedule,
 * and widening that list is a visible change to one line in one place.
 */

export type EventAdminGateProps = {
  readonly onLeave: (slug: string) => void;
  readonly children: ReactNode;
};

export function EventAdminGate({ onLeave, children }: EventAdminGateProps) {
  const resolution = useTenantResolution();
  const slug = resolution.kind === 'resolved' ? resolution.slug : null;
  /* Usually a cache hit: `TenantGate` above already loaded the event to decide whether it
     exists, and both reads share a key. */
  const tenant = useTenantBySlug(slug);

  if (slug === null || tenant.isPending) {
    return (
      <Screen testID="event-admin-loading">
        <SkeletonGroup label="Checking your access">
          <Skeleton width="70%" height={28} />
          <Skeleton width="100%" height={120} />
        </SkeletonGroup>
      </Screen>
    );
  }

  if (tenant.isError) {
    /*
     * Handled here rather than folded into `null`. Passing `null` to `RoleGate` for a *failed*
     * lookup would read as "no tenant yet" and leave the page on its loading state for good,
     * long after the retries had stopped — a spinner that is really an error is the worst of
     * both, because nobody knows to retry it.
     */
    return (
      <Screen testID="event-admin-error">
        <EmptyState
          title="Could not check your access"
          message="Something went wrong reaching this event. It may be the connection."
          action={
            <Button
              label="Try again"
              onPress={() => {
                void tenant.refetch();
              }}
            />
          }
        />
      </Screen>
    );
  }

  return (
    <RoleGate
      tenantId={tenant.data.id}
      allow={['event_admin']}
      leaveLabel="Back to the event"
      onLeave={() => {
        onLeave(slug);
      }}
    >
      {children}
    </RoleGate>
  );
}
