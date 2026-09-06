import { describe, expect, it } from '@jest/globals';
import { DEFAULT_SPLIT_RATIO, MAX_SPLIT_RATIO, MIN_SPLIT_RATIO, splitRatio } from './splitRatio';

describe('splitRatio', () => {
  it('passes a sensible ratio through untouched', () => {
    expect(splitRatio(0.5)).toBe(0.5);
    expect(splitRatio(0.35)).toBe(0.35);
  });

  it('clamps a pane that would be a hairline', () => {
    expect(splitRatio(0.01)).toBe(MIN_SPLIT_RATIO);
    expect(splitRatio(0.99)).toBe(MAX_SPLIT_RATIO);
    expect(splitRatio(0)).toBe(MIN_SPLIT_RATIO);
    expect(splitRatio(1)).toBe(MAX_SPLIT_RATIO);
  });

  it('falls back for every value that cannot be a proportion', () => {
    /*
     * `NaN` is the one that motivated this. It survives both comparisons in a
     * `Math.min(Math.max(…))` unchanged, so clamping does not catch it, and the result reaches
     * `flexBasis` as `"NaN%"` — not a proportion at all. The panes stop obeying their split and
     * nothing reports it.
     */
    expect(splitRatio(Number.NaN)).toBe(DEFAULT_SPLIT_RATIO);
    expect(splitRatio(Number.POSITIVE_INFINITY)).toBe(DEFAULT_SPLIT_RATIO);
    expect(splitRatio(Number.NEGATIVE_INFINITY)).toBe(DEFAULT_SPLIT_RATIO);
    expect(splitRatio(undefined)).toBe(DEFAULT_SPLIT_RATIO);
  });

  it('always returns something flexBasis can use', () => {
    /* The property the component depends on, asserted over the awkward inputs together: a
       finite number inside the clamp, whatever arrives. */
    for (const input of [Number.NaN, Infinity, -Infinity, undefined, -5, 0, 0.5, 1, 1e9]) {
      const result = splitRatio(input);
      expect(Number.isFinite(result)).toBe(true);
      expect(result).toBeGreaterThanOrEqual(MIN_SPLIT_RATIO);
      expect(result).toBeLessThanOrEqual(MAX_SPLIT_RATIO);
    }
  });
});
