import { describe, expect, it } from '@jest/globals';
import { themeInputFromPreset } from './presets';
import { resolveTheme } from './resolve';

const light = resolveTheme(themeInputFromPreset('romantic', '#7C3A5A'), { forceScheme: 'light' });
const dark = resolveTheme(themeInputFromPreset('festival', '#E8582B'), { forceScheme: 'dark' });

describe('elevation', () => {
  it('rises monotonically, so a higher level is never a flatter shadow', () => {
    const { none, sm, md, lg } = light.elevation;
    /* Pairs rather than array indices: indexing would need a non-null assertion, which lint
       forbids -- and the pairs read better anyway. */
    for (const [lower, higher] of [
      [none, sm],
      [sm, md],
      [md, lg],
    ] as const) {
      expect(higher.y).toBeGreaterThan(lower.y);
      expect(higher.blur).toBeGreaterThan(lower.blur);
      expect(higher.android).toBeGreaterThan(lower.android);
    }
  });

  it('makes "none" genuinely nothing rather than a faint shadow', () => {
    expect(light.elevation.none.opacity).toBe(0);
    expect(light.elevation.none.blur).toBe(0);
    expect(light.elevation.none.android).toBe(0);
  });

  it('deepens shadows in dark mode instead of leaving them invisible', () => {
    /* Light-mode opacities are effectively invisible on a dark surface, so a level tuned in
       light would silently do nothing in dark. */
    expect(dark.elevation.md.opacity).toBeGreaterThan(light.elevation.md.opacity);
    expect(dark.elevation.lg.opacity).toBeLessThanOrEqual(1);
  });

  it('tints the shadow toward the theme rather than using pure black', () => {
    expect(light.elevation.md.color).not.toBe('#000000');
    /* ...and differently per tenant, so a shadow belongs to that event's palette. */
    expect(dark.elevation.md.color).not.toBe(light.elevation.md.color);
  });
});
