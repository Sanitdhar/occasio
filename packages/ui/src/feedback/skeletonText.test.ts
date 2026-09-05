import { resolveTheme, themeInputFromPreset } from '@occasio/theme';
import { describe, expect, it } from '@jest/globals';
import { DEFAULT_LAST_LINE_WIDTH, skeletonTextRows } from './skeletonText';

/* Real resolved tokens rather than a hand-written fixture. A fixture would have to state a
   fontSize and a lineHeight as literals — which D17 rightly rejects — and would also let this
   suite keep passing against metrics the resolver no longer produces. */
const { type } = resolveTheme(themeInputFromPreset('conference', '#2B6CB0'), {
  forceScheme: 'light',
});

describe('skeletonTextRows', () => {
  it('occupies exactly the height of the text it stands in for', () => {
    const total = skeletonTextRows(type.body, 4).reduce((sum, row) => sum + row.lineHeight, 0);

    expect(total).toBe(4 * type.body.lineHeight);
  });

  it('measures each variant from its own token, not from a shared guess', () => {
    const [heading] = skeletonTextRows(type.display1, 1);
    const [caption] = skeletonTextRows(type.caption, 1);

    expect(heading?.lineHeight).toBe(type.display1.lineHeight);
    expect(caption?.lineHeight).toBe(type.caption.lineHeight);
    expect(heading?.barHeight).toBeGreaterThan(caption?.barHeight ?? 0);
  });

  it('draws the bar at ink height, not at the height of the line box', () => {
    const [row] = skeletonTextRows(type.body, 1);

    /* The gap between the two is the point: a bar as tall as the line box leaves no space
       between lines and reads as one solid slab. */
    expect(row?.barHeight).toBeLessThan(type.body.lineHeight);
    expect(row?.barHeight).toBeGreaterThan(0);
    expect(row?.barHeight).toBe(Math.round(row?.barHeight ?? 0));
  });

  it('shortens the last line of a paragraph', () => {
    const rows = skeletonTextRows(type.body, 3);

    expect(rows.map((row) => row.width)).toEqual([
      '100%',
      '100%',
      `${String(DEFAULT_LAST_LINE_WIDTH)}%`,
    ]);
  });

  it('leaves a single line full width, because one short line reads as a broken heading', () => {
    expect(skeletonTextRows(type.body, 1).map((row) => row.width)).toEqual(['100%']);
  });

  it('honours an explicit last-line width', () => {
    expect(skeletonTextRows(type.body, 2, 40).map((row) => row.width)).toEqual(['100%', '40%']);
  });

  it('rejects line counts that cannot describe a layout', () => {
    expect(() => skeletonTextRows(type.body, 0)).toThrow(RangeError);
    expect(() => skeletonTextRows(type.body, -1)).toThrow(RangeError);
    expect(() => skeletonTextRows(type.body, 1.5)).toThrow(RangeError);
  });

  it('rejects a last-line width that is not a percentage', () => {
    expect(() => skeletonTextRows(type.body, 2, 0)).toThrow(RangeError);
    expect(() => skeletonTextRows(type.body, 2, 140)).toThrow(RangeError);
    expect(() => skeletonTextRows(type.body, 2, Number.NaN)).toThrow(RangeError);
  });
});
