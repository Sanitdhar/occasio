/**
 * A stable identity for the change a pull request proposes.
 *
 * Built from GitHub's three-dot comparison, so it describes the difference from the merge base
 * — the PR's own changes, without whatever the base branch has done since. That is what makes
 * it survive a rebase: the commit is new, its parent is new, and the change is the same one
 * somebody already read.
 *
 * Used by check-reviewed.mjs to tell "this was rebased" from "this was edited". Getting that
 * distinction wrong in the permissive direction would let an edit ride in on an old review, so
 * the rules below are deliberately strict: anything unknown compares as different.
 */

/**
 * The most files GitHub's compare endpoint will report. A comparison at the cap is truncated,
 * and a fingerprint built from a truncated list can match while an unlisted file differs — so
 * the caller must treat it as unknown rather than as a comparison.
 */
export const COMPARE_FILE_CAP = 300;

/**
 * Whether a file carries enough to tell one version of it from another.
 *
 * A file with neither a patch nor a blob sha serialises to `binary:unknown`, and so does every
 * other such file — one unknown matching another, in the function whose answer decides whether
 * a review can be skipped. `null` counts as absent as well as `undefined`, because these values
 * come off the wire as JSON and a null is what an absent field often arrives as.
 *
 * Exported and tested rather than inlined at the call site: the first version of this guard was
 * written inline against `undefined` only, and nothing could have caught that it missed `null`.
 *
 * @param {{ patch?: string | null, sha?: string | null }} file
 * @returns {boolean}
 */
export const isDescribable = (file) => (file.patch ?? file.sha ?? null) !== null;

/**
 * @param {{ filename?: string, previous_filename?: string, patch?: string, sha?: string, status?: string }[]} files
 * @returns {string}
 */
export const diffFingerprint = (files) =>
  files
    .map((file) => {
      const name = file.filename ?? '';
      /*
       * Where a rename came from. Two renames landing on the same path with the same contents
       * are the same patch and the same status, and differ only here — without it, moving
       * `secrets.ts` to `config.ts` fingerprints identically to moving `readme.ts` to it.
       */
      const from = file.previous_filename ?? 'none';
      /*
       * A binary file has no patch, and its blob sha is the only thing that distinguishes one
       * version from another. Falling back to the empty string instead would make every binary
       * change invisible here — two different images would fingerprint identically.
       */
      const body = file.patch ?? `binary:${file.sha ?? 'unknown'}`;
      /* The status matters on its own: deleting a file and adding it back with the same
         contents is not the same change as leaving it alone. */
      return `${name}\n${from}\n${file.status ?? 'unknown'}\n${body}`;
    })
    /* Sorted, because the API does not promise a stable file order between calls, and a
       fingerprint that depends on response ordering would report spurious differences. */
    .sort()
    .join('\n--\n');
