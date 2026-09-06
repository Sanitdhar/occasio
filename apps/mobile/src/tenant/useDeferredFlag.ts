import { useEffect, useRef, useState } from 'react';

/**
 * A flag that only becomes true once it has stayed true for long enough to be worth showing.
 *
 * A loading state that appears and disappears inside a frame or two is worse than no loading
 * state: the page moves for no reason, and what somebody notices is the flicker rather than the
 * content that arrived. A cached tenant never reaches the loading branch at all — that is
 * TanStack's doing, not this hook's — but a fast fetch does, and it is the one that flashes.
 *
 * Only the rising edge is delayed. Going false is immediate, because the reason to stop showing
 * a spinner is that the answer arrived, and holding it a moment longer to satisfy a timer would
 * be adding the delay this exists to remove.
 */
export const useDeferredFlag = (active: boolean, delayMs: number): boolean => {
  const [shown, setShown] = useState(false);
  /* Held in a ref so a caller passing a literal cannot restart the timer on every render. */
  const delay = useRef(delayMs);
  delay.current = delayMs;

  useEffect(() => {
    if (!active) {
      setShown(false);
      return;
    }

    const timer = setTimeout(() => {
      setShown(true);
    }, delay.current);

    return () => {
      clearTimeout(timer);
    };
  }, [active]);

  /*
   * `active` gates the result as well as the timer: a flag that has gone false must stop being
   * shown on *that* render, not one render later when the effect runs. Without it there is a
   * single frame where the spinner is painted over content that has already arrived — which is
   * the flash this hook exists to remove, arriving at the other end.
   *
   * Not separately covered by a test, and worth saying rather than implying: React runs effects
   * before `rerender` returns under `act`, so the stale frame the conjunct removes is invisible
   * to anything @testing-library can observe. Deleting it passes the suite. It is kept on the
   * reasoning above, not on a green run.
   */
  return active && shown;
};
