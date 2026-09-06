/**
 * The short code printed on a card, a sign or a table tent.
 *
 * It exists because native has no URL bar: at a real event somebody is holding a printed thing
 * and typing what they see, so the rules here are about human transcription rather than about
 * storage. Case is ignored, and so are the spaces and hyphens people insert to make a code
 * readable — `SAN RIY 26`, `san-riy-26` and `SANRIY26` are one code, because they are one code
 * to the person holding the card.
 *
 * Comparison goes through this on both sides. A code typed into a field and a code stored on a
 * row are compared in normalised form, so a fixture written in lowercase or an operator who
 * pasted a trailing space does not create an event nobody can join.
 */

/**
 * Everything a person might insert while transcribing, plus everything invisible that a paste
 * carries out of a PDF or a chat message.
 *
 * `\p{Cf}` — the Unicode format characters — rather than a list of the ones anybody has thought
 * of. The first version enumerated four and missed U+2060 WORD JOINER, which is exactly the
 * failure mode of enumerating: the list is always one short, and being one short means a code
 * pasted out of a document does not match the code printed on the card, with nothing to see in
 * the field to explain why. The class covers the zero-width spaces and joiners, the byte-order
 * mark, the soft hyphen and the directional marks in one rule.
 *
 * `\s` covers ordinary and non-breaking whitespace; the three separators after it are the ones
 * people type on purpose to make a code readable. Written as escapes rather than as the
 * characters themselves, since a zero-width joiner in a source file is a change nobody can see
 * in a diff.
 */
const DECORATION = /[\s\p{Cf}\-\u2013\u2014_.]/gu;

/**
 * The comparable form of a code, or `null` when there is nothing left to compare.
 *
 * `null` rather than an empty string, because "" would equal "" and quietly match a row whose
 * code is blank — which is how an event with no join code becomes joinable by pressing enter on
 * an empty field.
 */
export const normaliseJoinCode = (value: string): string | null => {
  const stripped = value.replace(DECORATION, '').toUpperCase();
  return stripped === '' ? null : stripped;
};

/**
 * Whether two codes are the same code.
 *
 * Takes the stored value as `string | null` because that is what a tenant row holds: an event
 * with no code has `null`, and no input may ever match it. Writing this as a plain `===` at each
 * call site is how that case gets missed once.
 */
export const joinCodeMatches = (stored: string | null, typed: string): boolean => {
  if (stored === null) return false;
  const left = normaliseJoinCode(stored);
  const right = normaliseJoinCode(typed);
  return left !== null && left === right;
};
