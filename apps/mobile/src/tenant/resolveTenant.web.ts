import { slugForHost } from './customDomains';
import { readRecentTenants } from './recentTenants';
import { firstResolved, slugFromPath, type TenantResolution } from './tenantResolution';

/**
 * Web: hostname, then path, then where this browser was last.
 *
 * The hostname comes first because a custom domain is a stronger statement than anything else
 * available — somebody typed `lila-and-sam.com`, and serving them the discover page because the
 * path happened to be `/` would be the site failing to be its own site. ADR-0003 keeps this to a
 * lookup: no pattern matching, no hostname anywhere in a route.
 *
 * The path is the canonical route (D9) and the one that always works. Storage is last and rarely
 * reached — a browser has a URL — and exists for the person who opens the bare origin having
 * been to an event before.
 */
export const resolveTenant = async (): Promise<TenantResolution> => {
  const url = currentUrl();
  /* The head of the list: where this device was last. The rest of it is the join
     screen's picker, which is the same data made visible. */
  const [recent] = await readRecentTenants();

  return firstResolved([
    ['domain', url === null ? null : slugForHost(url.hostname)],
    ['path', url === null ? null : slugFromPath(url.pathname)],
    ['recent', recent?.slug ?? null],
  ]);
};

/**
 * The two parts of the URL this cares about, or `null` where there is no URL.
 *
 * A static export's prerender runs with no DOM, so `globalThis.location` is absent and
 * destructuring it throws. `lib.dom` types it as always present — an optional chain would be
 * removed as dead code by the same lint rule that reads those types — so the absence is caught
 * rather than tested for, and an absent location contributes no candidates instead of failing a
 * render.
 */
const currentUrl = (): { hostname: string; pathname: string } | null => {
  try {
    const { hostname, pathname } = globalThis.location;
    return { hostname, pathname };
  } catch {
    return null;
  }
};
