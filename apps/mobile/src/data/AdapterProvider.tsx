import type { DataAdapter } from '@occasio/data';
import { createContext, useContext, type ReactNode } from 'react';

/**
 * Supplies the one `DataAdapter` the app talks to.
 *
 * A context rather than a module-level singleton, and the reason is the swap this architecture
 * is built around: a singleton is constructed by whoever imports it first, which makes "use the
 * Supabase adapter here and the mock in a test" a matter of import order. A provider makes it a
 * matter of what is rendered, which is a decision somebody writes down.
 *
 * It is deliberately not the query client. TanStack Query owns caching; this owns *where the
 * data comes from*. Conflating them would mean a test that wanted a different adapter also had
 * to reconstruct a cache, and one that wanted a cold cache also had to rebuild an adapter.
 */

const AdapterContext = createContext<DataAdapter | null>(null);

export function AdapterProvider({
  adapter,
  children,
}: {
  readonly adapter: DataAdapter;
  readonly children: ReactNode;
}) {
  return <AdapterContext.Provider value={adapter}>{children}</AdapterContext.Provider>;
}

/**
 * Throws rather than returning null.
 *
 * A hook that returned `null` would push the same `if (adapter === null)` into every caller, and
 * the one that forgot it would fail somewhere unrelated with a message about a property of
 * undefined. Failing here names the actual mistake.
 */
export const useAdapter = (): DataAdapter => {
  const adapter = useContext(AdapterContext);
  if (adapter === null) {
    throw new Error('useAdapter() was called outside an <AdapterProvider>. Wrap the subtree.');
  }
  return adapter;
};
