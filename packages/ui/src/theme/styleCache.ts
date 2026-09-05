/**
 * A bounded, least-recently-used cache keyed by theme id.
 *
 * Kept free of React and React Native so the eviction policy can be tested directly rather than
 * only through a rendered component — the bound is the whole point of this file, and a bound
 * that is only exercised incidentally is a bound nobody has checked.
 *
 * Why bounded at all: the theme editor resolves a new theme on every frame of a colour-picker
 * drag, each with its own id. An unbounded cache would retain a StyleSheet for every intermediate
 * colour the admin passed through on the way to the one they wanted.
 */

/** Small on purpose: an app renders one theme, and the editor needs the draft plus a preview. */
export const DEFAULT_MAX_THEMES = 8;

export type StyleCache<T> = {
  /** Returns the cached value for `id`, building and storing it if absent. */
  readonly get: (id: string, build: () => T) => T;
  /** Number of themes currently retained. Exposed for tests and diagnostics. */
  readonly size: () => number;
  /** Ids currently retained, least-recently-used first. */
  readonly keys: () => readonly string[];
};

export const createStyleCache = <T>(maxThemes: number = DEFAULT_MAX_THEMES): StyleCache<T> => {
  /* `maxThemes < 1` was not a bound: Infinity passed it, and `size > Infinity` is never true,
     so eviction never ran and the cache this module exists to bound grew without limit. */
  if (!Number.isInteger(maxThemes) || maxThemes < 1) {
    throw new RangeError(
      `A style cache must retain a whole number of themes, at least one; got ${String(maxThemes)}`,
    );
  }

  /* Map iterates in insertion order, so re-inserting on a hit makes the first key the
     least recently used one. That is the whole LRU implementation.
     Values are boxed so a *cached* `undefined` is distinguishable from a miss without a
     type assertion: an unboxed `get()` returning undefined is ambiguous, and reading it as a
     miss would rebuild on every call, quietly turning the cache off for that value. */
  const entries = new Map<string, { readonly value: T }>();

  return {
    get: (id, build) => {
      const hit = entries.get(id);
      if (hit !== undefined) {
        entries.delete(id);
        entries.set(id, hit);
        return hit.value;
      }

      const created = { value: build() };
      entries.set(id, created);

      if (entries.size > maxThemes) {
        const oldest = entries.keys().next().value;
        if (oldest !== undefined) entries.delete(oldest);
      }
      return created.value;
    },
    size: () => entries.size,
    keys: () => [...entries.keys()],
  };
};
