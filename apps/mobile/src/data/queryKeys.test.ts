import { describe, expect, it } from '@jest/globals';
import { gossipPostId, sessionId, tenantId, userId } from '@occasio/core';
import { queryKeys } from './queryKeys';

/**
 * Keys are compared by structure, so the properties worth testing are structural.
 *
 * Two matter more than the rest. Every key must start with its tenant, or the cache serves one
 * event's data to another after passing every authorisation check on the way in. And
 * `entity.all(t)` must be a genuine prefix of every key for that entity, because invalidation
 * after a mutation relies on it — a prefix that is nearly right leaves a stale list on screen
 * with nothing in the code looking wrong.
 */

const WEDDING = tenantId('t_sanit-riyanks');
const FESTIVAL = tenantId('t_anandhara');
const PUBLISHED = { statuses: ['published'], track: null } as const;
const TASKS = { statuses: ['todo'], visibilities: ['public'], assigneeUserId: null } as const;

/** True when `prefix` is the leading segments of `key`, compared structurally. */
const isPrefixOf = (prefix: readonly unknown[], key: readonly unknown[]): boolean =>
  prefix.length <= key.length &&
  prefix.every((segment, i) => JSON.stringify(segment) === JSON.stringify(key[i]));

describe('every key', () => {
  const forWedding = [
    queryKeys.sessions.list(WEDDING, PUBLISHED),
    queryKeys.sessions.byId(WEDDING, sessionId('s_1')),
    queryKeys.venues.list(WEDDING),
    queryKeys.gossip.list(WEDDING, { statuses: ['approved'] }),
    queryKeys.gossip.byId(WEDDING, gossipPostId('g_1')),
    queryKeys.tasks.list(WEDDING, TASKS),
    queryKeys.announcements.list(WEDDING, { publishedOnly: true }),
    queryKeys.memberships.forUser(WEDDING, userId('u_1')),
    queryKeys.people.list(WEDDING),
  ];

  it('starts with its tenant', () => {
    /* The cache's half of the rule the adapter enforces on every read. Two events are open in
       one app across a session, and a key without the tenant serves one to the other. */
    for (const key of forWedding) {
      expect(isPrefixOf(queryKeys.tenant(WEDDING), key)).toBe(true);
    }
  });

  it('differs between two events asking the same question', () => {
    /* The failure the rule above prevents, asserted directly rather than implied. */
    expect(queryKeys.sessions.list(WEDDING, PUBLISHED)).not.toEqual(
      queryKeys.sessions.list(FESTIVAL, PUBLISHED),
    );
  });

  it('is the same key for the same question', () => {
    /* Two structurally equal keys must hash the same, or every call is a cache miss and the
       cache is an expensive way to fetch everything twice. */
    expect(queryKeys.sessions.list(WEDDING, { statuses: ['published'], track: null })).toEqual(
      queryKeys.sessions.list(WEDDING, { statuses: ['published'], track: null }),
    );
  });

  it('separates a filtered list from an unfiltered one', () => {
    /* A key that ignored the query would let the attendee schedule and the admin editor share
       one cache entry -- and the attendee would see unpublished sessions. */
    expect(queryKeys.sessions.list(WEDDING, PUBLISHED)).not.toEqual(
      queryKeys.sessions.list(WEDDING, { statuses: ['draft', 'published'], track: null }),
    );
  });

  it('separates one page of a list from another', () => {
    expect(queryKeys.venues.list(WEDDING, { limit: 10 })).not.toEqual(
      queryKeys.venues.list(WEDDING, { limit: 20 }),
    );
  });

  it('treats an omitted page and an empty one as the same request', () => {
    /* `list(t)` and `list(t, {})` ask for exactly the same thing — the first page with the
       repository's defaults — so two cache entries for it means two fetches, which reads as the
       app being slow rather than as a key bug. The previous version of this test asserted they
       differ, which enshrined the defect as the contract. */
    expect(queryKeys.venues.list(WEDDING)).toEqual(queryKeys.venues.list(WEDDING, {}));
    expect(queryKeys.venues.list(WEDDING, { limit: undefined })).toEqual(
      queryKeys.venues.list(WEDDING),
    );
    /* But a real page request is still its own key. */
    expect(queryKeys.venues.list(WEDDING, { limit: 10 })).not.toEqual(
      queryKeys.venues.list(WEDDING),
    );
  });
});

describe('invalidation prefixes', () => {
  it('covers every key for that entity', () => {
    /* What a mutation relies on: one `invalidateQueries` after a write clears the list, the
       detail and every filtered variant -- including ones a screen adds later that nobody
       remembers to enumerate. */
    const sessionKeys = [
      queryKeys.sessions.list(WEDDING, PUBLISHED),
      queryKeys.sessions.byId(WEDDING, sessionId('s_1')),
      queryKeys.sessions.people(WEDDING, sessionId('s_1')),
    ];

    for (const key of sessionKeys) {
      expect(isPrefixOf(queryKeys.sessions.all(WEDDING), key)).toBe(true);
    }
  });

  it('does not reach another entity', () => {
    /* An over-broad prefix refetches the whole screen on every write, which reads as the app
       being slow rather than as a cache bug. */
    expect(isPrefixOf(queryKeys.sessions.all(WEDDING), queryKeys.venues.list(WEDDING))).toBe(false);
    expect(isPrefixOf(queryKeys.gossip.all(WEDDING), queryKeys.tasks.list(WEDDING, TASKS))).toBe(
      false,
    );
  });

  it('does not reach another tenant', () => {
    /* Invalidating a wedding must not refetch a conference that happens to be open. */
    expect(
      isPrefixOf(queryKeys.sessions.all(WEDDING), queryKeys.sessions.list(FESTIVAL, PUBLISHED)),
    ).toBe(false);
  });

  it('leaves the directory unscoped, because it is how a tenant is found', () => {
    /*
     * The one documented exception, and it mirrors the repository layer: `TenantDirectory` is
     * the single cross-tenant surface — `bySlug` resolves `/e/[slug]` for someone who has no
     * tenant yet, and `forUser` answers "which events am I in". Prefixing either with a tenant
     * would mean inventing one to look up the thing that produces it.
     */
    expect(queryKeys.directory.bySlug('sanit-riyanks')[0]).not.toBe('tenant');
    expect(queryKeys.directory.forUser(userId('u_1'))[0]).not.toBe('tenant');
    /* And they are still distinct from one another, and from a different subject. */
    expect(queryKeys.directory.bySlug('a')).not.toEqual(queryKeys.directory.bySlug('b'));
  });

  it('lets the tenant prefix clear the whole event', () => {
    /* Signing out of an event, or switching to another, has to leave nothing of it behind. */
    expect(isPrefixOf(queryKeys.tenant(WEDDING), queryKeys.gossip.all(WEDDING))).toBe(true);
    expect(isPrefixOf(queryKeys.tenant(WEDDING), queryKeys.tenant(FESTIVAL))).toBe(false);
  });
});
