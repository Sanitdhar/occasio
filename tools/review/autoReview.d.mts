/** Types for the `.mjs` beside this file; see diffFingerprint.d.mts for why it stays `.mjs`. */

export type AutoReviewConfig = {
  enabled: boolean;
  patterns: string[] | null;
};

export type AutoReviewState = 'eligible' | 'disabled' | 'base-not-configured' | 'unknown';

export declare const parseAutoReview: (yaml: string) => AutoReviewConfig | null;
export declare const autoReviewState: (
  config: AutoReviewConfig | null,
  ref: string,
) => AutoReviewState;
export declare const matchesBase: (patterns: readonly string[], ref: string) => boolean;
