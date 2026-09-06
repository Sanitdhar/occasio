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
  readonly status?: string | undefined;
  readonly patch?: string | undefined;
  readonly sha?: string | undefined;
};

export declare const diffFingerprint: (files: readonly ComparedFile[]) => string;
