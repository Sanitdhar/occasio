import { z } from 'zod';

/**
 * D10 — two layers, deliberately separated.
 *
 *   ThemeInput  (~25 fields, JSON, this is the persisted row)
 *        |  resolveTheme(input, ctx)   <- pure, synchronous, deterministic
 *        v
 *   ResolvedTheme  (~150 semantic tokens, never persisted)
 *
 * The admin never picks `borderSubtle`. They pick a preset and a seed colour, and the resolver
 * derives everything else. That is what keeps the persisted row small and forward-compatible,
 * and what makes it impossible for a non-designer to produce an unreadable site.
 */

export const PRESET_IDS = ['editorial', 'romantic', 'festival', 'conference', 'minimal'] as const;
export type PresetId = (typeof PRESET_IDS)[number];

export const TYPE_SET_IDS = [
  'editorial',
  'modernist',
  'romantic',
  'festival',
  'humanist',
  'system',
] as const;
export type TypeSetId = (typeof TYPE_SET_IDS)[number];

export type Scheme = 'light' | 'dark';

const HEX_COLOR = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;
const HexColor = z.string().regex(HEX_COLOR, 'Expected a hex colour such as #7C3A5A');

/** The whole tenant theme row. Versioned from day one — see migrateThemeInput(). */
export const ThemeInputSchema = z.object({
  version: z.literal(1),
  presetId: z.enum(PRESET_IDS),
  brand: z.object({
    /** The one colour the admin actually picks. Everything else is derived from it. */
    seed: HexColor,
    accent: HexColor.optional(),
    /** How much of the brand hue bleeds into the greys. 0 = neutral, 1 = strongly tinted. */
    neutralTint: z.number().min(0).max(1).optional(),
  }),
  mode: z.object({
    /** A wedding pins light; a festival pins dark; a conference follows the device. */
    support: z.enum(['light', 'dark', 'system']),
    default: z.enum(['light', 'dark']),
  }),
  typography: z.object({
    setId: z.enum(TYPE_SET_IDS),
    scale: z.enum(['compact', 'default', 'grand']),
  }),
  shape: z.object({ corner: z.enum(['sharp', 'soft', 'round']) }),
  density: z.enum(['cozy', 'comfortable', 'airy']),
  imagery: z.object({
    heroAspect: z.enum(['3:2', '4:5', '16:9']),
    treatment: z.enum(['none', 'duotone', 'warm', 'mono']),
    scrim: z.enum(['auto', 'light', 'heavy']),
  }),
  motion: z.object({ level: z.enum(['none', 'subtle', 'expressive']) }),
});

export type ThemeInput = z.infer<typeof ThemeInputSchema>;

/**
 * A 12-step perceptual ramp, modelled as a tuple so indexing it is checked at compile time
 * (the repo runs with noUncheckedIndexedAccess).
 *
 * 1-2 app background · 3-5 component backgrounds · 6-8 borders · 9 solid brand · 10 hover
 * 11 low-contrast text · 12 high-contrast text
 */
export type Ramp = readonly [
  string,
  string,
  string,
  string,
  string,
  string,
  string,
  string,
  string,
  string,
  string,
  string,
];

/**
 * A ready-to-spread text style. Deliberately NOT React Native's TextStyle: the theme package
 * stays free of React Native so the resolver can run anywhere, including in tests and on a
 * server. The UI package adapts these to platform styles.
 */
export type TextStyleToken = {
  readonly fontFamily: string;
  readonly fontSize: number;
  readonly lineHeight: number;
  readonly letterSpacing: number;
  readonly fontWeight: '400' | '500' | '600' | '700';
};

export type ThemeColors = {
  /* Backgrounds, ordered by depth */
  readonly bg: string;
  readonly surface: string;
  readonly surfaceRaised: string;
  readonly surfaceSunken: string;
  /* Content */
  readonly text: string;
  readonly textMuted: string;
  readonly textFaint: string;
  readonly textInverse: string;
  /* Brand roles */
  readonly brand: string;
  readonly onBrand: string;
  readonly brandSubtle: string;
  readonly onBrandSubtle: string;
  readonly brandBorder: string;
  readonly accent: string;
  readonly onAccent: string;
  readonly accentSubtle: string;
  /* Lines */
  readonly border: string;
  readonly borderStrong: string;
  readonly divider: string;
  /* Status — owned by the preset, NEVER derived from the seed, so a red brand cannot make
     errors invisible. */
  readonly success: string;
  readonly onSuccess: string;
  readonly warning: string;
  readonly onWarning: string;
  readonly danger: string;
  readonly onDanger: string;
  readonly info: string;
  readonly onInfo: string;
  /* Interaction — precomputed, not opacity hacks */
  readonly interactive: {
    readonly rest: string;
    readonly hover: string;
    readonly pressed: string;
    readonly disabled: string;
    readonly onDisabled: string;
    readonly focusRing: string;
  };
  readonly ramp: {
    readonly brand: Ramp;
    readonly neutral: Ramp;
    readonly accent: Ramp;
  };
};

export type ThemeTypography = {
  readonly family: { readonly display: string; readonly body: string; readonly mono: string };
  readonly display1: TextStyleToken;
  readonly display2: TextStyleToken;
  readonly title1: TextStyleToken;
  readonly title2: TextStyleToken;
  readonly body: TextStyleToken;
  readonly bodyStrong: TextStyleToken;
  readonly caption: TextStyleToken;
  readonly overline: TextStyleToken;
};

/**
 * A shadow described in platform-neutral terms.
 *
 * The design doc sketched `elevation` as React Native `ViewStyle` objects, but that would drag
 * React Native types into this package, which must stay platform-free so the resolver runs in a
 * plain test and on a server. The spec is translated per platform in `@occasio/ui` instead:
 * `boxShadow` on web, `shadow*` plus Android's `elevation` on native.
 */
export type ElevationSpec = {
  readonly y: number;
  readonly blur: number;
  readonly spread: number;
  readonly opacity: number;
  /** Tinted toward the theme rather than pure black, so shadows belong to the palette. */
  readonly color: string;
  /** Android's elevation scale, which is a single number rather than a shadow description. */
  readonly android: number;
};

export type ThemeElevation = {
  readonly none: ElevationSpec;
  readonly sm: ElevationSpec;
  readonly md: ElevationSpec;
  readonly lg: ElevationSpec;
};

export type ResolvedTheme = {
  /** Stable hash of (input, scheme). Used as the style-cache key — see createStyles. */
  readonly id: string;
  readonly scheme: Scheme;
  readonly presetId: PresetId;
  readonly color: ThemeColors;
  readonly type: ThemeTypography;
  /** space(4) -> 16 at comfortable density. Density is a multiplier applied once, here. */
  readonly space: (steps: number) => number;
  readonly radius: {
    readonly xs: number;
    readonly sm: number;
    readonly md: number;
    readonly lg: number;
    readonly pill: number;
    readonly hero: number;
  };
  readonly border: { readonly hairline: number; readonly standard: number };
  readonly elevation: ThemeElevation;
  readonly image: {
    readonly heroAspect: number;
    readonly radius: number;
    readonly treatment: ThemeInput['imagery']['treatment'];
    readonly scrimGradient: readonly [string, string];
  };
  readonly motion: {
    readonly enabled: boolean;
    readonly fast: number;
    readonly base: number;
    readonly slow: number;
  };
  readonly layout: {
    readonly maxContentWidth: number;
    readonly breakpoints: { readonly sm: number; readonly md: number; readonly lg: number };
  };
};

export type ResolveContext = {
  /** The device's scheme, when the tenant follows the system. */
  readonly systemScheme?: Scheme | undefined;
  /** Overrides everything — used by the theme editor's light/dark preview toggle. */
  readonly forceScheme?: Scheme | undefined;
  /** Honours the OS "reduce motion" setting. */
  readonly reducedMotion?: boolean | undefined;
};
