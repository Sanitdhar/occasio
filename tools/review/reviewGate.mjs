/**
 * Whether a pull request was actually reviewed, decided from data rather than from the network.
 *
 * Everything here used to live in check-reviewed.mjs, interleaved with `fetch`, and so could not
 * be tested at all (#148). That mattered more than it sounds: every rule below was added because
 * a defect got past it, and each fix was verified by running the real gate against a real pull
 * request and reading the output — which proves the answer for that one PR on that one day.
 *
 * The single seam is `api`. Give it a function from path to parsed JSON and this makes the same
 * decision it makes in CI, against canned responses, in milliseconds.
 */
import { isReviewable } from './reviewablePaths.mjs';
import { COMPARE_FILE_CAP, coversAllOf, diffEntries, isDescribable } from './diffFingerprint.mjs';
import { isFullReviewFinished } from './reviewMarkers.mjs';
import { autoReviewState } from './autoReview.mjs';

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
export const REVIEWER_LOGINS = new Set(['coderabbitai[bot]']);

/**
 * D42 — Claude only ever runs here as CodeRabbit's fallback (see
 * .github/workflows/claude-fallback-review.yml, whose automatic trigger is CodeRabbit's own
 * "Review limit reached" comment), posting through the official Claude GitHub app
 * (https://github.com/apps/claude). Exact login, no substring — the same rule REVIEWER_LOGINS
 * applies above, extended to a second trusted reviewer rather than hedged into the first one.
 *
 * Unconfirmed until the workflow has actually posted once: check `user.login` on that PR's
 * comments and correct this if the app's account name differs. #142 tracks doing exactly that.
 */
export const CLAUDE_REVIEWER_LOGIN = 'claude[bot]';

const byReviewer = (item) => REVIEWER_LOGINS.has(item?.user?.login ?? '');
const byClaude = (item) => (item?.user?.login ?? '') === CLAUDE_REVIEWER_LOGIN;

/**
 * The change a commit proposes, independent of where it sits in history.
 *
 * `/compare/base...head` is three-dot, so it reports the difference from the merge base — the
 * pull request's own changes, without whatever the base branch has done since. Hashing the
 * patches gives a value that survives a rebase and moves the moment a line does.
 */
const effectiveDiff = async (api, repo, base, sha, excludedPaths) => {
  let comparison;
  try {
    comparison = await api(`/repos/${repo}/compare/${base}...${sha}?per_page=300`);
  } catch {
    /* A force-pushed commit can fall out of reach. Unknown is not "unchanged". */
    return null;
  }
  /*
   * Everything below fails closed, because this function's answer is used to skip a review and
   * every uncertainty here is shaped the same way: two incomplete comparisons produce equal
   * fingerprints, and equal reads as "already reviewed".
   */
  const reported = comparison?.files;
  /* An absent list fingerprints as the empty string, and so does another absent list. */
  if (!Array.isArray(reported)) return null;
  /*
   * The cap is checked against what the endpoint reported, before anything is filtered out.
   * Checking the filtered list instead lets excluded entries hide the truncation: 300 files of
   * which 40 are lockfile-and-screenshot noise leaves 260, under the cap, and the check passes
   * on a comparison that was cut short — with the unlisted change being the one nobody
   * reviewed.
   */
  if (reported.length >= COMPARE_FILE_CAP) return null;
  /*
   * Only the files the reviewer is asked to read. `.coderabbit.yaml` excludes the lockfile, the
   * scratch directory and the screenshot baselines, so a commit touching only those gives it
   * nothing to review and it will never produce one — leaving the freshness check demanding
   * something that cannot arrive. Missing config means nothing is excluded, which errs toward
   * asking for more review rather than less.
   */
  const files = reported.filter((f) => isReviewable(excludedPaths, String(f?.filename ?? '')));
  /* A file with neither a patch nor a blob sha is a file this cannot describe. Both would
     serialise as `binary:unknown`, which is one unknown matching another. */
  if (!files.every(isDescribable)) return null;
  return diffEntries(files);
};

/**
 * The gate's verdict, and everything it was derived from.
 *
 * Returned as data rather than printed, so the CLI decides how to say it and the tests can ask
 * about any single rule without parsing prose.
 */
export const evaluate = async ({
  api,
  apiAll,
  repo,
  pr,
  excludedPaths = [],
  autoReview = null,
}) => {
  const [issueComments, reviewComments, reviews, prData] = await Promise.all([
    apiAll(`/repos/${repo}/issues/${pr}/comments`),
    apiAll(`/repos/${repo}/pulls/${pr}/comments`),
    apiAll(`/repos/${repo}/pulls/${pr}/reviews`),
    api(`/repos/${repo}/pulls/${pr}`),
  ]);

  const headSha = prData?.head?.sha ?? null;
  const baseRef = prData?.base?.ref ?? null;

  const status = headSha === null ? null : await api(`/repos/${repo}/commits/${headSha}/status`);
  const reviewerStatus = (status?.statuses ?? []).find((s) =>
    String(s?.context ?? '')
      .toLowerCase()
      .includes('coderabbit'),
  );

  const rateLimited = issueComments.some(
    (c) => byReviewer(c) && String(c.body ?? '').includes('Review limit reached'),
  );
  const walkthrough = issueComments.some(
    (c) => byReviewer(c) && String(c.body ?? '').includes('Walkthrough'),
  );
  const findings = reviewComments.filter(byReviewer).length;
  /* A PENDING review has no submitted_at. Counting it would report "reviewed" before the review
     exists — the same mistake, one level in. */
  const submittedReviews = reviews.filter((r) => byReviewer(r) && r.submitted_at != null);
  const submitted = submittedReviews.length;

  const claudeFindings = reviewComments.filter(byClaude).length;
  const claudeComment = issueComments.some(byClaude);
  /*
   * Claude counts as a reviewer only where D42 puts it: standing in for CodeRabbit after the
   * budget ran out. Without the `rateLimited` conjunct, any Claude comment on any PR — a reply
   * in a thread, an answer to a question, anything the app posts — satisfied this gate, so the
   * fallback reviewer doubled as a way to skip review entirely.
   */
  const claudeReviewed = rateLimited && (claudeFindings > 0 || claudeComment);

  /*
   * When the newest review happened, and when the code it would have read was written.
   *
   * A review is of a commit, not of a pull request. Push a fix after the review and the PR still
   * carries a walkthrough, findings and a submitted review — every signal above is still true —
   * while the diff that is about to land has been read by nobody. On #134 that was a 374-line
   * commit changing who may read invitation contact details, eight minutes after the review it
   * appeared to have.
   *
   * Only evidence that could make `reviewed` true may date it. Any reviewer comment would be
   * wrong here in a specific and useful way: "Review limit reached" is posted by the reviewer,
   * after the commit, and says a review did *not* happen — counting it would let the one comment
   * that means "unreviewed" certify a stale review as fresh. Claude's activity is admitted only
   * on the condition D42 gives it, matching `claudeReviewed` above.
   */
  const fullReviewComments = issueComments.filter(
    (c) => byReviewer(c) && isFullReviewFinished(c.body),
  );
  const reviewEvidence = [
    ...submittedReviews.map((r) => r.submitted_at),
    ...reviewComments.filter(byReviewer).map((c) => c.created_at),
    ...issueComments
      .filter((c) => byReviewer(c) && String(c.body ?? '').includes('Walkthrough'))
      .map((c) => c.created_at),
    /*
     * A full review that found nothing.
     *
     * Every other entry here is something a review produced, and a clean review produces none of
     * them: no walkthrough, no finding, no submitted review — just a note edited into the
     * acknowledgement saying it finished. #144 sat on that for hours, reviewed and clean and
     * permanently stale, because the gate had nothing newer than the head to point at.
     *
     * Dated by `created_at`, which is when the command was acknowledged and therefore when the
     * review was scoped, not `updated_at`, which is when it finished. The two differ by minutes,
     * and a commit pushed inside that window is one the review did not read — with `created_at`
     * the head is then newer than the evidence and this still refuses, which is the answer that
     * costs a wait rather than a merge.
     *
     * Evidence only: it dates a review, it cannot be one. `reviewed` below is deliberately left
     * alone, so this can refresh an existing review and never manufacture a first one.
     */
    ...fullReviewComments.map((c) => c.created_at),
    /* Claude's activity is admitted only on the condition D42 gives it, matching
       `claudeReviewed` above — otherwise the fallback reviewer's every comment could refresh a
       review it had nothing to do with. Dropping this branch is not harmless in the other
       direction either: without it a rate-limited PR that Claude *did* review has no evidence
       to date, so it reads as permanently stale and can never merge. */
    ...(rateLimited
      ? [
          ...reviewComments.filter(byClaude).map((c) => c.created_at),
          ...issueComments.filter(byClaude).map((c) => c.created_at),
        ]
      : []),
  ].filter((value) => value != null);
  const lastReviewAt = reviewEvidence.length === 0 ? null : reviewEvidence.sort().at(-1);

  /** Reported separately, because "clean full review" and "no review" look identical otherwise. */
  const fullReviewAt = fullReviewComments
    .map((c) => c.created_at)
    .filter((value) => value != null)
    .sort()
    .at(-1);

  const headCommit = headSha === null ? null : await api(`/repos/${repo}/commits/${headSha}`);
  const headAt = headCommit?.commit?.committer?.date ?? null;

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
  /*
   * Which commit the newest review sat on.
   *
   * Claude's review comments count here on the same condition they count as evidence, and for a
   * reason that only shows up after a rebase: on a rate-limited pull request there is no
   * CodeRabbit review to take a sha from, so this stayed undefined, `sameDiffAsReviewed` could
   * never answer, and the PR went permanently stale the first time `main` moved. D42 gives the
   * fallback no re-review trigger either, so nothing would have rescued it.
   *
   * Review comments only, never issue comments: a review comment is bound to a commit and an
   * issue comment is not, and a sha invented for an unbound comment would be a guess about
   * which code was read.
   */
  const shaCandidates = [
    ...submittedReviews.map((r) => ({ at: r.submitted_at, sha: r.commit_id })),
    ...(rateLimited
      ? reviewComments.filter(byClaude).map((c) => ({ at: c.created_at, sha: c.commit_id }))
      : []),
  ].filter((candidate) => candidate.at != null && candidate.sha != null);

  const reviewedSha = shaCandidates.sort((a, b) => (a.at < b.at ? -1 : 1)).at(-1)?.sha;

  /**
   * Whether everything the head proposes was part of what the review read.
   *
   * A subset rather than an equality, and the difference is not a convenience. A pull request
   * whose base absorbed one of its files — `main` merged the same lockfile fix, say — proposes a
   * strictly smaller change than the one that was reviewed, and dropping a file cannot introduce
   * code nobody read. Equality refuses that, and CodeRabbit will not clear it either: asked to
   * look again it answers "No files to review", because there is nothing new to read. The gate
   * then wants a review that cannot be produced, which is a stuck pull request rather than a
   * safe one.
   *
   * Any file whose patch differs is simply not in the reviewed set, so an edit still fails here.
   */
  const sameDiffAsReviewed = async () => {
    if (reviewedSha === undefined || reviewedSha === headSha) return false;
    if (headSha === null || baseRef === null) return false;
    const [reviewedDiff, headDiff] = await Promise.all([
      effectiveDiff(api, repo, baseRef, reviewedSha, excludedPaths),
      effectiveDiff(api, repo, baseRef, headSha, excludedPaths),
    ]);
    if (reviewedDiff === null || headDiff === null) return false;
    return coversAllOf(reviewedDiff, headDiff);
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

  /*
   * Whether this pull request is one CodeRabbit will ever auto-review, and if not, why.
   *
   * `unknown` when nothing was configured to check against — that has to stay distinct from
   * every real setting, because "we cannot tell" and "no branch qualifies" want different words
   * and only one of them is worth saying out loud.
   */
  const autoReviewStatus = baseRef === null ? 'unknown' : autoReviewState(autoReview, baseRef);

  return {
    baseRef,
    autoReviewStatus,
    title: prData?.title ?? '',
    headSha,
    headAt,
    reviewerState: reviewerStatus?.state ?? 'none',
    reviewerDescription: reviewerStatus?.description ?? '',
    walkthrough,
    findings,
    submitted,
    rateLimited,
    claudeReviewed,
    claudeFindings,
    lastReviewAt: lastReviewAt ?? null,
    fullReviewAt: fullReviewAt ?? null,
    reviewedSha: reviewedSha ?? null,
    rebasedOnly,
    stale,
    reviewed,
    ok: reviewed && !stale,
  };
};
