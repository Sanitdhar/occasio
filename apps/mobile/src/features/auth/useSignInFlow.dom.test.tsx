import { userId } from '@occasio/core';
import { createMemoryStorage, createMockAuthAdapter } from '@occasio/data';
import type { AuthAdapter } from '@occasio/data';
import { describe, expect, it, jest } from '@jest/globals';
import { act, render, waitFor } from '@testing-library/react';
import { AuthProvider } from '../../auth/AuthProvider';
import { useSignInFlow, type SignInFlow } from './useSignInFlow';

/**
 * The half of signing in that is neither the screen nor the adapter: what the screen is told,
 * and how many times the route is asked to navigate.
 */

const USER = { id: userId('u_sanit'), email: 'sanit@example.com' };

const mountFlow = (next: unknown, adapter?: AuthAdapter) => {
  const onSignedIn = jest.fn<(destination: string) => void>();
  const seen: SignInFlow[] = [];

  const Probe = () => {
    seen.push(useSignInFlow({ next, onSignedIn }));
    return null;
  };

  render(
    <AuthProvider
      adapter={adapter ?? createMockAuthAdapter({ user: USER, storage: createMemoryStorage() })}
    >
      <Probe />
    </AuthProvider>,
  );

  const flow = () => {
    const latest = seen.at(-1);
    if (latest === undefined) throw new Error('the provider rendered nothing');
    return latest;
  };

  return { flow, onSignedIn };
};

describe('useSignInFlow', () => {
  it('resolves the destination it was given', () => {
    expect(mountFlow('/e/lila-and-sam/schedule').flow().destination).toBe(
      '/e/lila-and-sam/schedule',
    );
  });

  it('falls home for a destination that cannot be followed', () => {
    /* The check belongs here rather than at the point of navigation, so there is one place that
       decides what an acceptable destination is. */
    expect(mountFlow('https://evil.example').flow().destination).toBe('/');
  });

  it('navigates once when the button is pressed twice', async () => {
    /*
     * `signIn` is single-flight, so a second press does not start a second sign-in — but each
     * `start` used to attach its own completion handler, and both would navigate. Two
     * navigations for one sign-in is a duplicate route on a stack and a history entry somebody
     * has to press back through twice on the web.
     *
     * Pressed twice synchronously, which is the case `busy` cannot catch: it is set for the next
     * render, and both presses happen before it.
     */
    const { flow, onSignedIn } = mountFlow('/discover');

    await act(async () => {
      flow().start();
      flow().start();
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(onSignedIn).toHaveBeenCalledTimes(1);
    });
    expect(onSignedIn).toHaveBeenCalledWith('/discover');
  });

  it('reports a failure to the screen rather than navigating', async () => {
    const failing: AuthAdapter = {
      ...createMockAuthAdapter({ user: USER, storage: createMemoryStorage() }),
      signInWithOAuth: () => Promise.reject(new Error('the provider, probably')),
    };
    const { flow, onSignedIn } = mountFlow('/discover', failing);

    await act(async () => {
      flow().start();
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(flow().error).toMatch(/Could not sign in/);
    });
    expect(onSignedIn).not.toHaveBeenCalled();
  });

  it('can be tried again after a failure', async () => {
    /* The guard is one-at-a-time, not once-only: a sign-in that failed has to be retryable. */
    let fail = true;
    const inner = createMockAuthAdapter({ user: USER, storage: createMemoryStorage() });
    const adapter: AuthAdapter = {
      ...inner,
      signInWithOAuth: (provider) =>
        fail ? Promise.reject(new Error('nope')) : inner.signInWithOAuth(provider),
    };
    const { flow, onSignedIn } = mountFlow('/discover', adapter);

    await act(async () => {
      flow().start();
      await Promise.resolve();
    });
    await waitFor(() => {
      expect(flow().error).toBeDefined();
    });

    fail = false;
    await act(async () => {
      flow().start();
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(onSignedIn).toHaveBeenCalledTimes(1);
    });
  });
});
