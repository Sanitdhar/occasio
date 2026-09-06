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
 * #123 merged that way. This looks for evidence of an actual review instead.
 *
 * Usage: node tools/review/check-reviewed.mjs <pr-number>
 *   GITHUB_TOKEN or GH_TOKEN is used when set. The repository is public, so unauthenticated
 *   requests also work, at a lower rate limit.
 */
import { readFileSync } from 'node:fs';

/**
 * Exact logins, not a substring match.
 *
 * Matching any login *containing* "coderabbit" would let anyone who registers such an account
 * post a comment saying "Walkthrough" and make this gate report a PR as reviewed — an
 * authorization bypass in the one check that exists to be trusted.
 */
const REVIEWER_LOGINS = new Set(['coderabbitai[bot]', 'coderabbitai']);

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

/** Follows pagination: evidence on page two is still evidence. */
const apiAll = async (path) => {
  const headers = { accept: 'application/vnd.github+json' };
  if (token !== undefined) headers.authorization = `Bearer ${token}`;
  const out = [];
  for (let page = 1; page <= 20; page += 1) {
    const url = `https://api.github.com${path}${path.includes('?') ? '&' : '?'}per_page=100&page=${String(page)}`;
    const res = await fetch(url, { headers });
    if (!res.ok) throw new Error(`${path} -> ${String(res.status)} ${res.statusText}`);
    const batch = await res.json();
    if (!Array.isArray(batch) || batch.length === 0) break;
    out.push(...batch);
    if (batch.length < 100) break;
  }
  return out;
};

const apiOne = async (path) => {
  const headers = { accept: 'application/vnd.github+json' };
  if (token !== undefined) headers.authorization = `Bearer ${token}`;
  const res = await fetch(`https://api.github.com${path}`, { headers });
  if (!res.ok) throw new Error(`${path} -> ${String(res.status)} ${res.statusText}`);
  return res.json();
};

const byReviewer = (item) => REVIEWER_LOGINS.has(item.user?.login ?? '');

const [issueComments, reviewComments, reviews, prData] = await Promise.all([
  apiAll(`/repos/${REPO}/issues/${pr}/comments`),
  apiAll(`/repos/${REPO}/pulls/${pr}/comments`),
  apiAll(`/repos/${REPO}/pulls/${pr}/reviews`),
  apiOne(`/repos/${REPO}/pulls/${pr}`),
]);

const status = await apiOne(`/repos/${REPO}/commits/${prData.head.sha}/status`);
const reviewerStatus = status.statuses.find((s) => s.context.toLowerCase().includes('coderabbit'));

const rateLimited = issueComments.some(
  (c) => byReviewer(c) && c.body.includes('Review limit reached'),
);
const walkthrough = issueComments.some((c) => byReviewer(c) && c.body.includes('Walkthrough'));
const findings = reviewComments.filter(byReviewer).length;
/* A PENDING review has no submitted_at. Counting it would report "reviewed" before the review
   exists — the same mistake, one level in. */
const submitted = reviews.filter((r) => byReviewer(r) && r.submitted_at != null).length;

const reviewed = walkthrough || findings > 0 || submitted > 0;

console.log(`PR #${pr} — ${prData.title}`);
console.log(
  `  status      : ${reviewerStatus?.state ?? 'none'} | ${reviewerStatus?.description ?? ''}`,
);
console.log(`  walkthrough : ${String(walkthrough)}`);
console.log(`  findings    : ${String(findings)}`);
console.log(`  reviews     : ${String(submitted)}`);
console.log(`  rate limited: ${String(rateLimited)}`);

if (!reviewed) {
  console.error(
    `\nNOT REVIEWED. ${rateLimited ? 'The review budget was exhausted; wait for it to reset.' : 'No walkthrough, finding or submitted review from a known reviewer account.'}`,
  );
  console.error('Merging now would satisfy the letter of D40 and none of its point.');
  process.exit(1);
}
console.log('\nReviewed.');
