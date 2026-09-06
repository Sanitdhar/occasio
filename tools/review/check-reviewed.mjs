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
import { COMPARE_FILE_CAP, diffFingerprint } from './diffFingerprint.mjs';

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
/*
 * Claude counts as a reviewer only where D42 puts it: standing in for CodeRabbit after the
 * budget ran out. Without the `rateLimited` conjunct, any Claude comment on any PR — a reply in
 * a thread, an answer to a question, anything the app posts — satisfied this gate, so the
 * fallback reviewer doubled as a way to skip review entirely.
 */
const claudeReviewed = rateLimited && (claudeFindings > 0 || claudeComment);

/*
 * When the newest review happened, and when the code it would have read was written.
 *
 * A review is of a commit, not of a pull request. Push a fix after the review and the PR still
 * carries a walkthrough, findings and a submitted review — every signal below is still true —
 * while the diff that is about to land has been read by nobody. On #134 that was a 374-line
 * commit changing who may read invitation contact details, eight minutes after the review it
 * appeared to have.
 */
/*
 * Only evidence that could make `reviewed` true may date it. Any reviewer comment would be
 * wrong here in a specific and useful way: "Review limit reached" is posted by the reviewer,
 * after the commit, and says a review did *not* happen — counting it would let the one comment
 * that means "unreviewed" certify a stale review as fresh. Claude's activity is admitted only
 * on the condition D42 gives it, matching `claudeReviewed` above.
 */
const reviewEvidence = [
  ...reviews.filter((r) => byReviewer(r) && r.submitted_at != null).map((r) => r.submitted_at),
  ...reviewComments.filter(byReviewer).map((c) => c.created_at),
  ...issueComments
    .filter((c) => byReviewer(c) && c.body.includes('Walkthrough'))
    .map((c) => c.created_at),
  ...(rateLimited
    ? [
        ...reviewComments.filter(byClaude).map((c) => c.created_at),
        ...issueComments.filter(byClaude).map((c) => c.created_at),
      ]
    : []),
].filter((value) => value != null);
const lastReviewAt = reviewEvidence.length === 0 ? null : reviewEvidence.sort().at(-1);

const headCommit = await apiOne(`/repos/${REPO}/commits/${prData.head.sha}`);
const headAt = headCommit.commit?.committer?.date ?? null;

/**
 * The change a commit proposes, independent of where it sits in history.
 *
 * `/compare/base...head` is three-dot, so it reports the difference from the merge base — the
 * pull request's own changes, without whatever the base branch has done since. Hashing the
 * patches gives a value that survives a rebase and moves the moment a line does.
 */
const effectiveDiff = async (sha) => {
  try {
    const comparison = await apiOne(
      `/repos/${REPO}/compare/${prData.base.ref}...${sha}?per_page=300`,
    );
    /*
     * Everything below fails closed, because this function's answer is used to skip a review and
     * every uncertainty here is shaped the same way: two incomplete comparisons produce equal
     * fingerprints, and equal reads as "already reviewed".
     */
    const files = comparison.files;
    /* An absent list fingerprints as the empty string, and so does another absent list. */
    if (!Array.isArray(files)) return null;
    /* The endpoint stops at 300 files; at the cap the list is truncated, so a file nobody
       listed can differ while the two fingerprints match. */
    if (files.length >= COMPARE_FILE_CAP) return null;
    /* A file with neither a patch nor a blob sha is a file this cannot describe. Both would
       serialise as `binary:unknown`, which is one unknown matching another. */
    if (files.some((f) => f.patch === undefined && f.sha === undefined)) return null;
    return diffFingerprint(files);
  } catch {
    /* A force-pushed commit can fall out of reach. Unknown is not "unchanged". */
    return null;
  }
};

/*
 * A rebase is not a change to the code.
 *
 * Branch protection requires a branch to be up to date, so every open PR is rebased whenever
 * `main` moves — and the head commit is then newer than its review while proposing exactly the
 * same diff. CodeRabbit will not re-review that, correctly, because there is nothing new to
 * read, so a date comparison alone leaves the PR stuck between a gate wanting a review and a
 * reviewer with no reason to give one (#140).
 *
 * So the date is the cheap check and the diff is the authority: when the newest review sits on
 * a commit proposing the same effective diff as the head, the review still applies. Any real
 * edit changes the patches and this stops helping, which is the point.
 */
const reviewedSha = [...reviews]
  .filter((r) => byReviewer(r) && r.submitted_at != null)
  .sort((a, b) => (a.submitted_at < b.submitted_at ? -1 : 1))
  .at(-1)?.commit_id;

const sameDiffAsReviewed = async () => {
  if (reviewedSha === undefined || reviewedSha === prData.head.sha) return false;
  const [reviewedDiff, headDiff] = await Promise.all([
    effectiveDiff(reviewedSha),
    effectiveDiff(prData.head.sha),
  ]);
  return reviewedDiff !== null && headDiff !== null && reviewedDiff === headDiff;
};
/*
 * Fails closed. An absent timestamp is a reason to look rather than to pass, and treating one
 * as `not stale` would have made every unknown a quiet approval — which is the failure this
 * whole file exists to answer, reintroduced by its newest check.
 */
const newerThanReview =
  lastReviewAt == null || headAt === null ? true : Date.parse(headAt) > Date.parse(lastReviewAt);
const rebasedOnly = newerThanReview && (await sameDiffAsReviewed());
const stale = newerThanReview && !rebasedOnly;

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
console.log(`  last review : ${lastReviewAt ?? 'none'}`);
console.log(`  head commit : ${prData.head.sha.slice(0, 7)} ${headAt ?? 'unknown'}`);
if (rebasedOnly) {
  console.log(
    `  rebase only : yes — same effective diff as the reviewed commit ${String(reviewedSha).slice(0, 7)}`,
  );
}

if (reviewed && stale) {
  console.error(
    lastReviewAt == null || headAt === null
      ? `\nNOT REVIEWED. Could not date the review (${String(lastReviewAt)}) or the head commit (${String(headAt)}), so freshness cannot be established.`
      : `\nNOT REVIEWED. Head commit ${prData.head.sha.slice(0, 7)} (${String(headAt)}) is newer than the last review (${String(lastReviewAt)}).`,
  );
  console.error(
    'The pull request has been reviewed; the code about to merge has not. Wait for the',
  );
  console.error('incremental review of this commit, which normally lands within a few minutes.');
  process.exit(1);
}

if (!reviewed) {
  console.error(
    `\nNOT REVIEWED. ${rateLimited ? 'The review budget was exhausted, and Claude has not stepped in yet; wait for .github/workflows/claude-fallback-review.yml or for the budget to reset.' : 'No walkthrough, finding or submitted review from a known reviewer account.'}`,
  );
  console.error('Merging now would satisfy the letter of D40 and none of its point.');
  process.exit(1);
}
console.log('\nReviewed.');
