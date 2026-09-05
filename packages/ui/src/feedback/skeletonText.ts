import type { TextStyleToken } from '@occasio/theme';

/**
 * The geometry behind <SkeletonText>, kept here as plain arithmetic.
 *
 * Free of React and React Native on purpose, exactly like styleCache: the one property that
 * makes a text skeleton worth having — that it occupies the same vertical space as the text it
 * stands in for — is arithmetic, and arithmetic that can only be exercised through a rendered
 * component is arithmetic nobody checks. Component render tests are not possible yet (#110), so
 * this is the half of the behaviour that can be proven now.
 */

/**
 * A bar drawn at the full font size reads as a solid slab, because a font's em box is mostly
 * the space above the cap and below the baseline. Real ink is roughly cap height, so the bar is
 * drawn at that fraction and centred in the line box.
 */
const INK_RATIO = 0.72;

/** A last line that reached the margin would read as a paragraph that got cut off. */
export const DEFAULT_LAST_LINE_WIDTH = 62;

export type SkeletonTextRow = {
  /**
   * The row's box, equal to one rendered line of this text style. Rows sit flush against each
   * other with no gap — line spacing already lives inside `lineHeight`, and adding a gap on top
   * is what makes a skeleton taller than the text that replaces it.
   */
  readonly lineHeight: number;
  /** The bar inside the box, vertically centred. */
  readonly barHeight: number;
  readonly width: `${number}%`;
};

/**
 * Rows for `lines` lines of text rendered in `token`.
 *
 * Total height is exactly `lines * token.lineHeight`, so swapping the skeleton for the loaded
 * text moves nothing below it.
 *
 * A single line is never shortened: the shortened last line is what makes a paragraph read as a
 * paragraph, and applied to a one-line heading it just reads as a heading rendered wrong.
 */
export const skeletonTextRows = (
  token: TextStyleToken,
  lines: number,
  lastLineWidth: number = DEFAULT_LAST_LINE_WIDTH,
): readonly SkeletonTextRow[] => {
  if (!Number.isInteger(lines) || lines < 1) {
    throw new RangeError(
      `A text skeleton needs a whole number of lines, at least one; got ${String(lines)}`,
    );
  }
  if (!(lastLineWidth > 0 && lastLineWidth <= 100)) {
    throw new RangeError(`lastLineWidth is a percentage in (0, 100]; got ${String(lastLineWidth)}`);
  }

  /* Rounded so the bar lands on whole pixels — a fractional height blurs the top and bottom
     edges on web, which on a two-pixel-tall element is most of it. */
  const barHeight = Math.max(1, Math.round(token.fontSize * INK_RATIO));

  return Array.from({ length: lines }, (_unused, index): SkeletonTextRow => {
    const percent = lines > 1 && index === lines - 1 ? lastLineWidth : 100;
    /* eslint-disable-next-line @typescript-eslint/restrict-template-expressions --
       The template literal *type* is the point: React Native's DimensionValue accepts
       `${number}%` and nothing wider, so String(percent) would widen this to `string` and stop
       it fitting. The interpolated value is a number the guards above have already checked. */
    const width: `${number}%` = `${percent}%`;
    return { lineHeight: token.lineHeight, barHeight, width };
  });
};
