import { isSlug } from './tenantResolution';

/**
 * Web: the last event this browser opened.
 *
 * Barely used, and kept for symmetry rather than as a shortcut — a browser has a URL, and the
 * URL is the answer. It matters at exactly one moment: someone opening the app's bare origin,
 * who has been to an event before. Web resolution tries the hostname, then the path, then this.
 *
 * `localStorage` is read through a `try` on both sides, because it is not a variable: Safari in
 * private mode throws on write, an embedded webview can have site data disabled entirely, and a
 * page served from a `file://` origin throws on access itself. The same `try` covers a runtime
 * with no DOM at all — a static export's prerender — where the property is simply absent and
 * calling a method on it throws. `lib.dom` types it as always present, so an optional chain
 * would be deleted as dead code by the very lint rule that reads those types.
 */

const KEY = 'occasio.recentTenant';

export const readRecentTenant = (): Promise<string | null> => {
  try {
    const stored = globalThis.localStorage.getItem(KEY);
    /* Validated rather than trusted: it is about to become a path segment, and what came back
       was written by an older build or by whoever had the developer console open. */
    return Promise.resolve(stored !== null && isSlug(stored) ? stored : null);
  } catch {
    return Promise.resolve(null);
  }
};

export const writeRecentTenant = (slug: string): Promise<void> => {
  if (isSlug(slug)) {
    try {
      globalThis.localStorage.setItem(KEY, slug);
    } catch {
      /* Private mode, a disabled store, a quota. The app works; it just will not remember. */
    }
  }
  return Promise.resolve();
};
