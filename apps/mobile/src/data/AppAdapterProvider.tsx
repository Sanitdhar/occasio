import { createMockAdapter, FIXTURE_SEED } from '@occasio/data';
import { useState, type ReactNode } from 'react';
import { AdapterProvider } from './AdapterProvider';
import { useCurrentUserId } from './useCurrentUserId';

/**
 * The app's binding of `<AdapterProvider>`: the mock, seeded with the four fixture events.
 *
 * This is the one file the Supabase swap touches. Everything above it asks `useAdapter()` for a
 * `DataAdapter` and does not know which one it got, which is the arrangement D5 and D29 are
 * about — so the swap is a change here and nothing else.
 *
 * `currentUserId` comes from `useCurrentUserId`, which is a placeholder until sign-in lands
 * (epic #5) — one hook rather than a constant scattered about, so replacing it is one file.
 */
export function AppAdapterProvider({ children }: { readonly children: ReactNode }) {
  const currentUserId = useCurrentUserId();

  /* Created once per app instance, like the query client beside it. A new adapter per render
     would rebuild its in-memory state and throw away every subscription with it. */
  const [adapter] = useState(() => createMockAdapter({ currentUserId, seed: FIXTURE_SEED }));

  return <AdapterProvider adapter={adapter}>{children}</AdapterProvider>;
}
