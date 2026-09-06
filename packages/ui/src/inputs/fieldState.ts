/**
 * What a field says beneath itself, and how a screen reader is told about it.
 *
 * Pulled out of the component because it is the part with decisions in it, and because the
 * combinations that matter are awkward to reach through a rendered tree: a field with both a
 * hint and an error, a field whose error arrives while it is focused, a field with neither.
 *
 * The rule the rest follows: **an error replaces the hint rather than joining it.** Two lines of
 * small text under an input, one of them red, is a layout that shifts as validation runs — and
 * the hint is advice for filling the field in, which stops being the most useful thing to say
 * the moment the field is wrong.
 */

export type FieldMessage = {
  /** The text shown beneath the input, or `null` when there is nothing to say. */
  readonly text: string | null;
  /** Which tone renders it: an error is not merely red, it is announced differently. */
  readonly tone: 'hint' | 'error';
  /**
   * `aria-invalid`, and the reason it is separate from the tone: a field can be invalid with no
   * message — a required field left empty on submit — and a screen reader must still say so.
   */
  readonly invalid: boolean;
};

export const fieldMessage = (
  hint: string | null | undefined,
  error: string | null | undefined,
): FieldMessage => {
  const trimmedError = error?.trim() ?? '';
  if (trimmedError !== '') return { text: trimmedError, tone: 'error', invalid: true };

  /*
   * An unprintable error is still an error. `error=""` is what a validator produces when it
   * knows the field is wrong and has nothing to say about it, and the hint does not come back:
   * "Optional" under a field the form is refusing is worse than silence, because it is advice
   * that contradicts what just happened.
   */
  const invalid = error !== null && error !== undefined;
  if (invalid) return { text: null, tone: 'error', invalid: true };

  const trimmedHint = hint?.trim() ?? '';
  return { text: trimmedHint === '' ? null : trimmedHint, tone: 'hint', invalid: false };
};

/**
 * The ids a field wires together, or `undefined` where there is nothing to point at.
 *
 * `aria-describedby` pointing at an element that does not exist is worse than omitting it: a
 * screen reader announces nothing and the author believes the description is being read.
 */
export const fieldAria = (
  id: string,
  message: FieldMessage,
): {
  readonly labelId: string;
  readonly messageId: string | undefined;
  readonly describedBy: string | undefined;
} => {
  const messageId = message.text === null ? undefined : `${id}-message`;
  return { labelId: `${id}-label`, messageId, describedBy: messageId };
};
