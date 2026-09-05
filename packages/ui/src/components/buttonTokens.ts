import { onColorFor, type ResolvedTheme } from '@occasio/theme';

/**
 * Button's interaction model and its palette, kept free of React and React Native.
 *
 * Both are the parts of a button that can go wrong invisibly: a state that wins over the wrong
 * one, and a hover fill whose label stops being readable. Neither needs a renderer to check, and
 * component rendering is not available yet (#110) — so they live here and are unit-tested.
 */

/** WCAG AA for body-sized text. A button label is body-sized. */
const AA_TEXT = 4.5;

export const BUTTON_VARIANTS = ['primary', 'secondary'] as const;
export type ButtonVariant = (typeof BUTTON_VARIANTS)[number];

export const BUTTON_STATES = ['rest', 'hover', 'pressed', 'disabled'] as const;
export type ButtonState = (typeof BUTTON_STATES)[number];

/** The three signals a pointer can raise. They overlap freely — a button can be hovered *and*
 *  pressed — which is exactly why the winner is decided in one place. */
export type ButtonInteraction = {
  readonly disabled: boolean;
  readonly hovered: boolean;
  readonly pressed: boolean;
};

/**
 * Collapses the signals to the single state that paints.
 *
 * Precedence matters more than it looks: a disabled button still receives hover events on the
 * web (the pointer is over it), so "hovered wins" would light up a control that cannot be used.
 */
export const resolveButtonState = (interaction: ButtonInteraction): ButtonState => {
  if (interaction.disabled) return 'disabled';
  if (interaction.pressed) return 'pressed';
  if (interaction.hovered) return 'hover';
  return 'rest';
};

/**
 * Where focus came from.
 *
 * Modelled as a union rather than two booleans because `focused` and `focusedByPointer` can
 * contradict each other, and the contradiction is silent.
 *
 * Why it is tracked at all: on the web, mousedown focuses the element, so a ring drawn on every
 * focus flashes up after an ordinary click. Only keyboard focus should show a ring — that is
 * what `:focus-visible` does in CSS, and React Native's Pressable does not expose it.
 */
export type FocusOrigin = 'blurred' | 'pointer' | 'keyboard';

export const showsFocusRing = (origin: FocusOrigin, disabled: boolean): boolean =>
  origin === 'keyboard' && !disabled;

export type ButtonTone = {
  readonly background: string;
  readonly border: string;
  readonly label: string;
};

export type ButtonPalette = Readonly<
  Record<ButtonVariant, Readonly<Record<ButtonState, ButtonTone>>>
>;

/**
 * Every colour a button can paint, for one resolved theme.
 *
 * Two things here are load-bearing and were measured, not guessed:
 *
 * 1. The primary label is derived per state instead of always being `color.onBrand`. `onBrand`
 *    is paired with `color.brand` (ramp step 9); the hover and pressed fills are steps 10 and 11.
 *    Across every preset, seed and scheme, `onBrand` on the pressed fill bottoms out at 2.97:1 —
 *    a plain AA failure on the state a user is looking at while they click. `onColorFor` picks
 *    the readable end of the neutral ramp for the fill actually being painted, which is the same
 *    thing the resolver does for its own `on*` tokens, and lifts the floor to 4.5:1.
 *
 * 2. Secondary reads the neutral ramp's component-background steps (indices 2-4) rather than
 *    `surface`/`surfaceRaised`/`surfaceSunken`. `surfaceSunken` resolves to the page background,
 *    so a "pressed" secondary would vanish into the page instead of reacting to the press.
 */
export const buttonPalette = (theme: ResolvedTheme): ButtonPalette => {
  const { color } = theme;
  const { interactive, ramp } = color;

  /* The two ends of the neutral ramp — the same candidate pair the resolver hands to
     onColorFor when it derives onBrand, onDanger and the rest. */
  const labelOn = (fill: string): string =>
    onColorFor(fill, { light: ramp.neutral[0], dark: ramp.neutral[11] }, AA_TEXT);

  const solid = (fill: string): ButtonTone => ({
    background: fill,
    /* Border matches the fill so every variant has identical geometry and no state change
       moves a pixel of layout. */
    border: fill,
    label: labelOn(fill),
  });

  const disabled: ButtonTone = {
    background: interactive.disabled,
    border: interactive.disabled,
    label: interactive.onDisabled,
  };

  return {
    primary: {
      rest: solid(interactive.rest),
      hover: solid(interactive.hover),
      pressed: solid(interactive.pressed),
      disabled,
    },
    secondary: {
      rest: { background: ramp.neutral[2], border: color.border, label: color.text },
      hover: { background: ramp.neutral[3], border: color.borderStrong, label: color.text },
      pressed: { background: ramp.neutral[4], border: color.borderStrong, label: color.text },
      disabled: { ...disabled, border: color.border },
    },
  };
};
