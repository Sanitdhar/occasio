import {
  TYPE_SET_IDS,
  type TextStyleToken,
  type ThemeInput,
  type ThemeTypography,
  type TypeSetId,
} from './types';

/**
 * The two weights every curated set ships.
 *
 * `expo-font` registers one file per family name, so a family loaded from a single Regular cut
 * has no bold at all and the platform fakes one by thickening the outline. Shipping the real
 * SemiBold cut is one extra file per family and the difference between "designed" and "nearly
 * right" — see {@link fontFace} for the measurement.
 */
export const FONT_WEIGHTS = ['400', '600'] as const;
export type FontWeight = (typeof FONT_WEIGHTS)[number];

/**
 * `@expo-google-fonts/*` names its exports `<Family>_<weight><Style>`, so using that exact
 * string as the registered family name means the module the app statically imports and the
 * value written into `fontFamily` are the same identifier. One name, no mapping table to drift.
 */
const WEIGHT_FACE = { '400': '400Regular', '600': '600SemiBold' } as const;

/** The platform's own UI font. Never registered, always present — which is what makes it the
 *  fallback that guarantees text is never blank. */
export const SYSTEM_FAMILY = 'System';

type FamilySpec = {
  readonly family: string;
  /** The weights this set actually bundles for the family. Non-empty by construction. */
  readonly weights: readonly [FontWeight, ...FontWeight[]];
};

type TypeSetSpec = {
  readonly label: string;
  /** A line a picker can render in the set's own faces, so the choice is shown, not described. */
  readonly sample: string;
  readonly display: FamilySpec;
  readonly body: FamilySpec;
};

/**
 * Curated typography sets (D10).
 *
 * Metro's require() is static, so a font path cannot be built at runtime — which rules out
 * arbitrary admin font uploads and makes a fixed, statically-mapped set the honest design.
 * `system` is always available and is the fallback while a set is still loading, so text
 * renders immediately rather than blank.
 *
 * `weights` lists only what each set bundles, which is what keeps the download small: the
 * display face is only ever used at heading weight, so only its SemiBold cut ships. Anton has
 * no SemiBold at all — it is a single-weight poster face — so it declares `['400']` and
 * `fontFace()` degrades to it rather than pretending a 600 exists.
 */
export const TYPE_SETS = {
  editorial: {
    label: 'Editorial',
    sample: 'The ceremony begins at five',
    display: { family: 'PlayfairDisplay', weights: ['600'] },
    body: { family: 'Inter', weights: ['400', '600'] },
  },
  modernist: {
    label: 'Modernist',
    sample: 'Doors open at seven sharp',
    display: { family: 'Sora', weights: ['600'] },
    body: { family: 'Inter', weights: ['400', '600'] },
  },
  romantic: {
    label: 'Romantic',
    sample: 'Save the date, and bring flowers',
    display: { family: 'CormorantGaramond', weights: ['600'] },
    body: { family: 'Nunito', weights: ['400', '600'] },
  },
  festival: {
    label: 'Festival',
    sample: 'Main stage, Saturday night',
    display: { family: 'Anton', weights: ['400'] },
    body: { family: 'WorkSans', weights: ['400', '600'] },
  },
  humanist: {
    label: 'Humanist',
    sample: 'You are warmly invited',
    display: { family: 'Fraunces', weights: ['600'] },
    body: { family: 'DMSans', weights: ['400', '600'] },
  },
  system: {
    label: 'System',
    sample: 'Whatever this device already has',
    display: { family: SYSTEM_FAMILY, weights: ['400', '600'] },
    body: { family: SYSTEM_FAMILY, weights: ['400', '600'] },
  },
} as const satisfies Record<TypeSetId, TypeSetSpec>;

/** Every set except `system`, which has nothing to download. */
export type LoadableTypeSetId = Exclude<TypeSetId, 'system'>;

export const LOADABLE_TYPE_SET_IDS: readonly LoadableTypeSetId[] = TYPE_SET_IDS.filter(
  (id): id is LoadableTypeSetId => id !== 'system',
);

type FaceNamesOf<F> = F extends {
  family: infer N extends string;
  weights: infer W extends readonly FontWeight[];
}
  ? `${N}_${(typeof WEIGHT_FACE)[W[number]]}`
  : never;

/**
 * The exact font family names a set needs registered — derived from the set's own declaration
 * above, so the app's static `require()` map is a compile error away from drifting out of sync
 * with the sets it is meant to serve.
 */
export type TypeSetFace<K extends LoadableTypeSetId> =
  FaceNamesOf<(typeof TYPE_SETS)[K]['display']> | FaceNamesOf<(typeof TYPE_SETS)[K]['body']>;

const faceNamesOf = (spec: FamilySpec): readonly string[] =>
  spec.family === SYSTEM_FAMILY
    ? []
    : spec.weights.map((weight) => `${spec.family}_${WEIGHT_FACE[weight]}`);

/** The runtime twin of {@link TypeSetFace}: what has to be loaded before a set can be used. */
export const typeSetFaces = (setId: TypeSetId): readonly string[] => {
  const set = TYPE_SETS[setId];
  return [...new Set([...faceNamesOf(set.display), ...faceNamesOf(set.body)])];
};

const nearestWeight = (
  available: readonly [FontWeight, ...FontWeight[]],
  wanted: FontWeight,
): FontWeight =>
  available.reduce((best, weight) =>
    Math.abs(Number(weight) - Number(wanted)) < Math.abs(Number(best) - Number(wanted))
      ? weight
      : best,
  );

/**
 * The registered family for a design weight, plus the weight that family *actually is*.
 *
 * Returning the real weight is what stops a browser faking one. A custom family registered by
 * `expo-font` holds exactly one face, so asking it for a weight it does not have gets faux
 * bold: measured in Chromium against this export, `Anton_400Regular` at `font-weight: 600`
 * lays down 21% more ink than the same string at 400, and `Inter_400Regular` 40% more. Asking
 * `PlayfairDisplay_600SemiBold` for 600 changes nothing, because that is the weight it is.
 * Keeping the requested weight equal to the face's own weight is what makes every case behave
 * like the last one.
 *
 * The system family keeps the *design* weight instead, because there one family covers every
 * weight and the weight is the only lever there is.
 */
export const fontFace = (
  spec: FamilySpec,
  wanted: FontWeight,
): { readonly family: string; readonly weight: FontWeight } => {
  if (spec.family === SYSTEM_FAMILY) return { family: SYSTEM_FAMILY, weight: wanted };
  const weight = nearestWeight(spec.weights, wanted);
  return { family: `${spec.family}_${WEIGHT_FACE[weight]}`, weight };
};

export type TypeSetSpecimen = {
  readonly id: TypeSetId;
  readonly label: string;
  readonly sample: string;
  /** The typefaces by name, for the caption under the sample — not the registered face names,
   *  which carry a weight suffix an admin has no reason to read. */
  readonly typefaces: { readonly display: string; readonly body: string };
  readonly display: { readonly fontFamily: string; readonly fontWeight: FontWeight };
  readonly body: { readonly fontFamily: string; readonly fontWeight: FontWeight };
};

/**
 * Everything a set picker needs to show a set in its own faces rather than describe it in
 * words. Pure, so the picker can render a specimen for a set whose fonts have not loaded yet by
 * asking for the `system` specimen's faces and keeping this one's label.
 */
export const typeSetSpecimen = (setId: TypeSetId): TypeSetSpecimen => {
  const set = TYPE_SETS[setId];
  const display = fontFace(set.display, '600');
  const body = fontFace(set.body, '400');
  return {
    id: setId,
    label: set.label,
    sample: set.sample,
    typefaces: { display: set.display.family, body: set.body.family },
    display: { fontFamily: display.family, fontWeight: display.weight },
    body: { fontFamily: body.family, fontWeight: body.weight },
  };
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
  readonly weight: FontWeight;
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
  set: (typeof TYPE_SETS)[TypeSetId],
): TextStyleToken => {
  const size = Math.round(spec.size * (1 + (factor - 1) * spec.scaleWeight));
  const face = fontFace(spec.display ? set.display : set.body, spec.weight);
  return {
    fontFamily: face.family,
    fontSize: size,
    lineHeight: Math.round(size * spec.lineHeightRatio),
    letterSpacing: Number((size * spec.tracking).toFixed(2)),
    fontWeight: face.weight,
  };
};

export const buildTypography = (input: ThemeInput): ThemeTypography => {
  const set = TYPE_SETS[input.typography.setId];
  const factor = SCALE_FACTOR[input.typography.scale];

  return {
    family: {
      display: fontFace(set.display, '600').family,
      body: fontFace(set.body, '400').family,
      mono: SYSTEM_FAMILY,
    },
    display1: buildToken(TOKENS.display1, factor, set),
    display2: buildToken(TOKENS.display2, factor, set),
    title1: buildToken(TOKENS.title1, factor, set),
    title2: buildToken(TOKENS.title2, factor, set),
    body: buildToken(TOKENS.body, factor, set),
    bodyStrong: buildToken(TOKENS.bodyStrong, factor, set),
    caption: buildToken(TOKENS.caption, factor, set),
    overline: buildToken(TOKENS.overline, factor, set),
  };
};
