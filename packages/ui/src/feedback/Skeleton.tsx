import type { ResolvedTheme } from '@occasio/theme';
import { useMemo } from 'react';
import { Animated, View, type DimensionValue, type StyleProp, type ViewStyle } from 'react-native';
import { useTheme } from '../theme/useTheme';
import { useSkeletonPulse } from './SkeletonGroup';
import { skeletonTextRows } from './skeletonText';

/**
 * The two pieces a loading placeholder is built from.
 *
 * The point of the whole file, and of #28: **a skeleton is the screen with its content
 * removed, not a spinner where the screen will be.** The mock adapter carries deliberate
 * latency (D4) so this gets designed alongside each layout rather than retrofitted onto it.
 * A spinner tells someone that something is happening; a skeleton tells them what is about to
 * be there, and then does not move the page when it arrives.
 *
 * Which is why these are primitives rather than a `<LoadingSchedule>` per screen. A screen's
 * skeleton is a copy of that screen's box model, so it belongs next to the layout it mirrors
 * and lands in that screen's PR — written anywhere else, it starts drifting from the layout the
 * day after it is merged. What lives here is the vocabulary that makes such a copy exact: bars
 * measured in the same theme units the real components read, and text blocks measured from the
 * very type token the real text will use.
 */

/** The `t.type.*` keys that are text styles; `family` is the font stack, not a style. */
type TypeVariant = Exclude<keyof ResolvedTheme['type'], 'family'>;

type SkeletonProps = {
  /** Defaults to filling its parent, which is what a bar inside a laid-out row usually wants. */
  readonly width?: DimensionValue | undefined;
  /** In points, from `t.space(n)` or a `t.type.*` metric — never a number typed by hand. */
  readonly height?: number | undefined;
  readonly radius?: keyof ResolvedTheme['radius'] | undefined;
  readonly style?: StyleProp<ViewStyle> | undefined;
};

/**
 * One placeholder block: an avatar, a thumbnail, a button, a line of a heading.
 *
 * Size it from the same tokens the real element uses — `<Skeleton width={t.space(12)}
 * height={t.space(12)} radius="pill" />` for an avatar that will be `t.space(12)` across — and
 * the swap to real content moves nothing.
 */
export function Skeleton({ width = '100%', height, radius = 'sm', style }: SkeletonProps) {
  const theme = useTheme();
  const opacity = useSkeletonPulse();

  return (
    <Animated.View
      /* Ramp step 4 is a component background: present against both `bg` and `surface` in
         either scheme, without reading as a filled control that failed to load. */
      style={[
        {
          width,
          height: height ?? theme.space(3),
          borderRadius: theme.radius[radius],
          backgroundColor: theme.color.ramp.neutral[3],
          opacity,
        },
        style,
      ]}
    />
  );
}

type SkeletonTextProps = {
  readonly lines?: number | undefined;
  /** The `t.type.*` style the real text will be rendered in. */
  readonly variant?: TypeVariant | undefined;
  /** Percentage width of the closing line. Ignored when there is only one line. */
  readonly lastLineWidth?: number | undefined;
  readonly style?: StyleProp<ViewStyle> | undefined;
};

/**
 * A block of placeholder text that occupies exactly the space the real text will.
 *
 * Each row is a full line box of the chosen type token with the bar centred inside it, so
 * `lines` lines here and `lines` lines of loaded text are the same height and nothing below
 * jumps. The arithmetic is in skeletonText.ts, where it can be tested.
 */
export function SkeletonText({
  lines = 3,
  variant = 'body',
  lastLineWidth,
  style,
}: SkeletonTextProps) {
  const theme = useTheme();
  const rows = useMemo(
    () => skeletonTextRows(theme.type[variant], lines, lastLineWidth),
    [theme, variant, lines, lastLineWidth],
  );

  return (
    <View style={style}>
      {rows.map((row, index) => (
        /* Index keys: the rows are positional, homogeneous and never reordered or removed —
           there is no identity here for a key to carry. */
        <View key={index} style={{ height: row.lineHeight, justifyContent: 'center' }}>
          <Skeleton width={row.width} height={row.barHeight} radius="xs" />
        </View>
      ))}
    </View>
  );
}
