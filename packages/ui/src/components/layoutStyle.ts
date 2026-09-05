import type { TextStyle, ViewStyle } from 'react-native';

/**
 * What a caller is allowed to override on a themed component: where it sits, not what it looks
 * like.
 *
 * D17 makes a literal colour or spacing value a lint error, but a `style` prop typed as the full
 * `ViewStyle` still lets a token be smuggled through a variable or a computed string — and that
 * is the failure D17 exists to prevent, just harder to see. Narrowing the prop turns the rule
 * into something the compiler enforces at the call site rather than something lint catches only
 * when the value happens to be written inline.
 *
 * Deliberately absent: colour, radius, border, font, padding, margin and `opacity`. Spacing
 * between components belongs to the parent's `gap`; anything else that looks missing is a
 * variant or a tone, not a style override.
 *
 * TypeScript's excess-property check makes this bite on object literals, which is every call
 * site in practice. A value already typed as `ViewStyle` remains structurally assignable —
 * "these keys and no others" is not expressible without branding every style in the repo.
 */
export type LayoutViewStyle = Pick<
  ViewStyle,
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
  | 'zIndex'
>;

/** The same, plus the two text properties that shape a block without touching a type token. */
export type LayoutTextStyle = LayoutViewStyle & Pick<TextStyle, 'textAlign' | 'textTransform'>;
