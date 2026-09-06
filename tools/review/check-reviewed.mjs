/**
 * Asserts a pull request was actually reviewed before it is merged.
 *
 * D40 says every PR waits for CodeRabbit. The obvious check — the `CodeRabbit` commit status
 * being `success` — does not mean that happened. When the review budget is exhausted,
 * CodeRabbit posts a "Review limit reached" comment and sets the status to:
 *
 *     CodeRabbit: success | Review rate limited
 *
 * A merge gate keyed on `success` therefore passes on a PR nothing has read. #121, #122 and
 * #123 merged that way. This looks for evidence of an actual review instead — either
 * CodeRabbit's, or Claude's when it stepped in as CodeRabbit's fallback (D42).
 *
 * The decision lives in reviewGate.mjs, which takes its data through one injected `api` seam so
 * every rule in it can be tested (#148). What is left here is the command line: where the token
 * comes from, how the answer is printed, and what the exit code is.
 *
 * Usage: node tools/review/check-reviewed.mjs <pr-number>
 *   GITHUB_TOKEN or GH_TOKEN is used when set. The repository is public, so unauthenticated
 *   requests also work, at a lower rate limit.
 */
import { readFileSync } from 'node:fs';
import { parseExcludedPaths } from './reviewablePaths.mjs';
import { evaluate } from './reviewGate.mjs';

const REPO = process.env['GITHUB_REPOSITORY'] ?? 'dharlabs/occasio';
const pr = process.argv[2];
if (pr === undefined) {
  console.error('usage: node tools/review/check-reviewed.mjs <pr-number>');
  process.exit(2);
}

/** Local convenience only; absent on a normal machine, which must not be fatal. */
const tokenFromCredentialsFile = () => {
  try {
    const line = readFileSync('/root/.git-credentials-sanit', 'utf8').split('\n')[0] ?? '';
    return /^https:\/\/[^:]+:([^@]+)@/.exec(line)?.[1];
  } catch {
    return undefined;
  }
};

const token = process.env['GITHUB_TOKEN'] ?? process.env['GH_TOKEN'] ?? tokenFromCredentialsFile();

const headers = () => {
  const h = { accept: 'application/vnd.github+json' };
  if (token !== undefined) h.authorization = `Bearer ${token}`;
  return h;
};

const api = async (path) => {
  const res = await fetch(`https://api.github.com${path}`, { headers: headers() });
  if (!res.ok) throw new Error(`${path} -> ${String(res.status)} ${res.statusText}`);
  return res.json();
};

/** Follows pagination: evidence on page two is still evidence. */
const apiAll = async (path) => {
  const out = [];
  for (let page = 1; page <= 20; page += 1) {
    const url = `https://api.github.com${path}${path.includes('?') ? '&' : '?'}per_page=100&page=${String(page)}`;
    const res = await fetch(url, { headers: headers() });
    if (!res.ok) throw new Error(`${path} -> ${String(res.status)} ${res.statusText}`);
    const batch = await res.json();
    if (!Array.isArray(batch) || batch.length === 0) break;
    out.push(...batch);
    if (batch.length < 100) break;
  }
  return out;
};

/** Read once. Absent in a checkout that does not have it, which simply excludes nothing. */
const excludedPaths = (() => {
  try {
    return parseExcludedPaths(readFileSync('.coderabbit.yaml', 'utf8'));
  } catch {
    return [];
  }
})();

const v = await evaluate({ api, apiAll, repo: REPO, pr, excludedPaths });

console.log(`PR #${pr} — ${v.title}`);
console.log(`  status      : ${v.reviewerState} | ${v.reviewerDescription}`);
console.log(`  walkthrough : ${String(v.walkthrough)}`);
console.log(`  findings    : ${String(v.findings)}`);
console.log(`  reviews     : ${String(v.submitted)}`);
console.log(`  rate limited: ${String(v.rateLimited)}`);
console.log(`  claude      : ${String(v.claudeReviewed)} (findings: ${String(v.claudeFindings)})`);
console.log(`  last review : ${v.lastReviewAt ?? 'none'}`);
if (v.fullReviewAt !== null) console.log(`  full review : ${v.fullReviewAt}`);
console.log(`  head commit : ${(v.headSha ?? 'unknown').slice(0, 7)} ${v.headAt ?? 'unknown'}`);
if (v.rebasedOnly) {
  console.log(
    `  rebase only : yes — every change is one the review of ${String(v.reviewedSha).slice(0, 7)} already read`,
  );
}

if (v.reviewed && v.stale) {
  console.error(
    v.lastReviewAt == null || v.headAt === null
      ? `\nNOT REVIEWED. Could not date the review (${String(v.lastReviewAt)}) or the head commit (${String(v.headAt)}), so freshness cannot be established.`
      : `\nNOT REVIEWED. Head commit ${String(v.headSha).slice(0, 7)} (${String(v.headAt)}) is newer than the last review (${String(v.lastReviewAt)}).`,
  );
  console.error(
    'The pull request has been reviewed; the code about to merge has not. Wait for the',
  );
  console.error('incremental review of this commit, which normally lands within a few minutes.');
  process.exit(1);
}

if (!v.reviewed) {
  console.error(
    `\nNOT REVIEWED. ${v.rateLimited ? 'The review budget was exhausted, and Claude has not stepped in yet; wait for .github/workflows/claude-fallback-review.yml or for the budget to reset.' : 'No walkthrough, finding or submitted review from a known reviewer account.'}`,
  );
  console.error('Merging now would satisfy the letter of D40 and none of its point.');
  process.exit(1);
}
console.log('\nReviewed.');
