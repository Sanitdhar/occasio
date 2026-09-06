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
  | 'top'
  | 'right'
  | 'bottom'
  | 'left'
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
