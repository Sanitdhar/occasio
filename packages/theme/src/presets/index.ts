import type { PresetId, ThemeInput } from '../types.js';

/**
 * Presets are the primary admin UI (D7, D10): most people pick one and change the seed colour,
 * and that should already look good.
 *
 * A preset owns the things an admin must not be able to break — status hues above all. If
 * "danger" were derived from the brand seed, a red wedding theme would make errors invisible.
 */
export type Preset = {
  readonly id: PresetId;
  readonly label: string;
  readonly description: string;
  /** Hue rotation used to derive an accent when the admin has not chosen one. */
  readonly accentShift: number;
  readonly neutralTint: number;
  /** Fixed status hues — never derived from the seed. */
  readonly status: {
    readonly success: string;
    readonly warning: string;
    readonly danger: string;
    readonly info: string;
  };
  readonly defaults: Omit<ThemeInput, 'version' | 'presetId' | 'brand'>;
  readonly layout: {
    readonly maxContentWidth: number;
    readonly breakpoints: { readonly sm: number; readonly md: number; readonly lg: number };
  };
};

const STATUS = {
  success: '#2F855A',
  warning: '#B7791F',
  danger: '#C53030',
  info: '#2B6CB0',
} as const;

const BREAKPOINTS = { sm: 480, md: 768, lg: 1200 } as const;

export const PRESETS: Record<PresetId, Preset> = {
  editorial: {
    id: 'editorial',
    label: 'Editorial',
    description: 'Big photography, generous whitespace, a serif display over a clean sans.',
    accentShift: 32,
    neutralTint: 0.25,
    status: STATUS,
    layout: { maxContentWidth: 720, breakpoints: BREAKPOINTS },
    defaults: {
      mode: { support: 'system', default: 'light' },
      typography: { setId: 'editorial', scale: 'grand' },
      shape: { corner: 'soft' },
      density: 'airy',
      imagery: { heroAspect: '3:2', treatment: 'none', scrim: 'auto' },
      motion: { level: 'subtle' },
    },
  },
  romantic: {
    id: 'romantic',
    label: 'Romantic',
    description: 'Warm, soft and unhurried. Built for weddings, and pinned to light.',
    accentShift: -24,
    neutralTint: 0.45,
    status: STATUS,
    layout: { maxContentWidth: 680, breakpoints: BREAKPOINTS },
    defaults: {
      mode: { support: 'light', default: 'light' },
      typography: { setId: 'romantic', scale: 'grand' },
      shape: { corner: 'round' },
      density: 'airy',
      imagery: { heroAspect: '4:5', treatment: 'warm', scrim: 'auto' },
      motion: { level: 'subtle' },
    },
  },
  festival: {
    id: 'festival',
    label: 'Festival',
    description: 'Loud, dark and high energy. Saturated surfaces and heavy display type.',
    accentShift: 148,
    neutralTint: 0.6,
    status: STATUS,
    layout: { maxContentWidth: 860, breakpoints: BREAKPOINTS },
    defaults: {
      mode: { support: 'dark', default: 'dark' },
      typography: { setId: 'festival', scale: 'grand' },
      shape: { corner: 'round' },
      density: 'comfortable',
      imagery: { heroAspect: '4:5', treatment: 'duotone', scrim: 'heavy' },
      motion: { level: 'expressive' },
    },
  },
  conference: {
    id: 'conference',
    label: 'Conference',
    description: 'Dense, scannable and professional. Tracks, times and wayfinding first.',
    accentShift: 210,
    neutralTint: 0.15,
    status: STATUS,
    layout: { maxContentWidth: 960, breakpoints: BREAKPOINTS },
    defaults: {
      mode: { support: 'system', default: 'light' },
      typography: { setId: 'modernist', scale: 'default' },
      shape: { corner: 'soft' },
      density: 'cozy',
      imagery: { heroAspect: '16:9', treatment: 'none', scrim: 'light' },
      motion: { level: 'subtle' },
    },
  },
  minimal: {
    id: 'minimal',
    label: 'Minimal',
    description: 'Neutral surfaces, one accent, a tight grid. The most forgiving base.',
    accentShift: 0,
    neutralTint: 0.05,
    status: STATUS,
    layout: { maxContentWidth: 760, breakpoints: BREAKPOINTS },
    defaults: {
      mode: { support: 'system', default: 'light' },
      typography: { setId: 'humanist', scale: 'default' },
      shape: { corner: 'sharp' },
      density: 'comfortable',
      imagery: { heroAspect: '3:2', treatment: 'mono', scrim: 'light' },
      motion: { level: 'none' },
    },
  },
};

/** A complete ThemeInput for a preset, ready to persist as a new event's theme row. */
export const themeInputFromPreset = (id: PresetId, seed: string): ThemeInput => {
  const preset = PRESETS[id];
  return {
    version: 1,
    presetId: id,
    brand: { seed, neutralTint: preset.neutralTint },
    ...preset.defaults,
  };
};
