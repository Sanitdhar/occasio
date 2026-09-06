import { type ReactNode } from 'react';
import { View } from 'react-native';
import type { LayoutViewStyle } from '../components/layoutStyle';
import { createStyles } from '../theme/createStyles';
import { atLeast } from './breakpoints';
import { useBreakpoint } from './useBreakpoint';

/**
 * Two panes side by side when there is room, stacked when there is not.
 *
 * The theme editor is the reason it exists: a live preview beside the controls is the whole
 * point of it, and on a phone that is two half-width columns of nothing. Below `md` the panes
 * stack and `primary` comes first, so the editor degrades into a form with the preview beneath
 * rather than into an unusable split.
 *
 * Not a generic grid. A grid would need column counts, gutters and spans, all of which are
 * decisions this product has not had to make yet — and the one layout it does need is this one.
 */

type Props = {
  /** The pane that comes first when stacked: the controls, not the preview. */
  readonly primary: ReactNode;
  readonly secondary: ReactNode;
  /**
   * How much of the width `primary` takes when side by side, as a fraction.
   *
   * A number rather than a token because it is a proportion, not a distance — there is no
   * spacing scale for "two fifths" — and it is clamped so a caller cannot produce a pane of
   * zero width, which renders as a missing feature rather than as a narrow one.
   */
  readonly ratio?: number;
  /** Below this the panes stack. `md` is the tablet threshold and the editor's own cutoff. */
  readonly stackBelow?: 'sm' | 'md' | 'lg';
  readonly testID?: string;
  readonly style?: LayoutViewStyle | undefined;
};

const MIN_RATIO = 0.2;
const MAX_RATIO = 0.8;

/**
 * A fraction as the percentage string React Native's `flexBasis` wants.
 *
 * Typed as `${number}%` rather than `string`, because `DimensionValue` accepts the former and
 * not the latter — and building it inline produces the latter, which is a type error that reads
 * as being about flexbox rather than about template literals.
 */
const percent = (fraction: number): `${number}%` =>
  /*
   * `String(fraction * 100)` is what `restrict-template-expressions` wants and it widens the
   * result to `string`, which `DimensionValue` does not accept — so the lint rule and the type
   * both cannot be satisfied. The type wins here: it is the one that would let a wrong value
   * through, and the interpolated expression is a number by the signature above rather than by
   * inspection.
   */
  // eslint-disable-next-line @typescript-eslint/restrict-template-expressions -- see above
  `${fraction * 100}%`;

const useStyles = createStyles((t) => ({
  row: { flexDirection: 'row', gap: t.space(4) },
  stack: { flexDirection: 'column', gap: t.space(4) },
  pane: { flexShrink: 1 },
  full: { width: '100%' },
}));

export function Split({
  primary,
  secondary,
  ratio = 0.5,
  stackBelow = 'md',
  testID,
  style,
}: Props) {
  const styles = useStyles();
  const breakpoint = useBreakpoint();
  const sideBySide = atLeast(breakpoint, stackBelow);

  /* Clamped rather than trusted: a ratio of 0 or 1 renders one pane as a hairline, which reads
     as the feature being missing rather than as a layout mistake. */
  const share = Math.min(Math.max(ratio, MIN_RATIO), MAX_RATIO);

  if (!sideBySide) {
    return (
      <View style={[styles.stack, style]} testID={testID}>
        <View style={styles.full}>{primary}</View>
        <View style={styles.full}>{secondary}</View>
      </View>
    );
  }

  return (
    <View style={[styles.row, style]} testID={testID}>
      {/* `flexBasis` as a percentage rather than `flex`, so the two panes keep their proportion
          instead of being redistributed by their content's intrinsic width — which is what makes
          a preview pane jump about as the thing inside it changes. */}
      <View style={[styles.pane, { flexBasis: percent(share) }]}>{primary}</View>
      <View style={[styles.pane, { flexBasis: percent(1 - share) }]}>{secondary}</View>
    </View>
  );
}
