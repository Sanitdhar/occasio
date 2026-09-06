import { createMockAuthAdapter } from '@occasio/data';
import { userId } from '@occasio/core';
import { useState, type ReactNode } from 'react';
import { AuthProvider } from './AuthProvider';

/**
 * The app's binding of `<AuthProvider>`: the mock, signing in as the demo account.
 *
 * The one file the Supabase Auth swap touches, in the same way `AppAdapterProvider` is for data.
 * A fixed account because there is no provider to ask — inventing one per sign-in would produce
 * a user with no memberships and therefore no events, which is a demo of signing in rather than
 * of the app.
 */
const DEMO_USER = { id: userId('u_sanit'), email: 'sanit@example.com' };

export function AppAuthProvider({ children }: { readonly children: ReactNode }) {
  /* Once per app instance, like the query client and the data adapter beside it: a new adapter
     per render would drop the listeners the provider has already registered. */
  const [adapter] = useState(() => createMockAuthAdapter({ user: DEMO_USER }));

  /* `demo` because this is the mock: signing in here does not talk to Google, it writes the
     fixed account below. The screen says so, and both go away together when the real adapter
     lands — this is the one file that swap touches. */
  return (
    <AuthProvider adapter={adapter} demo>
      {children}
    </AuthProvider>
  );
}
