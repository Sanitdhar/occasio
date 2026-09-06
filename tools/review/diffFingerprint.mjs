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
 * The lines a patch adds and removes, without the context around them.
 *
 * A rebase does not change an edit, but it does change where the edit sits: replay a branch onto
 * a main that has moved and the same three added lines arrive with different surrounding
 * context and different hunk headers. Comparing the raw patch then reports a change that a
 * reviewer would not see, and the pull request is stuck asking for a review of nothing — which
 * is where #144 spent an afternoon and eight rebases.
 *
 * What this gives up is the ability to notice the same edit applied somewhere else in the same
 * file. That is a real gap and a narrow one: it needs identical added and removed lines at a
 * different location, with no other file differing. The alternative is a gate that a rebase
 * defeats, which is worse, because the answer to it is a human deciding to merge anyway.
 *
 * @param {string} patch
 * @returns {string}
 */
const changedLines = (patch) =>
  patch
    .split('\n')
    .filter((line) => /^[+-]/.test(line) && !/^(\+\+\+|---)/.test(line))
    .join('\n');

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
 * One string per file, each identifying that file's change completely.
 *
 * Separate from the joined fingerprint because a comparison is sometimes a *subset* of another
 * rather than equal to it — a pull request whose base absorbed one of its files still proposes
 * only changes that were already read — and a single joined string cannot express that.
 *
 * @param {{ filename?: string, previous_filename?: string, patch?: string, sha?: string, status?: string }[]} files
 * @returns {string[]}
 */
export const diffEntries = (files) =>
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
      const body =
        file.patch === undefined ? `binary:${file.sha ?? 'unknown'}` : changedLines(file.patch);
      /* The status matters on its own: deleting a file and adding it back with the same
         contents is not the same change as leaving it alone. */
      return `${name}\n${from}\n${file.status ?? 'unknown'}\n${body}`;
    })
    /* Sorted, because the API does not promise a stable file order between calls, and a
       fingerprint that depends on response ordering would report spurious differences. */
    .sort();

/**
 * @param {{ filename?: string, previous_filename?: string, patch?: string, sha?: string, status?: string }[]} files
 * @returns {string}
 */
export const diffFingerprint = (files) => diffEntries(files).join('\n--\n');

/**
 * Whether every change in `head` appears in `reviewed`.
 *
 * The question the freshness check actually asks. Equality is too strict: a pull request whose
 * base absorbed one of its files proposes strictly less than what was read, and dropping a file
 * cannot introduce code nobody saw. A file whose patch changed is simply not in the reviewed
 * set, so an edit still answers false.
 *
 * An empty `head` answers true, which is correct — a pull request that now proposes nothing has
 * nothing unreviewed in it — and is why the caller checks that the comparison was complete
 * before asking.
 *
 * @param {readonly string[]} reviewed
 * @param {readonly string[]} head
 * @returns {boolean}
 */
export const coversAllOf = (reviewed, head) => {
  const seen = new Set(reviewed);
  return head.every((entry) => seen.has(entry));
};
