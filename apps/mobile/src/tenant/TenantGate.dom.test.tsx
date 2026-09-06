import { userId } from '@occasio/core';
import { createMockAdapter, createMemoryStorage, FIXTURE_SEED } from '@occasio/data';
import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { ThemeProvider } from '@occasio/ui';
import { AdapterProvider } from '../data/AdapterProvider';
import { APP_THEME } from '../theme/inputs';
import { TenantContext } from './TenantProvider';
import { TenantGate } from './TenantGate';
import { resolvedAs, resolving, unresolved, type TenantResolution } from './tenantResolution';

/**
 * A mistyped slug is the first thing anyone will hit, so the screen it produces is the one worth
 * rendering rather than reasoning about.
 *
 * The resolution is supplied directly instead of going through `TenantProvider`, so each case
 * is one state and nothing else — the provider's own behaviour is tested next door.
 *
 * `ThemeProvider` rather than `AppThemeProvider`: the app's wrapper loads tenant fonts through
 * expo-font, which is ESM and not stubbed for jsdom. The gate needs a theme, not a font loader.
 */

const clients: QueryClient[] = [];

const renderGate = (resolution: TenantResolution) => {
  const adapter = createMockAdapter({
    currentUserId: userId('u_meera'),
    seed: FIXTURE_SEED,
    storage: createMemoryStorage(),
    latency: { minMs: 0, maxMs: 0 },
  });
  /* Retries off and no collection timer, for the reasons hooks.dom.test.tsx gives: a retried
     failure reports as a timeout, and a timer outliving the test keeps a handle open. */
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
  clients.push(client);

  const onLeave = jest.fn();
  const Wrapper = ({ children }: { readonly children: ReactNode }) => (
    <QueryClientProvider client={client}>
      <AdapterProvider adapter={adapter}>
        <ThemeProvider input={APP_THEME} forceScheme="light">
          <TenantContext.Provider value={resolution}>{children}</TenantContext.Provider>
        </ThemeProvider>
      </AdapterProvider>
    </QueryClientProvider>
  );

  render(
    <Wrapper>
      <TenantGate onLeave={onLeave} leaveLabel="Find your event">
        <div data-testid="event">the event</div>
      </TenantGate>
    </Wrapper>,
  );

  return { client, onLeave };
};

describe('TenantGate', () => {
  afterEach(() => {
    for (const client of clients.splice(0)) client.clear();
  });

  it('renders the event once its tenant loads', async () => {
    renderGate(resolvedAs('sanit-riyanks', 'path'));

    await waitFor(() => {
      expect(screen.getByTestId('event')).toBeTruthy();
    });
  });

  it('says the event does not exist, and offers a way out', async () => {
    /* A link read off a printed invitation with a character dropped. Being told a request
       failed helps nobody: the address is wrong and only leaving fixes it. */
    const { onLeave } = renderGate(resolvedAs('no-such-event', 'path'));

    await waitFor(() => {
      expect(screen.getByTestId('tenant-not-found')).toBeTruthy();
    });
    expect(screen.getByText(/No such event/)).toBeTruthy();
    /* The slug is quoted back, because "check the link" is useless without saying which link. */
    expect(screen.getByText(/no-such-event/)).toBeTruthy();

    screen.getByText('Find your event').click();
    expect(onLeave).toHaveBeenCalledTimes(1);
  });

  it('offers the same way out when nothing identified an event at all', async () => {
    const { onLeave } = renderGate(unresolved);

    await waitFor(() => {
      expect(screen.getByTestId('tenant-unresolved')).toBeTruthy();
    });
    screen.getByText('Find your event').click();
    expect(onLeave).toHaveBeenCalledTimes(1);
  });

  it('paints nothing at all in the first moments of a wait', () => {
    /*
     * The anti-flash requirement, from the side that matters: at the instant a load begins there
     * must be no skeleton, no spinner and no layout — otherwise every fast answer costs the page
     * a visible jump on the way to content that was about to arrive anyway.
     */
    renderGate(resolving);

    expect(screen.queryByTestId('tenant-loading')).toBeNull();
    expect(screen.queryByTestId('event')).toBeNull();
  });

  it('does not flash a loading state for a tenant already in the cache', async () => {
    /*
     * The requirement in #40's own words. Rendered twice against one client: the second render
     * has the answer already, so it must reach the content without passing through a loading
     * branch at all — not "quickly", but never.
     */
    const first = renderGate(resolvedAs('sanit-riyanks', 'path'));
    await waitFor(() => {
      expect(screen.getByTestId('event')).toBeTruthy();
    });

    render(
      <QueryClientProvider client={first.client}>
        <AdapterProvider
          adapter={createMockAdapter({
            currentUserId: userId('u_meera'),
            seed: FIXTURE_SEED,
            storage: createMemoryStorage(),
            latency: { minMs: 0, maxMs: 0 },
          })}
        >
          <ThemeProvider input={APP_THEME} forceScheme="light">
            <TenantContext.Provider value={resolvedAs('sanit-riyanks', 'path')}>
              <TenantGate onLeave={() => undefined} leaveLabel="Find your event">
                <div data-testid="cached-event">the event</div>
              </TenantGate>
            </TenantContext.Provider>
          </ThemeProvider>
        </AdapterProvider>
      </QueryClientProvider>,
    );

    /* Synchronously, on the first render — no `waitFor`, which would hide the flash it is
       supposed to be proving does not happen. */
    expect(screen.getByTestId('cached-event')).toBeTruthy();
  });
});
