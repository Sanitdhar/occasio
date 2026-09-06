/**
 * Which files the reviewer is actually asked to read.
 *
 * `.coderabbit.yaml` carries `path_filters`, and the entries beginning with `!` are paths
 * CodeRabbit never looks at — the lockfile, the scratch directory, the screenshot baselines.
 * The freshness check has to use the same list, and the reason is concrete rather than tidy: a
 * commit that touches only an excluded path gives the reviewer nothing to read, so it will
 * never be reviewed, and a gate demanding a review of it blocks the pull request forever. #144
 * sat on a one-line lockfile sync in exactly that state.
 *
 * This does widen what can merge without a fresh review, and the widening is the repository's
 * own decision rather than this file's: a change under an excluded path is unreviewed by policy
 * already. What would be wrong is for the gate to pretend otherwise and then be worked around
 * by hand, which is how #128 happened.
 */

/**
 * The exclusion globs from a `.coderabbit.yaml`, without a YAML parser.
 *
 * Deliberately narrow: it reads the `path_filters:` block and takes the quoted entries that
 * start with `!`. Anything it does not understand is simply not returned, and an empty list
 * means nothing is excluded — which fails toward asking for more review rather than less.
 *
 * @param {string} yaml
 * @returns {string[]}
 */
export const parseExcludedPaths = (yaml) => {
  /*
   * A line scan rather than one regex over the block. The regex version terminated the block
   * with `\Z`, which is a Python idiom — in JavaScript that matches a literal "Z", so a
   * `path_filters:` block with nothing after it parsed as nothing at all. The scan has no
   * end-of-input case to get wrong.
   */
  const lines = yaml.split('\n');
  const start = lines.findIndex((line) => /^\s*path_filters:\s*$/.test(line));
  if (start === -1) return [];

  const out = [];
  for (const line of lines.slice(start + 1)) {
    if (/^\s*$/.test(line)) continue;
    /* A key at any indentation ends the block; a list item continues it. */
    if (!/^\s*-\s/.test(line)) break;
    const entry = /^\s*-\s*['"]?!([^'"\s]+)['"]?\s*$/.exec(line);
    if (entry !== null && entry[1] !== undefined) out.push(entry[1]);
  }
  return out;
};

/**
 * Whether one glob matches one path.
 *
 * Supports the three forms the config actually uses — a literal name, a `**` spanning
 * directories, and a `*` within one segment. Every other regex character is escaped, so a
 * pattern with a dot in it matches a dot rather than any character.
 *
 * @param {string} pattern
 * @param {string} path
 * @returns {boolean}
 */
export const matchesGlob = (pattern, path) => {
  /*
   * Placeholders, not a lookbehind.
   *
   * The first version escaped the regex characters and then skipped any `*` preceded by a dot,
   * to avoid disturbing the `.*` that globstar expansion produces. That also skipped the `*` in
   * `config.*` — whose preceding dot is an escaped literal — so the pattern compiled to
   * `config\.*`, a regex matching `config`, `config.`, `config..` and nothing anyone wanted.
   *
   * Expanding into markers that contain no regex syntax removes the ambiguity: by the time the
   * single-star rule runs there is no globstar output left for it to misread.
   */
  const GLOBSTAR_SLASH = '\u0000gss\u0000';
  const GLOBSTAR = '\u0000gs\u0000';

  const source = pattern
    .replace(/\*\*\//g, GLOBSTAR_SLASH)
    .replace(/\*\*/g, GLOBSTAR)
    /* Escape everything with meaning in a regex, `*` included — it is restored below. */
    .replace(/[.+^${}()|[\]\\*?]/g, (char) => `\\${char}`)
    /* The single star, now unambiguous: one segment only, so `*.json` cannot cross a slash. */
    .replace(/\\\*/g, '[^/]*')
    .replace(GLOBSTAR_SLASH, '(?:.*/)?')
    .replace(GLOBSTAR, '.*');

  return new RegExp(`^${source}$`).test(path);
};

/**
 * @param {readonly string[]} excluded
 * @param {string} path
 * @returns {boolean}
 */
export const isReviewable = (excluded, path) =>
  !excluded.some((pattern) => matchesGlob(pattern, path));
