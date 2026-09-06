import { describe, expect, it } from '@jest/globals';
import { evaluate } from './reviewGate.mjs';

/**
 * The rules that decide whether a merge is allowed, exercised against canned GitHub responses.
 *
 * Every one of these was added because a defect got past it, and until now each fix was verified
 * by running the real gate against a real pull request and reading the output — which proves the
 * answer for one PR on one day and nothing about the next. The cases below are the situations
 * that produced those defects, written down.
 *
 * They lean one way on purpose. A gate that refuses when it should pass costs a wait; a gate
 * that passes when it should refuse is a commit nobody read, on `main`. So the uncertain cases —
 * a missing timestamp, a truncated comparison, a commit that cannot be fetched — all assert
 * refusal.
 */

const REPO = 'dharlabs/occasio';
const PR = '1';
const BOT = 'coderabbitai[bot]';

const HEAD = 'head000';
const REVIEWED = 'revd000';

const AT_REVIEW = '2026-09-06T10:00:00Z';
const AT_HEAD_BEFORE = '2026-09-06T09:00:00Z';
const AT_HEAD_AFTER = '2026-09-06T11:00:00Z';

/** A file entry as `/compare` reports one. */
const file = (filename: string, patch = '@@ -1 +1 @@\n-a\n+b') => ({ filename, patch });

/**
 * The comparison path, in one place.
 *
 * Written out twice — once to route the fixture, once to assert the gate asked for it — it
 * would drift the moment `effectiveDiff` changed its query string, and drift silently: an
 * unrouted path throws, `effectiveDiff` catches every throw and returns null, and null is
 * refusal. Every refusal case below would keep passing while reaching nothing.
 */
const comparePath = (sha: string) => `/repos/${REPO}/compare/main...${sha}?per_page=300`;

/**
 * Routes are thunks so a test can make one of them throw — a force-pushed commit that has
 * fallen out of reach is a case the gate has to answer, and it cannot be expressed by a value.
 *
 * Object endpoints and list endpoints are kept apart rather than narrowed at the call site: the
 * two seams `evaluate` takes have different return types, and a single map would need a cast to
 * satisfy both, which D16 refuses and which would let a mistyped fixture through anyway.
 */
type Objects = Record<string, () => unknown>;
type Lists = Record<string, () => unknown[]>;

type Scenario = {
  baseRef?: string;
  baseBranches?: string[] | null;
  headSha?: string;
  headAt?: string | null;
  issueComments?: unknown[];
  reviewComments?: unknown[];
  reviews?: unknown[];
  compare?: Objects;
  excludedPaths?: string[];
};

/**
 * A pull request that has been reviewed, cleanly, with the review newer than the head. Every
 * test below starts here and breaks exactly one thing, so a failure names its own cause.
 */
const run = async (scenario: Scenario = {}) => {
  const headSha = scenario.headSha ?? HEAD;
  const headAt = scenario.headAt === undefined ? AT_HEAD_BEFORE : scenario.headAt;

  const lists: Lists = {
    [`/repos/${REPO}/issues/${PR}/comments`]: () =>
      scenario.issueComments ?? [
        { user: { login: BOT }, body: '## Walkthrough\n…', created_at: AT_REVIEW },
      ],
    [`/repos/${REPO}/pulls/${PR}/comments`]: () => scenario.reviewComments ?? [],
    [`/repos/${REPO}/pulls/${PR}/reviews`]: () => scenario.reviews ?? [],
  };

  const objects: Objects = {
    [`/repos/${REPO}/pulls/${PR}`]: () => ({
      title: 'a pull request',
      head: { sha: headSha },
      base: { ref: scenario.baseRef ?? 'main' },
    }),
    [`/repos/${REPO}/commits/${headSha}/status`]: () => ({
      statuses: [{ context: 'CodeRabbit', state: 'success', description: 'Review completed' }],
    }),
    [`/repos/${REPO}/commits/${headSha}`]: () => ({ commit: { committer: { date: headAt } } }),
    ...(scenario.compare ?? {}),
  };

  const asked: string[] = [];
  const unrouted: string[] = [];

  /*
   * An unrouted path is a broken fixture, not an empty answer — and it cannot be left to throw
   * and be noticed, because `effectiveDiff` catches every throw and returns null, and null is
   * refusal. A misrouted comparison would therefore produce exactly the answer the refusal
   * tests assert, and they would pass having reached nothing. So the throw is recorded, and
   * `gate` below refuses to hand back a verdict that was reached over a missing route.
   */
  const pick = <T>(table: Record<string, () => T>, path: string): T => {
    asked.push(path);
    const route = table[path];
    if (route === undefined) {
      unrouted.push(path);
      throw new Error(`unrouted: ${path}`);
    }
    return route();
  };

  const verdict = await evaluate({
    api: (path) => Promise.resolve(pick(objects, path)),
    apiAll: (path) => Promise.resolve(pick(lists, path)),
    repo: REPO,
    pr: PR,
    excludedPaths: scenario.excludedPaths ?? ['package-lock.json', '**/__screenshots__/**'],
    baseBranches: scenario.baseBranches === undefined ? ['^main$'] : scenario.baseBranches,
  });

  return { verdict, asked, unrouted };
};

/** The verdict, with a broken fixture failing loudly instead of passing as a refusal. */
const gate = async (scenario: Scenario = {}) => {
  const { verdict, unrouted } = await run(scenario);
  expect(unrouted).toEqual([]);
  return verdict;
};

describe('the review gate', () => {
  it('passes a reviewed pull request whose head predates the review', async () => {
    /* The baseline every other case departs from. If this ever fails, nothing below means
       what it says. */
    expect(await gate()).toMatchObject({ reviewed: true, stale: false, ok: true });
  });

  it('refuses a pull request with no evidence of any review', async () => {
    const v = await gate({ issueComments: [] });
    expect(v).toMatchObject({ reviewed: false, ok: false });
  });

  it('refuses when the head is newer than the review', async () => {
    /*
     * The #134 case: a 374-line commit changing who may read invitation contact details, pushed
     * eight minutes after the review it appeared to have. Every other signal stayed true.
     */
    const v = await gate({ headAt: AT_HEAD_AFTER });
    expect(v).toMatchObject({ reviewed: true, stale: true, ok: false });
  });

  describe('what may date a review', () => {
    it('does not let "Review limit reached" refresh a stale review', async () => {
      /*
       * That comment is posted by the reviewer, after the commit, and says a review did *not*
       * happen. Counting it as evidence would let the one comment meaning "unreviewed" certify
       * a stale review as fresh — the exact inversion this gate exists to prevent.
       */
      const v = await gate({
        headAt: AT_HEAD_AFTER,
        issueComments: [
          { user: { login: BOT }, body: '## Walkthrough\n…', created_at: AT_REVIEW },
          {
            user: { login: BOT },
            body: 'Review limit reached',
            created_at: '2026-09-06T12:00:00Z',
          },
        ],
      });
      expect(v).toMatchObject({ rateLimited: true, stale: true, ok: false });
      expect(v.lastReviewAt).toBe(AT_REVIEW);
    });

    it('accepts a full review that finished after the head commit', async () => {
      /* A clean full review produces no walkthrough, no finding and no review record — only a
         note edited into its own acknowledgement. #144 was stuck on exactly that. */
      const v = await gate({
        headAt: AT_HEAD_AFTER,
        issueComments: [
          { user: { login: BOT }, body: '## Walkthrough\n…', created_at: AT_REVIEW },
          {
            user: { login: BOT },
            body: 'A full review will evaluate the current head.\n\nFull review finished.',
            created_at: '2026-09-06T12:00:00Z',
          },
        ],
      });
      expect(v).toMatchObject({ stale: false, ok: true });
      expect(v.fullReviewAt).toBe('2026-09-06T12:00:00Z');
    });

    it('does not count a review that has not been submitted', async () => {
      /* A PENDING review has no `submitted_at`. Counting it reports "reviewed" before the
         review exists. */
      const v = await gate({
        issueComments: [],
        reviews: [{ user: { login: BOT }, submitted_at: null, commit_id: HEAD }],
      });
      expect(v).toMatchObject({ submitted: 0, reviewed: false, ok: false });
    });
  });

  it('does not accept a login that merely contains a reviewer name', async () => {
    /*
     * Exact logins, not a substring match. Anyone can register `coderabbitai` or
     * `my-coderabbitai[bot]`, post a comment containing the word "Walkthrough", and — under a
     * substring rule — make this gate report a PR as reviewed. That is an authorization bypass
     * in the one check that exists to be trusted, and nothing else here would notice: replace
     * `Set.has` with `String.includes` and every other case in this file still passes.
     */
    for (const login of ['coderabbitai', 'my-coderabbitai[bot]', 'coderabbitai[bot]-x']) {
      const v = await gate({
        issueComments: [{ user: { login }, body: '## Walkthrough\n…', created_at: AT_REVIEW }],
      });
      expect([login, v.reviewed]).toEqual([login, false]);
      expect([login, v.lastReviewAt]).toEqual([login, null]);
    }
  });

  describe('Claude as the fallback reviewer (D42)', () => {
    it('counts Claude only when CodeRabbit was actually rate limited', async () => {
      const withoutLimit = await gate({
        issueComments: [{ user: { login: 'claude[bot]' }, body: 'review', created_at: AT_REVIEW }],
      });
      /* Without the conjunct, any comment the app ever posts — a reply in a thread, an answer to
         a question — satisfied the gate, so the fallback reviewer doubled as a way to skip
         review entirely. */
      expect(withoutLimit).toMatchObject({ claudeReviewed: false, reviewed: false, ok: false });

      const withLimit = await gate({
        issueComments: [
          { user: { login: BOT }, body: 'Review limit reached', created_at: AT_HEAD_BEFORE },
          { user: { login: 'claude[bot]' }, body: 'review', created_at: AT_REVIEW },
        ],
      });
      expect(withLimit).toMatchObject({ claudeReviewed: true, reviewed: true, ok: true });
    });
  });

  describe('a rebase is not a change to the code', () => {
    const CLAUDE = 'claude[bot]';

    const compareOf = (sha: string, files: unknown) => ({ [comparePath(sha)]: () => ({ files }) });

    /**
     * The verdict, plus proof that both comparisons were actually fetched.
     *
     * Without the second half every refusal case below would pass on a typo: `effectiveDiff`
     * turns any throw into `null`, `null` is refusal, and refusal is what they assert. So the
     * helper checks the gate asked for both compare paths and that nothing went unrouted —
     * the assertions then only hold when the code under test ran.
     */
    const rebased = async (
      headFiles: unknown,
      reviewedFiles: unknown,
      excludedPaths?: string[],
    ) => {
      const { verdict, asked, unrouted } = await run({
        headAt: AT_HEAD_AFTER,
        reviews: [{ user: { login: BOT }, submitted_at: AT_REVIEW, commit_id: REVIEWED }],
        compare: { ...compareOf(HEAD, headFiles), ...compareOf(REVIEWED, reviewedFiles) },
        ...(excludedPaths === undefined ? {} : { excludedPaths }),
      });
      expect(unrouted).toEqual([]);
      expect(asked).toEqual(expect.arrayContaining([comparePath(HEAD), comparePath(REVIEWED)]));
      return verdict;
    };

    it('passes when the head proposes the same diff the review read', async () => {
      const files = [file('packages/ui/src/a.ts'), file('packages/ui/src/b.ts')];
      expect(await rebased(files, files)).toMatchObject({ rebasedOnly: true, ok: true });
    });

    it('passes when the base absorbed one of the files, leaving a smaller change', async () => {
      /* A subset, not an equality. Dropping a file cannot introduce code nobody read, and
         CodeRabbit will not clear it either — asked again it answers "No files to review". */
      const reviewedFiles = [file('packages/ui/src/a.ts'), file('packages/ui/src/b.ts')];
      expect(await rebased([file('packages/ui/src/a.ts')], reviewedFiles)).toMatchObject({
        rebasedOnly: true,
        ok: true,
      });
    });

    it('refuses when a line actually changed', async () => {
      const reviewedFiles = [file('packages/ui/src/a.ts', '@@ -1 +1 @@\n-a\n+b')];
      const headFiles = [file('packages/ui/src/a.ts', '@@ -1 +1 @@\n-a\n+c')];
      expect(await rebased(headFiles, reviewedFiles)).toMatchObject({
        rebasedOnly: false,
        stale: true,
        ok: false,
      });
    });

    it('refuses a comparison the API truncated, even when the excess is all excluded', async () => {
      /*
       * The #147 finding. Filtering before the cap check lets excluded entries hide the
       * truncation: 300 files of which 40 are lockfile-and-screenshot noise leaves 260, under
       * the cap, and the check passes on a comparison that was cut short — with the unlisted
       * change being the one nobody reviewed.
       */
      const bulk = Array.from({ length: 260 }, (_, i) => file(`packages/ui/src/f${String(i)}.ts`));
      const noise = Array.from({ length: 40 }, (_, i) =>
        file(`packages/ui/src/__screenshots__/s${String(i)}.png`),
      );
      const truncated = [...bulk, ...noise];
      expect(truncated).toHaveLength(300);

      const v = await rebased(truncated, truncated);
      expect(v).toMatchObject({ rebasedOnly: false, stale: true, ok: false });
    });

    it('refuses a comparison with no file list at all', async () => {
      /* An absent list fingerprints as the empty string, and so does another absent list —
         two unknowns matching each other and reading as "already reviewed". */
      expect(await rebased(undefined, undefined)).toMatchObject({ rebasedOnly: false, ok: false });
    });

    it('refuses a file it cannot describe', async () => {
      /* Neither a patch nor a blob sha: both sides would serialise as `binary:unknown`, which
         is one unknown matching another. */
      const opaque = [{ filename: 'assets/logo.png' }];
      expect(await rebased(opaque, opaque)).toMatchObject({ rebasedOnly: false, ok: false });
    });

    it("anchors on Claude's review comment when CodeRabbit never reviewed", async () => {
      /*
       * A rate-limited pull request has no CodeRabbit review to take a sha from, so before this
       * `reviewedSha` was undefined, `sameDiffAsReviewed` could not answer, and the PR went
       * permanently stale the first time `main` moved — with D42 giving the fallback no
       * re-review trigger to rescue it.
       *
       * Review comments only. An issue comment carries no `commit_id`, so it cannot say which
       * code was read, and a sha invented for one would be a guess.
       */
      const files = [file('packages/ui/src/a.ts')];
      const { verdict, unrouted } = await run({
        headAt: AT_HEAD_AFTER,
        issueComments: [
          { user: { login: BOT }, body: 'Review limit reached', created_at: AT_HEAD_BEFORE },
        ],
        reviewComments: [
          {
            user: { login: CLAUDE },
            created_at: AT_REVIEW,
            commit_id: REVIEWED,
            body: 'a finding',
          },
        ],
        compare: { ...compareOf(HEAD, files), ...compareOf(REVIEWED, files) },
      });
      expect(unrouted).toEqual([]);
      expect(verdict).toMatchObject({ claudeReviewed: true, rebasedOnly: true, ok: true });
    });

    it('refuses when the reviewed commit can no longer be fetched', async () => {
      /* A force push can put it out of reach. Unknown is not "unchanged". */
      const files = [file('packages/ui/src/a.ts')];
      const { verdict, asked, unrouted } = await run({
        headAt: AT_HEAD_AFTER,
        reviews: [{ user: { login: BOT }, submitted_at: AT_REVIEW, commit_id: REVIEWED }],
        compare: {
          [comparePath(HEAD)]: () => ({ files }),
          [comparePath(REVIEWED)]: () => {
            throw new Error('404 Not Found');
          },
        },
      });
      /* The throw has to come from the route, not from a path nobody wired up — those are
         indistinguishable to `effectiveDiff` and only one of them is the case under test. */
      expect(unrouted).toEqual([]);
      expect(asked).toContain(comparePath(REVIEWED));
      expect(verdict).toMatchObject({ rebasedOnly: false, stale: true, ok: false });
    });
  });

  describe('why a pull request is unreviewed', () => {
    it('reports a base branch auto review was never configured for', async () => {
      /*
       * #132 targeted `review/unreviewed-baseline`, matched no pattern, and was skipped in
       * silence — indistinguishable from a PR waiting its turn, for seven and a half hours.
       * The verdict is unchanged either way; what changes is whether waiting is the right
       * response, and here it never is.
       */
      const v = await gate({
        baseRef: 'review/unreviewed-baseline',
        baseBranches: ['^main$', '^feat/.*'],
        issueComments: [],
      });
      expect(v).toMatchObject({ reviewed: false, autoReviewedBase: false, ok: false });
      expect(v.baseRef).toBe('review/unreviewed-baseline');
    });

    it('does not blame the base branch when it is configured', async () => {
      /* A PR simply waiting its turn must not be told to go and edit the reviewer's config. */
      const v = await gate({ baseBranches: ['^main$'], issueComments: [] });
      expect(v).toMatchObject({ reviewed: false, autoReviewedBase: true });
    });

    it('says nothing when there is no configuration to judge against', async () => {
      /* Null, not false. "We cannot tell" must not print as "this can never be reviewed". */
      const v = await gate({ baseBranches: null, issueComments: [] });
      expect(v).toMatchObject({ reviewed: false, autoReviewedBase: null });
    });
  });

  it('refuses when the head commit carries no date', async () => {
    /*
     * Fails closed. Treating an absent timestamp as "not stale" would make every unknown a
     * quiet approval — the failure the whole gate exists to answer, reintroduced by its own
     * freshness check.
     */
    const v = await gate({ headAt: null });
    expect(v).toMatchObject({ headAt: null, stale: true, ok: false });
  });
});
