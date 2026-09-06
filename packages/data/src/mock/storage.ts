/**
 * The storage port the mock adapter writes through, and the three bindings that satisfy it.
 *
 * The adapter itself never names `localStorage` or `AsyncStorage`. It is handed a `MockStorage`
 * and does not know which one it has, which is what keeps a demo running identically in a
 * browser, in Jest, and on a phone — and what makes "does persistence work" a question a unit
 * test can answer without a DOM.
 *
 * The port is async even though `localStorage` is not. The native binding cannot be: React
 * Native's AsyncStorage is a promise API, so a synchronous port would have been rewritten the
 * first time the mock ran on a device, and every call site with it.
 *
 * Which binding is the default is a platform question, and it is answered by the platform split
 * in `defaultStorage.ts` / `defaultStorage.web.ts` rather than by a runtime `Platform.OS` check
 * here — Metro resolves the right file and the wrong one is never bundled.
 */

/**
 * Read, write, remove — the whole surface. No `clear()`: the mock owns one key and clearing the
 * store would take the host app's own data with it, which is exactly the kind of collateral a
 * "reset demo data" button must not have.
 */
export type MockStorage = {
  readonly read: (key: string) => Promise<string | null>;
  readonly write: (key: string, value: string) => Promise<void>;
  readonly remove: (key: string) => Promise<void>;
};

/**
 * A `Map` behind the port. This is the binding tests use, and the fallback whenever a real store
 * is unavailable — a private browsing window, a browser with site data blocked, a server render.
 *
 * Losing writes on reload is a worse demo, but it is a working one; throwing on the first write
 * instead would take the whole app down for a storage quota.
 */
export const createMemoryStorage = (
  initial?: Readonly<Record<string, string>>,
): MockStorage & { readonly snapshot: () => Readonly<Record<string, string>> } => {
  const store = new Map<string, string>(Object.entries(initial ?? {}));
  return {
    read: (key) => Promise.resolve(store.get(key) ?? null),
    write: (key, value) => {
      store.set(key, value);
      return Promise.resolve();
    },
    remove: (key) => {
      store.delete(key);
      return Promise.resolve();
    },
    /** Test-only view of what was actually written, so persistence can be asserted directly. */
    snapshot: () => Object.fromEntries(store),
  };
};

/**
 * The synchronous shape `localStorage` and `sessionStorage` both have.
 *
 * Declared structurally rather than imported from `lib.dom` because this package compiles with
 * `lib: ["ES2023"]` and no DOM — the data layer has to typecheck on a server and in a React
 * Native bundle, neither of which has a `Window`.
 */
export type WebStorageLike = {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
};

/** The promise API of `@react-native-async-storage/async-storage`, structurally. */
export type AsyncStorageLike = {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
  removeItem: (key: string) => Promise<void>;
};

/**
 * Wraps a synchronous web store.
 *
 * Every call is guarded, because `localStorage` throws rather than returning null in two
 * ordinary situations: Safari's private mode on older versions, and any browser that has hit its
 * ~5MB quota. A demo dataset plus a few writes is nowhere near the quota, but a thrown
 * `QuotaExceededError` inside a repository read would surface as a broken screen, and the honest
 * behaviour for a mock is to lose the write, not the app.
 */
export const createWebStorage = (store: WebStorageLike): MockStorage => ({
  read: (key) => {
    try {
      return Promise.resolve(store.getItem(key));
    } catch {
      return Promise.resolve(null);
    }
  },
  write: (key, value) => {
    try {
      store.setItem(key, value);
    } catch {
      /* Quota or a blocked store: the demo continues from memory. */
    }
    return Promise.resolve();
  },
  remove: (key) => {
    try {
      store.removeItem(key);
    } catch {
      /* Nothing to do — the value the caller wanted gone is unreachable either way. */
    }
    return Promise.resolve();
  },
});

/**
 * Wraps React Native's AsyncStorage, or anything with its three methods.
 *
 * Taking the store as an argument rather than importing it keeps
 * `@react-native-async-storage/async-storage` out of this package's dependencies: the data layer
 * has no React Native dependency today, and adding one so a mock can persist would put a native
 * module in the way of every server-side and test import of `@occasio/data`. The app wires it in
 * one line at its root.
 */
export const createAsyncStorage = (store: AsyncStorageLike): MockStorage => ({
  read: async (key) => {
    try {
      return await store.getItem(key);
    } catch {
      return null;
    }
  },
  write: async (key, value) => {
    try {
      await store.setItem(key, value);
    } catch {
      /* Same reasoning as the web binding: a failed write must not fail the read that follows. */
    }
  },
  remove: async (key) => {
    try {
      await store.removeItem(key);
    } catch {
      /* Ditto. */
    }
  },
});

/**
 * A structural check rather than a cast, because `globalThis.localStorage` is `unknown` in a
 * package with no DOM lib and casts are legal in two files, neither of which is this one.
 */
export const isWebStorageLike = (value: unknown): value is WebStorageLike =>
  typeof value === 'object' &&
  value !== null &&
  'getItem' in value &&
  typeof value.getItem === 'function' &&
  'setItem' in value &&
  typeof value.setItem === 'function' &&
  'removeItem' in value &&
  typeof value.removeItem === 'function';

/**
 * `globalThis.localStorage`, or `null` where there is none.
 *
 * `Reflect.get` rather than a property access so that reading it cannot itself throw: a browser
 * configured to block site data raises a `SecurityError` on the *getter*, before any method is
 * called, and that is a crash on module load rather than a caught write failure.
 */
export const findWebStorage = (): WebStorageLike | null => {
  let candidate: unknown;
  try {
    candidate = Reflect.get(globalThis, 'localStorage');
  } catch {
    return null;
  }
  return isWebStorageLike(candidate) ? candidate : null;
};
