import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { SignInScreen } from '../src/features/auth/SignInScreen';
import { useSignInFlow } from '../src/features/auth/useSignInFlow';

/**
 * The route: the parameter, and where signing in leads.
 */
export default function Route() {
  const { next } = useLocalSearchParams<{ next?: string }>();

  const flow = useSignInFlow({
    next,
    onSignedIn: (destination) => {
      /* `replace`, not `push`: the sign-in screen is how somebody got in, not somewhere to go
         back to. Leaving it on the stack means the back gesture lands on it again. */
      router.replace(destination);
    },
  });

  /*
   * Declarative, because navigating during render is a side effect in render — React may run it
   * twice, and under Strict Mode does. `Redirect` is expo-router's answer for the case where a
   * route decides, before painting anything, that it is not the right route.
   */
  if (flow.alreadySignedIn) return <Redirect href={flow.destination} />;

  return (
    <SignInScreen busy={flow.busy} error={flow.error} demo={flow.demo} onSignIn={flow.start} />
  );
}
