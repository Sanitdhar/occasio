import { typeSetSpecimen, type ThemeInput, type TypeSetId } from '@occasio/theme';
import { useTheme } from '@occasio/ui';
import { useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { AppThemeProvider } from '../../theme/AppThemeProvider';
import { TypeSetPicker } from '../../theme/TypeSetPicker';

/**
 * The card under the picker, deliberately reading its theme from context rather than a prop.
 *
 * It renders under a nested provider carrying the *previewed* theme, which is the mechanism the
 * full editor (#74–#78) will use for every screen: wrap a subtree, re-theme exactly that
 * subtree, duplicate no components.
 */
function Preview({ label }: { readonly label: string }) {
  const { color, type, space, radius, border } = useTheme();
  return (
    <View
      style={{
        backgroundColor: color.surface,
        borderColor: color.border,
        borderWidth: border.hairline,
        borderRadius: radius.lg,
        padding: space(4),
        gap: space(2),
      }}
    >
      <Text style={{ ...type.overline, color: color.textMuted }}>PREVIEW · {label}</Text>
      <Text style={{ ...type.display2, color: color.text }}>Saturday, 14 June</Text>
      <Text style={{ ...type.body, color: color.textMuted }}>
        Sizes, line heights and weights all come from the same resolver the live event site uses, so
        this is what the set looks like in place — not a font sample.
      </Text>
    </View>
  );
}

type Props = {
  /** The theme being edited. Passed in, never imported: screens take no fixtures. */
  readonly input: ThemeInput;
};

/**
 * Picking a typography set, with a live preview of the result (#31).
 *
 * The selection is local state and goes nowhere yet — there is no writer for a tenant's theme
 * row until #23, and the rest of the editor lands in #74–#78. It is still worth wiring rather
 * than freezing: choosing a set is what triggers that set's download, so this screen is where
 * the lazy per-set loading is visible, and the preview shows the reflow from system type to the
 * real faces exactly as an attendee would see it.
 */
export function TypeSetEditor({ input }: Props) {
  const theme = useTheme();
  const [setId, setSetId] = useState<TypeSetId>(input.typography.setId);

  const previewInput = useMemo(
    () => ({ ...input, typography: { ...input.typography, setId } }),
    [input, setId],
  );

  return (
    <View style={{ gap: theme.space(4) }}>
      <TypeSetPicker theme={theme} selectedId={setId} onSelect={setSetId} />
      <AppThemeProvider input={previewInput}>
        <Preview label={typeSetSpecimen(setId).label} />
      </AppThemeProvider>
    </View>
  );
}
