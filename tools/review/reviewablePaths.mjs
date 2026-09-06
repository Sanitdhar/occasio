import picomatch from 'picomatch';
import { parse } from 'yaml';

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
 *
 * **Both halves are libraries now, and that is the point of this version.** The first one parsed
 * the YAML by hand and matched the globs by hand, and review found four defects in them: a `\Z`
 * that is a Python idiom, a star after an escaped dot that expanded to "repeated dots", a
 * `replace` that restored one globstar marker out of two, and a header comment that made the
 * whole block invisible. Every one failed *open* — an exclusion list that silently comes back
 * empty or matches nothing stops excluding, and the gate goes on reporting success. Four in a
 * row is not a run of bad luck, it is the wrong tool, and `yaml` and `picomatch` were already
 * in the tree.
 */

/**
 * The exclusion globs from a `.coderabbit.yaml`.
 *
 * Anything unparseable yields an empty list, which excludes nothing and therefore asks for more
 * review rather than less — the safe direction for this file to fail in.
 *
 * @param {string} yaml
 * @returns {string[]}
 */
export const parseExcludedPaths = (yaml) => {
  /** @type {unknown} */
  let doc;
  try {
    doc = parse(yaml);
  } catch {
    return [];
  }

  const filters = /** @type {{ reviews?: { path_filters?: unknown } }} */ (doc)?.reviews
    ?.path_filters;
  if (!Array.isArray(filters)) return [];

  return filters
    .filter((entry) => typeof entry === 'string' && entry.startsWith('!'))
    .map((entry) => String(entry).slice(1));
};

/** @param {string} pattern @param {string} path @returns {boolean} */
export const matchesGlob = (pattern, path) => picomatch.isMatch(path, pattern, { dot: true });

/**
 * @param {readonly string[]} excluded
 * @param {string} path
 * @returns {boolean}
 */
export const isReviewable = (excluded, path) =>
  !excluded.some((pattern) => matchesGlob(pattern, path));
