/**
 * Asserts a pull request was actually reviewed before it is merged.
 *
 * D40 says every PR waits for CodeRabbit. The obvious check — the `CodeRabbit` commit status
 * being `success` — does not mean that happened. When the org's hourly review budget is
 * exhausted, CodeRabbit posts a "Review limit reached" comment and sets the status to:
 *
 *     CodeRabbit: success | Review rate limited
 *
 * A merge gate keyed on `success` therefore passes on a PR nothing has read. #121 merged that
 * way. This checks for evidence of an actual review instead: a walkthrough or a finding.
 *
 * Usage: node tools/review/check-reviewed.mjs <pr-number>
 */
import { readFileSync } from 'node:fs';

const REPO = 'dharlabs/occasio';
const pr = process.argv[2];
if (pr === undefined) {
  console.error('usage: node tools/review/check-reviewed.mjs <pr-number>');
  process.exit(2);
}

const token = /^https:\/\/[^:]+:([^@]+)@/.exec(
  readFileSync('/root/.git-credentials-sanit', 'utf8').split('\n')[0] ?? '',
)?.[1];

const api = async (path) => {
  const res = await fetch(`https://api.github.com${path}`, {
    headers: { authorization: `Bearer ${token ?? ''}`, accept: 'application/vnd.github+json' },
  });
  if (!res.ok) throw new Error(`${path} -> ${String(res.status)}`);
  return res.json();
};

const isBot = (login) => login.toLowerCase().includes('coderabbit');

const [issueComments, reviewComments, reviews, prData] = await Promise.all([
  api(`/repos/${REPO}/issues/${pr}/comments?per_page=100`),
  api(`/repos/${REPO}/pulls/${pr}/comments?per_page=100`),
  api(`/repos/${REPO}/pulls/${pr}/reviews?per_page=100`),
  api(`/repos/${REPO}/pulls/${pr}`),
]);

const status = await api(`/repos/${REPO}/commits/${prData.head.sha}/status`);
const crStatus = status.statuses.find((s) => isBot(s.context));

const rateLimited = issueComments.some(
  (c) => isBot(c.user.login) && c.body.includes('Review limit reached'),
);
const walkthrough = issueComments.some(
  (c) => isBot(c.user.login) && c.body.includes('Walkthrough'),
);
const findings = reviewComments.filter((c) => isBot(c.user.login)).length;
const submitted = reviews.filter((r) => isBot(r.user.login)).length;

const reviewed = walkthrough || findings > 0 || submitted > 0;

console.log(`PR #${pr} — ${prData.title}`);
console.log(`  status      : ${crStatus?.state ?? 'none'} | ${crStatus?.description ?? ''}`);
console.log(`  walkthrough : ${String(walkthrough)}`);
console.log(`  findings    : ${String(findings)}`);
console.log(`  reviews     : ${String(submitted)}`);
console.log(`  rate limited: ${String(rateLimited)}`);

if (!reviewed) {
  console.error(
    `\nNOT REVIEWED. ${rateLimited ? 'The review budget was exhausted; wait for it to reset.' : 'No walkthrough, findings or submitted review found.'}`,
  );
  console.error('Merging now would satisfy the letter of D40 and none of its point.');
  process.exit(1);
}
console.log('\nReviewed.');
