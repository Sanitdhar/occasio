import { tenantId, userId } from '@occasio/core';
import { createMockAdapter, createMemoryStorage, FIXTURE_SEED } from '@occasio/data';
import { afterEach, describe, expect, it } from '@jest/globals';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { AdapterProvider } from './AdapterProvider';
import { useCreateGossip, useGossip } from './hooks';

/**
 * What the key factory's tests cannot reach: that a mutation's invalidation actually refreshes
 * the list a screen is looking at.
 *
 * The keys are structural and tested as such. Whether `gossip.all(tenantId)` is the prefix
 * TanStack Query matches against the key a `useGossip` call stored is a fact about the two of
 * them together, and the failure — a board that does not update after a post — looks like a
 * backend problem from the outside.
 */

const WEDDING = tenantId('t_sanit-riyanks');
const PENDING = { statuses: ['pending'] } as const;

/** Every client built by `wrapper`, so `afterEach` can clear them. */
const clients: QueryClient[] = [];

const wrapper = () => {
  const adapter = createMockAdapter({
    currentUserId: userId('u_meera'),
    seed: FIXTURE_SEED,
    storage: createMemoryStorage(),
    latency: { minMs: 0, maxMs: 0 },
  });
  /*
   * Retries off: a failing query would otherwise retry twice before the assertion sees it, and
   * the test would report a timeout rather than the error.
   *
   * `gcTime: Infinity` because releasing an inactive query schedules a garbage-collection timer,
   * and a timer outliving the test keeps a handle open — Jest then waits on it and reports a
   * slow or hanging run rather than the finished one it had.
   */
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });

  clients.push(client);
  return {
    client,
    Wrapper: ({ children }: { readonly children: ReactNode }) => (
      <QueryClientProvider client={client}>
        <AdapterProvider adapter={adapter}>{children}</AdapterProvider>
      </QueryClientProvider>
    ),
  };
};

describe('useGossip', () => {
  afterEach(() => {
    /* Clearing drops the cached entries now rather than leaving them for a collection timer
       that outlives the test. */
    for (const client of clients.splice(0)) client.clear();
  });

  it('reads through the adapter it was given', async () => {
    const { Wrapper } = wrapper();
    const { result } = renderHook(() => useGossip(WEDDING, PENDING), { wrapper: Wrapper });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    expect(result.current.data?.items).toBeDefined();
  });

  it('refreshes the queue after a post is created', async () => {
    /*
     * The whole point of the arrangement. A new post is `pending`, so it belongs to the
     * moderation queue's list — invalidating the caller's own key would have refreshed the one
     * view guaranteed not to contain it, which is why the mutation invalidates the entity
     * prefix instead.
     */
    const { Wrapper } = wrapper();
    const list = renderHook(() => useGossip(WEDDING, PENDING), { wrapper: Wrapper });
    const create = renderHook(() => useCreateGossip(WEDDING), { wrapper: Wrapper });

    await waitFor(() => {
      expect(list.result.current.isSuccess).toBe(true);
    });
    const before = list.result.current.data?.items.length ?? 0;

    await create.result.current.mutateAsync({ body: 'A post from a hook test', mediaId: null });

    await waitFor(() => {
      expect(list.result.current.data?.items.length).toBe(before + 1);
    });
  });
});
