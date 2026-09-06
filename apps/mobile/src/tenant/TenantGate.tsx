import { isNotFoundError } from '@occasio/data';
import { Button, EmptyState, Screen, Skeleton, SkeletonGroup } from '@occasio/ui';
import { useEffect, type ReactNode } from 'react';
import { useTenantBySlug } from '../data/hooks';
import { rememberTenant } from './recentTenants';
import { useTenantResolution } from './TenantProvider';
import { useDeferredFlag } from './useDeferredFlag';

/**
 * Everything under `/e/[slug]` waits here until there is an event to show, or an answer about
 * why there is not.
 *
 * A mistyped slug is the first thing anyone will hit — a link read off a printed invitation, a
 * character dropped in a message — so "no such event" is a first-class screen rather than an
 * error boundary, and it has a way out. Somebody who has typed the wrong address is not helped
 * by being told a request failed.
 *
 * Pure of the router, per this repo's conventions: the layout above hands in `onLeave`, and this
 * decides only *whether* to offer a way out, never where it goes. That is also what makes the
 * whole thing renderable in a test and, later, in the theme editor's preview.
 */

/** Long enough that a cached or quick answer never paints a spinner, short enough to feel honest. */
const SPINNER_DELAY_MS = 250;

type Props = {
  /** Where the way out goes. Discover on web, join-by-code on native — the layout knows which. */
  readonly onLeave: () => void;
  readonly leaveLabel: string;
  readonly children: ReactNode;
};

export function TenantGate({ onLeave, leaveLabel, children }: Props) {
  const resolution = useTenantResolution();
  const slug = resolution.kind === 'resolved' ? resolution.slug : null;

  /*
   * Held disabled until there is a slug — `enabled` inside the hook, rather than an early return
   * here, because a hook cannot be called conditionally. The query's own cache is what makes a
   * revisit instant, and what keeps the loading branch below unreached on the way back.
   */
  const tenant = useTenantBySlug(slug);
  const pending = resolution.kind === 'resolving' || (slug !== null && tenant.isPending);
  const showSpinner = useDeferredFlag(pending, SPINNER_DELAY_MS);

  const opened = tenant.data;
  useEffect(() => {
    /*
     * Remembered here rather than where the slug is resolved, and only once the event has
     * actually loaded. A slug that resolves is not yet an event somebody reached — it may not
     * exist — so remembering earlier would fill the picker with mistyped addresses. This is also
     * the only place the name is known, which is what lets the picker render a list of events
     * rather than a list of slugs.
     */
    if (opened !== undefined) void rememberTenant({ slug: opened.slug, name: opened.name });
  }, [opened]);

  if (pending) {
    /*
     * Nothing at all for the first quarter second. A cached tenant never reaches this branch —
     * TanStack answers from the cache and `isPending` is false on the first render — and a fast
     * fetch reaches it and leaves it before the timer, so neither flashes. What used to be the
     * default, a spinner rendered the instant a query starts, is the flicker itself.
     */
    return showSpinner ? (
      <Screen testID="tenant-loading">
        <SkeletonGroup label="Loading this event">
          <Skeleton width="60%" height={32} />
          <Skeleton width="90%" height={20} />
          <Skeleton width="80%" height={20} />
        </SkeletonGroup>
      </Screen>
    ) : null;
  }

  if (slug === null) {
    /* Nothing identified an event: a first native launch, or the bare origin on web. Not an
       error, and the same way out serves it. */
    return (
      <Screen testID="tenant-unresolved">
        <EmptyState
          title="No event yet"
          message="Open the link you were sent, or find your event to get started."
          action={<Button label={leaveLabel} onPress={onLeave} />}
        />
      </Screen>
    );
  }

  if (tenant.isError) {
    const missing = isNotFoundError(tenant.error);

    /*
     * Two different failures wearing one screen would be a lie in one of the two cases. A
     * mistyped address is the person's to fix and retrying it will never work; a request that
     * failed is ours, and retrying is the entire remedy. So they differ in what they say and in
     * which control they offer.
     */
    return (
      <Screen testID={missing ? 'tenant-not-found' : 'tenant-error'}>
        <EmptyState
          title={missing ? 'No such event' : 'Could not load this event'}
          message={
            missing
              ? `Nothing lives at “${slug}”. Check the link you were sent — it is easy to lose a character.`
              : 'Something went wrong reaching this event. It may be the connection.'
          }
          action={
            missing ? (
              <Button label={leaveLabel} onPress={onLeave} />
            ) : (
              <Button
                label="Try again"
                onPress={() => {
                  void tenant.refetch();
                }}
              />
            )
          }
        />
      </Screen>
    );
  }

  return <>{children}</>;
}
