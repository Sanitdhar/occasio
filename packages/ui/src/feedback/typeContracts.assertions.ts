import type { EmptyStateProps } from './EmptyState';

/**
 * Compile-time proof that the feedback components' `style` props are the narrowed ones.
 *
 * `LayoutViewStyle` is contract-tested where it is defined, which proves the *type* rejects a
 * colour. It says nothing about whether a given component uses it — and `EmptyState` did not:
 * its prop stayed `StyleProp<ViewStyle>` after #120 narrowed the others, leaving the D17
 * boundary open at exactly one component (#138 item 4).
 *
 * That is the harder half of D17 to see. The lint rule catches a literal colour in a stylesheet;
 * it cannot catch a token handed in through a variable at a call site, which is what a wide
 * `style` prop allows. Nothing here runs — it is a source file rather than a test because Jest
 * strips types, and `tsc` is the only assertion available for a type.
 */

/** `true` when `Value` is NOT assignable to `Shape` — i.e. the prop rejects it. */
type Rejects<Value, Shape> = [Value] extends [Shape] ? false : true;

/** `true` when `Value` IS assignable — a legitimate call still compiles. */
type Accepts<Value, Shape> = [Value] extends [Shape] ? true : false;

/** A complete, valid call. The style under test is the only thing that varies below. */
type EmptyStateCall<Style> = { title: 'No photos yet'; style: Style };

export const FEEDBACK_TYPE_CONTRACTS: {
  readonly emptyStateRejectsColour: Rejects<
    EmptyStateCall<{ backgroundColor: 'red' }>,
    EmptyStateProps
  >;
  readonly emptyStateRejectsPadding: Rejects<EmptyStateCall<{ padding: 8 }>, EmptyStateProps>;
  readonly emptyStateRejectsRadius: Rejects<EmptyStateCall<{ borderRadius: 8 }>, EmptyStateProps>;

  /* …while the layout the prop exists for still goes through. A prop that rejects everything is
     not a narrowed prop, it is a broken one — and with `title` required, a contract built from
     `style` alone would have "rejected" every one of these for the wrong reason. */
  readonly emptyStateAcceptsLayout: Accepts<
    EmptyStateCall<{ maxWidth: 480; alignSelf: 'center' }>,
    EmptyStateProps
  >;
} = {
  emptyStateRejectsColour: true,
  emptyStateRejectsPadding: true,
  emptyStateRejectsRadius: true,
  emptyStateAcceptsLayout: true,
};
