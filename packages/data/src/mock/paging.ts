import { ValidationError } from '../errors';
import {
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  type Cursor,
  type Page,
  type PageRequest,
} from '../pagination';

/**
 * Keyset pagination over an in-memory array.
 *
 * The mock could return every fixture row from one call and nothing would break today. It pages
 * anyway, and it pages the way Postgres will — by sort key rather than by offset — because the
 * point of the mock is to be wrong in the same places the real backend will be. A screen that
 * only works because `list()` returned everything is a screen that breaks on the first event with
 * two hundred sessions, and it breaks after the swap, when the change that caused it is a month
 * old.
 *
 * The cursor names a position in an ordering: `(sortKey, id)`. An insert above it changes
 * nothing, which is the property an offset does not have and the reason a gossip board paged by
 * offset repeats the post that page 1 ended on.
 */

/** Identifies cursors this adapter minted, so one from another adapter is rejected, not misread. */
const CURSOR_PREFIX = 'mockv1.';

/**
 * `Cursor` is documented as opaque: produced by an adapter and handed back unread. This encoding
 * is percent-encoded JSON rather than something unreadable, because obfuscating it would only
 * make debugging harder — what actually stops anything above the data layer parsing it is that
 * the shape is undocumented and adapter-specific, and the prefix check below turns a cursor
 * carried across the Supabase swap into a `ValidationError` instead of a wrong page.
 */
export const encodeCursor = (sortKey: string, id: string): Cursor =>
  CURSOR_PREFIX + encodeURIComponent(JSON.stringify([sortKey, id]));

const isStringPair = (value: unknown): value is readonly [string, string] =>
  Array.isArray(value) &&
  value.length === 2 &&
  typeof value[0] === 'string' &&
  typeof value[1] === 'string';

export const decodeCursor = (cursor: Cursor): { readonly sortKey: string; readonly id: string } => {
  const reject = (): never => {
    throw new ValidationError([
      { path: 'page.cursor', message: 'Not a cursor issued by the mock adapter' },
    ]);
  };
  if (!cursor.startsWith(CURSOR_PREFIX)) return reject();
  let parsed: unknown;
  try {
    parsed = JSON.parse(decodeURIComponent(cursor.slice(CURSOR_PREFIX.length)));
  } catch {
    return reject();
  }
  if (!isStringPair(parsed)) return reject();
  return { sortKey: parsed[0], id: parsed[1] };
};

/**
 * Numbers as lexicographically comparable strings, so one string comparison orders every
 * collection regardless of what it sorts on.
 *
 * The offset is what makes negatives work: `-1` becomes a smaller string than `0` only once both
 * are shifted into a fixed-width positive range. The bound is generous enough for epoch
 * milliseconds (~1.8e12 today) and for any `sort_order` a human will type, and a value outside it
 * is a bug worth hearing about rather than silently sorting wrong.
 */
const KEY_OFFSET = 1e15;
const KEY_WIDTH = 16;

export const numericKey = (value: number, path: string): string => {
  if (!Number.isFinite(value) || Math.abs(value) >= KEY_OFFSET) {
    throw new ValidationError([{ path, message: `Cannot order on ${String(value)}` }]);
  }
  return (Math.trunc(value) + KEY_OFFSET).toString().padStart(KEY_WIDTH, '0');
};

/**
 * A timestamp as a sort key, via epoch milliseconds rather than the string itself.
 *
 * Two ISO strings for the same instant can differ (`+00:00` versus `Z`, and any non-UTC offset),
 * so comparing them as text orders rows by how they were written rather than by when they
 * happened. Parsing first makes the ordering a property of the instant.
 */
export const timestampKey = (value: string, path: string): string => {
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) {
    throw new ValidationError([{ path, message: `Not an ISO 8601 timestamp: ${value}` }]);
  }
  return numericKey(parsed, path);
};

export type Order = 'asc' | 'desc';

export type PageSpec<T> = {
  /** The rows to page over, unsorted. */
  readonly items: readonly T[];
  /** The ordering key. Must be a total order once combined with `id` — ties break on the id. */
  readonly sortKey: (item: T) => string;
  readonly id: (item: T) => string;
  readonly order: Order;
  readonly page: PageRequest | undefined;
};

/**
 * Clamps rather than rejects a large `limit`, and rejects a nonsensical one.
 *
 * `pagination.ts` is explicit that asking for 10,000 returns a page rather than an error — a
 * caller over-asking is a caller who will read `items.length` — whereas a limit of zero, a
 * negative or a fraction is a bug in the caller that returning an empty page would hide.
 */
export const resolveLimit = (limit: number | undefined): number => {
  if (limit === undefined) return DEFAULT_PAGE_SIZE;
  if (!Number.isInteger(limit) || limit < 1) {
    throw new ValidationError([{ path: 'page.limit', message: 'Expected an integer >= 1' }]);
  }
  return Math.min(limit, MAX_PAGE_SIZE);
};

type Position = { readonly sortKey: string; readonly id: string };

/** Ascending order on `(sortKey, id)`. The id is the tiebreak that makes the order total. */
const compare = (left: Position, right: Position): number => {
  if (left.sortKey !== right.sortKey) return left.sortKey < right.sortKey ? -1 : 1;
  if (left.id === right.id) return 0;
  return left.id < right.id ? -1 : 1;
};

export const paginate = <T>(spec: PageSpec<T>): Page<T> => {
  const limit = resolveLimit(spec.page?.limit);
  const direction = spec.order === 'asc' ? 1 : -1;

  const keyed = spec.items
    .map((item) => ({ item, sortKey: spec.sortKey(item), id: spec.id(item) }))
    .sort((left, right) => direction * compare(left, right));

  const cursor = spec.page?.cursor;
  let start = 0;
  if (cursor !== undefined) {
    const after = decodeCursor(cursor);
    /*
     * The position is found by comparison, not by looking the id up: the row the cursor names may
     * have been deleted, or moderated out of the caller's filter, between pages — and an index
     * lookup would silently restart the collection from the top when that happened.
     *
     * `> 0` rather than `>= 0` is what excludes the cursor row itself. Getting that wrong repeats
     * one item on every page boundary, which is exactly the offset-pagination bug this replaces.
     */
    const index = keyed.findIndex((entry) => direction * compare(entry, after) > 0);
    start = index === -1 ? keyed.length : index;
  }

  const slice = keyed.slice(start, start + limit);
  const last = slice.at(-1);
  const hasMore = start + slice.length < keyed.length;

  return {
    items: slice.map((entry) => entry.item),
    nextCursor: hasMore && last !== undefined ? encodeCursor(last.sortKey, last.id) : null,
  };
};
