import { describe, expect, it } from '@jest/globals';
import { contrast, resolveTheme, themeInputFromPreset, type ResolvedTheme } from '@occasio/theme';
import { TEXT_TONES, TEXT_VARIANTS, textPalette, type TextTone } from './textTokens';
import { everyTheme } from './themeMatrix.fixture';

describe('text variants', () => {
  it('covers every type role the resolver produces, and invents none', () => {
    /* The point of the test: a role added to ThemeTypography stays unreachable from Text until
       it is listed here, and a variant naming a role that no longer exists is a dead prop.
       Both are silent failures otherwise. */
    const { family: _family, ...roles } = resolveTheme(
      themeInputFromPreset('editorial', '#7C3A5A'),
    ).type;

    expect([...TEXT_VARIANTS].sort()).toEqual(Object.keys(roles).sort());
  });
});

describe('text tones', () => {
  /* Each tone, the background it is designed to sit on, and its WCAG floor. `faint` is a
     large-text tone (3:1); the rest carry body copy and owe AA. */
  const PAIRS: Readonly<
    Record<TextTone, { readonly on: (theme: ResolvedTheme) => string; readonly min: number }>
  > = {
    default: { on: (t) => t.color.surface, min: 4.5 },
    muted: { on: (t) => t.color.surface, min: 4.5 },
    faint: { on: (t) => t.color.surface, min: 3 },
    inverse: { on: (t) => t.color.ramp.neutral[11], min: 4.5 },
    onBrand: { on: (t) => t.color.brand, min: 4.5 },
    onAccent: { on: (t) => t.color.accent, min: 4.5 },
  };

  it('names a background pairing for every tone', () => {
    expect(Object.keys(PAIRS).sort()).toEqual([...TEXT_TONES].sort());
  });

  it.each(TEXT_TONES)('keeps %s readable on its own background, in every theme', (tone) => {
    const pair = PAIRS[tone];

    const failures = everyTheme()
      .map(({ label, theme }) => ({
        label,
        ratio: contrast(textPalette(theme)[tone], pair.on(theme)),
      }))
      .filter(({ ratio }) => ratio < pair.min)
      .map(({ label, ratio }) => `${label} ${ratio.toFixed(2)}:1`);

    expect(failures).toEqual([]);
  });
});
