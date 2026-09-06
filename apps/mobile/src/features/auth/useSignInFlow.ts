import { useRef, useState } from 'react';
import { useAuth } from '../../auth/AuthProvider';
import { safeNext } from '../../auth/nextRoute';

/**
 * Signing in, and where it leads.
 *
 * The route used to hold this. Route files are thin adapters here — read params, compose
 * providers, render a screen — and resolving an untrusted `next` parameter, deciding what to say
 * when sign-in fails, and owning the in-flight flag are none of those.
 *
 * Navigation stays in the route, passed in as `onSignedIn`, which is what keeps this runnable
 * without a router.
 */

export type SignInFlow = {
  /** Where to go afterwards, already checked. Also where an already-signed-in visitor belongs. */
  readonly destination: string;
  readonly alreadySignedIn: boolean;
  readonly busy: boolean;
  readonly error: string | undefined;
  readonly demo: boolean;
  readonly start: () => void;
};

export const useSignInFlow = ({
  next,
  onSignedIn,
}: {
  readonly next: unknown;
  readonly onSignedIn: (destination: string) => void;
}): SignInFlow => {
  const { state, signIn, demo } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);

  /*
   * One completion handler per attempt.
   *
   * `signIn` is single-flight, so a second `start` does not begin a second sign-in — but it does
   * attach a second `.then`, and both would call `onSignedIn`. That is two navigations for one
   * sign-in, which on a stack is a duplicate route and on the web is a history entry somebody
   * has to press back through twice.
   *
   * A ref rather than the `busy` state: `busy` is set for the next render, and both calls happen
   * before it.
   */
  const handling = useRef(false);

  /* Checked here rather than at the point of navigation, so there is one place that decides what
     an acceptable destination is — see nextRoute.ts for why an unchecked one is an open
     redirect rather than a convenience. */
  const destination = safeNext(next);

  return {
    destination,
    alreadySignedIn: state.status === 'signed-in',
    busy,
    error,
    demo,
    start: () => {
      if (handling.current) return;
      handling.current = true;
      setBusy(true);
      setError(undefined);

      void signIn()
        .then(() => {
          onSignedIn(destination);
        })
        .catch(() => {
          /* Nothing specific to say: there is one provider, and the only thing worth reporting
             is that it did not work. */
          setError('Could not sign in. Please try again.');
        })
        .finally(() => {
          handling.current = false;
          setBusy(false);
        });
    },
  };
};
