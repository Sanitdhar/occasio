/**
 * How much of the width the primary pane takes, as a fraction that can be trusted.
 *
 * A pure function rather than an expression inside the component, because the interesting cases
 * are the ones a rendered test cannot easily reach — and because an inline `Math.min(Math.max(…))`
 * is where `NaN` goes to hide. `NaN` survives both comparisons unchanged, so a ratio of `NaN`
 * clamped that way is still `NaN`, and `flexBasis: "NaN%"` is not a proportion at all: the panes
 * lose their split and the layout silently becomes whatever flexbox does with an invalid value.
 *
 * Every unusable input falls back to an even split rather than throwing. A layout is not worth
 * blanking a screen over, and an even split is visibly *a* layout — someone will notice it is
 * wrong, which is more than can be said for two panes that quietly stopped obeying their ratio.
 */

export const DEFAULT_SPLIT_RATIO = 0.5;

/** Below this a pane is a hairline, which reads as a missing feature rather than a narrow one. */
export const MIN_SPLIT_RATIO = 0.2;
export const MAX_SPLIT_RATIO = 0.8;

export const splitRatio = (ratio: number | undefined): number => {
  if (ratio === undefined || !Number.isFinite(ratio)) return DEFAULT_SPLIT_RATIO;
  return Math.min(Math.max(ratio, MIN_SPLIT_RATIO), MAX_SPLIT_RATIO);
};
