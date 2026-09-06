import { parse } from 'yaml';

/**
 * Whether CodeRabbit will ever auto-review a pull request.
 *
 * Two things in `.coderabbit.yaml` decide it, and either one alone gives the wrong answer.
 * `reviews.auto_review.enabled` turns the whole mechanism on, and `base_branches` says which
 * targets it applies to — so a pull request onto `main` is skipped just as completely when
 * auto review is switched off as one onto a branch nobody listed. Reading only the patterns
 * reports that PR as eligible and stays silent about the one thing wrong with it.
 *
 * A PR targeting an unlisted branch is skipped in silence from the outside. #132 sat green and
 * idle for seven and a half hours looking exactly like a PR waiting its turn in the queue, when
 * in fact nothing was ever going to look at it.
 *
 * The gate already refused to merge it, so this was never a safety problem. It is a diagnosis
 * problem, and the states want opposite responses: "not reviewed yet" resolves on its own if
 * you wait, and the other two do not resolve at all, however long you wait.
 *
 * Derived from the configuration rather than from CodeRabbit's skip comment. The comment is
 * the obvious signal and the wrong one to depend on: its wording is not ours, it is replaced
 * when a review is later triggered by hand — which is why it can no longer be read off #132 —
 * and matching it loosely would collide with the "Check skipped because…" rows CodeRabbit puts
 * in every walkthrough table. The base ref and this configuration are both facts we hold.
 */

/**
 * @typedef {object} AutoReviewConfig
 * @property {boolean} enabled Absent in the file means on, which is CodeRabbit's own default.
 * @property {string[] | null} patterns `null` when the file says nothing about base branches.
 */

/**
 * The auto-review settings from a `.coderabbit.yaml`.
 *
 * `null` when there is no configuration to read. That has to stay distinct from every real
 * setting: an empty `base_branches` list means "no branch qualifies", and `enabled: false`
 * means "none of this runs" — announcing either of those because a file was missing would send
 * somebody to fix a configuration that is not broken.
 *
 * @param {string} yaml
 * @returns {AutoReviewConfig | null}
 */
export const parseAutoReview = (yaml) => {
  /** @type {unknown} */
  let doc;
  try {
    doc = parse(yaml);
  } catch {
    return null;
  }

  const autoReview = /** @type {{ reviews?: { auto_review?: unknown } }} */ (doc)?.reviews
    ?.auto_review;
  if (autoReview === null || typeof autoReview !== 'object') return null;

  const { enabled, base_branches: branches } =
    /** @type {{ enabled?: unknown, base_branches?: unknown }} */ (autoReview);

  return {
    /* Only an explicit `false` disables it. Absent means on — that is CodeRabbit's default, and
       guessing the other way would report a working setup as switched off. */
    enabled: enabled !== false,
    patterns: Array.isArray(branches)
      ? branches.filter((entry) => typeof entry === 'string').map((entry) => String(entry))
      : null,
  };
};

/**
 * @typedef {'eligible' | 'disabled' | 'base-not-configured' | 'unknown'} AutoReviewState
 */

/**
 * Why a pull request will or will not be picked up.
 *
 * A single state rather than a pair of booleans, because two of the four combinations those
 * would allow cannot happen and the remaining two mean different things — which is the shape
 * this repository asks for wherever state can otherwise contradict itself.
 *
 * `unknown` is not a failure: it is the honest answer when nothing was configured to check
 * against, and the caller says nothing rather than guessing.
 *
 * @param {AutoReviewConfig | null} config
 * @param {string} ref
 * @returns {AutoReviewState}
 */
export const autoReviewState = (config, ref) => {
  if (config === null) return 'unknown';
  if (!config.enabled) return 'disabled';
  if (config.patterns === null) return 'unknown';
  return matchesBase(config.patterns, ref) ? 'eligible' : 'base-not-configured';
};

/**
 * Whether a base ref matches one of the configured patterns.
 *
 * These are regular expressions, not globs — `^feat/.*` in the file is read by CodeRabbit as a
 * regex, so it is read as one here. An unparseable pattern counts as no match rather than
 * throwing: this answer only ever changes the wording of a message, and a message is not worth
 * crashing a merge gate over.
 *
 * @param {readonly string[]} patterns
 * @param {string} ref
 * @returns {boolean}
 */
export const matchesBase = (patterns, ref) =>
  patterns.some((pattern) => {
    try {
      return new RegExp(pattern).test(ref);
    } catch {
      return false;
    }
  });
