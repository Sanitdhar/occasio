import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useAuth } from '../src/auth/AuthProvider';
import { safeNext } from '../src/auth/nextRoute';
import { SignInScreen } from '../src/features/auth/SignInScreen';

/**
 * The route: where signing in leads, and where it came from.
 *
 * `next` carries the route somebody was heading for. It arrives from a URL, so it is passed
 * through `safeNext` before it is followed — see that file for why an unchecked one is an open
 * redirect rather than a convenience.
 */
export default function Route() {
  const { next } = useLocalSearchParams<{ next?: string }>();
  const { state, signIn } = useAuth();
  const [error, setError] = useState<string | undefined>(undefined);
  const [busy, setBusy] = useState(false);

  const destination = safeNext(next);

  /*
   * Already signed in — somebody who followed a stale link, or came back to this route from
   * history. `Redirect` rather than an effect, because rendering a sign-in button to a person
   * who is signed in and then moving them is a flicker with a wrong screen in it.
   */
  if (state.status === 'signed-in') {
    router.replace(destination);
    return null;
  }

  return (
    <SignInScreen
      busy={busy}
      error={error}
      onSignIn={() => {
        setBusy(true);
        setError(undefined);
        void signIn()
          .then(() => {
            router.replace(destination);
          })
          .catch(() => {
            /* Nothing specific to say: there is one provider and one failure worth reporting,
               which is that it did not work. */
            setError('Could not sign in. Please try again.');
          })
          .finally(() => {
            setBusy(false);
          });
      }}
    />
  );
}
