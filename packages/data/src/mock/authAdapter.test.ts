import { userId } from '@occasio/core';
import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { isAuthProvider } from '../auth';
import { isValidationError } from '../errors';
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

const tick = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * The same store, with one operation slower than the other.
 *
 * Which one has to be slow depends on the order the transitions are started in, and getting that
 * wrong produces a test that passes without the queue. Delaying writes only makes "sign in, then
 * sign out" land backwards — but for "sign out, then sign in" the same delay produces the right
 * answer by accident, because the immediate remove happens first and the late write is the one
 * that should win anyway. That case needs the *remove* delayed, so an unqueued run has the late
 * remove wipe a completed sign-in.
 *
 * A store that answers instantly can never produce either interleaving.
 */
const slowStorage = (inner: MockStorage, slow: 'write' | 'remove'): MockStorage => ({
  read: (k) => inner.read(k),
  write: async (k, v) => {
    if (slow === 'write') await tick(20);
    await inner.write(k, v);
  },
  remove: async (k) => {
    if (slow === 'remove') await tick(20);
    await inner.remove(k);
  },
});

/** Fails whichever operation it is told to, so a rejected transition can be observed. */
const failingStorage = (inner: MockStorage, failing: 'write' | 'remove'): MockStorage => ({
  read: (k) => inner.read(k),
  write: (k, v) =>
    failing === 'write' ? Promise.reject(new Error('the disk, probably')) : inner.write(k, v),
  remove: (k) =>
    failing === 'remove' ? Promise.reject(new Error('the disk, probably')) : inner.remove(k),
});

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

  describe('overlapping transitions', () => {
    it('does not let a slow sign-in undo a sign-out', async () => {
      /*
       * Both are read-write across an await, so without a queue the writes land in whichever
       * order storage finishes them: a sign-in whose write settles after a sign-out's remove
       * puts the session back on disk, and the next reload signs the person in again — from the
       * action they took to leave.
       *
       * Nothing on screen disagrees while it happens, which is what makes it worth a test: the
       * in-memory session says signed out, and the late `SIGNED_IN` carries that same null.
       */
      /* Writes delayed: unqueued, the sign-in's write lands after the sign-out's remove and
         puts the session back. */
      const storage = slowStorage(createMemoryStorage(), 'write');
      const auth = adapterOn(storage);

      const signingIn = auth.signInWithOAuth('google');
      const signingOut = auth.signOut();
      await Promise.all([signingIn, signingOut]);

      expect(await auth.getSession()).toBeNull();
      /* The disk, not just the field — a reload is what would reveal a stale write. */
      expect(await adapterOn(storage).getSession()).toBeNull();
    });

    it('ends signed in when signing out is what finished first', async () => {
      /*
       * The mirror image, so the queue is shown to preserve order rather than to favour one
       * outcome — and with the *remove* delayed rather than the write. With writes delayed this
       * case passes without a queue at all: the immediate remove goes first and the late write is
       * the one that should win anyway, so it proves nothing. Delaying the remove is what makes
       * an unqueued run wipe a sign-in that had already completed.
       */
      const storage = slowStorage(createMemoryStorage(), 'remove');
      const auth = adapterOn(storage);

      const signingOut = auth.signOut();
      const signingIn = auth.signInWithOAuth('google');
      await Promise.all([signingOut, signingIn]);

      expect(await auth.getSession()).not.toBeNull();
      expect(await adapterOn(storage).getSession()).not.toBeNull();
    });
  });

  describe('when storage refuses', () => {
    it('does not report a sign-in that was never stored', async () => {
      /*
       * Assigning the session before persisting it leaves the adapter reporting a signed-in user
       * that nothing has written: the call rejects, a screen shows the failure, and `getSession`
       * contradicts it — until a reload quietly signs the person out again. Storage is the
       * durable answer, so storage decides.
       */
      const auth = adapterOn(failingStorage(createMemoryStorage(), 'write'));

      await expect(auth.signInWithOAuth('google')).rejects.toThrow();
      expect(await auth.getSession()).toBeNull();
    });

    it('does not report a sign-out that did not happen', async () => {
      /* The same in reverse, and the worse direction: reporting signed out while storage still
         holds the session means the next reload signs the person back in. */
      const storage = createMemoryStorage();
      await adapterOn(storage).signInWithOAuth('google');

      const auth = adapterOn(failingStorage(storage, 'remove'));
      await auth.getSession();

      await expect(auth.signOut()).rejects.toThrow();
      expect(await auth.getSession()).not.toBeNull();
      expect(await adapterOn(storage).getSession()).not.toBeNull();
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
      /*
       * The first version of this called `'google'` and asserted the session existed — a test
       * whose name described a refusal and whose body exercised the happy path, which is worse
       * than no test. It could not fail if unsupported providers were accepted.
       *
       * `Reflect.apply` is how to reach the case without a cast: its parameters are untyped, so
       * this is genuinely the untyped caller the guard exists for, rather than a lie told to the
       * compiler.
       */
      const auth = adapterOn(createMemoryStorage());

      let caught: unknown;
      try {
        await Reflect.apply(auth.signInWithOAuth, auth, ['facebook']);
      } catch (error) {
        caught = error;
      }

      /* The guard recognised through the exported type guard, which is how a caller narrows one
         of these — and asserted to have thrown at all, so a call that quietly resolved could not
         pass by leaving `caught` undefined. */
      expect(isValidationError(caught)).toBe(true);
      expect(await auth.getSession()).toBeNull();

      /* …and the real provider still works, so the guard is not simply refusing everything. */
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

    it('does not let a configured role travel into the session', async () => {
      /*
       * The same rule on the way *in*, which is where it is needed first. `MockAuthOptions`'s
       * user is a structural type, so an object carrying a role satisfies it — and a spread
       * would have put that role into the live session and then persisted it. Sanitising only on
       * read would leave the running app holding it until a reload.
       */
      /* Through a variable, because an object literal would be refused by the excess-property
         check — and a variable is how such an object actually arrives: something builds a user
         with more on it than this adapter asked for, and structural typing accepts it. */
      const configured = { ...USER, role: 'owner' };
      const auth = createMockAuthAdapter({ user: configured, storage: createMemoryStorage() });
      await auth.signInWithOAuth('google');

      const session = await auth.getSession();
      expect(Object.keys(session?.user ?? {}).sort()).toEqual(['email', 'id']);
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
