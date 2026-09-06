import type { ChipProps } from './Chip';

/**
 * Compile-time proof that the primitive prop types reject what they claim to reject.
 *
 * Same reasoning as the file of this name under `components/`: a union that silently admits
 * everything looks exactly like one that works, and `tsc` is the only assertion available for a
 * type. Nothing here runs; it is a source file rather than a test because Jest strips types.
 */

/** `true` when `Value` is NOT assignable to `Shape` — i.e. the type rejects it. */
type Rejects<Value, Shape> = [Value] extends [Shape] ? false : true;

/** `true` when `Value` IS assignable — a legitimate call still compiles. */
type Accepts<Value, Shape> = [Value] extends [Shape] ? true : false;

export const PRIMITIVE_TYPE_CONTRACTS: {
  /* A selected chip is a checkbox, so it needs something to toggle. Without this, `selected`
     alone compiled and painted the selected palette while rendering no `role="checkbox"` and no
     `aria-checked` — visible to anyone who can see the colour, invisible to anyone who cannot. */
  readonly selectedWithoutOnPressIsRejected: Rejects<
    { children: 'Vegetarian'; selected: true },
    ChipProps
  >;
  readonly selectedFalseWithoutOnPressIsRejected: Rejects<
    { children: 'Vegetarian'; selected: false },
    ChipProps
  >;

  /* …while the two shapes a chip is actually allowed to have still compile. */
  readonly toggleChipIsAccepted: Accepts<
    { children: 'Vegetarian'; selected: true; onPress: () => void },
    ChipProps
  >;
  readonly plainTagIsAccepted: Accepts<{ children: 'Vegetarian' }, ChipProps>;
  readonly actionChipIsAccepted: Accepts<{ children: 'Clear'; onPress: () => void }, ChipProps>;
} = {
  selectedWithoutOnPressIsRejected: true,
  selectedFalseWithoutOnPressIsRejected: true,
  toggleChipIsAccepted: true,
  plainTagIsAccepted: true,
  actionChipIsAccepted: true,
};
