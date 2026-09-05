export {
  buildNeutralRamp,
  buildRamp,
  chromaOf,
  contrast,
  ensureContrast,
  hueOf,
  isAchromatic,
  mix,
  onColorFor,
  rotateHue,
  withAlpha,
} from './color.js';
export { PRESETS, themeInputFromPreset, type Preset } from './presets/index.js';
export { pickScheme, resolveTheme } from './resolve.js';
export {
  runThemeChecks,
  type CheckStatus,
  type ThemeCheck,
  type ThemeCheckReport,
} from './checks.js';
export { TYPE_SETS, buildTypography } from './typography.js';
export {
  PRESET_IDS,
  ThemeInputSchema,
  TYPE_SET_IDS,
  type PresetId,
  type Ramp,
  type ResolveContext,
  type ResolvedTheme,
  type Scheme,
  type TextStyleToken,
  type ThemeColors,
  type ThemeInput,
  type ThemeTypography,
  type TypeSetId,
} from './types.js';

export const THEME_SCHEMA_VERSION = 1 as const;
