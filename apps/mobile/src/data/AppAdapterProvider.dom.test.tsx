import { userId } from '@occasio/core';
import { describe, expect, it } from '@jest/globals';
import { renderHook } from '@testing-library/react';
import { useBoundAdapter } from './AppAdapterProvider';

/**
 * The adapter carries the identity every tenant check inside it is made against, so an adapter
 * that outlives a change of account answers for the wrong person. Invisible today, because the
 * identity is a constant — and an account boundary that does not move the day sign-in lands.
 */

const A = userId('u_sanit');
const B = userId('u_meera');

const bound = () =>
  renderHook(({ id }: { id: typeof A }) => useBoundAdapter(id), { initialProps: { id: A } });

describe('useBoundAdapter', () => {
  it('keeps one adapter while the identity does not change', () => {
    /* Rebuilding per render would throw away the mock's in-memory state and every live
       subscription with it, which is what the lazy initialiser is protecting. */
    const { rerender, result } = bound();
    const first = result.current;

    rerender({ id: A });

    expect(result.current).toBe(first);
  });

  it('builds a new adapter when the identity changes', () => {
    /*
     * `createMockAdapter` captures `currentUserId` as `me`, so an initialiser that runs once
     * pins every membership and visibility check to whoever was signed in when this mounted.
     * Somebody signing out and back in as another account would read the first person's events.
     */
    const { rerender, result } = bound();
    const first = result.current;

    rerender({ id: B });

    expect(result.current).not.toBe(first);
  });

  it('goes back to a fresh adapter rather than reviving the first', () => {
    /* Returning to an identity must not resurrect state from before the switch — the mock holds
       writes in memory, and a revived instance would carry the previous session's across. */
    const { rerender, result } = bound();
    const first = result.current;

    rerender({ id: B });
    rerender({ id: A });

    expect(result.current).not.toBe(first);
  });
});
