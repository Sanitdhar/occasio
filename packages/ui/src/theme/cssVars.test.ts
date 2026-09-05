import { describe, expect, it } from '@jest/globals';
import { resolveTheme, themeInputFromPreset } from '@occasio/theme';
import { toCssVars } from './cssVars';

const theme = resolveTheme(themeInputFromPreset('romantic', '#7C3A5A'), { forceScheme: 'light' });
const vars = toCssVars(theme);

describe('toCssVars', () => {
  it('emits every name as a CSS custom property', () => {
    const wrong = Object.keys(vars).filter((k) => !k.startsWith('--occasio-'));
    expect(wrong).toEqual([]);
  });

  it('carries the resolved values through unchanged rather than recomputing them', () => {
    expect(vars['--occasio-color-brand']).toBe(theme.color.brand);
    expect(vars['--occasio-color-interactive-hover']).toBe(theme.color.interactive.hover);
    expect(vars['--occasio-ramp-brand-9']).toBe(theme.color.ramp.brand[8]);
  });

  it('gives numeric tokens CSS units, since a bare number is invalid in CSS', () => {
    expect(vars['--occasio-radius-lg']).toBe(`${String(theme.radius.lg)}px`);
    expect(vars['--occasio-space-4']).toBe(`${String(theme.space(4))}px`);
    expect(vars['--occasio-motion-base']).toBe(`${String(theme.motion.base)}ms`);
  });

  it('flattens the nested colour object rather than emitting "[object Object]"', () => {
    /* theme.color contains `interactive` and `ramp`, which are objects. Naive iteration
       stringifies them into unusable values. */
    expect(Object.values(vars)).not.toContain('[object Object]');
    expect(vars['--occasio-color-interactive']).toBeUndefined();
    expect(vars['--occasio-color-ramp']).toBeUndefined();
  });

  it('produces different values for different tenants', () => {
    const other = toCssVars(
      resolveTheme(themeInputFromPreset('festival', '#E8582B'), { forceScheme: 'dark' }),
    );
    expect(other['--occasio-color-brand']).not.toBe(vars['--occasio-color-brand']);
  });
});
