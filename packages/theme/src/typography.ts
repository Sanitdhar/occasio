import type { TextStyleToken, ThemeInput, ThemeTypography, TypeSetId } from './types';

/**
 * Curated typography sets (D10).
 *
 * Metro's require() is static, so a font path cannot be built at runtime — which rules out
 * arbitrary admin font uploads and makes a fixed, statically-mapped set the honest design.
 * `system` is always available and is the fallback while a set is still loading, so text
 * renders immediately rather than blank.
 */
export const TYPE_SETS: Record<
  TypeSetId,
  { readonly label: string; readonly display: string; readonly body: string }
> = {
  editorial: { label: 'Editorial', display: 'PlayfairDisplay', body: 'Inter' },
  modernist: { label: 'Modernist', display: 'Sora', body: 'Inter' },
  romantic: { label: 'Romantic', display: 'CormorantGaramond', body: 'Nunito' },
  festival: { label: 'Festival', display: 'Anton', body: 'WorkSans' },
  humanist: { label: 'Humanist', display: 'Fraunces', body: 'DMSans' },
  system: { label: 'System', display: 'System', body: 'System' },
};

/**
 * Timid 20pt headings are what make apps look like templates, so `scale` mostly moves the
 * display sizes and barely touches body text — the result is dramatic hierarchy that stays
 * readable. `scaleWeight` is how much of the scale factor each token receives.
 */
const SCALE_FACTOR: Record<ThemeInput['typography']['scale'], number> = {
  compact: 0.88,
  default: 1,
  grand: 1.22,
};

type TokenSpec = {
  readonly size: number;
  readonly lineHeightRatio: number;
  readonly tracking: number;
  readonly weight: TextStyleToken['fontWeight'];
  readonly scaleWeight: number;
  readonly display: boolean;
};

const TOKENS = {
  display1: {
    size: 40,
    lineHeightRatio: 1.06,
    tracking: -0.022,
    weight: '600',
    scaleWeight: 1,
    display: true,
  },
  display2: {
    size: 32,
    lineHeightRatio: 1.1,
    tracking: -0.018,
    weight: '600',
    scaleWeight: 0.85,
    display: true,
  },
  title1: {
    size: 24,
    lineHeightRatio: 1.2,
    tracking: -0.012,
    weight: '600',
    scaleWeight: 0.6,
    display: true,
  },
  title2: {
    size: 19,
    lineHeightRatio: 1.3,
    tracking: -0.006,
    weight: '600',
    scaleWeight: 0.35,
    display: false,
  },
  body: {
    size: 16,
    lineHeightRatio: 1.5,
    tracking: 0,
    weight: '400',
    scaleWeight: 0.12,
    display: false,
  },
  bodyStrong: {
    size: 16,
    lineHeightRatio: 1.5,
    tracking: 0,
    weight: '600',
    scaleWeight: 0.12,
    display: false,
  },
  caption: {
    size: 13,
    lineHeightRatio: 1.4,
    tracking: 0.002,
    weight: '400',
    scaleWeight: 0,
    display: false,
  },
  overline: {
    size: 11,
    lineHeightRatio: 1.3,
    tracking: 0.08,
    weight: '600',
    scaleWeight: 0,
    display: false,
  },
} as const satisfies Record<string, TokenSpec>;

const buildToken = (
  spec: TokenSpec,
  factor: number,
  families: { display: string; body: string },
) => {
  const size = Math.round(spec.size * (1 + (factor - 1) * spec.scaleWeight));
  return {
    fontFamily: spec.display ? families.display : families.body,
    fontSize: size,
    lineHeight: Math.round(size * spec.lineHeightRatio),
    letterSpacing: Number((size * spec.tracking).toFixed(2)),
    fontWeight: spec.weight,
  };
};

export const buildTypography = (input: ThemeInput): ThemeTypography => {
  const set = TYPE_SETS[input.typography.setId];
  const factor = SCALE_FACTOR[input.typography.scale];
  const families = { display: set.display, body: set.body };

  return {
    family: { display: set.display, body: set.body, mono: 'System' },
    display1: buildToken(TOKENS.display1, factor, families),
    display2: buildToken(TOKENS.display2, factor, families),
    title1: buildToken(TOKENS.title1, factor, families),
    title2: buildToken(TOKENS.title2, factor, families),
    body: buildToken(TOKENS.body, factor, families),
    bodyStrong: buildToken(TOKENS.bodyStrong, factor, families),
    caption: buildToken(TOKENS.caption, factor, families),
    overline: buildToken(TOKENS.overline, factor, families),
  };
};
