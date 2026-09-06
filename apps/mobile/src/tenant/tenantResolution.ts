/**
 * Where the current event comes from, before anything is fetched.
 *
 * D9 makes `/e/[slug]/…` the canonical route forever, and ADR-0003 is explicit that a hostname
 * is never a routing concern inside the app — no bundler has a `Host` header, and custom
 * domains are an edge rewrite plus a lookup table in every stack there is. So the app's job is
 * narrower than "work out the tenant": it is to turn whatever the platform can tell it into a
 * slug, or to say honestly that it cannot.
 *
 * The two platforms have nothing in common here. Web has a URL and reads the hostname, then the
 * path. Native has no URL bar at all, so it reads the deep link it was opened with, then the
 * last event this device visited. One abstraction, two implementations — and this file is the
 * half that belongs to neither, so it can be tested without a platform.
 */

/**
 * How a slug was arrived at.
 *
 * Kept on the resolved state rather than discarded because the answer to "what now" differs by
 * source: a slug from a custom domain that turns out not to exist is a misconfigured domain,
 * and the same slug typed into a path is a typo. #40 is where that distinction is spent.
 */
export type TenantSource = 'domain' | 'path' | 'link' | 'recent';

/**
 * Resolution as a union rather than a slug plus flags.
 *
 * `{ slug: string | null, loading: boolean }` admits four combinations, two of which are
 * nonsense — resolved-and-loading, and not-loading-with-no-slug-and-no-explanation — and the
 * screens would each invent their own reading of them. Three states, and every one of them
 * means exactly one thing.
 */
export type TenantResolution =
  /** Still looking. Native reads storage asynchronously, so this is a real state, not a flicker. */
  | { readonly kind: 'resolving' }
  | { readonly kind: 'resolved'; readonly slug: string; readonly source: TenantSource }
  /**
   * Nothing to resolve from: a first native launch with no deep link and no history, or a web
   * URL that names no event. Not an error — it is the state the join-by-code screen (#41) and
   * the discover page (#42) exist to answer.
   */
  | { readonly kind: 'unresolved' };

export const resolving: TenantResolution = { kind: 'resolving' };
export const unresolved: TenantResolution = { kind: 'unresolved' };

export const resolvedAs = (slug: string, source: TenantSource): TenantResolution => ({
  kind: 'resolved',
  slug,
  source,
});

/**
 * A slug is a path segment, so it has to survive being one.
 *
 * Rejecting rather than escaping: a slug arrives from a hostname map, a URL or this device's own
 * storage, and every one of those can hold something that was never a slug — a stale key, a
 * hand-edited link, a path traversal. Somewhere below this a slug is concatenated into a route
 * and sent to a repository, and "looks like a slug" is the last point where that is cheap to
 * insist on.
 *
 * Lowercase alphanumerics and single hyphens, 1–64 characters, no leading or trailing hyphen —
 * what a URL-safe identifier looks like everywhere, and narrow enough that `..`, `%2e`, a slash
 * and a query string are all outside it.
 */
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const isSlug = (value: string): boolean => value.length <= 64 && SLUG.test(value);

/**
 * The slug in a canonical path, if it is one.
 *
 * Only `/e/<slug>`, because D9 says that is the shape forever. A path this does not recognise is
 * not a tenant route — the discover page and the join screen live outside `/e/` on purpose — so
 * answering `null` is the correct reading rather than a failure to parse.
 */
export const slugFromPath = (pathname: string): string | null => {
  const segments = pathname.split('/').filter((segment) => segment !== '');
  const [prefix, slug] = segments;
  if (prefix !== 'e' || slug === undefined) return null;
  /* Percent-encoding is decoded before matching, so `%2e%2e` cannot arrive looking like a slug.
     A malformed sequence throws rather than returning something half-decoded. */
  let decoded: string;
  try {
    decoded = decodeURIComponent(slug);
  } catch {
    return null;
  }
  return isSlug(decoded) ? decoded : null;
};

/**
 * The first source that produces a slug, in the order given.
 *
 * The order is the whole policy — a deep link the user just followed beats the event they
 * happened to open last week — so it is expressed as a list at the call site rather than nested
 * conditionals here, where it would be a paragraph to read instead of a line.
 */
export const firstResolved = (
  candidates: readonly (readonly [TenantSource, string | null])[],
): TenantResolution => {
  for (const [source, slug] of candidates) {
    if (slug !== null && isSlug(slug)) return resolvedAs(slug, source);
  }
  return unresolved;
};
