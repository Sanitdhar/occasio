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
const listeners = new Set<MediaListener>();

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
      addEventListener: (_event: string, fn: MediaListener) => listeners.add(fn),
      removeEventListener: (_event: string, fn: MediaListener) => listeners.delete(fn),
      addListener: (fn: MediaListener) => listeners.add(fn),
      removeListener: (fn: MediaListener) => listeners.delete(fn),
      dispatchEvent: () => true,
    }),
  });
};

/** Sets the preference and notifies every listener, as a browser does. */
export const setReducedMotion = (reduced: boolean): void => {
  state.reduced = reduced;
  for (const listener of [...listeners]) listener({ matches: reduced });
};

/** Back to the default, with no listeners left over between tests. */
export const resetReducedMotion = (): void => {
  state.reduced = false;
  listeners.clear();
};
