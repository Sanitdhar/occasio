/** Types for the `.mjs` beside this file; see diffFingerprint.d.mts for why it stays `.mjs`. */
export declare const parseBaseBranches: (yaml: string) => string[] | null;
export declare const isAutoReviewedBase: (
  patterns: readonly string[] | null,
  ref: string,
) => boolean | null;
