import type { GossipPostId, SessionId, TenantId, UserId, VenueId } from '@occasio/core';
import type {
  AnnouncementQuery,
  GossipQuery,
  MembershipQuery,
  SessionQuery,
  TaskQuery,
} from '@occasio/data';
import type { PageRequest } from '@occasio/data';

/**
 * Every cache key in the app, in one place.
 *
 * Ad-hoc key arrays are the reason cache bugs are hard: a mutation invalidates
 * `['sessions', tenantId]` while a list was stored under `['sessions', tenantId, query]`, and
 * the screen shows stale data with nothing in the code looking wrong. Writing them once removes
 * the class rather than the instance.
 *
 * **Every key starts with the tenant, except the directory's.** That is not tidiness — it is
 * the cache's half of the rule the adapter enforces on every read. Two events are open in one
 * app across a session, and a key that omitted the tenant would serve a wedding's schedule to a
 * conference from cache, having passed every authorisation check on the way in.
 *
 * `directory` is the exception because it is the exception in the repository layer too:
 * `TenantDirectory` is the one cross-tenant surface, the way a caller *obtains* a `TenantId` in
 * the first place. `bySlug` resolves `/e/[slug]` for someone who has no tenant yet, and
 * `forUser` answers "which events am I in", which is cross-tenant by definition. Prefixing
 * either with a tenant would mean inventing one to look up the thing that produces it.
 *
 * The shape is hierarchical so that invalidation can be, too: `sessions.all(t)` is a prefix of
 * every session key for that tenant, so one call after a mutation clears the list, the detail
 * and every filtered variant — including the ones a screen added later that nobody remembered
 * to list.
 */

/** Everything cached for one event. Invalidating this is what a tenant switch does. */
const tenant = (tenantId: TenantId) => ['tenant', tenantId] as const;

/**
 * A query object as a key segment.
 *
 * Passed through rather than serialised: TanStack Query hashes keys structurally, so two equal
 * objects are the same key regardless of identity — and a hand-rolled `JSON.stringify` would
 * make key equality depend on property order, which is a cache miss nobody can see.
 */

/**
 * A page request, canonicalised.
 *
 * `list(t)` and `list(t, {})` ask for exactly the same thing — the first page with the
 * repository's defaults — so they have to produce the same key. Storing `null` for one and `{}`
 * for the other gave one result two cache entries and two fetches, which reads as the app being
 * slow rather than as a key bug. An empty object is the same request as no object.
 */
const page = (request?: PageRequest): PageRequest | null => {
  if (request === undefined) return null;
  const { limit, cursor } = request;
  return limit === undefined && cursor === undefined ? null : request;
};
export const queryKeys = {
  tenant,

  directory: {
    bySlug: (slug: string) => ['directory', 'bySlug', slug] as const,
    forUser: (userId: UserId) => ['directory', 'forUser', userId] as const,
  },

  sessions: {
    all: (t: TenantId) => [...tenant(t), 'sessions'] as const,
    list: (t: TenantId, query: SessionQuery, request?: PageRequest) =>
      [...tenant(t), 'sessions', 'list', query, page(request)] as const,
    byId: (t: TenantId, id: SessionId) => [...tenant(t), 'sessions', 'byId', id] as const,
    people: (t: TenantId, id: SessionId) => [...tenant(t), 'sessions', 'people', id] as const,
  },

  venues: {
    all: (t: TenantId) => [...tenant(t), 'venues'] as const,
    list: (t: TenantId, request?: PageRequest) =>
      [...tenant(t), 'venues', 'list', page(request)] as const,
    byId: (t: TenantId, id: VenueId) => [...tenant(t), 'venues', 'byId', id] as const,
  },

  gossip: {
    all: (t: TenantId) => [...tenant(t), 'gossip'] as const,
    list: (t: TenantId, query: GossipQuery, request?: PageRequest) =>
      [...tenant(t), 'gossip', 'list', query, page(request)] as const,
    byId: (t: TenantId, id: GossipPostId) => [...tenant(t), 'gossip', 'byId', id] as const,
  },

  tasks: {
    all: (t: TenantId) => [...tenant(t), 'tasks'] as const,
    list: (t: TenantId, query: TaskQuery, request?: PageRequest) =>
      [...tenant(t), 'tasks', 'list', query, page(request)] as const,
  },

  announcements: {
    all: (t: TenantId) => [...tenant(t), 'announcements'] as const,
    list: (t: TenantId, query: AnnouncementQuery, request?: PageRequest) =>
      [...tenant(t), 'announcements', 'list', query, page(request)] as const,
  },

  memberships: {
    all: (t: TenantId) => [...tenant(t), 'memberships'] as const,
    list: (t: TenantId, query: MembershipQuery, request?: PageRequest) =>
      [...tenant(t), 'memberships', 'list', query, page(request)] as const,
    forUser: (t: TenantId, userId: UserId) =>
      [...tenant(t), 'memberships', 'forUser', userId] as const,
  },

  people: {
    all: (t: TenantId) => [...tenant(t), 'people'] as const,
    list: (t: TenantId, request?: PageRequest) =>
      [...tenant(t), 'people', 'list', page(request)] as const,
  },
} as const;
