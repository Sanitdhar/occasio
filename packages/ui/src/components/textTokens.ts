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
