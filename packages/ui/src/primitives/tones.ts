import type { ResolvedTheme } from '@occasio/theme';

/**
 * The vocabulary the surface primitives are built from. Deliberately free of React Native so it
 * stays unit-testable: every value below is a pure function of the resolved theme, which is what
 * lets the contrast properties in tones.test.ts run against every preset and hundreds of seeds
 * without rendering anything.
 *
 * Sizes are enumerated, never free numbers — the same guardrail the theme editor uses (density is
 * cozy/comfortable/airy, not a px field). A caller cannot write `padding={13}`, so a stylesheet
 * covering the whole matrix can be built once per theme and cached.
 */

/** Padding and gap steps, in `theme.space()` units. */
export const SPACE_STEPS = { none: 0, xs: 1, sm: 2, md: 4, lg: 6 } as const;

export type SpaceScale = keyof typeof SPACE_STEPS;

/** Corner sizes: the theme's radii, plus square. */
export type RadiusScale = 'none' | keyof ResolvedTheme['radius'];

/**
 * Hairline is the default and `strong` is rare. There is no shadow option: tonal separation plus
 * a hairline is the house style, because drop shadows date a product instantly and render
 * differently on every platform. Genuinely floating UI — a sheet, a menu — gets its elevation
 * from the component that owns it, not from every box on the screen.
 */
export type BorderTone = 'none' | 'hairline' | 'strong';

/**
 * Depth is expressed as two steps of the neutral ramp, not as elevation. `bg` is the page,
 * `surface` sits on it, `raised` sits on that.
 */
export type SurfaceTone = 'sunken' | 'base' | 'raised';

export const surfaceBackground = (theme: ResolvedTheme, tone: SurfaceTone): string => {
  switch (tone) {
    case 'sunken':
      return theme.color.surfaceSunken;
    case 'base':
      return theme.color.surface;
    case 'raised':
      return theme.color.surfaceRaised;
  }
};

/**
 * A background, its hairline and the content that sits on it, always taken as a set.
 *
 * They travel together because the resolver only guarantees contrast for specific pairs
 * (`onBrandSubtle` on `brandSubtle`, `onSuccess` on `success`). Letting a caller pick a
 * background and a text colour independently is exactly how a theme-safe palette becomes an
 * unreadable one.
 */
export type TonalPalette = {
  readonly background: string;
  readonly border: string;
  readonly content: string;
};

/**
 * `brand` is the tinted form and `brandSolid` the filled one — selection is a single visual
 * state rather than a variant of every tone, so a row of chips stays readable when one is on.
 *
 * Status tones are filled rather than tinted because the theme guarantees contrast for the
 * `on*` pairs only; a tinted `dangerSubtle` would need a new role in the resolver, and inventing
 * one here is how a colour ends up unchecked.
 */
export type TonalTone =
  'neutral' | 'brand' | 'brandSolid' | 'success' | 'warning' | 'danger' | 'info';

export const tonalPalette = (theme: ResolvedTheme, tone: TonalTone): TonalPalette => {
  const c = theme.color;
  switch (tone) {
    case 'neutral':
      return { background: c.surfaceRaised, border: c.border, content: c.text };
    case 'brand':
      return { background: c.brandSubtle, border: c.brandBorder, content: c.onBrandSubtle };
    case 'brandSolid':
      return { background: c.brand, border: c.brand, content: c.onBrand };
    case 'success':
      return { background: c.success, border: c.success, content: c.onSuccess };
    case 'warning':
      return { background: c.warning, border: c.warning, content: c.onWarning };
    case 'danger':
      return { background: c.danger, border: c.danger, content: c.onDanger };
    case 'info':
      return { background: c.info, border: c.info, content: c.onInfo };
  }
};

export const TONAL_TONES: readonly TonalTone[] = [
  'neutral',
  'brand',
  'brandSolid',
  'success',
  'warning',
  'danger',
  'info',
];

export const SURFACE_TONES: readonly SurfaceTone[] = ['sunken', 'base', 'raised'];
