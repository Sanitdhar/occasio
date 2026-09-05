import { clampChroma, formatHex, oklch, parse, wcagContrast } from 'culori';
import type { Ramp, Scheme } from './types.js';

/**
 * Colour derivation works in OKLCH, not HSL.
 *
 * HSL lightness is perceptually wrong — yellow at L=50% is far brighter than blue at L=50% —
 * which is exactly why naive theming systems produce buttons nobody can read. OKLCH lightness
 * matches human perception, so one set of lightness targets works for every hue.
 *
 * Nothing here imports React, React Native or the data layer (enforced by lint), so the whole
 * engine is synchronously testable and runs anywhere.
 */

/** Lightness targets per ramp step. Shaped like Radix's scales. */
const LIGHT_L = [0.99, 0.975, 0.95, 0.92, 0.89, 0.855, 0.81, 0.74, 0.62, 0.575, 0.52, 0.3] as const;
const DARK_L = [0.17, 0.2, 0.245, 0.28, 0.315, 0.36, 0.42, 0.52, 0.62, 0.665, 0.77, 0.94] as const;

/** Chroma is low at the extremes and peaks at the solid step, so backgrounds stay calm. */
const CHROMA_ARC = [0.1, 0.18, 0.3, 0.42, 0.52, 0.62, 0.74, 0.88, 1.0, 0.98, 0.8, 0.42] as const;

/** Neon seeds get clamped and washed-out ones get revived, so every ramp is usable. */
const MIN_CHROMA = 0.045;
const MAX_CHROMA = 0.16;

/**
 * Below this, a seed has no meaningful hue — it is black, white or a grey. Boosting chroma
 * there would invent a hue the admin never chose (hue 0 turns every grey into dusty pink), so
 * an achromatic seed stays achromatic and the event gets a genuinely monochrome palette.
 */
const ACHROMATIC_CHROMA = 0.02;

/** Neon gets pulled in, washed-out gets revived, grey is left alone deliberately. */
const brandChroma = (chroma: number): number =>
  chroma < ACHROMATIC_CHROMA ? 0 : Math.min(Math.max(chroma, MIN_CHROMA), MAX_CHROMA);

export const isAchromatic = (color: string): boolean => toOklch(color).c < ACHROMATIC_CHROMA;

type Lch = { readonly l: number; readonly c: number; readonly h: number };

const toOklch = (color: string): Lch => {
  const parsed = oklch(parse(color));
  if (parsed === undefined) return { l: 0.5, c: 0.1, h: 0 };
  return { l: parsed.l, c: parsed.c, h: parsed.h ?? 0 };
};

/** Build a displayable hex, pulling chroma into gamut rather than clipping channels. */
const hex = (l: number, c: number, h: number): string =>
  formatHex(
    clampChroma({ mode: 'oklch', l: Math.min(1, Math.max(0, l)), c: Math.max(0, c), h }, 'oklch'),
  );

export const contrast = (foreground: string, background: string): number =>
  wcagContrast(foreground, background);

/** Rotate a hue by degrees, wrapping. Used to derive an accent when none was chosen. */
export const rotateHue = (color: string, degrees: number): string => {
  const { l, c, h } = toOklch(color);
  return hex(l, c, (((h + degrees) % 360) + 360) % 360);
};

/**
 * A 12-step perceptual ramp from a single seed, holding hue and shaping chroma.
 * Steps are listed explicitly rather than mapped so the result is a checked 12-tuple.
 */
export const buildRamp = (seed: string, scheme: Scheme): Ramp => {
  const { c, h } = toOklch(seed);
  const peak = brandChroma(c);
  const l = scheme === 'light' ? LIGHT_L : DARK_L;
  return [
    hex(l[0], peak * CHROMA_ARC[0], h),
    hex(l[1], peak * CHROMA_ARC[1], h),
    hex(l[2], peak * CHROMA_ARC[2], h),
    hex(l[3], peak * CHROMA_ARC[3], h),
    hex(l[4], peak * CHROMA_ARC[4], h),
    hex(l[5], peak * CHROMA_ARC[5], h),
    hex(l[6], peak * CHROMA_ARC[6], h),
    hex(l[7], peak * CHROMA_ARC[7], h),
    hex(l[8], peak * CHROMA_ARC[8], h),
    hex(l[9], peak * CHROMA_ARC[9], h),
    hex(l[10], peak * CHROMA_ARC[10], h),
    hex(l[11], peak * CHROMA_ARC[11], h),
  ] as const;
};

/**
 * The greys. `tint` decides how much of the brand hue bleeds in: 0 is truly neutral, 1 gives
 * surfaces a faint wash of the event's colour, which is what stops a themed app looking like a
 * default template with an accent bolted on.
 */
export const buildNeutralRamp = (seed: string, tint: number, scheme: Scheme): Ramp => {
  const { c, h } = toOklch(seed);
  /* A grey seed tints nothing — otherwise the "neutral" ramp would carry an invented hue. */
  const peak = c < ACHROMATIC_CHROMA ? 0 : Math.min(Math.max(tint, 0), 1) * 0.03;
  const l = scheme === 'light' ? LIGHT_L : DARK_L;
  return [
    hex(l[0], peak * CHROMA_ARC[0], h),
    hex(l[1], peak * CHROMA_ARC[1], h),
    hex(l[2], peak * CHROMA_ARC[2], h),
    hex(l[3], peak * CHROMA_ARC[3], h),
    hex(l[4], peak * CHROMA_ARC[4], h),
    hex(l[5], peak * CHROMA_ARC[5], h),
    hex(l[6], peak * CHROMA_ARC[6], h),
    hex(l[7], peak * CHROMA_ARC[7], h),
    hex(l[8], peak * CHROMA_ARC[8], h),
    hex(l[9], peak * CHROMA_ARC[9], h),
    hex(l[10], peak * CHROMA_ARC[10], h),
    hex(l[11], peak * CHROMA_ARC[11], h),
  ] as const;
};

/**
 * Walk lightness in OKLCH until the WCAG ratio is met.
 *
 * This is the mechanism behind the whole "an admin cannot break readability" promise: contrast
 * is *enforced here*, in the resolver, rather than checked in review. Never fails — it falls
 * back to black or white.
 */
export const ensureContrast = (foreground: string, background: string, min: number): string => {
  if (contrast(foreground, background) >= min) return foreground;

  const fg = toOklch(foreground);
  const bgLightness = toOklch(background).l;
  const direction = bgLightness > 0.5 ? -1 : 1;

  for (let step = 1; step <= 40; step += 1) {
    const candidate = hex(fg.l + direction * step * 0.025, fg.c, fg.h);
    if (contrast(candidate, background) >= min) return candidate;
  }
  return bgLightness > 0.5 ? '#000000' : '#FFFFFF';
};

/** Pick whichever of two content colours reads better on `background`, then guarantee it. */
export const onColorFor = (
  background: string,
  candidates: { readonly light: string; readonly dark: string },
  min: number,
): string => {
  const best =
    contrast(candidates.light, background) >= contrast(candidates.dark, background)
      ? candidates.light
      : candidates.dark;
  return ensureContrast(best, background, min);
};

/** Mix two colours in OKLCH. Used for scrims that belong to the brand rather than being black. */
export const mix = (from: string, to: string, amount: number): string => {
  const a = toOklch(from);
  const b = toOklch(to);
  const t = Math.min(1, Math.max(0, amount));
  const hueDelta = ((b.h - a.h + 540) % 360) - 180;
  return hex(a.l + (b.l - a.l) * t, a.c + (b.c - a.c) * t, a.h + hueDelta * t);
};

/** rgba() string from a hex colour, for scrims and overlays. */
export const withAlpha = (color: string, alpha: number): string => {
  const parsed = parse(color);
  if (parsed === undefined) return `rgba(0, 0, 0, ${String(alpha)})`;
  const channel = (value: number | undefined): number =>
    Math.round(Math.min(1, Math.max(0, value ?? 0)) * 255);
  const rgb = 'r' in parsed && 'g' in parsed && 'b' in parsed ? parsed : undefined;
  if (rgb === undefined) return `rgba(0, 0, 0, ${String(alpha)})`;
  return `rgba(${String(channel(rgb.r))}, ${String(channel(rgb.g))}, ${String(channel(rgb.b))}, ${String(alpha)})`;
};

/** Hue in degrees, used to warn when an accent is indistinguishable from the brand. */
export const hueOf = (color: string): number => toOklch(color).h;

/** Chroma, used to tell the admin when their seed was pulled into a usable range. */
export const chromaOf = (color: string): number => toOklch(color).c;
