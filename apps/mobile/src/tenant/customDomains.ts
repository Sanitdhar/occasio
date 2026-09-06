import { isSlug } from './tenantResolution';

/**
 * Which event a custom hostname belongs to.
 *
 * A fixture map today and a `tenant_domains` table later — ADR-0003 says so, and the shape here
 * is chosen to make that swap boring: a lookup from hostname to slug, nothing else. Anything
 * cleverer (patterns, wildcards, per-domain settings) would be a decision made in code that the
 * table then has to reproduce, which is how a hosting concern leaks into the app.
 *
 * Hostnames are lowercased and stripped of a port before lookup, and any `www.` prefix is
 * ignored: `WWW.Lila-And-Sam.com:8081` and `lila-and-sam.com` are the same site to everybody
 * except a string comparison.
 *
 * A hostname that is not in this map is not an error. Almost every request arrives on the app's
 * own domain, where the path carries the slug — which is the canonical route and the one that
 * always works.
 */
const CUSTOM_DOMAINS: Readonly<Record<string, string>> = {
  'lila-and-sam.com': 'lila-and-sam',
  'harvestlights.co.uk': 'harvest-lights',
  'devsummit.example': 'dev-summit-2026',
};

/**
 * The app's own hostnames, which never map to a tenant however they are spelled.
 *
 * Without this, adding `localhost` to the fixture map by accident — or a future table row
 * pointing at the app's own domain — would pin every local page to one event and make the
 * canonical path route unreachable, which is a failure that looks like the router being broken.
 */
const APP_HOSTS = new Set(['localhost', '127.0.0.1', '0.0.0.0', 'occasio.app']);

/** Lowercase, no port, no `www.` — the form the map is keyed by. */
export const normaliseHost = (host: string): string => {
  const withoutPort = host.trim().toLowerCase().split(':')[0] ?? '';
  return withoutPort.startsWith('www.') ? withoutPort.slice(4) : withoutPort;
};

/**
 * The lookup, against a map given to it.
 *
 * Separated from the fixture so the guard below can be tested against a map that actually
 * contains an app hostname. Written against `CUSTOM_DOMAINS` alone it could not be: no app host
 * is in there today, so the guard never fired and removing it changed no test — which is the
 * whole failure it exists to prevent, one level up.
 *
 * That the map becomes a `tenant_domains` table is exactly why: a row an operator can write is
 * the input this guard is for, and by then there is no fixture to inspect.
 */
export const slugFor = (domains: Readonly<Record<string, string>>, host: string): string | null => {
  const normalised = normaliseHost(host);
  if (normalised === '' || APP_HOSTS.has(normalised)) return null;
  const slug = domains[normalised];
  /* Checked against `isSlug` rather than trusted, for the same reason: a row written by an
     operator should not be able to hand a path segment to the router unexamined. */
  return slug !== undefined && isSlug(slug) ? slug : null;
};

/** The slug a hostname stands for, or `null` when it stands for nothing. */
export const slugForHost = (host: string): string | null => slugFor(CUSTOM_DOMAINS, host);
