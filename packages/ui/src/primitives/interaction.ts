import { contrast, mix, type ResolvedTheme } from '@occasio/theme';
import type { TonalPalette } from './tones';

/**
 * What a pressable box looks like in each of its four states, as a pure function of the theme.
 *
 * Kept free of React and React Native so the property that matters — content still meets AA on
 * the *hovered* and *pressed* fills, not merely on the resting one — is testable without
 * rendering anything.
 */

export type PressState = {
  readonly hovered: boolean;
  readonly pressed: boolean;
  readonly focused: boolean;
  readonly disabled: boolean;
};

/** How far the fill travels along the neutral ramp. Small: this is a tint, not a colour change. */
const HOVER_MIX = 0.06;
const PRESSED_MIX = 0.12;

const AA_TEXT = 4.5;

export const DISABLED_OPACITY = 0.45;

/**
 * Which way the fill moves when the box is hovered or pressed.
 *
 * The default is toward `ramp.neutral[11]`, the high-contrast end — one formula that works in
 * both schemes without a branch, because neutral[11] is near-black in light and near-white in
 * dark. So hover darkens a light card and lightens a dark one.
 *
 * The default is wrong for a filled chip whose content already sits near that end: darkening a
 * yellow `warning` chip that carries dark text pushes the pair below AA, and it was measured
 * doing exactly that (4.50 resting to 3.84 pressed across the preset x seed sweep). When the
 * strongest state would break AA, the fill moves the other way instead.
 *
 * The direction is decided once, from the *pressed* mix, so hover and press never travel in
 * opposite directions — a box that darkens on hover and lightens on press looks broken.
 */
const fillDirection = (theme: ResolvedTheme, palette: TonalPalette): string => {
  const toward = theme.color.ramp.neutral[11];
  const away = theme.color.ramp.neutral[0];

  const strongest = mix(palette.background, toward, PRESSED_MIX);
  if (contrast(palette.content, strongest) >= AA_TEXT) return toward;

  const flipped = mix(palette.background, away, PRESSED_MIX);
  return contrast(palette.content, flipped) >= contrast(palette.content, strongest) ? away : toward;
};

/**
 * The fill for an interactive box in a given state.
 *
 * A disabled box does not react — it keeps its resting fill and is dimmed by
 * `DISABLED_OPACITY` instead, so "nothing happened" reads as "this is off" rather than as a
 * dropped tap.
 */
export const interactiveFill = (
  theme: ResolvedTheme,
  palette: TonalPalette,
  state: PressState,
): string => {
  if (state.disabled) return palette.background;
  if (!state.pressed && !state.hovered) return palette.background;

  const target = fillDirection(theme, palette);
  return mix(palette.background, target, state.pressed ? PRESSED_MIX : HOVER_MIX);
};
