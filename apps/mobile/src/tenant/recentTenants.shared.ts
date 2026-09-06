import { isSlug } from './tenantResolution';

/**
 * The events this device has actually opened, newest first.
 *
 * Shared between the two storage implementations, because the interesting part is not reading a
 * string — it is deciding what a stored string is allowed to become. Everything here runs on
 * both platforms and needs neither.
 */

export type RecentTenant = {
  readonly slug: string;
  /** Kept alongside the slug so the picker can render a list without a request per row. */
  readonly name: string;
};

export const RECENT_KEY = 'occasio.recentTenants';

/**
 * Where the previous version kept a single slug.
 *
 * Read only when `RECENT_KEY` is absent, and migrated on the spot. Without this an installation
 * that upgrades mid-event silently forgets where it was — and on native, where the recent list
 * is most of the answer to "where was I", that means a returning attendee lands on a join screen
 * holding a code they were given once, weeks ago.
 */
export const LEGACY_KEY = 'occasio.recentTenant';

/** Enough to recognise an event you were at; short enough to stay a list rather than a history. */
export const RECENT_LIMIT = 8;

/** A name is shown to a person, so it is trimmed and bounded rather than trusted to be sensible. */
const MAX_NAME = 120;

/**
 * `Array.isArray` narrows `unknown` to `any[]`, which puts an `any` into every entry below and
 * defeats the point of parsing carefully. A guard of our own lands on `readonly unknown[]`, so
 * each entry stays something that has to be asked about rather than assumed.
 */
const isUnknownArray = (value: unknown): value is readonly unknown[] => Array.isArray(value);

const cleanName = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim().slice(0, MAX_NAME);
  return trimmed === '' ? null : trimmed;
};

/**
 * What survives being read back.
 *
 * Storage is not a variable: this was written by an older build of the app, or edited in a
 * simulator, and a slug from it is about to become a path segment. An entry that does not
 * survive is dropped rather than rejecting the whole list — one bad row should not cost somebody
 * the other seven.
 */
export const parseRecentTenants = (raw: string | null): RecentTenant[] => {
  if (raw === null) return [];

  /*
   * The previous version of this stored a bare slug under a different key, and somebody who
   * upgrades mid-event should not lose the shortcut. A value that is not JSON but is a slug is
   * read as a one-entry list named after itself — the name is replaced the moment they open it.
   */
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return isSlug(raw) ? [{ slug: raw, name: raw }] : [];
  }

  if (!isUnknownArray(parsed)) return [];

  const seen = new Set<string>();
  const out: RecentTenant[] = [];

  for (const entry of parsed) {
    /* Narrowed by asking, not by asserting: this came out of `JSON.parse`, so its type is
       whatever was on disk, and a cast here would be a promise about a file. */
    if (entry === null || typeof entry !== 'object') continue;
    if (!('slug' in entry)) continue;
    const { slug } = entry;
    if (typeof slug !== 'string' || !isSlug(slug) || seen.has(slug)) continue;

    const cleaned = 'name' in entry ? cleanName(entry.name) : null;
    seen.add(slug);
    out.push({ slug, name: cleaned ?? slug });
    if (out.length === RECENT_LIMIT) break;
  }

  return out;
};

/**
 * One storage update at a time.
 *
 * `rememberTenant` is read-modify-write across two awaits, so two of them in flight — a deep
 * link resolving while the gate loads another event, a fast tab switch — can both read the same
 * list and the later write silently discards the other's entry. The list is small and the fix is
 * a queue rather than a lock: each task starts only when the last one has settled.
 *
 * A failing task must not poison the queue, so the stored chain swallows rejections while the
 * caller still sees its own.
 */
let chain: Promise<unknown> = Promise.resolve();

export const serialise = <T>(task: () => Promise<T>): Promise<T> => {
  const next = chain.then(task, task);
  chain = next.catch(() => undefined);
  return next;
};

/**
 * The list after opening an event: that event first, no duplicates, capped.
 *
 * Pure, so the ordering rule is checkable without a storage engine — and the ordering rule is
 * the whole feature. A list that appended would put the event somebody opens most often at the
 * bottom and eventually off the end.
 */
export const withMostRecent = (
  existing: readonly RecentTenant[],
  entry: RecentTenant,
): RecentTenant[] => {
  const name = cleanName(entry.name) ?? entry.slug;
  const rest = existing.filter((candidate) => candidate.slug !== entry.slug);
  return [{ slug: entry.slug, name }, ...rest].slice(0, RECENT_LIMIT);
};
