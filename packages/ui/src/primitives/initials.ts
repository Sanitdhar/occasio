/**
 * Initials for an avatar that has no photo.
 *
 * The requirement is not "shorten a name" — it is "never let a name change the size of the
 * circle". A guest list contains `Anantharamakrishnan`, `Ada`, `李 明`, `007 Bond` and the
 * occasional emoji-only display name, and every one of them has to come out as at most two
 * characters.
 */

const MAX_INITIALS = 2;

/* Skips punctuation, so `(Ana)` gives `A` rather than `(`. */
const LETTER_OR_DIGIT = /[\p{L}\p{N}]/u;

/**
 * Iterating a string yields code points, so an astral character (an emoji, or a rarer CJK
 * ideograph) survives intact instead of being cut in half at a surrogate. Combining marks are
 * *not* grouped — a decomposed `é` would lose its accent. Intl.Segmenter would fix that but is
 * not reliably present in Hermes, and the cost of getting it wrong is a missing accent on one
 * letter rather than a broken glyph.
 */
const firstInitialOf = (word: string): string => {
  for (const character of word) {
    if (LETTER_OR_DIGIT.test(character)) {
      const [upper] = character.toLocaleUpperCase();
      return upper ?? '';
    }
  }
  return '';
};

/**
 * First and last word, because middle names are noise: `Mary Jane Watson` is `MW`.
 * A single word gives a single letter — `AN` for `Anantharamakrishnan` reads like two people.
 *
 * Returns an empty string for a name with nothing to show, which the avatar renders as a plain
 * tinted circle rather than a box with stray punctuation in it.
 */
export const initialsFrom = (name: string): string => {
  const initials = name
    .split(/\s+/u)
    .map(firstInitialOf)
    .filter((initial) => initial !== '');

  if (initials.length === 0) {
    /* Nothing alphanumeric anywhere: an emoji-only display name still deserves its glyph. */
    const [first] = name.trim();
    return first ?? '';
  }

  const chosen =
    initials.length <= MAX_INITIALS ? initials : [initials[0] ?? '', initials.at(-1) ?? ''];
  return chosen.join('');
};
