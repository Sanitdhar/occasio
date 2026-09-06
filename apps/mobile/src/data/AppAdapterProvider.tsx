import { createMockAdapter, FIXTURE_SEED } from '@occasio/data';
import { userId } from '@occasio/core';
import { useState, type ReactNode } from 'react';
import { AdapterProvider } from './AdapterProvider';

/**
 * The app's binding of `<AdapterProvider>`: the mock, seeded with the four fixture events.
 *
 * This is the one file the Supabase swap touches. Everything above it asks `useAdapter()` for a
 * `DataAdapter` and does not know which one it got, which is the arrangement D5 and D29 are
 * about — so the swap is a change here and nothing else.
 *
 * `currentUserId` is a placeholder until sign-in lands (D28, v0.3). It names the wedding's
 * organiser because that is the account with something to look at in every screen the app has
 * so far, and it is a constant rather than a setting precisely so that nobody mistakes it for
 * one: the moment it becomes configurable it starts to look like authentication.
 */
const DEMO_USER = userId('u_sanit');

export function AppAdapterProvider({ children }: { readonly children: ReactNode }) {
  /* Created once per app instance, like the query client beside it. A new adapter per render
     would rebuild its in-memory state and throw away every subscription with it. */
  const [adapter] = useState(() =>
    createMockAdapter({ currentUserId: DEMO_USER, seed: FIXTURE_SEED }),
  );

  return <AdapterProvider adapter={adapter}>{children}</AdapterProvider>;
}
