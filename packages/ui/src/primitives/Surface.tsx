import type { ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { createStyles } from '../theme/createStyles';
import { useTheme } from '../theme/useTheme';
import { InteractiveBox, type BoxAccessibilityProps } from './InteractiveBox';
import {
  SPACE_STEPS,
  surfacePalette,
  type BorderTone,
  type RadiusScale,
  type SpaceScale,
  type SurfaceTone,
} from './tones';

/**
 * The tonal box every other surface primitive is made of.
 *
 * Depth is two steps of the neutral ramp plus a hairline — never a shadow. Shadows date a
 * product instantly, render differently on each platform, and on web they smear over a
 * background image. `bg -> surface -> surfaceRaised` is the whole elevation model; genuinely
 * floating UI (a sheet, a menu) owns its own elevation rather than every box on the screen
 * carrying a shadow prop it almost never sets.
 *
 * There is deliberately no `elevation` prop, even though `theme.elevation` and
 * `toElevationStyle()` exist. A shadow drawn on this box would be clipped by the `overflow:
 * hidden` that makes the corner radius work, so a floating container composes the two instead:
 * an outer View carrying `toElevationStyle(theme.elevation.md)` around a Surface. That keeps the
 * shadow where it belongs — on the handful of things that genuinely float.
 *
 * Every size is an enumerated token, so the entire variant matrix is one cached StyleSheet per
 * theme rather than a fresh object per render.
 */

const useSurfaceStyles = createStyles((t) => ({
  /* Clips children to the corner radius — the reason a card can hold a photo. */
  box: { overflow: 'hidden' },

  borderNone: { borderWidth: 0 },
  borderHairline: { borderWidth: t.border.hairline },
  borderStrong: { borderWidth: t.border.standard },

  radiusNone: { borderRadius: 0 },
  radiusXs: { borderRadius: t.radius.xs },
  radiusSm: { borderRadius: t.radius.sm },
  radiusMd: { borderRadius: t.radius.md },
  radiusLg: { borderRadius: t.radius.lg },
  radiusPill: { borderRadius: t.radius.pill },
  radiusHero: { borderRadius: t.radius.hero },

  paddingNone: { padding: t.space(SPACE_STEPS.none) },
  paddingXs: { padding: t.space(SPACE_STEPS.xs) },
  paddingSm: { padding: t.space(SPACE_STEPS.sm) },
  paddingMd: { padding: t.space(SPACE_STEPS.md) },
  paddingLg: { padding: t.space(SPACE_STEPS.lg) },

  gapNone: { gap: t.space(SPACE_STEPS.none) },
  gapXs: { gap: t.space(SPACE_STEPS.xs) },
  gapSm: { gap: t.space(SPACE_STEPS.sm) },
  gapMd: { gap: t.space(SPACE_STEPS.md) },
  gapLg: { gap: t.space(SPACE_STEPS.lg) },
}));

type SurfaceStyles = ReturnType<typeof useSurfaceStyles>;

const BORDER_STYLE = {
  none: 'borderNone',
  hairline: 'borderHairline',
  strong: 'borderStrong',
} as const satisfies Record<BorderTone, keyof SurfaceStyles>;

const RADIUS_STYLE = {
  none: 'radiusNone',
  xs: 'radiusXs',
  sm: 'radiusSm',
  md: 'radiusMd',
  lg: 'radiusLg',
  pill: 'radiusPill',
  hero: 'radiusHero',
} as const satisfies Record<RadiusScale, keyof SurfaceStyles>;

const PADDING_STYLE = {
  none: 'paddingNone',
  xs: 'paddingXs',
  sm: 'paddingSm',
  md: 'paddingMd',
  lg: 'paddingLg',
} as const satisfies Record<SpaceScale, keyof SurfaceStyles>;

const GAP_STYLE = {
  none: 'gapNone',
  xs: 'gapXs',
  sm: 'gapSm',
  md: 'gapMd',
  lg: 'gapLg',
} as const satisfies Record<SpaceScale, keyof SurfaceStyles>;

export type SurfaceShape = {
  readonly tone?: SurfaceTone | undefined;
  readonly border?: BorderTone | undefined;
  readonly radius?: RadiusScale | undefined;
  readonly padding?: SpaceScale | undefined;
  readonly gap?: SpaceScale | undefined;
};

export type SurfaceProps = SurfaceShape &
  BoxAccessibilityProps & {
    /** Supplying this turns the surface into a Pressable with hover, press and focus states. */
    readonly onPress?: (() => void) | undefined;
    readonly disabled?: boolean | undefined;
    readonly testID?: string | undefined;
    readonly style?: StyleProp<ViewStyle> | undefined;
    readonly children?: ReactNode;
  };

export function Surface({
  tone = 'base',
  border = 'hairline',
  radius = 'md',
  padding = 'none',
  gap = 'none',
  ...rest
}: SurfaceProps) {
  const theme = useTheme();
  const styles = useSurfaceStyles();

  return (
    <InteractiveBox
      {...rest}
      palette={surfacePalette(theme, tone, border)}
      boxStyle={[
        styles.box,
        styles[BORDER_STYLE[border]],
        styles[RADIUS_STYLE[radius]],
        styles[PADDING_STYLE[padding]],
        styles[GAP_STYLE[gap]],
      ]}
    />
  );
}
