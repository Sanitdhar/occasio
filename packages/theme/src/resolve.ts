import {
  buildNeutralRamp,
  buildRamp,
  ensureContrast,
  mix,
  onColorFor,
  rotateHue,
  withAlpha,
} from './color';
import { PRESETS } from './presets/index';
import { buildTypography } from './typography';
import type { ResolveContext, ResolvedTheme, Scheme, ThemeColors, ThemeInput } from './types';

/**
 * resolveTheme is PURE, SYNCHRONOUS and DETERMINISTIC: the same input always produces the same
 * tokens. That is what makes the live preview trivial (nest a provider with a draft input),
 * the contrast guarantee testable (run every preset against hundreds of random seeds), and the
 * whole engine reusable outside the app.
 */

const BASE_SPACE = 4;

const DENSITY_FACTOR: Record<ThemeInput['density'], number> = {
  cozy: 0.85,
  comfortable: 1,
  airy: 1.25,
};

const CORNER_RADII: Record<
  ThemeInput['shape']['corner'],
  ResolvedTheme['radius'] & { readonly hero: number }
> = {
  sharp: { xs: 0, sm: 2, md: 4, lg: 6, pill: 999, hero: 0 },
  soft: { xs: 4, sm: 8, md: 12, lg: 16, pill: 999, hero: 12 },
  round: { xs: 8, sm: 14, md: 20, lg: 28, pill: 999, hero: 24 },
};

const HERO_ASPECT: Record<ThemeInput['imagery']['heroAspect'], number> = {
  '3:2': 3 / 2,
  '4:5': 4 / 5,
  '16:9': 16 / 9,
};

const SCRIM_STRENGTH: Record<ThemeInput['imagery']['scrim'], number> = {
  light: 0.35,
  auto: 0.55,
  heavy: 0.78,
};

const MOTION_TIMINGS: Record<
  ThemeInput['motion']['level'],
  { readonly fast: number; readonly base: number; readonly slow: number }
> = {
  none: { fast: 0, base: 0, slow: 0 },
  subtle: { fast: 140, base: 200, slow: 280 },
  expressive: { fast: 180, base: 280, slow: 420 },
};

/* Contrast targets. Body text aims at AAA; non-text separators only need to be perceptible. */
const AAA_TEXT = 7;
const AA_TEXT = 4.5;
const LARGE_TEXT = 3;
const BORDER_MIN = 1.4;
const BORDER_STRONG_MIN = 2.2;

/**
 * A tenant pins its scheme (a wedding is always light, a festival always dark) or follows the
 * device. The editor's preview toggle overrides everything via forceScheme.
 */
export const pickScheme = (input: ThemeInput, context: ResolveContext): Scheme => {
  if (context.forceScheme !== undefined) return context.forceScheme;
  if (input.mode.support === 'system') return context.systemScheme ?? input.mode.default;
  return input.mode.support;
};

/** Stable, cheap hash — the cache key for resolved StyleSheets. */
const hashTheme = (input: ThemeInput, scheme: Scheme): string => {
  const source = `${JSON.stringify(input)}|${scheme}`;
  let hash = 5381;
  for (let i = 0; i < source.length; i += 1) {
    hash = (hash * 33) ^ source.charCodeAt(i);
  }
  return (hash >>> 0).toString(36);
};

export const resolveTheme = (input: ThemeInput, context: ResolveContext = {}): ResolvedTheme => {
  const preset = PRESETS[input.presetId];
  const scheme = pickScheme(input, context);

  const brand = buildRamp(input.brand.seed, scheme);
  const accentSeed = input.brand.accent ?? rotateHue(input.brand.seed, preset.accentShift);
  const accent = buildRamp(accentSeed, scheme);
  const neutral = buildNeutralRamp(
    input.brand.seed,
    input.brand.neutralTint ?? preset.neutralTint,
    scheme,
  );

  const bg = neutral[0];
  const surface = neutral[1];
  const brandSolid = brand[8];
  const accentSolid = accent[8];

  /* Status hues are the preset's, but re-rendered through the ramp so they sit correctly in
     light or dark. Deriving them from the brand seed would let a red theme hide its errors. */
  const statusSolid = (hex: string): string => buildRamp(hex, scheme)[8];
  const success = statusSolid(preset.status.success);
  const warning = statusSolid(preset.status.warning);
  const danger = statusSolid(preset.status.danger);
  const info = statusSolid(preset.status.info);

  const contentOn = (background: string, min: number): string =>
    onColorFor(background, { light: neutral[0], dark: neutral[11] }, min);

  const color: ThemeColors = {
    bg,
    surface,
    surfaceRaised: neutral[2],
    surfaceSunken: bg,

    text: ensureContrast(neutral[11], surface, AAA_TEXT),
    textMuted: ensureContrast(neutral[10], surface, AA_TEXT),
    textFaint: ensureContrast(neutral[9], surface, LARGE_TEXT),
    textInverse: contentOn(neutral[11], AA_TEXT),

    brand: brandSolid,
    onBrand: contentOn(brandSolid, AA_TEXT),
    brandSubtle: brand[2],
    onBrandSubtle: ensureContrast(brand[11], brand[2], AA_TEXT),
    brandBorder: ensureContrast(brand[6], surface, BORDER_MIN),
    accent: accentSolid,
    onAccent: contentOn(accentSolid, AA_TEXT),
    accentSubtle: accent[2],

    border: ensureContrast(neutral[5], surface, BORDER_MIN),
    borderStrong: ensureContrast(neutral[7], surface, BORDER_STRONG_MIN),
    divider: ensureContrast(neutral[4], surface, 1.15),

    success,
    onSuccess: contentOn(success, AA_TEXT),
    warning,
    onWarning: contentOn(warning, AA_TEXT),
    danger,
    onDanger: contentOn(danger, AA_TEXT),
    info,
    onInfo: contentOn(info, AA_TEXT),

    interactive: {
      rest: brandSolid,
      hover: brand[9],
      pressed: brand[10],
      disabled: neutral[4],
      onDisabled: ensureContrast(neutral[8], neutral[4], AA_TEXT),
      focusRing: ensureContrast(brand[8], surface, LARGE_TEXT),
    },

    ramp: { brand, neutral, accent },
  };

  const densityFactor = DENSITY_FACTOR[input.density];
  const radii = CORNER_RADII[input.shape.corner];
  const motionEnabled = input.motion.level !== 'none' && context.reducedMotion !== true;
  const timings = motionEnabled ? MOTION_TIMINGS[input.motion.level] : MOTION_TIMINGS.none;

  /* A scrim tinted toward the brand rather than flat black, so text over photography stays
     legible AND the overlay reads as part of the event's identity. */
  const scrimBase = mix('#000000', brand[11], 0.28);
  const scrimAlpha = SCRIM_STRENGTH[input.imagery.scrim];

  return {
    id: hashTheme(input, scheme),
    scheme,
    presetId: input.presetId,
    color,
    type: buildTypography(input),
    space: (steps: number): number => Math.round(steps * BASE_SPACE * densityFactor),
    radius: radii,
    border: { hairline: 1, standard: 2 },
    image: {
      heroAspect: HERO_ASPECT[input.imagery.heroAspect],
      radius: radii.hero,
      treatment: input.imagery.treatment,
      scrimGradient: [withAlpha(scrimBase, 0), withAlpha(scrimBase, scrimAlpha)],
    },
    motion: { enabled: motionEnabled, ...timings },
    layout: preset.layout,
  };
};
