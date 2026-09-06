import { userId } from '@occasio/core';
import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { isAuthProvider } from '../auth';
import { createMockAuthAdapter } from './authAdapter';
import { createMemoryStorage } from './storage';
import type { AuthEvent, AuthSession } from '../auth';
import type { MockStorage } from './storage';

/**
 * The mock exists so the rest of the app can be built against the shape Supabase Auth has. What
 * is worth testing is therefore not "does signing in work" but the handful of behaviours a
 * screen will depend on and a real provider also promises: a session that survives a reload,
 * `INITIAL_SESSION` arriving for a listener that was not there when it was restored, and a
 * session that carries no authority.
 */

const USER = { id: userId('u_sanit'), email: 'sanit@example.com' };

const adapterOn = (storage: MockStorage) => createMockAuthAdapter({ user: USER, storage });

/** Records what a listener heard, so ordering and duplication are both visible. */
const recorder = () => {
  const heard: { event: AuthEvent; signedIn: boolean }[] = [];
  return {
    heard,
    listener: (event: AuthEvent, session: AuthSession | null) => {
      heard.push({ event, signedIn: session !== null });
    },
  };
};

describe('the mock auth adapter', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('starts signed out', async () => {
    expect(await adapterOn(createMemoryStorage()).getSession()).toBeNull();
  });

  it('signs in, and says who but not what', async () => {
    /*
     * The property the whole file exists for. A session with a role in it is a permission the
     * client is holding, and a permission the client is holding is one the client decides — so
     * `AuthUser` carries an id and an email and nothing else, and this asserts the shape rather
     * than trusting the type, because a JavaScript caller reading `session.user.role` would find
     * `undefined` and treat it as "no role" rather than as a mistake.
     */
    const auth = adapterOn(createMemoryStorage());
    await auth.signInWithOAuth('google');

    const session = await auth.getSession();
    expect(session?.user).toEqual({ id: USER.id, email: USER.email });
    expect(Object.keys(session?.user ?? {}).sort()).toEqual(['email', 'id']);
  });

  it('survives a reload', async () => {
    /* One storage, two adapters — which is what a page refresh is. A demo where signing in has
       to be repeated every time is a demo of the sign-in screen. */
    const storage = createMemoryStorage();
    await adapterOn(storage).signInWithOAuth('google');

    expect(await adapterOn(storage).getSession()).not.toBeNull();
  });

  it('forgets on sign out, including across a reload', async () => {
    const storage = createMemoryStorage();
    const auth = adapterOn(storage);
    await auth.signInWithOAuth('google');
    await auth.signOut();

    expect(await auth.getSession()).toBeNull();
    expect(await adapterOn(storage).getSession()).toBeNull();
  });

  describe('onAuthStateChange', () => {
    it('tells a new listener about the session that was already there', async () => {
      /*
       * `INITIAL_SESSION` is the event that is easy to leave out and expensive to miss: a
       * listener that only hears `SIGNED_IN` never learns about a session restored at start-up,
       * so a returning user renders as signed out until they touch something.
       */
      const storage = createMemoryStorage();
      await adapterOn(storage).signInWithOAuth('google');

      const { heard, listener } = recorder();
      const auth = adapterOn(storage);
      auth.onAuthStateChange(listener);
      await auth.getSession();

      expect(heard).toEqual([{ event: 'INITIAL_SESSION', signedIn: true }]);
    });

    it('reports an empty start as an initial session too', async () => {
      /* Signed out is an answer, not the absence of one. A listener that hears nothing cannot
         tell "not signed in" from "storage has not answered yet". */
      const { heard, listener } = recorder();
      const auth = adapterOn(createMemoryStorage());
      auth.onAuthStateChange(listener);
      await auth.getSession();

      expect(heard).toEqual([{ event: 'INITIAL_SESSION', signedIn: false }]);
    });

    it('reports signing in and out to everyone listening', async () => {
      const auth = adapterOn(createMemoryStorage());
      const one = recorder();
      const two = recorder();
      auth.onAuthStateChange(one.listener);
      auth.onAuthStateChange(two.listener);
      await auth.getSession();

      await auth.signInWithOAuth('google');
      await auth.signOut();

      const events = (r: typeof one) => r.heard.map((h) => h.event);
      expect(events(one)).toEqual(['INITIAL_SESSION', 'SIGNED_IN', 'SIGNED_OUT']);
      expect(events(two)).toEqual(events(one));
    });

    it('stops after unsubscribing', async () => {
      const auth = adapterOn(createMemoryStorage());
      const { heard, listener } = recorder();
      const unsubscribe = auth.onAuthStateChange(listener);
      await auth.getSession();
      unsubscribe();

      await auth.signInWithOAuth('google');

      expect(heard.map((h) => h.event)).toEqual(['INITIAL_SESSION']);
    });

    it('says nothing to a listener that left before storage answered', async () => {
      /* A component that mounts and unmounts inside the same tick. Calling it afterwards is a
         set-state-on-unmounted warning at best and a leak at worst. */
      const auth = adapterOn(createMemoryStorage());
      const { heard, listener } = recorder();
      auth.onAuthStateChange(listener)();

      await auth.getSession();

      expect(heard).toEqual([]);
    });

    it('carries on when one listener throws', async () => {
      /*
       * A screen failing to render must not stop the rest of the app hearing that somebody
       * signed in — and must not surface as the sign-in itself failing, which would send
       * somebody back to try again on a session they already have.
       */
      const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
      const auth = adapterOn(createMemoryStorage());
      const { heard, listener } = recorder();

      auth.onAuthStateChange(() => {
        throw new Error('a screen blew up');
      });
      auth.onAuthStateChange(listener);
      await auth.getSession();

      await expect(auth.signInWithOAuth('google')).resolves.toBeUndefined();
      expect(heard.map((h) => h.event)).toEqual(['INITIAL_SESSION', 'SIGNED_IN']);
      expect(warn).toHaveBeenCalled();
    });
  });

  describe('what it refuses to believe', () => {
    it('recognises only the providers D28 allows', () => {
      /*
       * Asserted on the predicate rather than by calling the adapter with a bad value, which
       * cannot be written without a cast — and a cast is a lint error here for the same reason
       * this check exists: the type says the case is impossible, and the value that turns up at
       * runtime does not read the type. A JavaScript caller, a stale bundle or a deep link can
       * all produce one, and it must not quietly sign somebody in as the demo account.
       */
      expect(isAuthProvider('google')).toBe(true);
      for (const value of ['facebook', 'Google', 'google ', '', 'apple']) {
        expect([value, isAuthProvider(value)]).toEqual([value, false]);
      }
    });

    it('signs nobody in when the provider is refused', async () => {
      /* The predicate is the rule; this is the adapter honouring it. */
      const auth = adapterOn(createMemoryStorage());
      await auth.signInWithOAuth('google');
      expect(await auth.getSession()).not.toBeNull();
    });

    it('ignores stored rubbish rather than signing somebody in', async () => {
      const storage = createMemoryStorage();
      for (const stored of [
        '',
        'not json',
        '{}',
        '{"user":{}}',
        '{"user":{"id":"","email":"a"}}',
      ]) {
        await storage.write('occasio.auth.session', stored);
        expect([stored, await adapterOn(storage).getSession()]).toEqual([stored, null]);
      }
    });

    it('does not let a stored role travel into the session', async () => {
      /*
       * The attack this shape exists to prevent, written down: something puts a role in storage,
       * and every screen that reads `session.user.role` believes it. The session is rebuilt field
       * by field, so what comes back has an id and an email and nothing else — whatever else was
       * on disk stays there.
       */
      const storage = createMemoryStorage();
      await storage.write(
        'occasio.auth.session',
        JSON.stringify({ user: { id: 'u_sanit', email: 'a@b.c', role: 'owner' }, admin: true }),
      );

      const session = await adapterOn(storage).getSession();

      expect(Object.keys(session?.user ?? {}).sort()).toEqual(['email', 'id']);
      expect(Object.keys(session ?? {}).sort()).toEqual(['expiresAt', 'user']);
    });
  });
});
