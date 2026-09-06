import { describe, expect, it } from '@jest/globals';
import { joinCodeMatches, normaliseJoinCode } from './joinCode';

/**
 * A join code is transcribed by a person from a printed card, so every case here is about what
 * somebody types rather than what is stored. The dangerous direction is a false match: this is
 * the credential that opens a private event.
 */

describe('normaliseJoinCode', () => {
  it('ignores the decoration people add to make a code readable', () => {
    for (const typed of ['SANRIY26', 'sanriy26', 'SAN RIY 26', 'san-riy-26', ' SANRIY26 ']) {
      expect([typed, normaliseJoinCode(typed)]).toEqual([typed, 'SANRIY26']);
    }
  });

  it('answers null when nothing is left to compare', () => {
    /* Not the empty string: `'' === ''` would match a row whose code is blank, which is how an
       event with no code becomes joinable by pressing enter on an empty field. */
    expect(normaliseJoinCode('')).toBeNull();
    expect(normaliseJoinCode('   ')).toBeNull();
    expect(normaliseJoinCode('---')).toBeNull();
  });

  it('strips everything invisible, not a list of the ones anybody thought of', () => {
    /*
     * A code copied out of a PDF or a chat message arrives carrying characters with no width at
     * all, and none of them are on the card. The first version of the pattern enumerated four
     * and missed U+2060 WORD JOINER — which is the failure mode of enumerating, so this asserts
     * the class rather than the members.
     */
    const invisible = [
      '\u200B', // zero width space
      '\u200C', // zero width non-joiner
      '\u200D', // zero width joiner
      '\u2060', // word joiner — the one the list missed
      '\uFEFF', // byte order mark
      '\u00AD', // soft hyphen
      '\u200E', // left-to-right mark
    ];

    for (const character of invisible) {
      const typed = `SAN${character}RIY${character}26`;
      expect([JSON.stringify(character), normaliseJoinCode(typed)]).toEqual([
        JSON.stringify(character),
        'SANRIY26',
      ]);
    }
  });

  it('strips the whitespace that is not a plain space', () => {
    /* A non-breaking space is what a copied line of a PDF is full of. */
    expect(normaliseJoinCode('SAN\u00A0RIY\u202F26')).toBe('SANRIY26');
  });
});

describe('joinCodeMatches', () => {
  it('matches however the code was transcribed', () => {
    expect(joinCodeMatches('SANRIY26', 'san riy 26')).toBe(true);
    expect(joinCodeMatches('sanriy26', 'SAN-RIY-26')).toBe(true);
  });

  it('refuses a different code', () => {
    expect(joinCodeMatches('SANRIY26', 'MAPLE99')).toBe(false);
    expect(joinCodeMatches('SANRIY26', 'SANRIY2')).toBe(false);
    expect(joinCodeMatches('SANRIY26', 'SANRIY266')).toBe(false);
  });

  it('never matches an event that has no code', () => {
    /*
     * The failure worth guarding: two events in the fixtures have `join_code: null`, and a rule
     * that compared normalised values without this would let an empty field — or a field holding
     * only spaces — open both of them.
     */
    expect(joinCodeMatches(null, '')).toBe(false);
    expect(joinCodeMatches(null, 'SANRIY26')).toBe(false);
    expect(joinCodeMatches(null, '   ')).toBe(false);
  });

  it('refuses an empty input against a real code', () => {
    expect(joinCodeMatches('SANRIY26', '')).toBe(false);
    expect(joinCodeMatches('SANRIY26', '  -  ')).toBe(false);
  });
});
