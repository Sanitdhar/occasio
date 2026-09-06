import type {
  AnnouncementQuery,
  GossipModeration,
  GossipQuery,
  NewGossipPost,
  PageRequest,
  SessionQuery,
} from '@occasio/data';
import type { GossipPostId, TenantId } from '@occasio/core';
import { useMutation, useQuery, useQueryClient, type UseQueryResult } from '@tanstack/react-query';
import type { Page, Session, Venue, GossipPost, Announcement } from '@occasio/data';
import { useAdapter } from './AdapterProvider';
import { queryKeys } from './queryKeys';

/**
 * The hooks screens use, and the only place a `queryFn` exists.
 *
 * The point of the arrangement is the swap: when the Supabase adapter lands, the bodies below
 * do not change at all — they call `adapter.sessions.list`, and which adapter that is comes
 * from the provider. Caching, invalidation and error shape stay put, so no component moves.
 *
 * Every hook takes its `tenantId` explicitly rather than reading it from a context. It is the
 * first argument of every repository method for the same reason: an event is a parameter, not
 * an ambient fact, and the moment it becomes ambient is the moment two open events start
 * borrowing each other's data.
 */

export const useSessions = (
  tenantId: TenantId,
  query: SessionQuery,
  page?: PageRequest,
): UseQueryResult<Page<Session>> => {
  const adapter = useAdapter();
  return useQuery({
    queryKey: queryKeys.sessions.list(tenantId, query, page),
    queryFn: () => adapter.sessions.list(tenantId, query, page),
  });
};

export const useVenues = (tenantId: TenantId, page?: PageRequest): UseQueryResult<Page<Venue>> => {
  const adapter = useAdapter();
  return useQuery({
    queryKey: queryKeys.venues.list(tenantId, page),
    queryFn: () => adapter.venues.list(tenantId, page),
  });
};

export const useAnnouncements = (
  tenantId: TenantId,
  query: AnnouncementQuery,
  page?: PageRequest,
): UseQueryResult<Page<Announcement>> => {
  const adapter = useAdapter();
  return useQuery({
    queryKey: queryKeys.announcements.list(tenantId, query, page),
    queryFn: () => adapter.announcements.list(tenantId, query, page),
  });
};

export const useGossip = (
  tenantId: TenantId,
  query: GossipQuery,
  page?: PageRequest,
): UseQueryResult<Page<GossipPost>> => {
  const adapter = useAdapter();
  return useQuery({
    queryKey: queryKeys.gossip.list(tenantId, query, page),
    queryFn: () => adapter.gossip.list(tenantId, query, page),
  });
};

/**
 * Posting to the board.
 *
 * **Invalidates `gossip.all(tenantId)`.** Every gossip key for this event, not the list the
 * caller happened to be looking at: a new post is `pending`, so it belongs to the moderation
 * queue's list rather than the board's, and invalidating the caller's own key would refresh the
 * one view guaranteed not to contain it.
 *
 * Not tenant-wide, because a post changes nothing about the schedule or the venues, and
 * refetching those on every post is how an app comes to feel slow.
 */
export const useCreateGossip = (tenantId: TenantId) => {
  const adapter = useAdapter();
  const client = useQueryClient();
  return useMutation({
    mutationFn: (post: NewGossipPost) => adapter.gossip.create(tenantId, post),
    onSuccess: () => client.invalidateQueries({ queryKey: queryKeys.gossip.all(tenantId) }),
  });
};

/**
 * A moderator's decision.
 *
 * **Invalidates `gossip.all(tenantId)`** for the same reason and one more: the decision moves a
 * post between two lists — out of the queue and onto the board, or off both — so exactly two
 * cached lists are wrong and neither is necessarily the one on screen. The realtime
 * subscription delivers the same change to any mounted listener; this is what makes the *next*
 * read correct for a screen that was not mounted.
 */
export const useModerateGossip = (tenantId: TenantId) => {
  const adapter = useAdapter();
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, decision }: { id: GossipPostId; decision: GossipModeration }) =>
      adapter.gossip.moderate(tenantId, id, decision),
    onSuccess: () => client.invalidateQueries({ queryKey: queryKeys.gossip.all(tenantId) }),
  });
};
