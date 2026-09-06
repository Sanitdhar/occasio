import { describe, expect, it } from '@jest/globals';
import { diffFingerprint, type ComparedFile } from './diffFingerprint.mjs';

/**
 * The rule this encodes: a rebase is not a change, and everything else is.
 *
 * It decides whether an existing review still applies to the commit about to merge, so a false
 * "same" is a way to land unreviewed code — the failure #128 is about. The cases below are
 * therefore weighted toward proving it reports *different* whenever it cannot be sure.
 */

const file = (over: Partial<ComparedFile> = {}): ComparedFile => ({
  filename: 'packages/ui/src/Button.tsx',
  status: 'modified',
  patch: '@@ -1 +1 @@\n-old\n+new',
  ...over,
});

describe('diffFingerprint', () => {
  it('is unchanged by the order the API returns files in', () => {
    /* The reason this exists at all: the comparison endpoint does not promise an order, and a
       fingerprint that depended on one would report a rebase as an edit at random. */
    const a = file();
    const b = file({ filename: 'packages/ui/src/Text.tsx' });

    expect(diffFingerprint([a, b])).toBe(diffFingerprint([b, a]));
  });

  it('changes when a single line of a patch changes', () => {
    expect(diffFingerprint([file()])).not.toBe(
      diffFingerprint([file({ patch: '@@ -1 +1 @@\n-old\n+newer' })]),
    );
  });

  it('changes when the same patch moves to a different file', () => {
    expect(diffFingerprint([file()])).not.toBe(
      diffFingerprint([file({ filename: 'packages/ui/src/Other.tsx' })]),
    );
  });

  it('changes when a file is added and removed rather than left alone', () => {
    /* Deleting a file and adding it back with identical contents nets out to nothing in the
       patches, and is not the same change. */
    expect(diffFingerprint([file({ status: 'modified' })])).not.toBe(
      diffFingerprint([file({ status: 'added' })]),
    );
  });

  it('distinguishes two different binaries, which have no patch at all', () => {
    /* Without the sha fallback both would fingerprint as the empty string, and swapping one
       image for another would read as "nothing changed since the review". */
    const one = { filename: 'assets/hero.png', status: 'modified', sha: 'aaa111' };
    const two = { filename: 'assets/hero.png', status: 'modified', sha: 'bbb222' };

    expect(diffFingerprint([one])).not.toBe(diffFingerprint([two]));
  });

  it('does not treat a missing sha as equal to another missing sha', () => {
    /* Two unknowns are not a match. They fingerprint identically here, which is why
       check-reviewed treats an unreachable comparison as "different" before it gets this far —
       asserted so that the weakness stays visible rather than being discovered later. */
    const unknown = { filename: 'assets/hero.png', status: 'modified' };
    expect(diffFingerprint([unknown])).toContain('binary:unknown');
  });

  it('reports an empty comparison distinctly from a one-file one', () => {
    expect(diffFingerprint([])).toBe('');
    expect(diffFingerprint([file()])).not.toBe('');
  });
});
