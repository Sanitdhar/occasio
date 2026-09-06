import type { ReactNode } from 'react';
import { Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { createStyles } from '../theme/createStyles';
import { useTheme } from '../theme/useTheme';
import { InteractiveBox } from './InteractiveBox';
import { tonalPalette, type TonalTone } from './tones';

/**
 * A pill carrying one short label: a dietary tag, an RSVP state, a filter.
 *
 * **Label is a string, not children.** A chip that accepts arbitrary children cannot promise to
 * stay one line, and "Partners welcome" next to "Veg" in a wrapping row is exactly where that
 * promise breaks. Being a string lets the chip guarantee the two things that keep a chip row
 * readable: the label truncates with an ellipsis instead of wrapping, and the chip shrinks
 * instead of pushing its neighbours off the screen. Icons go in `leading`/`trailing`, which are
 * pinned at their natural size so they never get squeezed to nothing.
 *
 * Selection is one visual state rather than a variant of every tone — a filter row where each
 * chip is selected in its own colour is unreadable at a glance.
 */

const useChipStyles = createStyles((t) => ({
  box: {
    flexDirection: 'row',
    alignItems: 'center',
    /* Sizes to its label, and shrinks rather than overflowing when the row runs out of room. */
    alignSelf: 'flex-start',
    flexShrink: 1,
    maxWidth: '100%',
    borderWidth: t.border.hairline,
    borderRadius: t.radius.pill,
    paddingHorizontal: t.space(3),
    paddingVertical: t.space(1),
    gap: t.space(1),
  },
  /* Icons keep their size; only the label gives ground. */
  slot: { flexShrink: 0 },
  label: { ...t.type.caption, flexShrink: 1 },
}));

export type ChipProps = {
  readonly tone?: TonalTone | undefined;
  /**
   * Present only on a chip that toggles. Left out — not set to `false` — on a plain tag, which
   * is what tells the chip whether it is a checkbox or a button, and stops every filter chip
   * announcing "not selected".
   */
  readonly selected?: boolean | undefined;
  readonly onPress?: (() => void) | undefined;
  readonly disabled?: boolean | undefined;
  readonly leading?: ReactNode;
  readonly trailing?: ReactNode;
  readonly style?: StyleProp<ViewStyle> | undefined;
  readonly testID?: string | undefined;
  /** The label. Screen readers get it in full even when it is visually truncated. */
  readonly children: string;
};

export function Chip({
  tone = 'neutral',
  selected,
  onPress,
  disabled = false,
  leading,
  trailing,
  style,
  testID,
  children,
}: ChipProps) {
  const theme = useTheme();
  const styles = useChipStyles();
  const palette = tonalPalette(theme, selected === true ? 'brandSolid' : tone);

  /* A chip that toggles is a checkbox, not a button: `aria-selected` is only valid on options
     and tabs, so a screen reader would ignore it on a button. `aria-checked` is valid here, is
     forwarded by react-native-web, and React Native maps it to the native checked state. */
  const togglable = onPress !== undefined && selected !== undefined;

  return (
    <InteractiveBox
      palette={palette}
      boxStyle={styles.box}
      onPress={onPress}
      disabled={disabled}
      role={togglable ? 'checkbox' : undefined}
      aria-checked={togglable ? selected : undefined}
      aria-label={children}
      testID={testID}
      style={style}
    >
      {leading === undefined ? null : <View style={styles.slot}>{leading}</View>}
      <Text
        numberOfLines={1}
        ellipsizeMode="tail"
        style={[styles.label, { color: palette.content }]}
      >
        {children}
      </Text>
      {trailing === undefined ? null : <View style={styles.slot}>{trailing}</View>}
    </InteractiveBox>
  );
}
