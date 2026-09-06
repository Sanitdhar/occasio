import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { render, screen } from '@testing-library/react';
import { useReducedMotion } from './useReducedMotion';

/**
 * The promise this hook makes is about the *first* render, not eventually.
 *
 * `AccessibilityInfo.isReduceMotionEnabled()` is asynchronous, so a hook that started at
 * `false` would play one frame of animation to the one person who asked for none, and would
 * leave the visual gate screenshotting a page mid-transition — Playwright sets the preference
 * before load, and an async-only read has not seen it yet when the first frame is captured
 * (#129). Everything below is therefore asserted synchronously, before any effect has settled.
 */

type Listener = (event: { matches: boolean }) => void;

/** jsdom has no `matchMedia`; this is the smallest one that answers the query truthfully. */
const stubMatchMedia = (reduce: boolean): void => {
  const listeners = new Set<Listener>();
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: (query: string) => ({
      matches: query.includes('prefers-reduced-motion') && reduce,
      media: query,
      onchange: null,
      addEventListener: (_: string, fn: Listener) => listeners.add(fn),
      removeEventListener: (_: string, fn: Listener) => listeners.delete(fn),
      addListener: (fn: Listener) => listeners.add(fn),
      removeListener: (fn: Listener) => listeners.delete(fn),
      dispatchEvent: () => true,
    }),
  });
};

function Probe() {
  const reduced = useReducedMotion();
  return <span data-testid="reduced">{String(reduced)}</span>;
}

describe('useReducedMotion', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('reports the preference on the very first render, not a tick later', () => {
    stubMatchMedia(true);
    render(<Probe />);

    /* Read immediately: no `await`, no `act` flush. If this needed one, the first painted frame
       would already have animated. */
    expect(screen.getByTestId('reduced').textContent).toBe('true');
  });

  it('reports false when the preference is not set', () => {
    stubMatchMedia(false);
    render(<Probe />);

    expect(screen.getByTestId('reduced').textContent).toBe('false');
  });

  it('does not throw where there is no matchMedia at all', () => {
    /* Native, and a server render. The initialiser has to survive both rather than assume a
       browser, since this hook is in the app shell that renders on every platform. */
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      writable: true,
      value: undefined,
    });

    expect(() => render(<Probe />)).not.toThrow();
    expect(screen.getByTestId('reduced').textContent).toBe('false');
  });
});
