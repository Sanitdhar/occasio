import { describe, expect, it } from '@jest/globals';
import {
  COMPARE_FILE_CAP,
  coversAllOf,
  diffEntries,
  diffFingerprint,
  isDescribable,
  type ComparedFile,
} from './diffFingerprint.mjs';

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

  it('ignores the context a rebase moves an edit into', () => {
    /*
     * The same edit replayed onto a moved base arrives with different surrounding context and a
     * different hunk header. Comparing the raw patch reported a change no reviewer would see,
     * and left the pull request asking for a review of nothing — eight rebases on #144.
     */
    const before = file({
      patch: '@@ -1,3 +1,4 @@\n const a = 1;\n+const added = 2;\n const b = 3;',
    });
    const rebased = file({
      patch: '@@ -40,3 +40,4 @@\n const x = 9;\n+const added = 2;\n const y = 10;',
    });

    expect(diffFingerprint([before])).toBe(diffFingerprint([rebased]));
  });

  it('keeps a changed line that begins with a plus or a minus', () => {
    /*
     * `++counter;` added is encoded `+++counter;`, and `--counter;` removed is `---counter;`.
     * A filter that recognised file headers by prefix dropped both — and dropping a changed
     * line is the fail-open direction: two different patches fingerprint the same, and the gate
     * reports a review that never happened.
     */
    const added = file({ patch: '@@ -1,2 +1,3 @@\n const a = 1;\n+++counter;' });
    const removed = file({ patch: '@@ -1,3 +1,2 @@\n const a = 1;\n---counter;' });

    /* Each encoding checked on its own, because comparing the two to each other passes for a
       regression that drops one of them -- which is what the first version of this test did:
       both its fixtures were *added* lines, so nothing exercised `---`. */
    expect(diffFingerprint([added])).toContain('++counter;');
    expect(diffFingerprint([removed])).toContain('--counter;');
    expect(diffFingerprint([added])).not.toBe(diffFingerprint([removed]));
  });

  it('still drops the filename headers themselves', () => {
    /* They precede the first hunk, which is how they are told apart now. Keeping them would
       make a rename look like a content change. */
    const withHeaders = file({
      patch: '--- a/src/x.ts\n+++ b/src/x.ts\n@@ -1 +1 @@\n-old\n+new',
    });
    const withoutHeaders = file({ patch: '@@ -1 +1 @@\n-old\n+new' });

    expect(diffFingerprint([withHeaders])).toBe(diffFingerprint([withoutHeaders]));
  });

  it('does not throw on a null patch', () => {
    /* `patch` arrives as `null` for a binary file as readily as absent, and splitting null
       would throw inside the comparison rather than answer it. */
    const binary = { filename: 'assets/hero.png', status: 'modified', patch: null, sha: 'abc' };

    expect(() => diffFingerprint([binary])).not.toThrow();
    expect(diffFingerprint([binary])).toContain('binary:abc');
  });

  it('still notices a different line arriving in the same place', () => {
    /* The property the rule above must not cost: what was added is still compared. */
    const added = file({ patch: '@@ -1,3 +1,4 @@\n const a = 1;\n+const added = 2;' });
    const other = file({ patch: '@@ -1,3 +1,4 @@\n const a = 1;\n+const different = 2;' });

    expect(diffFingerprint([added])).not.toBe(diffFingerprint([other]));
  });

  it('notices a removal that the added lines alone would hide', () => {
    const removes = file({ patch: '@@ -1,3 +1,2 @@\n const a = 1;\n-const gone = 2;' });
    const keeps = file({ patch: '@@ -1,3 +1,3 @@\n const a = 1;\n const gone = 2;' });

    expect(diffFingerprint([removes])).not.toBe(diffFingerprint([keeps]));
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

describe('isDescribable', () => {
  it('accepts a file with a patch, or with only a blob sha', () => {
    expect(isDescribable({ patch: '@@ -1 +1 @@' })).toBe(true);
    expect(isDescribable({ sha: 'abc123' })).toBe(true);
  });

  it('rejects a file with neither', () => {
    /* Two of these fingerprint identically as `binary:unknown`, which would read as "nothing
       changed since the review". */
    expect(isDescribable({})).toBe(false);
  });

  it('treats null the same as absent', () => {
    /* These arrive as JSON, where an absent field is often an explicit null. The first version
       of this guard compared against `undefined` only and let both nulls through. */
    expect(isDescribable({ patch: null, sha: null })).toBe(false);
    expect(isDescribable({ patch: null, sha: 'abc123' })).toBe(true);
    expect(isDescribable({ patch: '@@ -1 +1 @@', sha: null })).toBe(true);
  });

  it('accepts an empty patch, which is a real value', () => {
    /* A pure rename has an empty patch rather than no patch, and it is describable. */
    expect(isDescribable({ patch: '' })).toBe(true);
  });
});

describe('coversAllOf', () => {
  const a = 'a.ts\nnone\nmodified\n@@ -1 +1 @@';
  const b = 'b.ts\nnone\nmodified\n@@ -2 +2 @@';
  const bEdited = 'b.ts\nnone\nmodified\n@@ -2 +2 @@ different';

  it('accepts an identical comparison', () => {
    expect(coversAllOf([a, b], [a, b])).toBe(true);
  });

  it('accepts a head that dropped a file the review had read', () => {
    /* The case this exists for: `main` absorbed one of the PR's files, so the PR now proposes
       strictly less than what was reviewed. Dropping a file cannot introduce unread code, and
       CodeRabbit will not re-review it — asked again, it answers "No files to review". */
    expect(coversAllOf([a, b], [a])).toBe(true);
  });

  it('rejects a head that changed a file', () => {
    /* The edit that must never ride in on an older review. */
    expect(coversAllOf([a, b], [a, bEdited])).toBe(false);
  });

  it('rejects a head that added a file', () => {
    expect(coversAllOf([a], [a, b])).toBe(false);
  });

  it('accepts an empty head, which proposes nothing', () => {
    expect(coversAllOf([a, b], [])).toBe(true);
  });

  it('rejects everything when nothing was reviewed', () => {
    expect(coversAllOf([], [a])).toBe(false);
  });

  it('works on the entries the fingerprint is built from', () => {
    /* The two halves have to agree: `diffEntries` produces what `coversAllOf` compares, and a
       change to either alone would silently stop the freshness check from meaning anything. */
    const files: ComparedFile[] = [
      { filename: 'a.ts', status: 'modified', patch: '@@ -1 +1 @@' },
      { filename: 'b.ts', status: 'modified', patch: '@@ -2 +2 @@' },
    ];
    const entries = diffEntries(files);

    expect(entries).toHaveLength(2);
    expect(coversAllOf(entries, diffEntries(files.slice(0, 1)))).toBe(true);
    expect(diffFingerprint(files)).toBe(entries.join('\n--\n'));
  });
});
