import { describe, expect, it } from '@jest/globals';
import { COMPARE_FILE_CAP, diffFingerprint, type ComparedFile } from './diffFingerprint.mjs';

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

  it('marks a file it cannot describe, so the caller can refuse it', () => {
    /* Two unknowns are not a match, but they fingerprint identically here — this function sees
       only the list it is handed. `check-reviewed` refuses such a file before calling in, and
       the marker is asserted so the two halves of that arrangement cannot drift apart. */
    const unknown: ComparedFile = { filename: 'assets/hero.png', status: 'modified' };
    expect(diffFingerprint([unknown])).toContain('binary:unknown');
  });

  it('separates two renames that land on the same path with the same contents', () => {
    /* Same destination, same patch, same status -- the source path is the only difference, and
       without it moving `secrets.ts` to `config.ts` fingerprints identically to moving
       `readme.ts` there. */
    const fromSecrets = file({
      filename: 'src/config.ts',
      status: 'renamed',
      previous_filename: 'src/secrets.ts',
    });
    const fromReadme = file({
      filename: 'src/config.ts',
      status: 'renamed',
      previous_filename: 'src/readme.ts',
    });

    expect(diffFingerprint([fromSecrets])).not.toBe(diffFingerprint([fromReadme]));
  });

  it('separates a rename from an ordinary edit of the destination', () => {
    expect(
      diffFingerprint([
        file({ filename: 'src/config.ts', status: 'renamed', previous_filename: 'src/old.ts' }),
      ]),
    ).not.toBe(diffFingerprint([file({ filename: 'src/config.ts', status: 'renamed' })]));
  });

  it('names the cap the caller has to fail closed on', () => {
    /* The fingerprint itself cannot detect truncation -- it only sees the list it is handed --
       so the cap lives here and check-reviewed refuses at it. Pinned so the two cannot drift. */
    expect(COMPARE_FILE_CAP).toBe(300);
  });

  it('reports an empty comparison distinctly from a one-file one', () => {
    expect(diffFingerprint([])).toBe('');
    expect(diffFingerprint([file()])).not.toBe('');
  });
});
