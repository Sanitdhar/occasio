import { View, type StyleProp, type ViewStyle } from 'react-native';
import { createStyles } from '../theme/createStyles';
import { SPACE_STEPS, type SpaceScale } from './tones';

/**
 * A hairline rule.
 *
 * Drawn as a filled box of `border.hairline` rather than as a border, so a divider between two
 * rows cannot be mistaken for one of those rows having a border — and so its colour comes from
 * `divider`, the token the resolver keeps deliberately fainter than `border`.
 *
 * Decorative by default: it is hidden from assistive technology, because a separator announced
 * between every list item is noise. Structure that a screen reader needs belongs in headings.
 */

const useDividerStyles = createStyles((t) => ({
  horizontal: { alignSelf: 'stretch', height: t.border.hairline },
  vertical: { alignSelf: 'stretch', width: t.border.hairline },

  toneDivider: { backgroundColor: t.color.divider },
  toneBorder: { backgroundColor: t.color.border },

  insetHorizontalNone: { marginHorizontal: t.space(SPACE_STEPS.none) },
  insetHorizontalXs: { marginHorizontal: t.space(SPACE_STEPS.xs) },
  insetHorizontalSm: { marginHorizontal: t.space(SPACE_STEPS.sm) },
  insetHorizontalMd: { marginHorizontal: t.space(SPACE_STEPS.md) },
  insetHorizontalLg: { marginHorizontal: t.space(SPACE_STEPS.lg) },

  insetVerticalNone: { marginVertical: t.space(SPACE_STEPS.none) },
  insetVerticalXs: { marginVertical: t.space(SPACE_STEPS.xs) },
  insetVerticalSm: { marginVertical: t.space(SPACE_STEPS.sm) },
  insetVerticalMd: { marginVertical: t.space(SPACE_STEPS.md) },
  insetVerticalLg: { marginVertical: t.space(SPACE_STEPS.lg) },
}));

type DividerStyles = ReturnType<typeof useDividerStyles>;

export type DividerOrientation = 'horizontal' | 'vertical';
export type DividerTone = 'divider' | 'border';

const TONE_STYLE = {
  divider: 'toneDivider',
  border: 'toneBorder',
} as const satisfies Record<DividerTone, keyof DividerStyles>;

/** Inset runs along the line, so a horizontal rule insets left and right. */
const INSET_STYLE = {
  horizontal: {
    none: 'insetHorizontalNone',
    xs: 'insetHorizontalXs',
    sm: 'insetHorizontalSm',
    md: 'insetHorizontalMd',
    lg: 'insetHorizontalLg',
  },
  vertical: {
    none: 'insetVerticalNone',
    xs: 'insetVerticalXs',
    sm: 'insetVerticalSm',
    md: 'insetVerticalMd',
    lg: 'insetVerticalLg',
  },
} as const satisfies Record<DividerOrientation, Record<SpaceScale, keyof DividerStyles>>;

export type DividerProps = {
  readonly orientation?: DividerOrientation | undefined;
  readonly tone?: DividerTone | undefined;
  readonly inset?: SpaceScale | undefined;
  readonly style?: StyleProp<ViewStyle> | undefined;
  readonly testID?: string | undefined;
};

export function Divider({
  orientation = 'horizontal',
  tone = 'divider',
  inset = 'none',
  style,
  testID,
}: DividerProps) {
  const styles = useDividerStyles();

  return (
    <View
      aria-hidden
      testID={testID}
      style={[
        styles[orientation],
        styles[TONE_STYLE[tone]],
        styles[INSET_STYLE[orientation][inset]],
        style,
      ]}
    />
  );
}
