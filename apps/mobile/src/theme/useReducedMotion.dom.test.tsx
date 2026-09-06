import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { act, render, screen } from '@testing-library/react';
import { AccessibilityInfo } from 'react-native';
import { resetReducedMotion, setReducedMotion } from '../../../../test/setup/mediaQuery';
import { useReducedMotion } from './useReducedMotion';

/**
 * The promise this hook makes is about the *first* render, not eventually.
 *
 * `AccessibilityInfo.isReduceMotionEnabled()` is asynchronous, so a hook that started at
 * `false` and corrected itself a tick later would play one frame of animation to the one person
 * who asked for none, and would leave the visual gate screenshotting a page mid-transition —
 * Playwright sets the preference before load, and an async-only read has not seen it when the
 * first frame is captured (#129).
 *
 * The preference is driven through the real `matchMedia` that react-native-web reads, installed
 * before any module loads (test/setup/mediaQuery.ts), so these assert the library's own
 * translation rather than a stub standing in for it.
 */

function Probe() {
  const reduced = useReducedMotion();
  return <span data-testid="reduced">{String(reduced)}</span>;
}

describe('useReducedMotion', () => {
  afterEach(() => {
    resetReducedMotion();
    jest.restoreAllMocks();
  });

  it('reports the preference on the very first render, not a tick later', () => {
    setReducedMotion(true);
    render(<Probe />);

    /* Read immediately: no `await`, no `act` flush. If this needed one, the first painted frame
       would already have animated. */
    expect(screen.getByTestId('reduced').textContent).toBe('true');
  });

  it('reports false when the preference is not set', () => {
    render(<Probe />);

    expect(screen.getByTestId('reduced').textContent).toBe('false');
  });

  it('follows the preference changing while the app is open', async () => {
    /* Both platforms allow it from a control centre, and a browser follows the OS. */
    render(<Probe />);
    expect(screen.getByTestId('reduced').textContent).toBe('false');

    await act(async () => {
      setReducedMotion(true);
      await Promise.resolve();
    });

    expect(screen.getByTestId('reduced').textContent).toBe('true');
  });

  it('does not let the initial read undo a change that arrived first', async () => {
    /*
     * The two values travel on different channels — on native the initial read comes back
     * through a bridge callback while changes arrive over the event emitter — so nothing orders
     * them. Toggling the setting during the first render would otherwise be undone a moment
     * later by a promise carrying the value from before the toggle: the preference reverting on
     * its own, which nobody reports because nobody believes it.
     *
     * Only the initial read is stubbed, and only to hold it open; the change travels the real
     * path, so what is asserted is the ordering rather than a mock of it.
     */
    const deferred: { resolve: (value: boolean) => void } = { resolve: () => undefined };
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockReturnValue(
      new Promise<boolean>((resolve) => {
        deferred.resolve = resolve;
      }),
    );

    render(<Probe />);
    expect(screen.getByTestId('reduced').textContent).toBe('false');

    await act(async () => {
      setReducedMotion(true);
      await Promise.resolve();
    });
    expect(screen.getByTestId('reduced').textContent).toBe('true');

    /* …and the stale read lands afterwards, carrying the value from before the toggle.

       Awaited, and the callback is async: resolving a promise queues a microtask, and a
       synchronous `act` returns before it runs — which made the first version of this test pass
       against the very bug it was written for. */
    await act(async () => {
      deferred.resolve(false);
      await Promise.resolve();
    });
    /* A second empty act, because the value has to travel promise -> setState -> render, and
       one flush only gets it partway. Without this the assertion runs before the stale read
       could have done any damage, and the test passes whether or not the guard exists. */
    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.getByTestId('reduced').textContent).toBe('true');
  });
});
