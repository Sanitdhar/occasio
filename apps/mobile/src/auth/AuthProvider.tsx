import type { AuthAdapter, AuthSession } from '@occasio/data';
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

/**
 * Who is signed in, for the screens that need to know.
 *
 * A thin context over `AuthAdapter` — the adapter is where sign-in happens and this is where a
 * component asks about it. Everything it exposes is identity: there is no role here, and no
 * `can` helper, because a session says who somebody is and never what they may see (#43). What
 * they may do is asked of the data layer, per event.
 */

export type AuthState =
  /** Storage has not answered yet. Distinct from signed out, which is an answer. */
  | { readonly status: 'restoring' }
  | { readonly status: 'signed-out' }
  | { readonly status: 'signed-in'; readonly session: AuthSession };

type AuthValue = {
  readonly state: AuthState;
  readonly signIn: () => Promise<void>;
  readonly signOut: () => Promise<void>;
  /**
   * Whether this is the mock rather than a real provider.
   *
   * Carried so a screen can say so. A button reading "Continue with Google" that signs somebody
   * in as a fixed account, with nothing on screen admitting it, is the app lying about what it
   * just did — and the person most likely to be misled is whoever is demonstrating it.
   */
  readonly demo: boolean;
};

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({
  adapter,
  demo = false,
  children,
}: {
  readonly adapter: AuthAdapter;
  readonly demo?: boolean | undefined;
  readonly children: ReactNode;
}) {
  const [state, setState] = useState<AuthState>({ status: 'restoring' });

  /*
   * One sign-in at a time, across every caller rather than every screen.
   *
   * A screen's own `busy` flag protects that screen and nothing else, and it is set a render
   * later than the click — so a double tap, or two components each with a sign-in button, can
   * both reach the adapter. With a real provider that is two redirects started at once, and the
   * second one wins whichever account the first was in the middle of choosing.
   */
  const inFlight = useRef<Promise<void> | null>(null);

  useEffect(() => {
    /*
     * The listener is the only source of truth here, rather than a `getSession` call alongside
     * it. `onAuthStateChange` emits `INITIAL_SESSION` after the restore, so subscribing is
     * enough — and calling both would race, with whichever answered second overwriting the
     * other's view of the same fact.
     */
    return adapter.onAuthStateChange((_event, session) => {
      setState(session === null ? { status: 'signed-out' } : { status: 'signed-in', session });
    });
  }, [adapter]);

  const value = useMemo<AuthValue>(
    () => ({
      state,
      demo,
      signIn: () => {
        if (inFlight.current !== null) return inFlight.current;

        /* Cleared only if this is still the current attempt, so a late `finally` from an
           abandoned one cannot unlock a newer sign-in that is still running. */
        const started: Promise<void> = adapter.signInWithOAuth('google').finally(() => {
          if (inFlight.current === started) inFlight.current = null;
        });
        inFlight.current = started;
        return started;
      },
      signOut: () => adapter.signOut(),
    }),
    [state, adapter, demo],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/**
 * Throws outside a provider rather than reporting signed out.
 *
 * The two mean opposite things: "nobody is signed in" is a state screens are built to handle,
 * and "this screen was mounted outside the provider" is a wiring mistake that would otherwise
 * render as a plausible sign-in prompt nobody investigates.
 */
export const useAuth = (): AuthValue => {
  const value = useContext(AuthContext);
  if (value === null) throw new Error('useAuth must be used inside an <AuthProvider>.');
  return value;
};

export { AuthContext };
