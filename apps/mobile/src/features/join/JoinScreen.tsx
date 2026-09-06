import { Button, Card, Field, Screen, Text } from '@occasio/ui';
import { View } from 'react-native';
import { createStyles } from '@occasio/ui';
import { useState } from 'react';
import type { RecentTenant } from '../../tenant/recentTenants.shared';

/**
 * The way in when there is no URL bar.
 *
 * At a real event somebody is holding a printed card, a table tent or a sign, and typing what
 * they see. That is the whole design brief: the code field is the largest thing on the screen,
 * the events they have already been to are one tap away underneath it, and the scanner is an
 * accelerator rather than the only route — a camera permission dialog is a terrible thing to put
 * between a guest and the event they were invited to.
 *
 * Props in, JSX out. No router, no data fetching, no storage: the route above supplies the
 * recents, performs the lookup and decides where a successful join goes. That is what keeps this
 * renderable in a test and, later, under the theme editor's preview.
 */

export type JoinScreenProps = {
  readonly recents: readonly RecentTenant[];
  readonly onOpen: (slug: string) => void;
  readonly onSubmitCode: (code: string) => void;
  readonly submitting?: boolean | undefined;
  /** Shown under the field. Absent while nothing has gone wrong. */
  readonly error?: string | undefined;
  /**
   * Starts the scanner. Absent where there is no camera to start — which is every browser today
   * and will be some devices forever, and is why the field is the primary control rather than a
   * fallback.
   */
  readonly onScan?: (() => void) | undefined;
};

const useStyles = createStyles((t) => ({
  form: { gap: t.space(3) },
  recents: { gap: t.space(2), marginTop: t.space(6) },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
}));

export function JoinScreen({
  recents,
  onOpen,
  onSubmitCode,
  submitting = false,
  error,
  onScan,
}: JoinScreenProps) {
  const styles = useStyles();
  const [code, setCode] = useState('');

  /*
   * Whitespace-only input is not a submission. Without this the button is enabled on a field
   * that looks empty, and pressing it spends a request to be told the code is wrong.
   */
  const submittable = code.trim() !== '' && !submitting;

  return (
    <Screen testID="join-screen">
      <View style={styles.form}>
        <Text variant="display2">Join an event</Text>
        <Text tone="muted">
          Enter the code printed on your invitation, or pick an event you have been to before.
        </Text>

        <Field
          label="Event code"
          value={code}
          onChangeText={setCode}
          placeholder="SANRIY26"
          hint="Case does not matter, and neither do spaces or dashes."
          error={error}
          testID="join-code"
        />

        <Button
          label={submitting ? 'Looking…' : 'Join'}
          disabled={!submittable}
          testID="join-submit"
          onPress={() => {
            onSubmitCode(code);
          }}
        />

        {onScan === undefined ? null : (
          <Button
            label="Scan the QR code"
            variant="secondary"
            testID="join-scan"
            onPress={onScan}
          />
        )}
      </View>

      {recents.length === 0 ? null : (
        <View style={styles.recents}>
          <Text variant="title2">Events you have been to</Text>
          {recents.map((recent) => (
            <Card key={recent.slug}>
              <View style={styles.row}>
                <Text variant="bodyStrong">{recent.name}</Text>
                <Button
                  label="Open"
                  variant="secondary"
                  accessibilityLabel={`Open ${recent.name}`}
                  testID={`join-recent-${recent.slug}`}
                  onPress={() => {
                    onOpen(recent.slug);
                  }}
                />
              </View>
            </Card>
          ))}
        </View>
      )}
    </Screen>
  );
}
