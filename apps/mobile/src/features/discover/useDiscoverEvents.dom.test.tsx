import { userId } from '@occasio/core';
import { createMockAdapter, createMemoryStorage, FIXTURE_SEED } from '@occasio/data';
import type { DataAdapter } from '@occasio/data';
import { afterEach, describe, expect, it } from '@jest/globals';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { AdapterProvider } from '../../data/AdapterProvider';
import { useDiscoverEvents } from './useDiscoverEvents';

/**
 * The failure path, which the screen's own tests cannot reach: they are handed an `onRetry` and
 * therefore prove nothing about whether one exists. A retry the hook does not expose leaves the
 * page's only control inert on the one screen somebody sees when the listing fails.
 */

const clients: QueryClient[] = [];

/** Fails until told otherwise, then behaves. Each surface fails independently. */
const flaky = () => {
  const base = createMockAdapter({
    currentUserId: userId('u_sanit'),
    seed: FIXTURE_SEED,
    storage: createMemoryStorage(),
    latency: { minMs: 0, maxMs: 0 },
  });

  const state = { failing: true, configsFailing: false };
  const adapter: DataAdapter = {
    ...base,
    directory: {
      ...base.directory,
      listForUser: (...args) =>
        state.failing
          ? Promise.reject(new Error('the network, probably'))
          : base.directory.listForUser(...args),
    },
    tenants: {
      ...base.tenants,
      config: (...args) =>
        state.configsFailing
          ? Promise.reject(new Error('the network, probably'))
          : base.tenants.config(...args),
    },
  };

  return { adapter, state };
};

const wrap = (adapter: DataAdapter) => {
  /* Retries off, so a failing query reaches the assertion rather than the test timing out; no
     collection timer, so nothing outlives the test. */
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
  clients.push(client);

  return ({ children }: { readonly children: ReactNode }) => (
    <QueryClientProvider client={client}>
      <AdapterProvider adapter={adapter}>{children}</AdapterProvider>
    </QueryClientProvider>
  );
};

describe('useDiscoverEvents', () => {
  afterEach(() => {
    for (const client of clients.splice(0)) client.clear();
  });

  it('lists the events this account is in', async () => {
    const { adapter, state } = flaky();
    state.failing = false;

    const { result } = renderHook(() => useDiscoverEvents(), { wrapper: wrap(adapter) });

    await waitFor(() => {
      expect(result.current.events.length).toBeGreaterThan(0);
    });
    expect(result.current.failed).toBe(false);
    /* Each event brings its own published theme, which is what the cards are for. */
    expect(result.current.events.every((event) => event.theme !== null)).toBe(true);
  });

  it('keeps the cards when only their themes fail to load', async () => {
    /*
     * The two failures are not the same failure. A listing that will not load leaves nothing to
     * show; a config that will not load costs one card its palette, and a card in the wrong
     * colours is still a way into the event. Holding the whole page back for a detail nobody has
     * noticed would trade what somebody came for against what they did not.
     *
     * This was written down in a comment and asserted nowhere, which is how the sentence would
     * have quietly stopped being true.
     */
    const { adapter, state } = flaky();
    state.failing = false;
    state.configsFailing = true;

    const { result } = renderHook(() => useDiscoverEvents(), { wrapper: wrap(adapter) });

    await waitFor(() => {
      expect(result.current.events.length).toBeGreaterThan(0);
    });
    expect(result.current.failed).toBe(false);
    expect(result.current.events.every((event) => event.theme === null)).toBe(true);
  });

  it('reports a failed listing, and recovers when retried', async () => {
    /*
     * The whole point of returning `retry`. Without it the screen renders its failure state with
     * no control at all, and the only way out of a transient error is to reload the page —
     * which on native is not a thing somebody can do.
     */
    const { adapter, state } = flaky();
    const { result } = renderHook(() => useDiscoverEvents(), { wrapper: wrap(adapter) });

    await waitFor(() => {
      expect(result.current.failed).toBe(true);
    });
    expect(result.current.events).toEqual([]);

    state.failing = false;
    act(() => {
      result.current.retry();
    });

    await waitFor(() => {
      expect(result.current.events.length).toBeGreaterThan(0);
    });
    expect(result.current.failed).toBe(false);
  });
});
