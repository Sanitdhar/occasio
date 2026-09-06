/**
 * A controllable `matchMedia`, installed before any module is imported.
 *
 * The timing is the whole point. react-native-web captures the media query list once, at module
 * load — `var prefersReducedMotionMedia = canUseDOM && ... ? window.matchMedia(...) : null` —
 * so a stub installed inside a test arrives after that constant is already `null`, and the
 * library's entire reduce-motion channel is inert for the rest of the run. Tests written
 * against it then pass or fail for reasons that have nothing to do with the code under test.
 *
 * Installed from `setupFiles`, which runs before the test module and its imports.
 */

type MediaListener = (event: { readonly matches: boolean }) => void;

const state = { reduced: false };
/*
 * Listeners are kept with the query they registered for. A browser only notifies the listeners
 * of a query whose result actually changed, so notifying all of them would let a test observe
 * an event no browser can emit — and the listener's own `matches` would still say `false`,
 * which is a contradiction a test could be written against by accident.
 */
const listeners = new Map<MediaListener, string>();

const REDUCED_MOTION = 'prefers-reduced-motion';

export const installMatchMedia = (): void => {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: (query: string) => ({
      media: query,
      get matches() {
        /* Live rather than captured: react-native-web reads `.matches` on every call, and a
           frozen value would make `setReducedMotion` silently do nothing. */
        return query.includes(REDUCED_MOTION) && state.reduced;
      },
      onchange: null,
      addEventListener: (_event: string, fn: MediaListener) => listeners.set(fn, query),
      removeEventListener: (_event: string, fn: MediaListener) => listeners.delete(fn),
      /* The deprecated pair, which is the one react-native-web falls back to. */
      addListener: (fn: MediaListener) => listeners.set(fn, query),
      removeListener: (fn: MediaListener) => listeners.delete(fn),
      dispatchEvent: () => true,
    }),
  });
};

/** Sets the preference and notifies every listener, as a browser does. */
export const setReducedMotion = (reduced: boolean): void => {
  state.reduced = reduced;
  for (const [listener, query] of [...listeners]) {
    if (query.includes(REDUCED_MOTION)) listener({ matches: reduced });
  }
};

/** Back to the default, with no listeners left over between tests. */
export const resetReducedMotion = (): void => {
  state.reduced = false;
  listeners.clear();
};
