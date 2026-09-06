import { tenantId as toTenantId, userId } from '@occasio/core';
import { createMemoryStorage, createMockAdapter, FIXTURE_SEED } from '@occasio/data';
import type { DataAdapter } from '@occasio/data';
import { afterEach, describe, expect, it } from '@jest/globals';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from '@occasio/ui';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { AdapterProvider } from '../data/AdapterProvider';
import { APP_THEME } from '../theme/inputs';
import { RoleGate } from './RoleGate';
import type { Role } from './useRole';

/**
 * A gate has two ways to be wrong and only one of them is visible: refusing somebody who should
 * be let in is a complaint, and letting somebody through for even a moment is a screen they were
 * never meant to see, with a request already sent. So the cases below are about *when* the
 * children render as much as whether they do.
 */

const WEDDING = toTenantId('t_sanit-riyanks');
const clients: QueryClient[] = [];

const base = () =>
  createMockAdapter({
    currentUserId: userId('u_sanit'),
    seed: FIXTURE_SEED,
    storage: createMemoryStorage(),
    latency: { minMs: 0, maxMs: 0 },
  });

/**
 * The adapter answering as though a different fixture person were signed in.
 *
 * `useCurrentUserId` is a module-level constant until sign-in lands, and mocking it after import
 * does not take — so the identity is varied where the role actually comes from: the membership
 * lookup. That is also the more faithful test, since what `RoleGate` does is decide what to do
 * with the data layer's answer.
 */
const asPerson = (who: string): DataAdapter => {
  const inner = base();
  return {
    ...inner,
    memberships: {
      ...inner.memberships,
      findForUser: (tenant) => inner.memberships.findForUser(tenant, userId(who)),
    },
  };
};

const renderGate = (who: string, allow: readonly Role[] = ['event_admin']) =>
  mount(asPerson(who), allow);

const mount = (adapter: DataAdapter, allow: readonly Role[]) => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
  clients.push(client);

  const Wrapper = ({ children }: { readonly children: ReactNode }) => (
    <QueryClientProvider client={client}>
      <AdapterProvider adapter={adapter}>
        <ThemeProvider input={APP_THEME} forceScheme="light">
          {children}
        </ThemeProvider>
      </AdapterProvider>
    </QueryClientProvider>
  );

  render(
    <Wrapper>
      <RoleGate tenantId={WEDDING} allow={allow}>
        <div data-testid="behind-the-gate">the admin screens</div>
      </RoleGate>
    </Wrapper>,
  );

  return { client };
};

describe('RoleGate', () => {
  afterEach(() => {
    for (const client of clients.splice(0)) client.clear();
  });

  it('shows nothing but a placeholder while the answer is unknown', () => {
    /*
     * The failure this ordering prevents: rendering the children first and hiding them on
     * refusal means the request they make has already left, and on a slow connection somebody
     * sees the admin screen for a second. Rendering the refusal first is the opposite mistake,
     * telling a genuine organiser they have no access every time they open the page.
     */
    renderGate('u_sanit');

    expect(screen.getByTestId('role-gate-loading')).toBeTruthy();
    expect(screen.queryByTestId('behind-the-gate')).toBeNull();
    expect(screen.queryByTestId('role-gate-refused')).toBeNull();
  });

  it('lets an event admin through', async () => {
    renderGate('u_sanit');

    await waitFor(() => {
      expect(screen.getByTestId('behind-the-gate')).toBeTruthy();
    });
  });

  it('refuses a role that is in the event but not on the list', async () => {
    /* A moderator moderates a queue; they do not edit the theme or the schedule. */
    renderGate('u_meera');

    await waitFor(() => {
      expect(screen.getByTestId('role-gate-refused')).toBeTruthy();
    });
    expect(screen.queryByTestId('behind-the-gate')).toBeNull();
  });

  it('refuses somebody who is not in the event at all', async () => {
    /* The same screen as the wrong role, deliberately: distinguishing them would tell a stranger
       which events exist and who runs them. */
    renderGate('u_lena');

    await waitFor(() => {
      expect(screen.getByTestId('role-gate-refused')).toBeTruthy();
    });
  });

  it('lets a moderator through when moderators are allowed', async () => {
    /* The allow-list is what decides, so a gate that refused everybody would pass the cases
       above for the wrong reason. */
    renderGate('u_meera', ['event_admin', 'moderator']);

    await waitFor(() => {
      expect(screen.getByTestId('behind-the-gate')).toBeTruthy();
    });
  });

  it('refuses a membership that is no longer active', async () => {
    /*
     * The case the fixtures cannot produce, and the one that matters most: every membership in
     * them is `active`, so the status check was never exercised — deleting it passed the whole
     * suite. A revoked organiser whose row still says `event_admin` would have kept the admin
     * screens, and an invited one who has not accepted would have had them early.
     */
    for (const status of ['revoked', 'invited'] as const) {
      const inner = base();
      const stale: DataAdapter = {
        ...inner,
        memberships: {
          ...inner.memberships,
          findForUser: async (tenant, who) => {
            const membership = await inner.memberships.findForUser(tenant, who);
            return membership === null ? null : { ...membership, status };
          },
        },
      };

      mount(stale, ['event_admin']);

      await waitFor(() => {
        expect([status, screen.getAllByTestId('role-gate-refused').length]).toEqual([status, 1]);
      });
      cleanup();
      for (const client of clients.splice(0)) client.clear();
    }
  });

  it('does not call a failed read a refusal', async () => {
    /* "You do not have access" when the network dropped sends an organiser to ask somebody for
       a permission they already have. */
    const inner = base();
    const failing: DataAdapter = {
      ...inner,
      memberships: {
        ...inner.memberships,
        findForUser: () => Promise.reject(new Error('the network, probably')),
      },
    };

    mount(failing, ['event_admin']);

    await waitFor(() => {
      expect(screen.getByTestId('role-gate-error')).toBeTruthy();
    });
    expect(screen.queryByTestId('role-gate-refused')).toBeNull();
    expect(screen.queryByTestId('behind-the-gate')).toBeNull();
  });
});
