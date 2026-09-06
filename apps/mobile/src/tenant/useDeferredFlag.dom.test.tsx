import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, renderHook } from '@testing-library/react';
import { useDeferredFlag } from './useDeferredFlag';

/**
 * The whole value of this hook is what it does *not* render, which is invisible to every other
 * kind of test. Fake timers make the two edges checkable exactly: nothing before the delay,
 * something after it, and nothing at all when the wait ends first.
 */

describe('useDeferredFlag', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('shows nothing while the wait is still short', () => {
    const { result } = renderHook(() => useDeferredFlag(true, 250));

    expect(result.current).toBe(false);

    act(() => {
      jest.advanceTimersByTime(249);
    });
    expect(result.current).toBe(false);
  });

  it('shows once the wait has gone on long enough to be worth admitting', () => {
    const { result } = renderHook(() => useDeferredFlag(true, 250));

    act(() => {
      jest.advanceTimersByTime(250);
    });
    expect(result.current).toBe(true);
  });

  it('never shows for a wait that ends before the delay', () => {
    /* The flash this exists to prevent: a fast fetch that would otherwise paint a spinner and
       remove it a frame later, so the only thing anybody notices is the page moving. */
    const { rerender, result } = renderHook(({ active }) => useDeferredFlag(active, 250), {
      initialProps: { active: true },
    });

    act(() => {
      jest.advanceTimersByTime(100);
    });
    rerender({ active: false });

    expect(result.current).toBe(false);

    act(() => {
      jest.advanceTimersByTime(1000);
    });
    /* The cancelled timer must not fire later and light up a spinner over content that has
       already arrived. */
    expect(result.current).toBe(false);
  });

  it('hides immediately, without waiting out a second delay', () => {
    /* Only the rising edge is deferred. Holding a spinner on after the answer arrives would be
       adding the delay this hook exists to remove. */
    const { rerender, result } = renderHook(({ active }) => useDeferredFlag(active, 250), {
      initialProps: { active: true },
    });

    act(() => {
      jest.advanceTimersByTime(300);
    });
    expect(result.current).toBe(true);

    rerender({ active: false });
    expect(result.current).toBe(false);
  });

  it('defers again on a second wait rather than staying on from the first', () => {
    const { rerender, result } = renderHook(({ active }) => useDeferredFlag(active, 250), {
      initialProps: { active: true },
    });

    act(() => {
      jest.advanceTimersByTime(300);
    });
    rerender({ active: false });
    rerender({ active: true });

    expect(result.current).toBe(false);

    act(() => {
      jest.advanceTimersByTime(250);
    });
    expect(result.current).toBe(true);
  });
});
