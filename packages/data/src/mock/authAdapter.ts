import { userId, type UserId } from '@occasio/core';
import { isAuthProvider } from '../auth';
import type { AuthAdapter, AuthEvent, AuthListener, AuthProvider, AuthSession } from '../auth';
import { ValidationError } from '../errors';
import type { Unsubscribe } from '../repositories';
import { createDefaultStorage } from './defaultStorage';
import type { MockStorage } from './storage';

/**
 * Sign-in without a provider.
 *
 * It exists to make the rest of the app real before Google OAuth does: screens can gate, a role
 * switcher can switch, and none of it has to be rewritten when the provider arrives, because the
 * shape it is written against is the one Supabase Auth has.
 *
 * The session is persisted through the same `MockStorage` port the data mock uses, so it
 * survives a reload on web and a relaunch on native — a demo where signing in has to be repeated
 * every time is a demo of the sign-in screen rather than of the app.
 *
 * **No membership, no role, no claim is stored here.** The session holds an id and an email;
 * everything about what that person may do is asked of the data layer, per tenant. See the note
 * on `AuthAdapter` for why that separation is not a matter of taste.
 */

const SESSION_KEY = 'occasio.auth.session';

export type MockAuthOptions = {
  /**
   * Who signing in produces.
   *
   * A fixed account, because there is no provider to ask and inventing an account per sign-in
   * would produce a user with no memberships and therefore no events — a demo that signs in
   * successfully and shows nothing.
   */
  readonly user: { readonly id: UserId; readonly email: string };
  readonly storage?: MockStorage | undefined;
  /** Starts signed out unless a stored session says otherwise. */
  readonly storageKey?: string | undefined;
};

/** What a stored session must look like to be believed. */
const parseSession = (raw: string | null): AuthSession | null => {
  if (raw === null) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }

  if (parsed === null || typeof parsed !== 'object') return null;
  if (!('user' in parsed)) return null;
  const { user } = parsed;
  if (user === null || typeof user !== 'object') return null;
  if (!('id' in user) || !('email' in user)) return null;
  if (typeof user.id !== 'string' || typeof user.email !== 'string') return null;
  if (user.id === '' || user.email === '') return null;

  /*
   * Rebuilt field by field rather than returned as parsed. Whatever else was on disk — a `role`
   * an older build wrote, something somebody added by hand — does not travel into the session,
   * which is the one object screens are most likely to trust.
   */
  return { user: { id: userId(user.id), email: user.email }, expiresAt: null };
};

export const createMockAuthAdapter = (options: MockAuthOptions): AuthAdapter => {
  const storage = options.storage ?? createDefaultStorage();
  const key = options.storageKey ?? SESSION_KEY;

  let session: AuthSession | null = null;
  let restored: Promise<void> | null = null;
  const listeners = new Set<AuthListener>();

  /* Read once and shared, so several callers during start-up do not each hit storage — and so
     `getSession` and a listener registered in the same tick cannot disagree about the answer. */
  const restore = (): Promise<void> => {
    restored ??= storage.read(key).then((raw) => {
      session = parseSession(raw);
    });
    return restored;
  };

  const emit = (event: AuthEvent, to: Iterable<AuthListener>): void => {
    for (const listener of to) {
      /* One listener throwing must not stop the others hearing, and must not surface as a
         failure of the sign-in that triggered it. */
      try {
        listener(event, session);
      } catch (error) {
        if (process.env.NODE_ENV !== 'production') {
          console.warn('[mock auth] a listener threw', error);
        }
      }
    }
  };

  return {
    getSession: async () => {
      await restore();
      return session;
    },

    onAuthStateChange: (listener: AuthListener): Unsubscribe => {
      listeners.add(listener);

      /*
       * `INITIAL_SESSION` after the restore, exactly once, and only if this listener is still
       * subscribed. A component that mounts and unmounts before storage answers would otherwise
       * be called after it had gone.
       */
      void restore().then(() => {
        if (listeners.has(listener)) emit('INITIAL_SESSION', [listener]);
      });

      return () => {
        listeners.delete(listener);
      };
    },

    signInWithOAuth: async (provider: AuthProvider) => {
      /* Unreachable from TypeScript and reachable from a JavaScript caller or a stale bundle.
         An unknown provider must not quietly sign somebody in as the demo account. */
      if (!isAuthProvider(provider)) {
        throw new ValidationError([
          { path: 'provider', message: `unsupported: ${String(provider)}` },
        ]);
      }

      await restore();
      session = { user: { ...options.user }, expiresAt: null };
      await storage.write(key, JSON.stringify(session));
      emit('SIGNED_IN', [...listeners]);
    },

    signOut: async () => {
      await restore();
      session = null;
      await storage.remove(key);
      emit('SIGNED_OUT', [...listeners]);
    },
  };
};
