import { describe, expect, it } from '@jest/globals';
import { contrast } from './color.js';
import { themeInputFromPreset } from './presets/index.js';
import { resolveTheme } from './resolve.js';
import { PRESET_IDS, type PresetId, type Scheme } from './types.js';

/**
 * This is the single highest-value test in the repo.
 *
 * The product promise is that an event admin picks one colour and cannot produce an unreadable
 * site. That promise is only real if it holds for colours nobody thought to try — neon yellow,
 * near-black, washed-out grey. So: every preset, against 200 deterministic pseudo-random seeds,
 * in both light and dark, asserting every content/background pair meets its WCAG target.
 *
 * It runs before the theme editor UI exists, because the editor is worthless if this fails.
 */

const SEED_COUNT = 200;
const SCHEMES: readonly Scheme[] = ['light', 'dark'];

/** Deterministic PRNG so a failure is reproducible rather than a flake. */
const mulberry32 = (seed: number): (() => number) => {
  let state = seed;
  return () => {
    state += 0x6d2b79f5;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

const randomHex = (random: () => number): string =>
  `#${Math.floor(random() * 0xffffff)
    .toString(16)
    .padStart(6, '0')}`;

type Requirement = {
  readonly label: string;
  readonly foreground: (t: ReturnType<typeof resolveTheme>) => string;
  readonly background: (t: ReturnType<typeof resolveTheme>) => string;
  readonly min: number;
};

const REQUIREMENTS: readonly Requirement[] = [
  {
    label: 'body text on surface',
    foreground: (t) => t.color.text,
    background: (t) => t.color.surface,
    min: 7,
  },
  {
    label: 'body text on bg',
    foreground: (t) => t.color.text,
    background: (t) => t.color.bg,
    min: 7,
  },
  {
    label: 'muted text on surface',
    foreground: (t) => t.color.textMuted,
    background: (t) => t.color.surface,
    min: 4.5,
  },
  {
    label: 'faint text on surface',
    foreground: (t) => t.color.textFaint,
    background: (t) => t.color.surface,
    min: 3,
  },
  {
    label: 'label on brand',
    foreground: (t) => t.color.onBrand,
    background: (t) => t.color.brand,
    min: 4.5,
  },
  {
    label: 'label on accent',
    foreground: (t) => t.color.onAccent,
    background: (t) => t.color.accent,
    min: 4.5,
  },
  {
    label: 'text on subtle brand',
    foreground: (t) => t.color.onBrandSubtle,
    background: (t) => t.color.brandSubtle,
    min: 4.5,
  },
  {
    label: 'label on danger',
    foreground: (t) => t.color.onDanger,
    background: (t) => t.color.danger,
    min: 4.5,
  },
  {
    label: 'label on success',
    foreground: (t) => t.color.onSuccess,
    background: (t) => t.color.success,
    min: 4.5,
  },
  {
    label: 'disabled label',
    foreground: (t) => t.color.interactive.onDisabled,
    background: (t) => t.color.interactive.disabled,
    min: 4.5,
  },
  {
    label: 'border on surface',
    foreground: (t) => t.color.border,
    background: (t) => t.color.surface,
    min: 1.4,
  },
  {
    label: 'strong border on surface',
    foreground: (t) => t.color.borderStrong,
    background: (t) => t.color.surface,
    min: 2.2,
  },
];

const failuresFor = (presetId: PresetId): string[] => {
  const random = mulberry32(0xc0ffee);
  const failures: string[] = [];

  for (let i = 0; i < SEED_COUNT; i += 1) {
    const seed = randomHex(random);
    for (const scheme of SCHEMES) {
      const theme = resolveTheme(themeInputFromPreset(presetId, seed), { forceScheme: scheme });
      for (const requirement of REQUIREMENTS) {
        const ratio = contrast(requirement.foreground(theme), requirement.background(theme));
        if (ratio < requirement.min) {
          failures.push(
            `${presetId}/${scheme} seed ${seed}: ${requirement.label} was ${ratio.toFixed(2)}:1, needs ${String(requirement.min)}:1`,
          );
        }
      }
    }
  }
  return failures;
};

describe.each(PRESET_IDS)('preset "%s"', (presetId) => {
  it(`stays readable across ${String(SEED_COUNT)} seed colours in light and dark`, () => {
    expect(failuresFor(presetId)).toEqual([]);
  });
});
