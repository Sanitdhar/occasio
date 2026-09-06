import { PRESET_IDS, contrast, resolveTheme, themeInputFromPreset } from '@occasio/theme';
import { describe, expect, it } from '@jest/globals';
import { segmentPalette } from './segmentPalette';

/**
 * A relationship between colours, checked across the matrix rather than asserted once.
 *
 * The defect this covers was invisible in every unit test and every screenshot taken in one
 * theme: unselected segments were painted `surfaceRaised`, one step *above* the sunken track
 * they sit in, so the control read as three cards in a well rather than one track with a
 * selection in it.
 */

const SEEDS = ['#2563EB', '#B91C1C', '#0F766E', '#CA8A04', '#7C3AED'];
const SCHEMES = ['light', 'dark'] as const;

const themes = PRESET_IDS.flatMap((preset) =>
  SEEDS.flatMap((seed) =>
    SCHEMES.map((scheme) => ({
      name: `${preset} ${seed} ${scheme}`,
      theme: resolveTheme(themeInputFromPreset(preset, seed), { forceScheme: scheme }),
    })),
  ),
);

describe('segmentPalette', () => {
  it('paints an unselected segment as the track it sits in, in every theme', () => {
    for (const { name, theme } of themes) {
      /* The group's own background is `surfaceSunken`. Anything else and the segment reads as a
         card sitting on the track rather than as part of it. */
      expect([name, segmentPalette(theme, false).background]).toEqual([
        name,
        theme.color.surfaceSunken,
      ]);
    }
  });

  it('makes the selected segment the brand fill, so the choice is not a shade of grey', () => {
    for (const { name, theme } of themes) {
      expect([name, segmentPalette(theme, true).background]).toEqual([name, theme.color.brand]);
    }
  });

  it('keeps both labels readable on their own fill', () => {
    /* Contrast is the reason background and content travel together in a palette at all. An
       unselected segment losing its raised surface must not cost its label. */
    for (const { name, theme } of themes) {
      for (const selected of [true, false]) {
        const palette = segmentPalette(theme, selected);
        expect([name, contrast(palette.content, palette.background) >= 4.5]).toEqual([name, true]);
      }
    }
  });
});
