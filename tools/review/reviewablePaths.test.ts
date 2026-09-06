import { describe, expect, it } from '@jest/globals';
import { isReviewable, matchesGlob, parseExcludedPaths } from './reviewablePaths.mjs';

/**
 * This module decides what may merge without a fresh review, so every case below is weighted
 * toward it excluding *less* than asked rather than more. A pattern that matches too much is a
 * path the gate stops guarding, silently.
 */

const CONFIG = `
reviews:
  auto_review:
    enabled: true
    base_branches:
      - ^main$
  path_filters:
    - '!package-lock.json'
    - '!.artifacts/**'
    - '!**/__screenshots__/**'

  path_instructions:
    - path: packages/theme/src/resolve.ts
      instructions: something
`;

describe('parseExcludedPaths', () => {
  it('takes the negated entries from path_filters and stops at the next key', () => {
    /* `path_instructions` follows immediately in the real config, and swallowing it would turn
       a `path:` line into a glob that matches nothing — or, worse, something. */
    expect(parseExcludedPaths(CONFIG)).toEqual([
      'package-lock.json',
      '.artifacts/**',
      '**/__screenshots__/**',
    ]);
  });

  it('ignores an inclusion, which is not an exclusion', () => {
    const config = "path_filters:\n  - '!excluded.json'\n  - 'included.json'\n";
    expect(parseExcludedPaths(config)).toEqual(['excluded.json']);
  });

  it('returns nothing when there is no such block', () => {
    /* Nothing excluded means every file counts, so an unparseable or absent config asks for
       more review rather than less. */
    expect(parseExcludedPaths('reviews:\n  auto_review:\n    enabled: true\n')).toEqual([]);
    expect(parseExcludedPaths('')).toEqual([]);
  });
});

describe('matchesGlob', () => {
  it('matches a literal name exactly', () => {
    expect(matchesGlob('package-lock.json', 'package-lock.json')).toBe(true);
    expect(matchesGlob('package-lock.json', 'apps/package-lock.json')).toBe(false);
  });

  it('treats a dot as a dot', () => {
    /* Unescaped, `package-lock.json` would also match `package-lockxjson`. Unlikely to matter
       and trivial to get wrong, which is the combination worth pinning. */
    expect(matchesGlob('package-lock.json', 'package-lockxjson')).toBe(false);
  });

  it('spans directories with **', () => {
    expect(matchesGlob('.artifacts/**', '.artifacts/loop-status.mjs')).toBe(true);
    expect(matchesGlob('.artifacts/**', '.artifacts/nested/deep/file.mjs')).toBe(true);
    expect(matchesGlob('.artifacts/**', 'artifacts/file.mjs')).toBe(false);
  });

  it('matches a leading ** at any depth, including none', () => {
    expect(matchesGlob('**/__screenshots__/**', 'packages/ui/__screenshots__/a.png')).toBe(true);
    expect(matchesGlob('**/__screenshots__/**', '__screenshots__/a.png')).toBe(true);
    expect(matchesGlob('**/__screenshots__/**', 'packages/ui/src/Button.tsx')).toBe(false);
  });

  it('keeps a single * inside one segment', () => {
    /* The difference that matters: `*.json` must not swallow `a/b.json`, or one careless
       pattern stops the gate guarding a whole tree. */
    expect(matchesGlob('*.json', 'tsconfig.json')).toBe(true);
    expect(matchesGlob('*.json', 'packages/data/tsconfig.json')).toBe(false);
  });
});

describe('isReviewable', () => {
  const excluded = parseExcludedPaths(CONFIG);

  it('excludes exactly what the config excludes', () => {
    expect(isReviewable(excluded, 'package-lock.json')).toBe(false);
    expect(isReviewable(excluded, '.artifacts/loop-status.mjs')).toBe(false);
    expect(isReviewable(excluded, 'packages/ui/src/__screenshots__/home.png')).toBe(false);
  });

  it('leaves source code reviewable', () => {
    /* The assertion that matters most: a source file must never fall through one of these. */
    for (const path of [
      'packages/data/src/rows.ts',
      'packages/ui/src/components/Button.tsx',
      'apps/mobile/app/_layout.tsx',
      'tools/review/check-reviewed.mjs',
      '.github/workflows/ci.yml',
      'package.json',
    ]) {
      expect(isReviewable(excluded, path)).toBe(true);
    }
  });

  it('reviews everything when nothing is excluded', () => {
    expect(isReviewable([], 'package-lock.json')).toBe(true);
  });
});
