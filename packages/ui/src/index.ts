export { ThemeProvider, ThemeContext } from './theme/ThemeProvider';
export { useTheme } from './theme/useTheme';
export { createStyles } from './theme/createStyles';
export { ThemeScope } from './theme/ThemeScope';
export { toCssVars } from './theme/cssVars';
export { toElevationStyle } from './theme/elevation';
export { createStyleCache, DEFAULT_MAX_THEMES, type StyleCache } from './theme/styleCache';

export { EmptyState } from './feedback/EmptyState';
export { Skeleton, SkeletonText } from './feedback/Skeleton';
export { SkeletonGroup, SkeletonPulseContext, useSkeletonPulse } from './feedback/SkeletonGroup';
export {
  DEFAULT_LAST_LINE_WIDTH,
  skeletonTextRows,
  type SkeletonTextRow,
} from './feedback/skeletonText';
export { Text, type TextProps } from './components/Text';
export {
  BODY_TEXT_TONES,
  LARGE_TEXT_VARIANTS,
  TEXT_TONES,
  TEXT_VARIANTS,
  textPalette,
  type BodyTextTone,
  type LargeTextVariant,
  type SmallTextVariant,
  type TextTone,
  type TextToneColors,
  type TextVariant,
} from './components/textTokens';
export type { LayoutTextStyle, LayoutViewStyle } from './components/layoutStyle';

export { Button, type ButtonProps } from './components/Button';
export {
  BUTTON_STATES,
  BUTTON_VARIANTS,
  buttonPalette,
  resolveButtonState,
  showsFocusRing,
  type ButtonInteraction,
  type ButtonPalette,
  type ButtonState,
  type ButtonTone,
  type ButtonVariant,
  type FocusOrigin,
} from './components/buttonTokens';

export { Image, type ImageAspect, type ImageProps, type ImageRadius } from './media/Image';
export {
  hasOverlay,
  imageAccessibility,
  scrimGeometry,
  type ImageAccessibility,
  type ScrimGeometry,
  type ScrimPlacement,
} from './media/imageFrame';

export { Avatar, type AvatarProps, type AvatarSize } from './primitives/Avatar';
export { Card, type CardProps } from './primitives/Card';
export { Chip, type ChipProps } from './primitives/Chip';
export {
  Divider,
  type DividerOrientation,
  type DividerProps,
  type DividerTone,
} from './primitives/Divider';
export { Surface, type SurfaceProps, type SurfaceShape } from './primitives/Surface';
export { initialsFrom } from './primitives/initials';
export {
  SPACE_STEPS,
  surfaceBackground,
  surfacePalette,
  tonalPalette,
  type BorderTone,
  type RadiusScale,
  type SpaceScale,
  type SurfaceTone,
  type TonalPalette,
  type TonalTone,
} from './primitives/tones';

export const UI_PACKAGE_VERSION = '0.0.0' as const;

/* Layout (#30). Breakpoints come from `useWindowDimensions` and the theme, because React Native
   has no media queries — see layout/breakpoints.ts for why the comparison is mobile-first. */
export { Screen } from './layout/Screen';
export { Split } from './layout/Split';
export { useBreakpoint } from './layout/useBreakpoint';
export { splitRatio, DEFAULT_SPLIT_RATIO } from './layout/splitRatio';
export {
  BREAKPOINT_NAMES,
  atLeast,
  breakpointFor,
  type Breakpoint,
  type BreakpointName,
} from './layout/breakpoints';

/* Inputs (#29). The composer, the theme editor and the preferences screens all need these
   three; `fieldState` is exported because the decision it makes -- an error replaces the hint
   rather than joining it -- is the same one a form-level summary has to make. */
export { Field, type FieldProps } from './inputs/Field';
export { Segmented, type SegmentedOption } from './inputs/Segmented';
export { Sheet } from './inputs/Sheet';
export { fieldAria, fieldMessage, type FieldMessage } from './inputs/fieldState';
