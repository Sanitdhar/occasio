/**
 * The one sentence CodeRabbit writes when it has read the current head.
 *
 * A review is evidenced by what it produced — a walkthrough, findings, a submitted review — and
 * a review that finds nothing produces none of those. `@coderabbitai full review` on a clean
 * pull request posts no review record at all; it edits its own acknowledgement to add an
 * "Action performed" note and stops. The freshness check then has nothing newer than the head
 * commit to point at and refuses the merge forever, which is where #144 sat: reviewed, clean,
 * and permanently unmergeable.
 *
 * So this recognises that note. Narrowly, because the same block carries a second sentence that
 * means the opposite:
 *
 *     ✅ Action performed
 *     Review finished.
 *     > Note: CodeRabbit is an incremental review system and does not re-review already
 *     > reviewed commits.
 *
 * That is `@coderabbitai review`, and it is posted whether or not anything was read — the note
 * underneath says so in as many words. It is the comment that would have certified #144's stale
 * review as fresh. Only the full-review form counts, because only the full form is a statement
 * about the current head rather than about the ancestry.
 */

/**
 * Line-anchored, so a body that merely quotes the phrase does not count. `\s*` deliberately
 * excludes `>`: text CodeRabbit quotes from somebody else is not CodeRabbit saying it.
 */
const FULL_REVIEW_FINISHED = /(^|\n)[^\S\n]*Full review finished\b/;

export const isFullReviewFinished = (body) => FULL_REVIEW_FINISHED.test(String(body ?? ''));
