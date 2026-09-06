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

/**
 * One entry per registration, not per callback.
 *
 * A browser only notifies the listeners of a query whose result actually changed, so a stub
 * that notified all of them would let a test observe an event no browser can emit — the
 * listener would receive `{ matches: true }` while its own `matches` still answered `false`.
 *
 * Keyed by the pair rather than by the callback because the same function can be registered on
 * two different queries: a `Map` keyed by the listener would have the second registration
 * overwrite the first, silently dropping the reduce-motion one and removing the wrong entry on
 * cleanup.
 */
type Registration = { readonly query: string; readonly listener: MediaListener };

const registrations: Registration[] = [];

const REDUCED_MOTION = 'prefers-reduced-motion';

const add = (query: string, listener: MediaListener): void => {
  registrations.push({ query, listener });
};

/** Removes one registration — the matching pair, not every entry for that callback. */
const remove = (query: string, listener: MediaListener): void => {
  const index = registrations.findIndex(
    (entry) => entry.query === query && entry.listener === listener,
  );
  if (index >= 0) registrations.splice(index, 1);
};

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
      addEventListener: (_event: string, fn: MediaListener) => {
        add(query, fn);
      },
      removeEventListener: (_event: string, fn: MediaListener) => {
        remove(query, fn);
      },
      /* The deprecated pair, which is the one react-native-web falls back to. Both go through
         the same store, so a listener added by one API is removed by the other. */
      addListener: (fn: MediaListener) => {
        add(query, fn);
      },
      removeListener: (fn: MediaListener) => {
        remove(query, fn);
      },
      dispatchEvent: () => true,
    }),
  });
};

/** Sets the preference and notifies every listener, as a browser does. */
export const setReducedMotion = (reduced: boolean): void => {
  /* A browser fires `change` when the result changes, not when the value is set again. Emitting
     regardless would let a test pass on a duplicate React update that nothing real produces. */
  if (state.reduced === reduced) return;
  state.reduced = reduced;
  for (const entry of [...registrations]) {
    if (entry.query.includes(REDUCED_MOTION)) entry.listener({ matches: reduced });
  }
};

/** Back to the default, with no listeners left over between tests. */
export const resetReducedMotion = (): void => {
  state.reduced = false;
  registrations.length = 0;
};
