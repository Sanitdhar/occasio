import { userId } from '@occasio/core';
import { createMemoryStorage, createMockAuthAdapter } from '@occasio/data';
import type { AuthAdapter } from '@occasio/data';
import { describe, expect, it } from '@jest/globals';
import { act, render, screen, waitFor } from '@testing-library/react';
import { AuthProvider, useAuth } from './AuthProvider';

/**
 * What a screen sees. The adapter's own behaviour is tested next door; this is about the three
 * states a component has to render and the one it must never be told to render by mistake.
 */

const USER = { id: userId('u_sanit'), email: 'sanit@example.com' };

const Probe = () => {
  const { state, signIn, signOut } = useAuth();
  return (
    <div>
      <div data-testid="status">{state.status}</div>
      <button
        data-testid="in"
        onClick={() => {
          void signIn();
        }}
      >
        in
      </button>
      <button
        data-testid="out"
        onClick={() => {
          void signOut();
        }}
      >
        out
      </button>
    </div>
  );
};

/** The same adapter, keeping count of how many listeners are currently subscribed. */
const counting = (inner: AuthAdapter) => {
  let live = 0;
  const adapter: AuthAdapter = {
    ...inner,
    onAuthStateChange: (listener) => {
      live += 1;
      const unsubscribe = inner.onAuthStateChange(listener);
      return () => {
        live -= 1;
        unsubscribe();
      };
    },
  };
  return { adapter, live: () => live };
};

/**
 * The context value, captured on every render.
 *
 * Read back through `.at(-1)` with a check rather than a cast — `signIn`'s identity changes when
 * the state does, so a value grabbed once goes stale, and a cast to paper over that is a lint
 * error here for good reason.
 */
const captureAuth = (adapter: AuthAdapter) => {
  const seen: ReturnType<typeof useAuth>[] = [];
  const Capture = () => {
    seen.push(useAuth());
    return null;
  };

  render(
    <AuthProvider adapter={adapter}>
      <Capture />
    </AuthProvider>,
  );

  return () => {
    const latest = seen.at(-1);
    if (latest === undefined) throw new Error('the provider rendered nothing');
    return latest;
  };
};

const mount = (adapter: AuthAdapter) =>
  render(
    <AuthProvider adapter={adapter}>
      <Probe />
    </AuthProvider>,
  );

const status = () => screen.getByTestId('status').textContent;

describe('AuthProvider', () => {
  it('starts restoring, then settles on signed out', async () => {
    /*
     * `restoring` is a state and not a formality: storage is asynchronous on both platforms, so
     * a provider that started at `signed-out` would flash a sign-in prompt at somebody who is
     * signed in, every launch.
     */
    mount(createMockAuthAdapter({ user: USER, storage: createMemoryStorage() }));

    expect(status()).toBe('restoring');
    await waitFor(() => {
      expect(status()).toBe('signed-out');
    });
  });

  it('restores a session that was already there', async () => {
    const storage = createMemoryStorage();
    await createMockAuthAdapter({ user: USER, storage }).signInWithOAuth('google');

    mount(createMockAuthAdapter({ user: USER, storage }));

    await waitFor(() => {
      expect(status()).toBe('signed-in');
    });
  });

  it('follows signing in and out', async () => {
    mount(createMockAuthAdapter({ user: USER, storage: createMemoryStorage() }));
    await waitFor(() => {
      expect(status()).toBe('signed-out');
    });

    await act(async () => {
      screen.getByTestId('in').click();
      await Promise.resolve();
    });
    await waitFor(() => {
      expect(status()).toBe('signed-in');
    });

    await act(async () => {
      screen.getByTestId('out').click();
      await Promise.resolve();
    });
    await waitFor(() => {
      expect(status()).toBe('signed-out');
    });
  });

  it('stops listening when it goes away', async () => {
    /*
     * An adapter outlives a provider — it is created once per app — so a listener left behind
     * sets state on an unmounted tree every time anybody signs in.
     *
     * Counted rather than inferred. The first version of this asserted that signing in still
     * resolved after unmounting, which it does whether or not the listener was removed: React
     * tolerates the stale update silently, so the assertion held with the cleanup deleted. What
     * has to be observed is the subscription itself.
     */
    const { adapter, live } = counting(
      createMockAuthAdapter({ user: USER, storage: createMemoryStorage() }),
    );
    const { unmount } = mount(adapter);
    await waitFor(() => {
      expect(status()).toBe('signed-out');
    });
    expect(live()).toBe(1);

    unmount();

    expect(live()).toBe(0);
  });

  it('starts one sign-in however many callers ask', async () => {
    /*
     * A screen's `busy` flag protects that screen and is set a render later than the click, so a
     * double tap — or two components each holding a sign-in button — can both reach the adapter.
     * With a real provider that is two redirects started at once, and the second wins whichever
     * account the first was in the middle of choosing.
     */
    const attempts: unknown[] = [];
    const inner = createMockAuthAdapter({ user: USER, storage: createMemoryStorage() });
    const adapter: AuthAdapter = {
      ...inner,
      signInWithOAuth: (provider) => {
        attempts.push(provider);
        return inner.signInWithOAuth(provider);
      },
    };

    const auth = captureAuth(adapter);

    const first = auth().signIn();
    const second = auth().signIn();

    /* The same promise, not two — a later caller joins the attempt already running. */
    expect(second).toBe(first);
    await act(async () => {
      await Promise.all([first, second]);
    });
    expect(attempts).toEqual(['google']);
  });

  it('allows a fresh attempt after the last one settled', async () => {
    /* Single-flight is not once-only: a failed or completed sign-in must be retryable. */
    const adapter = createMockAuthAdapter({ user: USER, storage: createMemoryStorage() });
    const auth = captureAuth(adapter);

    const first = auth().signIn();
    await act(async () => {
      await first;
    });

    expect(auth().signIn()).not.toBe(first);
  });

  it('fails loudly outside a provider', () => {
    /* Reporting signed out here would render a plausible sign-in prompt over a wiring mistake
       nobody would investigate. */
    expect(() => render(<Probe />)).toThrow(/inside an <AuthProvider>/);
  });
});
