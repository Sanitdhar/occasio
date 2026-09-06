/** Types for the `.mjs` beside this file; see diffFingerprint.d.mts for why it stays `.mjs`. */

export type ReviewVerdict = {
  title: string;
  baseRef: string | null;
  autoReviewedBase: boolean | null;
  headSha: string | null;
  headAt: string | null;
  reviewerState: string;
  reviewerDescription: string;
  walkthrough: boolean;
  findings: number;
  submitted: number;
  rateLimited: boolean;
  claudeReviewed: boolean;
  claudeFindings: number;
  lastReviewAt: string | null;
  fullReviewAt: string | null;
  reviewedSha: string | null;
  rebasedOnly: boolean;
  stale: boolean;
  reviewed: boolean;
  ok: boolean;
};

export declare const REVIEWER_LOGINS: Set<string>;
export declare const CLAUDE_REVIEWER_LOGIN: string;
export declare const evaluate: (options: {
  api: (path: string) => Promise<unknown>;
  apiAll: (path: string) => Promise<unknown[]>;
  repo: string;
  pr: string | number;
  excludedPaths?: readonly string[];
  baseBranches?: readonly string[] | null;
}) => Promise<ReviewVerdict>;
