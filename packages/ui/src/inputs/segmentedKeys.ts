/**
 * Where an arrow key moves the selection in a radio group.
 *
 * A `radiogroup` is not a row of buttons, and the difference is not only what a screen reader
 * announces: the role promises that arrow keys move between the options and that Tab moves past
 * the whole group. A control that claims the role and ignores the keys is worse than one that
 * never claimed it — a keyboard user is told the behaviour exists and finds it does not.
 *
 * Wrapping, because that is what the role specifies and what every native implementation does:
 * pressing Right on the last option returns to the first. Both axes, because a group can be
 * laid out either way and a keyboard user should not have to know which.
 */

export type ArrowKey = 'ArrowLeft' | 'ArrowRight' | 'ArrowUp' | 'ArrowDown';

const BACKWARD: readonly string[] = ['ArrowLeft', 'ArrowUp'];
const FORWARD: readonly string[] = ['ArrowRight', 'ArrowDown'];

/**
 * The index the selection moves to, or `null` when the key is not one this group handles.
 *
 * `null` rather than "stay where you are", so the caller knows whether to consume the event.
 * Swallowing an unrelated key is how a group breaks Tab, or the browser's own find-as-you-type.
 */
export const nextIndexForKey = (key: string, current: number, count: number): number | null => {
  if (count === 0) return null;

  /* A current index outside the group is not a position to move from. It happens when the
     selected value is not among the options, which is a caller's bug rather than a keypress. */
  const from = current >= 0 && current < count ? current : 0;

  if (BACKWARD.includes(key)) return (from - 1 + count) % count;
  if (FORWARD.includes(key)) return (from + 1) % count;
  /* Home and End are part of the same contract and cost nothing to honour. */
  if (key === 'Home') return 0;
  if (key === 'End') return count - 1;

  return null;
};
