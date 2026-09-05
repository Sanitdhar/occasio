import { PRESET_IDS, contrast, resolveTheme, themeInputFromPreset } from '@occasio/theme';
import type { ResolvedTheme, Scheme } from '@occasio/theme';
import { describe, expect, it } from '@jest/globals';
import { interactiveFill, type PressState } from './interaction';
import { SPACE_STEPS, SURFACE_TONES, TONAL_TONES, surfaceBackground, tonalPalette } from './tones';

/**
 * The primitives promise two things the theme package cannot check on its own: that every
 * palette a component is able to select is readable, and that "tonal surfaces, not shadows"
 * produces a step you can actually see.
 *
 * Both are pure functions of the resolved theme, so they are swept across every preset, both
 * schemes and a deterministic spread of seeds — including the neon and near-black ones an admin
 * will eventually try. No rendering is involved, which is why this can run at all before
 * jest-expo exists (#110).
 *
 * Each sweep collects the themes that failed rather than stopping at the first, so a failure
 * says which preset, scheme, seed and tone broke and by how much.
 */

const SEED_COUNT = 120;
const SCHEMES: readonly Scheme[] = ['light', 'dark'];

const AA_TEXT = 4.5;
const AAA_TEXT = 7;
/* Around where a flat fill stops reading as the same colour as the one next to it. */
const PERCEPTIBLE = 1.03;

/** Deterministic PRNG so a failure reproduces rather than flakes. */
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

const random = mulberry32(0x0cca5107);

const SEEDS: readonly string[] = [
  /* Adversarial cases first: a neon, a near-black, a near-white and a pure grey. */
  '#00ff00',
  '#050505',
  '#fafafa',
  '#808080',
  ...Array.from({ length: SEED_COUNT }, () => randomHex(random)),
];

type Case = { readonly theme: ResolvedTheme; readonly label: string };

const CASES: readonly Case[] = PRESET_IDS.flatMap((presetId) =>
  SCHEMES.flatMap((scheme) =>
    SEEDS.map((seed) => ({
      theme: resolveTheme(themeInputFromPreset(presetId, seed), { forceScheme: scheme }),
      label: `${presetId}/${scheme}/${seed}`,
    })),
  ),
);

/** Runs `check` over every theme and returns one line per failure. */
const sweep = (check: (theme: ResolvedTheme) => readonly string[]): readonly string[] =>
  CASES.flatMap(({ theme, label }) => check(theme).map((failure) => `${label} — ${failure}`));

const state = (overrides: Partial<PressState> = {}): PressState => ({
  hovered: false,
  pressed: false,
  focused: false,
  disabled: false,
  ...overrides,
});

describe('the sweep itself', () => {
  it('covers every preset, both schemes and the adversarial seeds', () => {
    expect(CASES).toHaveLength(PRESET_IDS.length * SCHEMES.length * SEEDS.length);
    expect(CASES.length).toBeGreaterThan(1000);
  });
});

describe('space scale', () => {
  it('starts at nothing and only ever increases', () => {
    const steps = Object.values(SPACE_STEPS);
    expect(steps[0]).toBe(0);
    expect([...steps].sort((a, b) => a - b)).toEqual(steps);
  });
});

describe('surface tones', () => {
  it('separate by lightness, with no shadow to fall back on', () => {
    const failures = sweep((theme) => {
      const sunken = surfaceBackground(theme, 'sunken');
      const base = surfaceBackground(theme, 'base');
      const raised = surfaceBackground(theme, 'raised');

      const problems: string[] = [];
      if (contrast(base, sunken) <= 1) {
        problems.push(`base is not above sunken (${base} on ${sunken})`);
      }
      const step = contrast(raised, base);
      if (step < PERCEPTIBLE) problems.push(`raised/base step only ${step.toFixed(3)}`);
      return problems;
    });

    expect(failures).toEqual([]);
  });

  it('keep body text at AAA whichever tone a box uses', () => {
    const failures = sweep((theme) =>
      SURFACE_TONES.flatMap((tone) => {
        const ratio = contrast(theme.color.text, surfaceBackground(theme, tone));
        return ratio >= AAA_TEXT ? [] : [`text on ${tone} is ${ratio.toFixed(2)}`];
      }),
    );

    expect(failures).toEqual([]);
  });
});

describe('tonal palettes', () => {
  it('keep their content at AA on their own background', () => {
    const failures = sweep((theme) =>
      TONAL_TONES.flatMap((tone) => {
        const palette = tonalPalette(theme, tone);
        const ratio = contrast(palette.content, palette.background);
        return ratio >= AA_TEXT ? [] : [`${tone} content is ${ratio.toFixed(2)}`];
      }),
    );

    expect(failures).toEqual([]);
  });

  it('stay visible against the surface they sit on', () => {
    /* A chip is either filled differently from the page or outlined against it — a neutral chip
       relies on its hairline, a status chip on its fill. Either is fine; neither is not. */
    const failures = sweep((theme) =>
      TONAL_TONES.flatMap((tone) => {
        const palette = tonalPalette(theme, tone);
        const visible = Math.max(
          contrast(palette.background, theme.color.surface),
          contrast(palette.border, theme.color.surface),
        );
        return visible >= 1.3
          ? []
          : [`${tone} disappears into the surface (${visible.toFixed(2)})`];
      }),
    );

    expect(failures).toEqual([]);
  });
});

describe('interactive fill', () => {
  it('does not move a disabled box', () => {
    const failures = sweep((theme) =>
      TONAL_TONES.flatMap((tone) => {
        const palette = tonalPalette(theme, tone);
        const hovered = interactiveFill(theme, palette, state({ disabled: true, hovered: true }));
        const pressed = interactiveFill(theme, palette, state({ disabled: true, pressed: true }));
        return hovered === palette.background && pressed === palette.background
          ? []
          : [`${tone} reacted while disabled`];
      }),
    );

    expect(failures).toEqual([]);
  });

  it('leaves a resting box exactly as it was', () => {
    const failures = sweep((theme) =>
      TONAL_TONES.flatMap((tone) => {
        const palette = tonalPalette(theme, tone);
        return interactiveFill(theme, palette, state()) === palette.background
          ? []
          : [`${tone} moved at rest`];
      }),
    );

    expect(failures).toEqual([]);
  });

  it('shifts perceptibly on hover and further on press, in one direction', () => {
    const failures = sweep((theme) =>
      TONAL_TONES.flatMap((tone) => {
        const palette = tonalPalette(theme, tone);
        const hoverShift = contrast(
          interactiveFill(theme, palette, state({ hovered: true })),
          palette.background,
        );
        const pressShift = contrast(
          interactiveFill(theme, palette, state({ pressed: true })),
          palette.background,
        );

        const problems: string[] = [];
        if (hoverShift <= 1.02)
          problems.push(`${tone} hover is invisible (${hoverShift.toFixed(3)})`);
        /* Same direction, further along it. Choosing the direction per state is how a box ends
           up darkening on hover and lightening on press. */
        if (pressShift <= hoverShift) {
          problems.push(
            `${tone} press (${pressShift.toFixed(3)}) does not go beyond hover (${hoverShift.toFixed(3)})`,
          );
        }
        return problems;
      }),
    );

    expect(failures).toEqual([]);
  });

  it('never drops its content below AA in any state', () => {
    /* This is why interaction.ts picks a direction instead of always mixing toward the
       high-contrast end. Measured before the flip existed: a filled warning chip with dark text
       fell to 3.84 when pressed. */
    const failures = sweep((theme) =>
      TONAL_TONES.flatMap((tone) => {
        const palette = tonalPalette(theme, tone);
        const states = [
          ['hovered', state({ hovered: true })],
          ['pressed', state({ pressed: true })],
        ] as const;

        return states.flatMap(([name, pressState]) => {
          const ratio = contrast(palette.content, interactiveFill(theme, palette, pressState));
          return ratio >= AA_TEXT ? [] : [`${tone} content when ${name} is ${ratio.toFixed(2)}`];
        });
      }),
    );

    expect(failures).toEqual([]);
  });
});
