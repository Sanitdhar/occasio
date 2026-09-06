import {
  parseRecentTenants,
  serialise,
  withMostRecent,
  LEGACY_KEY,
  RECENT_KEY,
  type RecentTenant,
} from './recentTenants.shared';

/**
 * Web: the events this browser has opened.
 *
 * `localStorage` is read through a `try` on both sides, because it is not a variable: Safari in
 * private mode throws on write, an embedded webview can have site data disabled, and a runtime
 * with no DOM — a static export's prerender — has no such property at all. `lib.dom` types it as
 * always present, so an optional chain would be removed as dead code by the same lint rule that
 * reads those types; the absence is caught instead.
 */

const readRaw = (): { readonly value: string | null; readonly legacy: boolean } => {
  const current = globalThis.localStorage.getItem(RECENT_KEY);
  if (current !== null) return { value: current, legacy: false };
  return { value: globalThis.localStorage.getItem(LEGACY_KEY), legacy: true };
};

export const readRecentTenants = async (): Promise<RecentTenant[]> => {
  try {
    const { value, legacy } = readRaw();
    const parsed = parseRecentTenants(value);
    /* Migrated on the spot rather than read through the old key forever — otherwise every read
       for the rest of this installation's life pays for a version nobody runs any more. */
    if (legacy && parsed.length > 0) await write(parsed);
    return parsed;
  } catch {
    return [];
  }
};

const write = (entries: readonly RecentTenant[]): Promise<void> =>
  serialise(() => {
    globalThis.localStorage.setItem(RECENT_KEY, JSON.stringify(entries));
    globalThis.localStorage.removeItem(LEGACY_KEY);
    return Promise.resolve();
  });

export const rememberTenant = (entry: RecentTenant): Promise<void> =>
  /*
   * The whole read-modify-write is queued, not just the write. Two of these in flight would
   * otherwise both read the same list and the later one would discard the other's event.
   */
  serialise(() => {
    try {
      const { value } = readRaw();
      const next = withMostRecent(parseRecentTenants(value), entry);
      globalThis.localStorage.setItem(RECENT_KEY, JSON.stringify(next));
      globalThis.localStorage.removeItem(LEGACY_KEY);
    } catch {
      /* The app works; it just will not remember. */
    }
    /* Synchronous on web and asynchronous on native, behind one promise-returning signature —
       the queue is what makes the two the same shape to the caller. */
    return Promise.resolve();
  });
