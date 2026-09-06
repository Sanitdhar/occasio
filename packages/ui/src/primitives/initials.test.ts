import { describe, expect, it } from '@jest/globals';
import { initialsFrom } from './initials';

/** Code points, not UTF-16 units: an astral character must count as the one glyph it draws. */
const codePointsOf = (value: string): readonly string[] => value.match(/./gu) ?? [];

/**
 * The property that matters is length: an avatar is a fixed-size circle, so no name may ever
 * produce more than two characters. Everything else here is a case from a real guest list.
 */
describe('initialsFrom', () => {
  it.each([
    ['Ada Lovelace', 'AL'],
    /* One long word gives one letter. "AN" would read like two different people. */
    ['Anantharamakrishnan', 'A'],
    ['Anantharamakrishnan Venkatasubramanian', 'AV'],
    /* Middle names are noise — first and last. */
    ['Mary Jane Watson', 'MW'],
    ['Jean-Luc Picard', 'JP'],
    ['  ada   lovelace  ', 'AL'],
    ['ólafur eliasson', 'ÓE'],
    ['李 明', '李明'],
    ['007 Bond', '0B'],
    /* Punctuation is skipped rather than shown. */
    ['(Ana) Ruiz', 'AR'],
  ])('turns %p into %p', (name, expected) => {
    expect(initialsFrom(name)).toBe(expected);
  });

  it('falls back to the first character when a name has no letters or digits', () => {
    /* Emoji-only display names exist, and an empty circle looks like a loading state. */
    expect(initialsFrom('🎉')).toBe('🎉');
    expect(initialsFrom('  🎉  ')).toBe('🎉');
  });

  it('skips a word that contributes nothing rather than emitting a blank initial', () => {
    expect(initialsFrom('🎉 party')).toBe('P');
  });

  it('returns nothing it cannot render', () => {
    expect(initialsFrom('')).toBe('');
    expect(initialsFrom('   ')).toBe('');
  });

  it('never returns more than two characters, for any name in a plausible guest list', () => {
    const names = [
      'Ada Lovelace',
      'Anantharamakrishnan Venkatasubramanian Iyer',
      'María del Carmen García Fernández',
      'Jean-Luc Picard',
      'ß',
      '🎉 🎊 🎈',
      'a b c d e f g h i j k',
      '李 明 華',
    ];

    const lengths = names.map((name) => codePointsOf(initialsFrom(name)).length);

    /* Every one of these names has something to show, and none of them may show more than two. */
    expect(lengths.filter((length) => length < 1 || length > 2)).toEqual([]);
  });

  it('uppercases, including where uppercasing lengthens the letter', () => {
    /* 'ß'.toUpperCase() is 'SS' — the second character must not leak into the circle. */
    expect(initialsFrom('ßingen')).toBe('S');
    expect(initialsFrom('ada')).toBe('A');
  });

  it('does not split an astral character in half', () => {
    /* A name starting with an ideograph outside the BMP is one code point, two UTF-16 units. */
    expect(initialsFrom('\u{20BB7} Tanaka')).toBe('\u{20BB7}T');
  });
});
