import { Button, Screen, Text, createStyles } from '@occasio/ui';
import { View } from 'react-native';

/**
 * One button, on purpose.
 *
 * D28 and ADR-0007: Google is the only provider, so this screen is shaped around exactly one —
 * no provider list, no "or continue with" divider, no slot standing empty. Adding the second is
 * then a visible change to this file rather than filling in a gap somebody left.
 *
 * Two constraints are already known and neither is paid (ADR-0007):
 *
 * - **Apple requires Sign in with Apple before an iOS release.** App Store Review Guideline 4.8
 *   makes a second button a submission blocker, not a preference, for any app offering a
 *   third-party sign-in on iOS.
 * - **Native Google sign-in needs a development build.** It is a native module, so it does not
 *   run in Expo Go; until the app moves to a dev build, native signs in against the mock.
 *
 * A guest at a wedding is not evaluating an authentication experience — they are trying to find
 * the seating plan before the speeches. That is the whole reason this screen says as little as
 * it does.
 */

export type SignInScreenProps = {
  readonly onSignIn: () => void;
  readonly busy?: boolean | undefined;
  /** Shown under the button. Absent while nothing has gone wrong. */
  readonly error?: string | undefined;
  /** Names the event somebody was heading for, when there is one. */
  readonly destination?: string | undefined;
};

const useStyles = createStyles((t) => ({
  root: { gap: t.space(3), maxWidth: 420 },
  actions: { gap: t.space(2), marginTop: t.space(4) },
}));

export function SignInScreen({ onSignIn, busy = false, error, destination }: SignInScreenProps) {
  const styles = useStyles();

  return (
    <Screen testID="sign-in-screen">
      <View style={styles.root}>
        <Text variant="display2">Sign in</Text>
        <Text tone="muted">
          {destination === undefined
            ? 'Signing in is how the app knows which tasks and reminders are yours.'
            : `Sign in to open ${destination}. It is how the app knows which tasks and reminders are yours.`}
        </Text>

        <View style={styles.actions}>
          <Button
            label={busy ? 'Signing in…' : 'Continue with Google'}
            disabled={busy}
            testID="sign-in-google"
            onPress={onSignIn}
          />
          {error === undefined ? null : (
            /* `Text` has no danger tone — the resolver only guarantees contrast for the
               content colours, and a solid `danger` fill is not one of them (textTokens.ts).
               The role is what makes this an error; the colour would be decoration. */
            <Text role="alert" testID="sign-in-error">
              {error}
            </Text>
          )}
        </View>
      </View>
    </Screen>
  );
}
