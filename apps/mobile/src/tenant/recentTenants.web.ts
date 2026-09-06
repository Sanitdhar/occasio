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

/**
 * Move a legacy value under the current key, and report what is actually stored afterwards.
 *
 * Queued, and it re-reads inside the queue rather than trusting what the caller parsed outside
 * it. Between that parse and this task an event can have been remembered — the gate loading one
 * while a deep link resolves another — and writing the parsed legacy list over it would delete
 * the newer event. So a value that has appeared wins, and this reports that value rather than
 * the stale one it was handed.
 */
const migrate = (entries: readonly RecentTenant[]): Promise<RecentTenant[]> =>
  serialise(() => {
    const current = globalThis.localStorage.getItem(RECENT_KEY);
    if (current !== null) {
      /* Superseded, so the old key is dead either way. */
      globalThis.localStorage.removeItem(LEGACY_KEY);
      return Promise.resolve(parseRecentTenants(current));
    }
    globalThis.localStorage.setItem(RECENT_KEY, JSON.stringify(entries));
    globalThis.localStorage.removeItem(LEGACY_KEY);
    return Promise.resolve([...entries]);
  });

export const readRecentTenants = async (): Promise<RecentTenant[]> => {
  let parsed: readonly RecentTenant[];
  let legacy: boolean;
  try {
    const raw = readRaw();
    parsed = parseRecentTenants(raw.value);
    legacy = raw.legacy;
  } catch {
    return [];
  }

  if (!legacy || parsed.length === 0) return [...parsed];

  try {
    return await migrate(parsed);
  } catch {
    /* The read worked and only the write failed — a full quota, a store turned off mid-session.
       Returning `[]` here would throw away a perfectly good answer and blank the picker; the
       legacy key is left in place so the next read can try the move again. */
    return [...parsed];
  }
};

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
