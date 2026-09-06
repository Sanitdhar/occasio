import { describe, expect, it } from '@jest/globals';
import {
  PRESET_IDS,
  TYPE_SET_IDS,
  contrast,
  resolveTheme,
  themeInputFromPreset,
  type ResolvedTheme,
  type ThemeInput,
} from '@occasio/theme';
import {
  BODY_TEXT_TONES,
  LARGE_TEXT_VARIANTS,
  TEXT_TONES,
  TEXT_VARIANTS,
  textPalette,
  type TextTone,
  type TextVariant,
} from './textTokens';
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

  it('admits exactly the variants that reach WCAG large text at every type scale', () => {
    /* 24px, or 18.66px at weight 700 — the threshold that makes a 3:1 contrast floor legal, and
       therefore the threshold that decides where the `faint` tone may be used. A tenant picks
       the type set and the scale, so a variant only qualifies if it qualifies in all of them:
       `title1` is 24px by default and 22px on `compact`, which is precisely the trap. */
    const isLargeText = (variant: TextVariant, input: ThemeInput): boolean => {
      const { fontSize, fontWeight } = resolveTheme(input).type[variant];
      return fontSize >= 24 || (fontSize >= 18.66 && Number(fontWeight) >= 700);
    };

    const everyTypeInput = PRESET_IDS.flatMap((presetId) =>
      TYPE_SET_IDS.flatMap((setId) =>
        (['compact', 'default', 'grand'] as const).map((scale) => ({
          ...themeInputFromPreset(presetId, '#7C3A5A'),
          typography: { setId, scale },
        })),
      ),
    );

    const qualifying = TEXT_VARIANTS.filter((variant) =>
      everyTypeInput.every((input) => isLargeText(variant, input)),
    );

    expect([...qualifying].sort()).toEqual([...LARGE_TEXT_VARIANTS].sort());
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

  it('admits at body size exactly the tones that owe and clear AA', () => {
    /* The floors below are what the contrast test actually enforces, so this ties the prop-level
       restriction to the measured property rather than to a second hand-maintained list: a tone
       that only reaches 3:1 must not be reachable from a body-sized variant. */
    const aaTones = TEXT_TONES.filter((tone) => PAIRS[tone].min >= 4.5);

    expect([...BODY_TEXT_TONES].sort()).toEqual([...aaTones].sort());
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
