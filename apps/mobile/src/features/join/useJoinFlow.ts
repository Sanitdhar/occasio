import { isNotFoundError } from '@occasio/data';
import { useMutation } from '@tanstack/react-query';
import { useAdapter } from '../../data/AdapterProvider';
import { useRecentTenants } from '../../tenant/useRecentTenants';
import type { RecentTenant } from '../../tenant/recentTenants.shared';

/**
 * Everything joining an event involves, except where it goes afterwards.
 *
 * The route used to hold this. Route files are thin adapters here — read params, compose
 * providers, render a screen — and a directory lookup, a retry policy and the wording of an
 * error are none of those. Moving it also makes the interesting half testable: what the screen
 * is told when a code is wrong is a decision, and it was previously reachable only by rendering
 * a route.
 *
 * Navigation stays out. Where a successful join leads is the router's, and passing it in as
 * `onJoined` is what keeps this runnable without one.
 */

export type JoinFlow = {
  readonly recents: readonly RecentTenant[];
  readonly submitCode: (code: string) => void;
  readonly submitting: boolean;
  readonly error: string | undefined;
};

/**
 * What to say under the field.
 *
 * A wrong code is the ordinary case and is the person's to fix, so it says so plainly and does
 * not mention the network. Anything else is ours — and telling somebody "that code is wrong"
 * about a request that failed sends them to check a card that was right all along.
 */
export const joinErrorText = (error: unknown): string | undefined => {
  if (error === null || error === undefined) return undefined;
  return isNotFoundError(error)
    ? 'No event has that code. Check the card — it is easy to lose a character.'
    : 'Could not check that code. It may be the connection.';
};

export const useJoinFlow = (onJoined: (slug: string) => void): JoinFlow => {
  const adapter = useAdapter();
  const recents = useRecentTenants();

  const join = useMutation({
    mutationFn: (code: string) => adapter.directory.byJoinCode(code),
    onSuccess: (tenant) => {
      onJoined(tenant.slug);
    },
  });

  return {
    recents,
    submitCode: (code) => {
      join.mutate(code);
    },
    submitting: join.isPending,
    error: joinErrorText(join.error),
  };
};
