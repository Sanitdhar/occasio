import type { ResolvedTheme } from '@occasio/theme';

/**
 * Breakpoints, as a decision rather than a media query.
 *
 * React Native has no CSS, so there is nothing to write `@media` against: the width arrives
 * from `useWindowDimensions()` and the thresholds from the theme. Keeping the choice in a pure
 * function rather than inline in a component is what makes it testable at all — the alternative
 * is asserting layout through a rendered tree, which is slow and tells you less.
 *
 * Mobile-first, and the direction is load-bearing. `atLeast('md')` reads as "this is a tablet or
 * wider", so a component that forgets to handle a size gets the phone layout — the one that
 * works everywhere. The opposite default hands a phone a desktop layout, which is the failure
 * nobody sees until they open it on a phone.
 */

export const BREAKPOINT_NAMES = ['sm', 'md', 'lg'] as const;

export type BreakpointName = (typeof BREAKPOINT_NAMES)[number];

/** Below the `sm` threshold there is no name — that is the base, and the base is a phone. */
export type Breakpoint = 'base' | BreakpointName;

/** Ordered smallest first, so an index comparison answers "at least this wide". */
const ORDER: readonly Breakpoint[] = ['base', ...BREAKPOINT_NAMES];

/**
 * The widest breakpoint this window has reached.
 *
 * Uses `>=` deliberately: a threshold of 768 means 768 *is* `md`, which is what a designer
 * means by it and what CSS does. Exactly-on-the-boundary is the case a hand-written comparison
 * gets wrong, and the one a device with that exact width sits on forever.
 */
export const breakpointFor = (
  width: number,
  breakpoints: ResolvedTheme['layout']['breakpoints'],
): Breakpoint => {
  if (width >= breakpoints.lg) return 'lg';
  if (width >= breakpoints.md) return 'md';
  if (width >= breakpoints.sm) return 'sm';
  return 'base';
};

/** Whether the current breakpoint is `name` or wider. */
export const atLeast = (current: Breakpoint, name: Breakpoint): boolean =>
  ORDER.indexOf(current) >= ORDER.indexOf(name);
