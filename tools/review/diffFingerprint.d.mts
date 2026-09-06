/**
 * Types for the `.mjs` module beside this file.
 *
 * It stays `.mjs` because `check-reviewed.mjs` runs under plain `node` in CI, with no build
 * step and no loader — a `.ts` module could not be imported there. The declaration is what
 * lets the test import it without a `@ts-expect-error`, which would have switched off exactly
 * the checking this repo relies on.
 */

/** One entry of GitHub's compare response, narrowed to the fields the fingerprint reads. */
export type ComparedFile = {
  readonly filename?: string | undefined;
  /** Set by GitHub only for a rename; the path the file came from. */
  readonly previous_filename?: string | undefined;
  readonly status?: string | undefined;
  readonly patch?: string | null | undefined;
  readonly sha?: string | null | undefined;
};

export declare const COMPARE_FILE_CAP: number;
export declare const isDescribable: (file: ComparedFile) => boolean;
export declare const diffEntries: (files: readonly ComparedFile[]) => string[];
export declare const coversAllOf: (reviewed: readonly string[], head: readonly string[]) => boolean;
export declare const diffFingerprint: (files: readonly ComparedFile[]) => string;
