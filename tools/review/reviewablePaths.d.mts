/** Types for the `.mjs` beside this file; see diffFingerprint.d.mts for why it stays `.mjs`. */
export declare const parseExcludedPaths: (yaml: string) => string[];
export declare const matchesGlob: (pattern: string, path: string) => boolean;
export declare const isReviewable: (excluded: readonly string[], path: string) => boolean;
