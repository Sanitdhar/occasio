import { describe, expect, it } from '@jest/globals';
import { themeInputFromPreset } from './presets/index.js';
import { pickScheme, resolveTheme } from './resolve.js';
import type { ThemeInput } from './types.js';

const romantic = themeInputFromPreset('romantic', '#7C3A5A');
const conference = themeInputFromPreset('conference', '#2B6CB0');

describe('resolveTheme', () => {
  it('is deterministic — same input, same tokens and same cache id', () => {
    const a = resolveTheme(romantic, { forceScheme: 'light' });
    const b = resolveTheme(romantic, { forceScheme: 'light' });
    expect(a.id).toBe(b.id);
    expect(a.color).toEqual(b.color);
  });

  it('gives light and dark distinct cache ids so styles are never reused across schemes', () => {
    const light = resolveTheme(conference, { forceScheme: 'light' });
    const dark = resolveTheme(conference, { forceScheme: 'dark' });
    expect(light.id).not.toBe(dark.id);
    expect(light.color.surface).not.toBe(dark.color.surface);
  });

  it('produces different palettes for different seeds under the same preset', () => {
    const rose = resolveTheme(themeInputFromPreset('romantic', '#7C3A5A'), {
      forceScheme: 'light',
    });
    const sage = resolveTheme(themeInputFromPreset('romantic', '#3A7C5A'), {
      forceScheme: 'light',
    });
    expect(rose.color.brand).not.toBe(sage.color.brand);
  });

  it('never derives status colours from the seed — a red brand still has a visible danger', () => {
    const redBrand = resolveTheme(themeInputFromPreset('minimal', '#C53030'), {
      forceScheme: 'light',
    });
    const blueBrand = resolveTheme(themeInputFromPreset('minimal', '#2B6CB0'), {
      forceScheme: 'light',
    });
    expect(redBrand.color.danger).toBe(blueBrand.color.danger);
  });
});

describe('scheme selection', () => {
  it('ignores the device when a tenant pins its scheme', () => {
    expect(pickScheme(romantic, { systemScheme: 'dark' })).toBe('light');
  });

  it('follows the device when the tenant supports system', () => {
    expect(pickScheme(conference, { systemScheme: 'dark' })).toBe('dark');
    expect(pickScheme(conference, { systemScheme: 'light' })).toBe('light');
  });

  it('lets the editor preview override everything', () => {
    expect(pickScheme(romantic, { systemScheme: 'light', forceScheme: 'dark' })).toBe('dark');
  });
});

describe('density and motion', () => {
  it('applies density once, in the space() function', () => {
    const cozy: ThemeInput = { ...conference, density: 'cozy' };
    const airy: ThemeInput = { ...conference, density: 'airy' };
    expect(resolveTheme(cozy).space(4)).toBeLessThan(resolveTheme(airy).space(4));
  });

  it('honours reduce-motion regardless of what the tenant configured', () => {
    const expressive: ThemeInput = { ...conference, motion: { level: 'expressive' } };
    const theme = resolveTheme(expressive, { reducedMotion: true });
    expect(theme.motion.enabled).toBe(false);
    expect(theme.motion.base).toBe(0);
  });
});

describe('achromatic seeds', () => {
  it('gives a genuinely monochrome palette instead of inventing a hue', () => {
    const grey = resolveTheme(themeInputFromPreset('minimal', '#7f7f7f'), { forceScheme: 'light' });
    const black = resolveTheme(themeInputFromPreset('minimal', '#000000'), {
      forceScheme: 'light',
    });

    /* Hue 0 at forced saturation used to turn every grey into dusty pink. */
    const [r, g, b] = [
      Number.parseInt(grey.color.brand.slice(1, 3), 16),
      Number.parseInt(grey.color.brand.slice(3, 5), 16),
      Number.parseInt(grey.color.brand.slice(5, 7), 16),
    ];
    expect(Math.max(r, g, b) - Math.min(r, g, b)).toBeLessThanOrEqual(2);
    expect(black.color.brand).toBe(grey.color.brand);
  });
});
