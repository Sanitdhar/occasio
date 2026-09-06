import { afterAll, describe, expect, it, jest } from '@jest/globals';
import { sessionId, tenantId, userId, type UserId } from '@occasio/core';
import { FIXTURE_SEED } from './fixtures/index';
import { isForbiddenError, isNotFoundError, isValidationError } from './errors';
import { createMockAdapter } from './mock/adapter';
import { createMemoryStorage } from './mock/storage';
import { MAX_PAGE_SIZE, type Cursor } from './pagination';
import type { DataAdapter } from './repositories';

/**
 * One suite, every adapter. This is the mock-to-Supabase swap guarantee (D29) made checkable.
 *
 * The value is entirely in the second implementation. Today only the mock runs, and a suite with
 * one subject proves little beyond that the mock does what the mock does — but writing it now,
 * against the interface rather than the implementation, is what makes the Supabase adapter's
 * arrival a matter of adding four lines to `SUBJECTS` and finding out. Written afterwards it
 * would be written to describe whatever the two happened to have in common.
 *
 * So nothing below reaches for a mock-specific API, and nothing asserts a value that is a
 * property of the fixture rather than of the contract: no counting rows, no naming a title. What
 * is asserted is behaviour a screen depends on and a reimplementation could plausibly get wrong.
 *
 * Until then it is also worth saying what this job was: the `contracts` project has existed
 * since the repo was scaffolded and ran zero tests, passing on `passWithNoTests`. A green gate
 * checking nothing is the failure this codebase keeps finding, and it had one of its own.
 */

const WEDDING = tenantId('t_sanit-riyanks');
const FESTIVAL = tenantId('t_anandhara');
const WEDDING_ADMIN = userId('u_sanit');
const WEDDING_GUEST = userId('u_nisha');
/** In the festival, and nowhere near the wedding. */
const OUTSIDER = userId('u_lena');

type Subject = {
  readonly name: string;
  /** Every adapter is constructed per test, so no case can depend on another's writes. */
  readonly create: (as: UserId) => Promise<DataAdapter>;
};

const SUBJECTS: readonly Subject[] = [
  {
    name: 'mock',
    create: (as) =>
      Promise.resolve(
        createMockAdapter({
          currentUserId: as,
          seed: FIXTURE_SEED,
          storage: createMemoryStorage(),
          /* The latency is real behaviour and is exercised by its own tests; here it would only
             make the suite slow. */
          latency: { minMs: 0, maxMs: 0 },
        }),
      ),
  },
  /*
   * The Supabase adapter joins this list when it exists (#39). It is deliberately not stubbed
   * out with a skip: a pending subject that never runs looks like coverage and is not.
   */
];

/**
 * Asserts a call fails, and fails with the error the contract names.
 *
 * Written out rather than `.rejects.toThrow(SomeError)`, because the type guards are the public
 * way to recognise these errors — a second adapter will construct its own instances, and an
 * `instanceof` against this package's classes would pass for the mock and fail for Supabase
 * while both behaved correctly.
 *
 * The `resolved` branch matters: without it a method that quietly succeeded would leave the
 * `catch` unreached and the test green, which is the shape of failure this repo keeps finding.
 */
const rejectsWith = async (
  call: Promise<unknown>,
  recognise: (error: unknown) => boolean,
  expected: string,
): Promise<void> => {
  try {
    await call;
  } catch (error) {
    expect({ expected, matched: recognise(error) }).toEqual({ expected, matched: true });
    return;
  }
  throw new Error(`expected ${expected}, but the call resolved`);
};

const ANY_STATUS = {
  statuses: ['pending', 'approved', 'rejected', 'hidden'],
} as const;

const EVERY_SESSION = { statuses: ['draft', 'published', 'cancelled'], track: null } as const;
const PUBLISHED = { statuses: ['published'], track: null } as const;

describe.each(SUBJECTS)('$name adapter', ({ create }: Subject) => {
  /* One case deliberately throws inside a listener, which an adapter is expected to report
     rather than swallow. Silenced so the expected noise does not read as a failing run. */
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);

  afterAll(() => {
    warn.mockRestore();
  });

  describe('pagination', () => {
    it('walks a collection once, in order, with no repeats and no gaps', async () => {
      /* Keyset pagination exists so a page boundary is stable while rows are inserted. Both of
         its failures -- a repeated row and a skipped one -- are invisible in a single page. */
      const adapter = await create(WEDDING_ADMIN);
      const all = await adapter.sessions.list(WEDDING, EVERY_SESSION, { limit: 100 });

      const seen: string[] = [];
      let cursor: Cursor | null = null;
      for (let guard = 0; guard <= all.items.length + 1; guard += 1) {
        const page: { items: readonly { readonly id: string }[]; nextCursor: Cursor | null } =
          await adapter.sessions.list(
            WEDDING,
            EVERY_SESSION,
            cursor === null ? { limit: 2 } : { limit: 2, cursor },
          );
        seen.push(...page.items.map((s) => s.id));
        if (page.nextCursor === null) break;
        cursor = page.nextCursor;
      }

      expect(seen).toEqual(all.items.map((s) => s.id));
      expect(new Set(seen).size).toBe(seen.length);
    });

    it('reports the end of a collection rather than an empty last page', async () => {
      /* A `nextCursor` on an exactly-full final page costs every caller one wasted round trip,
         and on a slow connection that is a visible spinner at the bottom of every list. */
      const adapter = await create(WEDDING_ADMIN);
      const all = await adapter.sessions.list(WEDDING, EVERY_SESSION, { limit: 100 });
      const exact = await adapter.sessions.list(WEDDING, EVERY_SESSION, {
        limit: all.items.length,
      });

      expect(exact.items).toHaveLength(all.items.length);
      expect(exact.nextCursor).toBeNull();
    });

    it('refuses a limit that cannot be meant, and clamps one that can', async () => {
      const adapter = await create(WEDDING_ADMIN);

      await rejectsWith(
        adapter.sessions.list(WEDDING, EVERY_SESSION, { limit: 0 }),
        isValidationError,
        'ValidationError for limit 0',
      );
      /* Over-asking is a caller who will read `items.length`, so it is answered rather than
         rejected -- the opposite decision from zero, and both are part of the contract. */
      const huge = await adapter.sessions.list(WEDDING, EVERY_SESSION, { limit: 10_000 });
      expect(huge.items.length).toBeGreaterThan(0);
      expect(huge.items.length).toBeLessThanOrEqual(MAX_PAGE_SIZE);
    });

    it('clamps to the maximum page rather than returning everything', async () => {
      /*
       * The fixture has five sessions, so the case above cannot tell clamping from obedience --
       * both return five. This one writes past the cap first, which is the only way the
       * boundary is observable at all.
       *
       * Gossip rather than sessions because it is the collection an adapter can be asked to
       * grow through its own interface, which keeps this from reaching for the mock's seed.
       */
      const adapter = await create(WEDDING_ADMIN);
      const wanted = MAX_PAGE_SIZE + 1;
      const existing = await adapter.gossip.list(WEDDING, ANY_STATUS, { limit: MAX_PAGE_SIZE });
      /* Concurrently, because a remote subject would otherwise spend two hundred serial round
         trips inside one case. The assertion is about the resulting page size, not about the
         order rows were written in, so nothing here depends on them being sequential. */
      await Promise.all(
        Array.from({ length: wanted - existing.items.length }, (_, i) =>
          adapter.gossip.create(WEDDING, { body: `Filler ${String(i)}`, mediaId: null }),
        ),
      );

      const huge = await adapter.gossip.list(WEDDING, ANY_STATUS, { limit: 10_000 });

      expect(huge.items).toHaveLength(MAX_PAGE_SIZE);
      /* And it says there is more, rather than pretending the clamp was the end. */
      expect(huge.nextCursor).not.toBeNull();
    });

    it('rejects a cursor it did not issue instead of returning a wrong page', async () => {
      /* The case that matters after the swap: a cursor held across a deploy. Decoding it as if
         it were ours returns a plausible wrong page, which nobody reports as a bug. */
      const adapter = await create(WEDDING_ADMIN);

      await rejectsWith(
        adapter.sessions.list(WEDDING, EVERY_SESSION, { cursor: 'eyJvZmZzZXQiOjUwfQ==' }),
        isValidationError,
        'ValidationError for a foreign cursor',
      );
    });
  });

  describe('not found', () => {
    it('raises NotFound for an id that does not exist', async () => {
      const adapter = await create(WEDDING_ADMIN);

      await rejectsWith(
        adapter.sessions.byId(WEDDING, sessionId('s_nope')),
        isNotFoundError,
        'NotFoundError for an unknown id',
      );
    });

    it('raises NotFound for an id that exists in another tenant', async () => {
      /*
       * The single most important line in this file. A row that exists but belongs elsewhere
       * must be indistinguishable from one that does not exist -- otherwise the error itself
       * confirms that a given id is real in some other event, and the answer leaks across the
       * boundary the whole architecture is built on.
       */
      const adapter = await create(WEDDING_ADMIN);
      const festival = await create(OUTSIDER);
      const theirs = (await festival.sessions.list(FESTIVAL, PUBLISHED, { limit: 1 })).items[0];

      expect(theirs).toBeDefined();
      if (theirs === undefined) return;
      await rejectsWith(
        adapter.sessions.byId(WEDDING, theirs.id),
        isNotFoundError,
        "NotFoundError for another tenant's id",
      );
    });
  });

  describe('forbidden', () => {
    it('refuses a tenant the caller has no membership in', async () => {
      const adapter = await create(OUTSIDER);

      await rejectsWith(
        adapter.sessions.list(WEDDING, PUBLISHED),
        isForbiddenError,
        'ForbiddenError for a tenant with no membership',
      );
    });

    it('refuses an operation the caller holds no role for', async () => {
      /* Membership is not permission. A guest can read the board and cannot moderate it, and
         the difference has to survive the swap or every admin action becomes a guest action. */
      const guest = await create(WEDDING_GUEST);
      const posts = await guest.gossip.list(WEDDING, { statuses: ['approved'] }, { limit: 1 });
      const post = posts.items[0];

      expect(post).toBeDefined();
      if (post === undefined) return;
      await rejectsWith(
        guest.gossip.moderate(WEDDING, post.id, { status: 'hidden', reason: 'no' }),
        isForbiddenError,
        'ForbiddenError for moderating without the role',
      );
    });

    it('refuses an outsider a subscription at all', async () => {
      /*
       * The only thing standing between a non-member and a live feed of an event's posts is the
       * membership check inside `subscribe`. Nothing else covered it: every other case in this
       * suite and in the mock's own tests holds a membership, so removing that check left them
       * all green while an outsider could open a channel and watch.
       */
      const outsider = await create(OUTSIDER);

      await rejectsWith(
        outsider.gossip.subscribe(WEDDING, ANY_STATUS, () => undefined),
        isForbiddenError,
        'ForbiddenError for subscribing to an event the caller is not in',
      );
    });

    it('answers "are you in this event" without raising', async () => {
      /* `findForUser` is what the join screen asks before it knows, so it must answer `null`
         rather than Forbidden -- the one method whose whole purpose is detecting non-membership
         would otherwise fail for every non-member. */
      const outsider = await create(OUTSIDER);

      await expect(outsider.memberships.findForUser(WEDDING, OUTSIDER)).resolves.toBeNull();
    });
  });

  describe('subscriptions', () => {
    it('delivers a change to a listener, and stops when it unsubscribes', async () => {
      /*
       * One adapter, not two. An instance is one signed-in client, and two people seeing each
       * other's posts is the backend's realtime channel rather than the adapter's contract —
       * a suite that used two instances to play two users would be asserting something no
       * implementation promises, and would pass on the mock for the wrong reason.
       */
      const adapter = await create(WEDDING_ADMIN);
      const seen: string[] = [];

      const stop = await adapter.gossip.subscribe(
        WEDDING,
        { statuses: ['pending', 'approved'] },
        (change) => {
          seen.push(change.kind);
        },
      );

      await adapter.gossip.create(WEDDING, {
        body: 'A post from the contract suite',
        mediaId: null,
      });
      expect(seen).toHaveLength(1);

      /* The half that leaks: a listener still firing after its screen has gone updates a
         component that is no longer mounted, and React reports that far from the cause. */
      stop();
      await adapter.gossip.create(WEDDING, { body: 'After unsubscribing', mediaId: null });

      expect(seen).toHaveLength(1);
    });

    it('tells a listener when a post leaves the view it is watching', async () => {
      /*
       * The moderation queue watches `pending`, and an approved post is no longer pending. An
       * adapter that filtered only on the new status would leave the queue showing a post
       * somebody had already dealt with -- which is the feature, not an edge case.
       */
      const adapter = await create(WEDDING_ADMIN);
      const post = await adapter.gossip.create(WEDDING, { body: 'In the queue', mediaId: null });
      const seen: string[] = [];

      const stop = await adapter.gossip.subscribe(WEDDING, { statuses: ['pending'] }, (change) => {
        seen.push(change.kind);
      });
      await adapter.gossip.moderate(WEDDING, post.id, { status: 'approved' });
      stop();

      expect(seen).toEqual(['deleted']);
    });

    it('survives a listener that throws, without failing the write or the others', async () => {
      /*
       * Three separate promises, and the previous version of this case asserted one of them.
       * Listeners run after the write is persisted, so an escaping exception rejects a call
       * whose row exists -- and a caller retrying a rejected create writes it twice. It also
       * stops delivery to every listener after the broken one, freezing everybody else's board.
       *
       * `resolves` alone catches neither: an adapter that discarded the row would pass it, and
       * so would one that stopped at the first throw.
       */
      const adapter = await create(WEDDING_ADMIN);
      const reached: string[] = [];

      const stopBroken = await adapter.gossip.subscribe(WEDDING, ANY_STATUS, () => {
        throw new Error('a broken subscriber');
      });
      const stopWorking = await adapter.gossip.subscribe(WEDDING, ANY_STATUS, () => {
        reached.push('delivered');
      });

      const body = 'Written regardless of a broken subscriber';
      await expect(adapter.gossip.create(WEDDING, { body, mediaId: null })).resolves.toBeDefined();
      stopBroken();
      stopWorking();

      expect(reached).toEqual(['delivered']);
      const stored = await adapter.gossip.list(WEDDING, ANY_STATUS, { limit: MAX_PAGE_SIZE });
      expect(stored.items.filter((post) => post.body === body)).toHaveLength(1);
    });
  });
});
