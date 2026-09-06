import { useMemo, useState } from 'react';

export type PressHandlers = {
  readonly onHoverIn: () => void;
  readonly onHoverOut: () => void;
  readonly onFocus: () => void;
  readonly onBlur: () => void;
};

/**
 * Hover and focus, which React Native does not hand back the way it hands back `pressed`.
 *
 * `pressed` arrives through Pressable's style callback, so it is deliberately absent here — two
 * sources of truth for the same state is how a box gets stuck looking pressed.
 *
 * Hover matters more than it looks: web is the first platform to ship (D30), and a card that
 * does not respond to the cursor reads as static content rather than as something you can open.
 */
export const usePressState = (): {
  readonly hovered: boolean;
  readonly focused: boolean;
  readonly handlers: PressHandlers;
} => {
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);

  /* State setters are stable, so these handlers are built once and never re-render a child. */
  const handlers = useMemo<PressHandlers>(
    () => ({
      onHoverIn: () => {
        setHovered(true);
      },
      onHoverOut: () => {
        setHovered(false);
      },
      onFocus: () => {
        setFocused(true);
      },
      onBlur: () => {
        setFocused(false);
      },
    }),
    [],
  );

  return { hovered, focused, handlers };
};
