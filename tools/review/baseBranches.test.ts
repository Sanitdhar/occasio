import { describe, expect, it } from '@jest/globals';
import { isAutoReviewedBase, parseBaseBranches } from './baseBranches.mjs';

/**
 * This decides what the gate *says*, never what it allows, so the cases below are weighted
 * toward silence rather than toward a guess. Announcing "this pull request can never be
 * reviewed" at somebody who is simply waiting their turn is worse than saying nothing, because
 * the obvious response to it is to go and edit the reviewer's configuration.
 */

/** The shape of the real file, trimmed to what this reads. */
const CONFIG = `
reviews:
  profile: assertive
  auto_review:
    enabled: true
    drafts: false
    base_branches:
      - ^main$
      - ^feat/.*
      - ^fix/.*
      - ^review/.*
  path_filters:
    - '!package-lock.json'
`;

describe('parseBaseBranches', () => {
  it('reads the configured patterns', () => {
    expect(parseBaseBranches(CONFIG)).toEqual(['^main$', '^feat/.*', '^fix/.*', '^review/.*']);
  });

  it('answers null when the file says nothing about them', () => {
    /* Null rather than an empty list, and the difference is the whole point: an empty list is a
       real configuration meaning "no branch qualifies", and reporting that when we simply do
       not know would tell every pull request it is unreviewable. */
    expect(parseBaseBranches('reviews:\n  auto_review:\n    enabled: true\n')).toBeNull();
    expect(parseBaseBranches('')).toBeNull();
    expect(parseBaseBranches('{{ not yaml')).toBeNull();
  });

  it('keeps a genuinely empty list distinct from an absent one', () => {
    expect(parseBaseBranches('reviews:\n  auto_review:\n    base_branches: []\n')).toEqual([]);
  });

  it('ignores entries that are not strings rather than failing on them', () => {
    expect(parseBaseBranches('reviews:\n  auto_review:\n    base_branches:\n      - 7\n')).toEqual(
      [],
    );
  });
});

describe('isAutoReviewedBase', () => {
  const patterns = parseBaseBranches(CONFIG);

  it('accepts the branches the repository actually uses', () => {
    for (const ref of ['main', 'feat/29-inputs', 'fix/148-gate-harness']) {
      expect([ref, isAutoReviewedBase(patterns, ref)]).toEqual([ref, true]);
    }
  });

  it('accepts a retro-review baseline branch, which is the case that prompted this', () => {
    /* #132 targeted `review/unreviewed-baseline`, matched nothing, and was skipped in silence
       for seven and a half hours — the one PR shape whose entire purpose is being reviewed. */
    expect(isAutoReviewedBase(patterns, 'review/unreviewed-baseline')).toBe(true);
  });

  it('refuses a branch no pattern covers', () => {
    expect(isAutoReviewedBase(patterns, 'wip/scratch')).toBe(false);
    expect(isAutoReviewedBase(patterns, 'release/v0.2')).toBe(false);
  });

  it('reads the patterns as regular expressions, because CodeRabbit does', () => {
    /* `^main$` is anchored, so it must not match `mainline`. A glob matcher would, and the
       difference only ever shows up on a branch name nobody thought to test. */
    expect(isAutoReviewedBase(['^main$'], 'mainline')).toBe(false);
    expect(isAutoReviewedBase(['^main$'], 'main')).toBe(true);
    /* And `.` is a regex wildcard here rather than a literal dot. */
    expect(isAutoReviewedBase(['^feat/.*'], 'feat/anything')).toBe(true);
  });

  it('answers null when nothing is configured, so the caller can stay quiet', () => {
    expect(isAutoReviewedBase(null, 'main')).toBeNull();
  });

  it('answers false for an empty list rather than treating it as unknown', () => {
    expect(isAutoReviewedBase([], 'main')).toBe(false);
  });

  it('treats an unparseable pattern as no match instead of throwing', () => {
    /* This only ever changes the wording of a message. Crashing a merge gate over a malformed
       regex in somebody's config would be a far worse outcome than an unhelpful sentence. */
    expect(isAutoReviewedBase(['^feat/(unclosed'], 'feat/x')).toBe(false);
    expect(isAutoReviewedBase(['^feat/(unclosed', '^feat/.*'], 'feat/x')).toBe(true);
  });
});
