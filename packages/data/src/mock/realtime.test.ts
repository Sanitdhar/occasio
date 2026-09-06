import { afterAll, describe, expect, it, jest } from '@jest/globals';
import { tenantId, userId, type UserId } from '@occasio/core';
import { FIXTURE_SEED } from '../fixtures/index';
import type { GossipChange } from '../repositories';
import { createMockAdapter, type MockAdapter } from './adapter';
import { createMemoryStorage } from './storage';

/**
 * The realtime half of the gossip board (#36).
 *
 * The demo it exists for is one screen: a post arrives in the queue, a moderator approves it,
 * and it appears on the board with nobody refreshing anything. Everything below is a way that
 * stops being true without anyone noticing — a listener that never fires, one that fires after
 * its screen is gone, or one that hears about an event it is not watching.
 *
 * **Scope, stated because it shaped these tests.** The listener registry belongs to an adapter
 * instance, and an instance is one signed-in client. Two people seeing each other's posts live
 * is Supabase's realtime channel, not this — so nothing here uses two adapters to simulate two
 * users. A first draft did, and every cross-user assertion passed for the wrong reason: the two
 * instances never shared a listener, so "no delivery" was structurally guaranteed rather than
 * enforced. They are written against one client watching what that client changes.
 */

const WEDDING = tenantId('t_sanit-riyanks');
const FESTIVAL = tenantId('t_anandhara');
/** Moderates both events, which is what makes the tenant filter observable at all. */
const MODERATOR = userId('u_meera');

const adapterFor = (as: UserId): MockAdapter =>
  createMockAdapter({
    currentUserId: as,
    seed: FIXTURE_SEED,
    storage: createMemoryStorage(),
    latency: { minMs: 0, maxMs: 0 },
  });

const ALL = ['pending', 'approved', 'rejected', 'hidden'] as const;

describe('gossip subscriptions', () => {
  /* One case below deliberately throws inside a listener, and the adapter reports that on
     `console.warn`. Silenced so the expected noise does not read as a failing run. */
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);

  afterAll(() => {
    warn.mockRestore();
  });

  it('delivers a post the moment it is created', async () => {
    const adapter = adapterFor(MODERATOR);
    const seen: GossipChange[] = [];

    const stop = await adapter.gossip.subscribe(WEDDING, { statuses: ['pending'] }, (change) => {
      seen.push(change);
    });
    await adapter.gossip.create(WEDDING, { body: 'Something worth moderating', mediaId: null });
    stop();

    expect(seen).toHaveLength(1);
    expect(seen[0]?.kind).toBe('created');
  });

  it('delivers the approval that puts a post on the board', async () => {
    /* The moment the feature is for. `updated` rather than `created`, because the post existed
       and its status changed — a board receiving `updated` for something it does not hold can
       insert it, which is not true the other way round. */
    const adapter = adapterFor(MODERATOR);
    const post = await adapter.gossip.create(WEDDING, { body: 'Approve me', mediaId: null });
    const seen: GossipChange[] = [];

    const stop = await adapter.gossip.subscribe(WEDDING, { statuses: ['approved'] }, (change) => {
      seen.push(change);
    });
    await adapter.gossip.moderate(WEDDING, post.id, { status: 'approved' });
    stop();

    expect(seen).toHaveLength(1);
    expect(seen[0]?.kind).toBe('updated');
  });

  it('delivers an auto-hide, which no one pressed a button for', async () => {
    /* D31 — enough reports hide a post without a moderator. A board that only listened for
       moderation decisions would keep showing it. */
    const adapter = adapterFor(MODERATOR);
    const post = await adapter.gossip.create(WEDDING, { body: 'Reported', mediaId: null });
    await adapter.gossip.moderate(WEDDING, post.id, { status: 'approved' });

    const seen: GossipChange[] = [];
    const stop = await adapter.gossip.subscribe(WEDDING, { statuses: ALL }, (change) => {
      seen.push(change);
    });
    for (let i = 0; i < 3; i += 1) await adapter.gossip.report(WEDDING, post.id);
    stop();

    /* Asserting the outcome, not merely that something was emitted: every report emits an
       update, so a threshold that never fired would still have satisfied a `kind` check while
       the post stayed on the board. */
    const last = seen.at(-1);
    expect(last?.kind).toBe('updated');
    expect(last !== undefined && last.kind !== 'deleted' ? last.item.status : null).toBe('hidden');
  });

  it('tells the queue when a post it is watching has been dealt with', async () => {
    /*
     * The moderation queue watches `pending`. Approving a post gives it `approved`, so a filter
     * that looked only at the new status would tell the queue nothing — and the queue would go
     * on showing a post somebody had already handled, which is the demo this feature exists for,
     * broken.
     *
     * It arrives as `deleted`: the post still exists, it is simply no longer this view's to
     * show, and `deleted` is the vocabulary a list has for dropping a row.
     */
    const adapter = adapterFor(MODERATOR);
    const post = await adapter.gossip.create(WEDDING, { body: 'In the queue', mediaId: null });
    const seen: GossipChange[] = [];

    const stop = await adapter.gossip.subscribe(WEDDING, { statuses: ['pending'] }, (change) => {
      seen.push(change);
    });
    await adapter.gossip.moderate(WEDDING, post.id, { status: 'approved' });
    stop();

    expect(seen).toHaveLength(1);
    expect(seen[0]?.kind).toBe('deleted');
  });

  it('tells the board when an approved post is hidden', async () => {
    /* The same transition in the other direction, and the one with a consequence: a board that
       kept showing a hidden post is showing something a moderator removed. */
    const adapter = adapterFor(MODERATOR);
    const post = await adapter.gossip.create(WEDDING, { body: 'On the board', mediaId: null });
    await adapter.gossip.moderate(WEDDING, post.id, { status: 'approved' });
    const seen: GossipChange[] = [];

    const stop = await adapter.gossip.subscribe(WEDDING, { statuses: ['approved'] }, (change) => {
      seen.push(change);
    });
    await adapter.gossip.moderate(WEDDING, post.id, { status: 'hidden', reason: 'Reported' });
    stop();

    expect(seen).toHaveLength(1);
    expect(seen[0]?.kind).toBe('deleted');
  });

  it('stops delivering the moment it is unsubscribed', async () => {
    /* A listener that outlives its screen updates a component that is no longer mounted, and
       React reports that far from the cause. */
    const adapter = adapterFor(MODERATOR);
    const seen: GossipChange[] = [];

    const stop = await adapter.gossip.subscribe(WEDDING, { statuses: ALL }, (change) => {
      seen.push(change);
    });
    await adapter.gossip.create(WEDDING, { body: 'Before', mediaId: null });
    const delivered = seen.length;

    stop();
    await adapter.gossip.create(WEDDING, { body: 'After', mediaId: null });

    expect(delivered).toBeGreaterThan(0);
    expect(seen).toHaveLength(delivered);
  });

  it('tolerates being unsubscribed twice', async () => {
    /* React effects do this on a fast unmount, and a second call that threw would surface as an
       error inside a cleanup function — about as far from its cause as it gets. */
    const adapter = adapterFor(MODERATOR);
    const stop = await adapter.gossip.subscribe(WEDDING, { statuses: ALL }, () => undefined);

    expect(() => {
      stop();
      stop();
    }).not.toThrow();
  });

  it('keeps one subscription when the same callback is used for two', async () => {
    /* Removing by callback rather than by registration would take both, so a screen watching
       two events would go quiet on one when it stopped watching the other. */
    const adapter = adapterFor(MODERATOR);
    const seen: GossipChange[] = [];
    const listener = (change: GossipChange): void => {
      seen.push(change);
    };

    const first = await adapter.gossip.subscribe(WEDDING, { statuses: ALL }, listener);
    const second = await adapter.gossip.subscribe(WEDDING, { statuses: ALL }, listener);
    first();
    await adapter.gossip.create(WEDDING, { body: 'Still watching', mediaId: null });
    second();

    expect(seen).toHaveLength(1);
  });

  it('never delivers one event to a listener watching another', async () => {
    /*
     * The scope check, and the reason a fixture moderator works two events. With one membership
     * each this would pass whether or not the filter existed — there would be nothing of the
     * other event's to reach. And a moderator rather than an attendee, because an attendee sees
     * only `approved` posts, so the moderation filter would have answered before the tenant
     * filter was consulted.
     */
    const adapter = adapterFor(MODERATOR);
    const seen: GossipChange[] = [];

    const stop = await adapter.gossip.subscribe(WEDDING, { statuses: ALL }, (change) => {
      seen.push(change);
    });
    await adapter.gossip.create(FESTIVAL, { body: 'A festival post', mediaId: null });
    stop();

    expect(seen).toEqual([]);
  });

  it('delivers both events to a listener on each', async () => {
    /* The other half of the same fact: scoping must not be silence. One client, two events, two
       subscriptions, and each hears exactly its own. */
    const adapter = adapterFor(MODERATOR);
    const wedding: GossipChange[] = [];
    const festival: GossipChange[] = [];

    const stopWedding = await adapter.gossip.subscribe(WEDDING, { statuses: ALL }, (c) => {
      wedding.push(c);
    });
    const stopFestival = await adapter.gossip.subscribe(FESTIVAL, { statuses: ALL }, (c) => {
      festival.push(c);
    });

    await adapter.gossip.create(WEDDING, { body: 'Wedding post', mediaId: null });
    await adapter.gossip.create(FESTIVAL, { body: 'Festival post', mediaId: null });
    stopWedding();
    stopFestival();

    expect(wedding).toHaveLength(1);
    expect(festival).toHaveLength(1);
  });

  it('does not let a broken subscriber break the write', async () => {
    /*
     * The write is already persisted when listeners run, so an exception escaping would reject
     * `create` for a post that exists -- and a caller retrying a rejected create writes it
     * twice. One screen's rendering bug would become duplicated data, blamed on the adapter.
     */
    const adapter = adapterFor(MODERATOR);
    const reached: string[] = [];

    const stopBroken = await adapter.gossip.subscribe(WEDDING, { statuses: ALL }, () => {
      throw new Error('this subscriber is broken');
    });
    const stopWorking = await adapter.gossip.subscribe(WEDDING, { statuses: ALL }, () => {
      reached.push('delivered');
    });

    await expect(
      adapter.gossip.create(WEDDING, { body: 'Written regardless', mediaId: null }),
    ).resolves.toBeDefined();
    stopBroken();
    stopWorking();

    /* And the one after it still heard: a single broken subscriber must not freeze everyone
       else's board. */
    expect(reached).toEqual(['delivered']);
    const stored = await adapter.gossip.list(WEDDING, { statuses: ['pending'] }, { limit: 50 });
    expect(stored.items.filter((p) => p.body === 'Written regardless')).toHaveLength(1);
  });

  it('filters by the statuses the listener asked for', async () => {
    /* A board watching `approved` should not be woken by every post entering the queue. */
    const adapter = adapterFor(MODERATOR);
    const seen: GossipChange[] = [];

    const stop = await adapter.gossip.subscribe(WEDDING, { statuses: ['approved'] }, (change) => {
      seen.push(change);
    });
    await adapter.gossip.create(WEDDING, { body: 'Pending, not approved', mediaId: null });
    stop();

    expect(seen).toEqual([]);
  });
});
