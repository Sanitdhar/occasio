import { describe, expect, it } from '@jest/globals';
import { isFullReviewFinished } from './reviewMarkers.mjs';

/**
 * This predicate can only ever make a stale review look fresh, so every case below is weighted
 * toward it recognising *less* than asked. The dangerous direction is a false positive: one
 * would let a commit nobody read merge under an older review's authority.
 */

/** Verbatim from the comment CodeRabbit posted on #144, minus the learnings block. */
const FULL = `\`@Sanitdhar\` A full review will evaluate the current head of \`#144\`. It will not
rely on the previous incremental-review ancestry.

<details>
<summary>✅ Action performed</summary>

Full review finished.

</details>`;

/** Verbatim from the same pull request, an hour earlier. This one must not count. */
const INCREMENTAL = `<details>
<summary>✅ Action performed</summary>

Review finished.

> Note: CodeRabbit is an incremental review system and does not re-review already reviewed
> commits. This command is applicable only when automatic reviews are paused.

</details>`;

describe('isFullReviewFinished', () => {
  it('recognises a finished full review', () => {
    expect(isFullReviewFinished(FULL)).toBe(true);
  });

  it('does not recognise a finished incremental review', () => {
    /* The whole point. An incremental review is posted whether or not anything was read — its
       own note says it does not re-review commits it believes it has seen — so treating it as
       evidence would date a stale review to the moment somebody asked for a new one. */
    expect(isFullReviewFinished(INCREMENTAL)).toBe(false);
  });

  it('does not recognise the announcement on its own', () => {
    /* The acknowledgement is posted the second the command is read, minutes before the review
       exists. Only the edit that adds the note means it finished. */
    expect(isFullReviewFinished(FULL.split('<details>')[0] ?? '')).toBe(false);
  });

  it('does not count the phrase quoted from somebody else', () => {
    expect(isFullReviewFinished('> Full review finished.')).toBe(false);
    expect(isFullReviewFinished('The gate looks for "Full review finished".')).toBe(false);
  });

  it('does not count a longer word that starts the same way', () => {
    expect(isFullReviewFinished('Full review finishedness')).toBe(false);
  });

  it('survives a missing or non-string body rather than throwing', () => {
    /* The gate reads whatever the API returned. A body that is absent is not a review. */
    expect(isFullReviewFinished(undefined)).toBe(false);
    expect(isFullReviewFinished(null)).toBe(false);
  });
});
