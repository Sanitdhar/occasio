import {
  parseRecentTenants,
  withMostRecent,
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

export const readRecentTenants = (): Promise<RecentTenant[]> => {
  try {
    return Promise.resolve(parseRecentTenants(globalThis.localStorage.getItem(RECENT_KEY)));
  } catch {
    return Promise.resolve([]);
  }
};

export const rememberTenant = async (entry: RecentTenant): Promise<void> => {
  try {
    const next = withMostRecent(await readRecentTenants(), entry);
    globalThis.localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    /* The app works; it just will not remember. */
  }
};
