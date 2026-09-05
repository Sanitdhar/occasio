import type { ResolvedTheme, ThemeTypography } from '@occasio/theme';

/**
 * The type roles Text can render, and the colour each tone reads.
 *
 * Free of React and React Native on purpose: the variant list and the tone palette are the two
 * things about Text that can be checked without rendering it, and jest-expo cannot be installed
 * yet (#110). Keeping them here means the checks are real tests rather than a rendered smoke
 * test nobody can run.
 */

/**
 * Every type role the resolver produces, and nothing else — Text does not invent sizes. The
 * `satisfies` clause makes a typo a compile error; textTokens.test.ts proves the list is also
 * *complete*, so a role added to the theme cannot stay unreachable from the component.
 */
export const TEXT_VARIANTS = [
  'display1',
  'display2',
  'title1',
  'title2',
  'body',
  'bodyStrong',
  'caption',
  'overline',
] as const satisfies readonly Exclude<keyof ThemeTypography, 'family'>[];

export type TextVariant = (typeof TEXT_VARIANTS)[number];

/**
 * The variants that reach WCAG's "large scale" threshold — 24px, or 18.66px at weight 700 — at
 * *every* type scale a tenant can pick, which is what makes the 3:1 contrast floor legal.
 *
 * Only the two display roles clear it. `title1` looks like it should and does not: it resolves
 * to 22px on the `compact` scale. That is why the list is measured by textTokens.test.ts across
 * every preset, type set and scale rather than chosen by eye.
 */
export const LARGE_TEXT_VARIANTS = [
  'display1',
  'display2',
] as const satisfies readonly TextVariant[];

export type LargeTextVariant = (typeof LARGE_TEXT_VARIANTS)[number];
export type SmallTextVariant = Exclude<TextVariant, LargeTextVariant>;

/**
 * Tones are limited to the content colours the resolver already guarantees a contrast floor for.
 *
 * `brand`, `danger`, `success` and `warning` are deliberately absent. They are solid *fill*
 * colours: measured across every preset, seed and scheme they bottom out around 3.4:1 against
 * the page background, so offering them as text tones would ship a WCAG AA failure that looks
 * like a design choice. Text-safe status colours belong in the resolver next to `textMuted`,
 * not in a cast at the call site.
 */
export const TEXT_TONES = ['default', 'muted', 'faint', 'inverse', 'onBrand', 'onAccent'] as const;

export type TextTone = (typeof TEXT_TONES)[number];

/**
 * The tones that clear AA (4.5:1) and are therefore legal at any size.
 *
 * `faint` is the one that is not: `textFaint` is resolved against a 3:1 floor, which WCAG allows
 * only for large text. Text's props pair it with `LARGE_TEXT_VARIANTS` so `<Text tone="faint">`
 * on body or caption copy is a compile error rather than an accessibility bug nobody sees.
 */
export const BODY_TEXT_TONES = [
  'default',
  'muted',
  'inverse',
  'onBrand',
  'onAccent',
] as const satisfies readonly TextTone[];

export type BodyTextTone = (typeof BODY_TEXT_TONES)[number];

export type TextToneColors = Readonly<Record<TextTone, string>>;

/** Resolves each tone to its token. Pure, so the contrast floors are testable directly. */
export const textPalette = (theme: ResolvedTheme): TextToneColors => ({
  default: theme.color.text,
  muted: theme.color.textMuted,
  faint: theme.color.textFaint,
  /** For text on the darkest neutral — a scrim or an inverted surface. */
  inverse: theme.color.textInverse,
  /** For text sitting on a solid brand or accent fill, such as a primary button label. */
  onBrand: theme.color.onBrand,
  onAccent: theme.color.onAccent,
});
