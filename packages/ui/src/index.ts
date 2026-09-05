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

export { Image, type ImageAspect, type ImageProps, type ImageRadius } from './media/Image';
export {
  imageAccessibility,
  scrimGeometry,
  type ImageAccessibility,
  type ScrimGeometry,
  type ScrimPlacement,
} from './media/imageFrame';

export const UI_PACKAGE_VERSION = '0.0.0' as const;
