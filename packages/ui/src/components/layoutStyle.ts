import type { TextStyle, ViewStyle } from 'react-native';

/**
 * What a caller is allowed to override on a themed component: where it sits, not what it looks
 * like.
 *
 * D17 makes a literal colour or spacing value a lint error, but a `style` prop typed as the full
 * `ViewStyle` still lets a token be smuggled through a variable or a computed string — and that
 * is the failure D17 exists to prevent, just harder to see. Narrowing the prop turns the rule
 * into something the compiler enforces at the call site.
 *
 * Deliberately absent: colour, radius, border, font, padding, margin and `opacity`. Spacing
 * between components belongs to the parent's `gap`; anything else that looks missing is a
 * variant or a tone, not a style override. The list is deliberately tight — widening it later
 * is a non-breaking change, narrowing it is not.
 *
 * `top`, `right`, `bottom` and `left` are absent for the same reason as `margin`, and it is
 * worth writing down because they read as layout: an inset is a distance, so `left: 13` is a
 * spacing value off the theme's scale, arriving through the one prop that was narrowed to keep
 * spacing values out. Where a child genuinely has to be positioned, it is the parent that knows
 * where — so the parent wraps it in a positioned `View` of its own, which is the same answer
 * `gap` gives for the space between two components. `position` and `zIndex` stay: they are
 * enumerations and a layer index, and neither can express a distance.
 */

type LayoutViewKey =
  | 'alignSelf'
  | 'display'
  | 'flex'
  | 'flexBasis'
  | 'flexGrow'
  | 'flexShrink'
  | 'width'
  | 'minWidth'
  | 'maxWidth'
  | 'height'
  | 'minHeight'
  | 'maxHeight'
  | 'position'
  | 'zIndex';

/** Plus the two text properties that shape a block without touching a type token. */
type LayoutTextKey = LayoutViewKey | 'textAlign' | 'textTransform';

/**
 * Every key that is *not* allowed, typed `never`.
 *
 * `Pick` alone only stops an inline object literal, because that is all TypeScript's
 * excess-property check covers — a value already typed `ViewStyle` stays structurally
 * assignable, and `const s: ViewStyle = { backgroundColor: brandFromSomewhere }` would sail
 * through. Declaring the excluded keys as optional `never` makes such a value fail to assign,
 * which is what closes the variable-smuggling route the lint rule cannot see.
 */
type Forbidden<Style, Allowed extends keyof Style> = Readonly<
  Partial<Record<Exclude<keyof Style, Allowed>, never>>
>;

export type LayoutViewStyle = Pick<ViewStyle, LayoutViewKey> & Forbidden<ViewStyle, LayoutViewKey>;

export type LayoutTextStyle = Pick<TextStyle, LayoutTextKey> & Forbidden<TextStyle, LayoutTextKey>;
