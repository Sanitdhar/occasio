import type { ReactNode } from 'react';
import type { AccessibilityRole, StyleProp, ViewStyle } from 'react-native';
import { createStyles } from '../theme/createStyles';
import { useTheme } from '../theme/useTheme';
import { InteractiveBox } from './InteractiveBox';
import {
  SPACE_STEPS,
  surfaceBackground,
  type BorderTone,
  type RadiusScale,
  type SpaceScale,
  type SurfaceTone,
  type TonalPalette,
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

export type SurfaceProps = SurfaceShape & {
  /** Supplying this turns the surface into a Pressable with hover, press and focus states. */
  readonly onPress?: (() => void) | undefined;
  readonly disabled?: boolean | undefined;
  readonly accessibilityRole?: AccessibilityRole | undefined;
  readonly accessibilityLabel?: string | undefined;
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

  const palette: TonalPalette = {
    background: surfaceBackground(theme, tone),
    border: border === 'strong' ? theme.color.borderStrong : theme.color.border,
    /* Body text is what will sit on this box, so it is the pair the hover fill must protect. */
    content: theme.color.text,
  };

  return (
    <InteractiveBox
      {...rest}
      palette={palette}
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
