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
 *
 * Exactly one login, not two. The bare `coderabbitai` was here as a hedge, and a hedge is the
 * bypass again with a smaller opening: the app posts as `coderabbitai[bot]`, which is what
 * every comment and review on this repository actually carries.
 */
const REVIEWER_LOGINS = new Set(['coderabbitai[bot]']);

/**
 * D42 — Claude only ever runs here as CodeRabbit's fallback (see
 * .github/workflows/claude-fallback-review.yml, triggered solely by CodeRabbit's own
 * "Review limit reached" comment), posting through the official Claude GitHub app
 * (https://github.com/apps/claude). Exact login, no substring — the same rule REVIEWER_LOGINS
 * applies above, extended to a second trusted reviewer rather than hedged into the first one.
 *
 * Unconfirmed until the workflow has actually posted once: check `user.login` on that PR's
 * comments and correct this if the app's account name differs.
 */
const CLAUDE_REVIEWER_LOGIN = 'claude[bot]';

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

const byClaude = (item) => (item.user?.login ?? '') === CLAUDE_REVIEWER_LOGIN;
const claudeFindings = reviewComments.filter(byClaude).length;
const claudeComment = issueComments.some(byClaude);
const claudeReviewed = claudeFindings > 0 || claudeComment;

const reviewed = walkthrough || findings > 0 || submitted > 0 || claudeReviewed;

console.log(`PR #${pr} — ${prData.title}`);
console.log(
  `  status      : ${reviewerStatus?.state ?? 'none'} | ${reviewerStatus?.description ?? ''}`,
);
console.log(`  walkthrough : ${String(walkthrough)}`);
console.log(`  findings    : ${String(findings)}`);
console.log(`  reviews     : ${String(submitted)}`);
console.log(`  rate limited: ${String(rateLimited)}`);
console.log(`  claude      : ${String(claudeReviewed)} (findings: ${String(claudeFindings)})`);

if (!reviewed) {
  console.error(
    `\nNOT REVIEWED. ${rateLimited ? 'The review budget was exhausted, and Claude has not stepped in yet; wait for .github/workflows/claude-fallback-review.yml or for the budget to reset.' : 'No walkthrough, finding or submitted review from a known reviewer account.'}`,
  );
  console.error('Merging now would satisfy the letter of D40 and none of its point.');
  process.exit(1);
}
console.log('\nReviewed.');
