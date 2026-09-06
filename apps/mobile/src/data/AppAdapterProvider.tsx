import { createMockAdapter, FIXTURE_SEED } from '@occasio/data';
import { useState, type ReactNode } from 'react';
import type { UserId } from '@occasio/core';
import type { DataAdapter } from '@occasio/data';
import { AdapterProvider } from './AdapterProvider';
import { useCurrentUserId } from './useCurrentUserId';

/**
 * The app's binding of `<AdapterProvider>`: the mock, seeded with the four fixture events.
 *
 * This is the one file the Supabase swap touches. Everything above it asks `useAdapter()` for a
 * `DataAdapter` and does not know which one it got, which is the arrangement D5 and D29 are
 * about — so the swap is a change here and nothing else.
 *
 * `currentUserId` comes from `useCurrentUserId`, a placeholder until sign-in lands (epic #5).
 */

/**
 * One adapter per identity, and it is the *per identity* half that is load-bearing.
 *
 * A lazy `useState` initialiser runs once, so an adapter built on the first render keeps the
 * user it was built with for the life of the mount. That is invisible today because the identity
 * is a constant — and the moment sign-in lands it becomes an account boundary that does not
 * move: `createMockAdapter` captures `currentUserId` as `me`, and every membership and
 * visibility check inside it would keep answering for whoever was signed in when the provider
 * mounted. Someone signing out and back in as somebody else would read the first person's
 * events.
 *
 * So the identity is stored beside the adapter and compared on render. Setting state during
 * render is React's own answer for state derived from a changing input: it re-renders before
 * committing anything, rather than painting one frame with the wrong account's data the way an
 * effect would — and the new adapter is returned on that same render, so nothing below unmounts
 * on the way.
 *
 * Not `useMemo`, which is a hint React is allowed to discard — and discarding this one would
 * silently rebuild the mock's in-memory state and drop every live subscription with it.
 */
type Binding = { readonly userId: UserId; readonly adapter: DataAdapter };

const bind = (userId: UserId): Binding => ({
  userId,
  adapter: createMockAdapter({ currentUserId: userId, seed: FIXTURE_SEED }),
});

/**
 * Exported so the rebinding can be tested as itself.
 *
 * The alternative was mocking `useCurrentUserId` out from under the provider, which cannot be
 * done cleanly — it is an ES module export, so its namespace object is non-configurable and
 * `jest.spyOn` refuses it. Testing the mechanism directly is both simpler and closer to what is
 * actually at stake: one adapter per identity.
 */
export const useBoundAdapter = (currentUserId: UserId): DataAdapter => {
  const [binding, setBinding] = useState<Binding>(() => bind(currentUserId));

  if (binding.userId !== currentUserId) {
    /* The new adapter is returned on this same render rather than after the re-render, so the
       subtree never unmounts and no frame is painted with the previous account's data. */
    const next = bind(currentUserId);
    setBinding(next);
    return next.adapter;
  }

  return binding.adapter;
};

export function AppAdapterProvider({ children }: { readonly children: ReactNode }) {
  const adapter = useBoundAdapter(useCurrentUserId());

  return <AdapterProvider adapter={adapter}>{children}</AdapterProvider>;
}
