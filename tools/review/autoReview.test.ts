import { describe, expect, it } from '@jest/globals';
import { autoReviewState, matchesBase, parseAutoReview } from './autoReview.mjs';

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

const config = parseAutoReview(CONFIG);

describe('parseAutoReview', () => {
  it('reads the enablement flag and the patterns together', () => {
    expect(config).toEqual({
      enabled: true,
      patterns: ['^main$', '^feat/.*', '^fix/.*', '^review/.*'],
    });
  });

  it('treats an absent flag as on, which is CodeRabbit’s own default', () => {
    /* Guessing the other way would report a perfectly working setup as switched off. */
    const parsed = parseAutoReview(
      'reviews:\n  auto_review:\n    base_branches:\n      - ^main$\n',
    );
    expect(parsed).toEqual({ enabled: true, patterns: ['^main$'] });
  });

  it('records an explicit false', () => {
    const parsed = parseAutoReview(
      'reviews:\n  auto_review:\n    enabled: false\n    base_branches:\n      - ^main$\n',
    );
    expect(parsed).toEqual({ enabled: false, patterns: ['^main$'] });
  });

  it('answers null when there is no auto_review section to read', () => {
    expect(parseAutoReview('reviews:\n  profile: assertive\n')).toBeNull();
    expect(parseAutoReview('')).toBeNull();
    expect(parseAutoReview('{{ not yaml')).toBeNull();
  });

  it('keeps a genuinely empty pattern list distinct from an absent one', () => {
    /* `[]` is a real configuration meaning "no branch qualifies". `null` means we do not know,
       and reporting the first when we mean the second sends somebody to fix nothing. */
    expect(parseAutoReview('reviews:\n  auto_review:\n    base_branches: []\n')).toEqual({
      enabled: true,
      patterns: [],
    });
    expect(parseAutoReview('reviews:\n  auto_review:\n    enabled: true\n')).toEqual({
      enabled: true,
      patterns: null,
    });
  });

  it('ignores pattern entries that are not strings rather than failing on them', () => {
    expect(
      parseAutoReview('reviews:\n  auto_review:\n    base_branches:\n      - 7\n')?.patterns,
    ).toEqual([]);
  });
});

describe('autoReviewState', () => {
  it('accepts the branches the repository actually uses', () => {
    for (const ref of ['main', 'feat/29-inputs', 'fix/148-gate-harness']) {
      expect([ref, autoReviewState(config, ref)]).toEqual([ref, 'eligible']);
    }
  });

  it('accepts a retro-review baseline branch, which is the case that prompted this', () => {
    /* #132 targeted `review/unreviewed-baseline`, matched nothing, and was skipped in silence
       for seven and a half hours — the one PR shape whose entire purpose is being reviewed. */
    expect(autoReviewState(config, 'review/unreviewed-baseline')).toBe('eligible');
  });

  it('names a base branch no pattern covers', () => {
    expect(autoReviewState(config, 'wip/scratch')).toBe('base-not-configured');
    expect(autoReviewState(config, 'release/v0.2')).toBe('base-not-configured');
  });

  it('reports auto review being off, even for a branch the patterns match', () => {
    /*
     * The two settings are independent, and reading only the patterns gets this exactly
     * backwards: a pull request onto `main` with auto review switched off is skipped just as
     * completely as one onto a branch nobody listed, and would have been reported as eligible
     * — silence in the case that most needs an explanation.
     */
    const off = { enabled: false, patterns: ['^main$'] };
    expect(autoReviewState(off, 'main')).toBe('disabled');
    expect(autoReviewState(off, 'wip/scratch')).toBe('disabled');
  });

  it('says unknown when there is nothing to judge against', () => {
    expect(autoReviewState(null, 'main')).toBe('unknown');
    expect(autoReviewState({ enabled: true, patterns: null }, 'main')).toBe('unknown');
  });

  it('says base-not-configured for an empty list rather than unknown', () => {
    expect(autoReviewState({ enabled: true, patterns: [] }, 'main')).toBe('base-not-configured');
  });
});

describe('matchesBase', () => {
  it('reads the patterns as regular expressions, because CodeRabbit does', () => {
    /* `^main$` is anchored, so it must not match `mainline`. A glob matcher would, and the
       difference only ever shows up on a branch name nobody thought to test. */
    expect(matchesBase(['^main$'], 'mainline')).toBe(false);
    expect(matchesBase(['^main$'], 'main')).toBe(true);
    /* And `.` is a regex wildcard here rather than a literal dot. */
    expect(matchesBase(['^feat/.*'], 'feat/anything')).toBe(true);
  });

  it('treats an unparseable pattern as no match instead of throwing', () => {
    /* This only ever changes the wording of a message. Crashing a merge gate over a malformed
       regex in somebody's config would be a far worse outcome than an unhelpful sentence. */
    expect(matchesBase(['^feat/(unclosed'], 'feat/x')).toBe(false);
    expect(matchesBase(['^feat/(unclosed', '^feat/.*'], 'feat/x')).toBe(true);
  });
});
