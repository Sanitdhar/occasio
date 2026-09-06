import { describe, expect, it } from '@jest/globals';
import { fieldAria, fieldMessage } from './fieldState';

describe('fieldMessage', () => {
  it('shows the hint when there is no error', () => {
    expect(fieldMessage('We will only use this for the seating plan', null)).toEqual({
      text: 'We will only use this for the seating plan',
      tone: 'hint',
      invalid: false,
    });
  });

  it('replaces the hint with the error rather than showing both', () => {
    /* Two lines of small text under an input, one of them red, is a layout that shifts as
       validation runs — and advice for filling a field in stops being the most useful thing to
       say the moment the field is wrong. */
    expect(fieldMessage('Any format is fine', 'That is not an email address')).toEqual({
      text: 'That is not an email address',
      tone: 'error',
      invalid: true,
    });
  });

  it('says nothing when there is nothing to say', () => {
    expect(fieldMessage(null, null).text).toBeNull();
    expect(fieldMessage(undefined, undefined).text).toBeNull();
  });

  it('treats an empty error as invalid, and still withholds the hint', () => {
    /*
     * What a validator produces when it knows the field is wrong and has nothing printable to
     * say — a required field left blank on submit. It is invalid, and the hint does not come
     * back: "Optional" under a field the form is refusing is worse than silence, because it is
     * advice contradicting what just happened.
     */
    const state = fieldMessage('Optional', '');

    expect(state.invalid).toBe(true);
    expect(state.text).toBeNull();
    expect(state.tone).toBe('error');
  });

  it('treats a whitespace error the same way', () => {
    /* `error={serverError}` where the server sent `"  "` is not readable and is still not ok. */
    const state = fieldMessage('A hint', '   ');

    expect(state.invalid).toBe(true);
    expect(state.text).toBeNull();
  });

  it('ignores whitespace that is not a hint', () => {
    expect(fieldMessage('   ', null).text).toBeNull();
  });
});

describe('fieldAria', () => {
  it('describes the field by its message when there is one', () => {
    const state = fieldMessage(null, 'Required');
    expect(fieldAria('guest-email', state).describedBy).toBe('guest-email-message');
  });

  it('points at nothing when there is no message', () => {
    /*
     * `aria-describedby` naming an element that does not exist is worse than omitting it: the
     * screen reader announces nothing and the author believes a description is being read.
     */
    const state = fieldMessage(null, null);

    expect(fieldAria('guest-email', state).describedBy).toBeUndefined();
    expect(fieldAria('guest-email', state).messageId).toBeUndefined();
  });

  it('keeps the label id stable whether or not there is a message', () => {
    expect(fieldAria('guest-email', fieldMessage(null, null)).labelId).toBe('guest-email-label');
    expect(fieldAria('guest-email', fieldMessage(null, 'Bad')).labelId).toBe('guest-email-label');
  });
});
