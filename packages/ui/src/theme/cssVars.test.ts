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

  it('emits every token group, not just colour', () => {
    /* A partial mirror is a trap: CSS that reaches for a missing token silently renders
       nothing, and the omission is invisible until someone writes that rule. */
    for (const name of [
      '--occasio-border-hairline',
      '--occasio-type-display1-size',
      '--occasio-type-overline-weight',
      '--occasio-image-hero-aspect',
      '--occasio-motion-fast',
      '--occasio-breakpoint-md',
    ]) {
      expect(vars[name]).toBeDefined();
    }
  });

  it('leaves aspect-ratio unitless, because CSS aspect-ratio takes a number', () => {
    expect(vars['--occasio-image-hero-aspect']).not.toContain('px');
    expect(Number.isNaN(Number(vars['--occasio-image-hero-aspect']))).toBe(false);
  });

  it('collapses durations to zero when motion is off', () => {
    const still = toCssVars(
      resolveTheme(themeInputFromPreset('minimal', '#3F5B7C'), {
        forceScheme: 'light',
        reducedMotion: true,
      }),
    );
    expect(still['--occasio-motion-enabled']).toBe('0');
    expect(still['--occasio-motion-base']).toBe('0ms');
  });

  it('produces different values for different tenants', () => {
    const other = toCssVars(
      resolveTheme(themeInputFromPreset('festival', '#E8582B'), { forceScheme: 'dark' }),
    );
    expect(other['--occasio-color-brand']).not.toBe(vars['--occasio-color-brand']);
  });
});
