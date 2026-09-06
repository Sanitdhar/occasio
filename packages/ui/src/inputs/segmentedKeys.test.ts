import { describe, expect, it } from '@jest/globals';
import { nextIndexForKey } from './segmentedKeys';

describe('nextIndexForKey', () => {
  it('moves forward and back along the group', () => {
    expect(nextIndexForKey('ArrowRight', 0, 3)).toBe(1);
    expect(nextIndexForKey('ArrowLeft', 2, 3)).toBe(1);
  });

  it('treats the vertical arrows as the same movement', () => {
    /* A group can be laid out either way, and a keyboard user should not have to know which. */
    expect(nextIndexForKey('ArrowDown', 0, 3)).toBe(1);
    expect(nextIndexForKey('ArrowUp', 1, 3)).toBe(0);
  });

  it('wraps at both ends, as the role specifies', () => {
    expect(nextIndexForKey('ArrowRight', 2, 3)).toBe(0);
    expect(nextIndexForKey('ArrowLeft', 0, 3)).toBe(2);
  });

  it('jumps to the ends with Home and End', () => {
    expect(nextIndexForKey('Home', 2, 3)).toBe(0);
    expect(nextIndexForKey('End', 0, 3)).toBe(2);
  });

  it('answers null for a key this group does not own', () => {
    /* The caller consumes the event only when this answers, so Tab still leaves the group and
       the browser keeps its own shortcuts. Swallowing everything is how a widget traps focus. */
    expect(nextIndexForKey('Tab', 0, 3)).toBeNull();
    expect(nextIndexForKey('a', 0, 3)).toBeNull();
    expect(nextIndexForKey('Enter', 0, 3)).toBeNull();
  });

  it('answers null for an empty group rather than an impossible index', () => {
    expect(nextIndexForKey('ArrowRight', 0, 0)).toBeNull();
  });

  it('starts from the first option when the current one is not in the group', () => {
    /* Happens when `value` is not among `options` — a caller's bug, but pressing an arrow key
       should still move somewhere real rather than to -1 or past the end. */
    expect(nextIndexForKey('ArrowRight', -1, 3)).toBe(1);
    expect(nextIndexForKey('ArrowLeft', 99, 3)).toBe(2);
  });
});
