import { parse } from 'yaml';

/**
 * Whether CodeRabbit will ever auto-review a pull request, given where it is targeted.
 *
 * `.coderabbit.yaml` lists the base branches auto review is enabled for, and a pull request
 * targeting anything else is skipped — silently, from the outside. #132 sat green and idle for
 * seven and a half hours looking exactly like a PR waiting its turn in the review queue, when
 * in fact nothing was ever going to look at it.
 *
 * The gate already refused to merge it, so this was never a safety problem. It is a diagnosis
 * problem, and the two states want opposite responses: "not reviewed yet" resolves on its own
 * if you wait, and "not reviewed because this base branch was never configured" does not
 * resolve at all, however long you wait.
 *
 * Derived from the configuration rather than from CodeRabbit's skip comment. The comment is
 * the obvious signal and the wrong one to depend on: its wording is not ours, it is replaced
 * when a review is later triggered by hand — which is why it can no longer be read off #132 —
 * and matching it loosely would collide with the "Check skipped because…" rows CodeRabbit puts
 * in every walkthrough table. The base ref and these patterns are both facts we hold.
 */

/**
 * The auto-review base-branch patterns from a `.coderabbit.yaml`.
 *
 * `null`, not `[]`, when the file is missing or says nothing about them. An empty list is a
 * real configuration meaning "no branch is enabled", and it must not be confused with "we do
 * not know" — the caller reports nothing at all in the second case rather than announcing that
 * every pull request is unreviewable.
 *
 * @param {string} yaml
 * @returns {string[] | null}
 */
export const parseBaseBranches = (yaml) => {
  /** @type {unknown} */
  let doc;
  try {
    doc = parse(yaml);
  } catch {
    return null;
  }

  const branches = /** @type {{ reviews?: { auto_review?: { base_branches?: unknown } } }} */ (doc)
    ?.reviews?.auto_review?.base_branches;
  if (!Array.isArray(branches)) return null;

  return branches.filter((entry) => typeof entry === 'string').map((entry) => String(entry));
};

/**
 * Whether a base ref matches one of the configured patterns.
 *
 * These are regular expressions, not globs — `^feat/.*` in the file is read by CodeRabbit as a
 * regex, so it is read as one here. An unparseable pattern counts as no match rather than
 * throwing: this answer only ever changes the wording of a message, and a message is not worth
 * crashing a merge gate over.
 *
 * @param {readonly string[] | null} patterns
 * @param {string} ref
 * @returns {boolean | null}
 */
export const isAutoReviewedBase = (patterns, ref) => {
  if (patterns === null) return null;
  return patterns.some((pattern) => {
    try {
      return new RegExp(pattern).test(ref);
    } catch {
      return false;
    }
  });
};
