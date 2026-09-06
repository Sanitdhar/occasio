import { describe, expect, it } from '@jest/globals';
import { ValidationError } from '../errors';
import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE, type Cursor, type Page } from '../pagination';
import {
  decodeCursor,
  encodeCursor,
  numericKey,
  paginate,
  resolveLimit,
  timestampKey,
  type Order,
} from './paging';

type Row = { readonly id: string; readonly at: number };

const rows = (count: number): readonly Row[] =>
  Array.from({ length: count }, (_, index) => ({ id: `r${String(index)}`, at: index }));

const spec = (items: readonly Row[], order: Order, page?: { limit?: number; cursor?: Cursor }) => ({
  items,
  sortKey: (row: Row) => numericKey(row.at, 'at'),
  id: (row: Row) => row.id,
  order,
  page,
});

/** Narrows `Cursor | null` by failing the test, rather than by an assertion D16 would reject. */
const nextCursor = (page: Page<Row>): Cursor => {
  if (page.nextCursor === null) throw new Error('expected a further page');
  return page.nextCursor;
};

/** Walks every page to the end, so the assertions are about the whole traversal. */
const walkAll = (items: readonly Row[], order: Order, limit: number): readonly Row[] => {
  const seen: Row[] = [];
  let cursor: Cursor | null = null;
  /* Bounded rather than `while (true)`: a paginator that never returns null should fail the
     test rather than hang the suite. */
  for (let guard = 0; guard <= items.length + 1; guard += 1) {
    /* Annotated because `spec` is inferred and `page` feeds back into it through `cursor`,
       which leaves tsc chasing its own tail. */
    const page: Page<Row> = paginate(
      spec(items, order, cursor === null ? { limit } : { limit, cursor }),
    );
    seen.push(...page.items);
    if (page.nextCursor === null) return seen;
    cursor = page.nextCursor;
  }
  throw new Error('paginate never reported the end of the collection');
};

describe('cursors', () => {
  it('round-trips the position it names', () => {
    expect(decodeCursor(encodeCursor('000000001000000042', 'r7'))).toEqual({
      sortKey: '000000001000000042',
      id: 'r7',
    });
  });

  it('survives the characters that break a naive encoding', () => {
    /* Ids are opaque to this module and gossip slugs have carried worse. A cursor that breaks on
       a slash or a quote breaks on one row in a thousand, which is the hardest kind to find. */
    const awkward = 'a/b+c=d&e"f\\g ह';
    expect(decodeCursor(encodeCursor(awkward, awkward))).toEqual({
      sortKey: awkward,
      id: awkward,
    });
  });

  it('rejects a cursor issued by something else rather than misreading it', () => {
    /* The case this exists for: a cursor held across the Supabase swap. Decoding it as if it
       were ours would return a plausible wrong page, which nobody would report as a bug. */
    expect(() => decodeCursor('eyJvZmZzZXQiOjUwfQ==')).toThrow(ValidationError);
    expect(() => decodeCursor('mockv1.%7Bnot-json')).toThrow(ValidationError);
    expect(() => decodeCursor('mockv1.%5B%22only-one%22%5D')).toThrow(ValidationError);
    expect(() => decodeCursor('mockv1.%5B1%2C2%5D')).toThrow(ValidationError);
  });
});

describe('paginate', () => {
  it('returns every row exactly once, in order, across every page', () => {
    /* The two failures keyset pagination is chosen to avoid -- a repeat at a page boundary and a
       skipped row -- are both invisible in a single-page test. */
    const items = rows(23);
    const seen = walkAll(items, 'asc', 5);

    expect(seen).toHaveLength(23);
    expect(seen.map((row) => row.id)).toEqual(items.map((row) => row.id));
    expect(new Set(seen.map((row) => row.id)).size).toBe(23);
  });

  it('walks descending order the same way', () => {
    const items = rows(11);
    const seen = walkAll(items, 'desc', 4);

    expect(seen.map((row) => row.id)).toEqual([...items].reverse().map((row) => row.id));
  });

  it('does not shift the next page when a row is inserted above the cursor', () => {
    /* The property an offset does not have, and the reason a gossip board paged by offset
       repeats the post that page 1 ended on: the feed grows at the top while you read it. */
    const items = rows(10);
    const first = paginate(spec(items, 'asc', { limit: 4 }));
    expect(first.nextCursor).not.toBeNull();

    const grown = [{ id: 'r-new', at: -1 }, ...items];
    const second = paginate(spec(grown, 'asc', { limit: 4, cursor: nextCursor(first) }));

    expect(second.items.map((row) => row.id)).toEqual(['r4', 'r5', 'r6', 'r7']);
  });

  it('resumes correctly when the row the cursor names has been deleted', () => {
    /* Moderation removes rows between pages. Looking the id up would find nothing and restart
       the collection from the top; comparing positions resumes where the reader was. */
    const items = rows(10);
    const first = paginate(spec(items, 'asc', { limit: 4 }));
    const withoutR3 = items.filter((row) => row.id !== 'r3');

    const second = paginate(spec(withoutR3, 'asc', { limit: 4, cursor: nextCursor(first) }));

    expect(second.items.map((row) => row.id)).toEqual(['r4', 'r5', 'r6', 'r7']);
  });

  it('breaks ties on the id so the order is total', () => {
    /* Four sessions starting at the same minute is normal for a festival. Without the tiebreak
       the sort is unstable across calls and a row can be returned twice or not at all. */
    const tied: readonly Row[] = [
      { id: 'c', at: 5 },
      { id: 'a', at: 5 },
      { id: 'b', at: 5 },
    ];
    expect(walkAll(tied, 'asc', 1).map((row) => row.id)).toEqual(['a', 'b', 'c']);
    expect(walkAll(tied, 'desc', 1).map((row) => row.id)).toEqual(['c', 'b', 'a']);
  });

  it('reports the end of the collection rather than an empty last page', () => {
    /* `hasMore` computed from the slice length would hand back a cursor on an exactly-full final
       page, costing every caller one wasted round trip. */
    const exactlyTwoPages = paginate(spec(rows(8), 'asc', { limit: 4 }));
    expect(exactlyTwoPages.nextCursor).not.toBeNull();

    const last = paginate(spec(rows(8), 'asc', { limit: 4, cursor: nextCursor(exactlyTwoPages) }));
    expect(last.items).toHaveLength(4);
    expect(last.nextCursor).toBeNull();
  });

  it('returns an empty page with no cursor for an empty collection', () => {
    expect(paginate(spec([], 'asc'))).toEqual({ items: [], nextCursor: null });
  });
});

describe('resolveLimit', () => {
  it('falls back and clamps rather than erroring on an over-ask', () => {
    expect(resolveLimit(undefined)).toBe(DEFAULT_PAGE_SIZE);
    expect(resolveLimit(10_000)).toBe(MAX_PAGE_SIZE);
    expect(resolveLimit(1)).toBe(1);
  });

  it('rejects a limit that can only be a bug in the caller', () => {
    /* Returning an empty page for these would hide the mistake somewhere far from its cause. */
    expect(() => resolveLimit(0)).toThrow(ValidationError);
    expect(() => resolveLimit(-1)).toThrow(ValidationError);
    expect(() => resolveLimit(2.5)).toThrow(ValidationError);
    expect(() => resolveLimit(Number.NaN)).toThrow(ValidationError);
  });
});

describe('sort keys', () => {
  it('orders negatives below zero as strings', () => {
    /* One string comparison orders every collection, so a negative `sort_order` -- which is how
       "pin this to the top" gets written -- has to compare correctly as text. */
    expect(numericKey(-1, 'k') < numericKey(0, 'k')).toBe(true);
    expect(numericKey(-1000, 'k') < numericKey(-999, 'k')).toBe(true);
    expect(numericKey(999, 'k') < numericKey(1000, 'k')).toBe(true);
  });

  it('keeps every key the same width, which is what makes the comparison work', () => {
    expect(numericKey(0, 'k')).toHaveLength(numericKey(-123_456, 'k').length);
    expect(numericKey(1e12, 'k')).toHaveLength(numericKey(7, 'k').length);
  });

  it('rejects a value it cannot order instead of ordering it wrongly', () => {
    expect(() => numericKey(Number.NaN, 'k')).toThrow(ValidationError);
    expect(() => numericKey(Number.POSITIVE_INFINITY, 'k')).toThrow(ValidationError);
    expect(() => numericKey(1e15, 'k')).toThrow(ValidationError);
  });

  it('orders timestamps by instant, not by how they were written', () => {
    /* The reason timestamps are parsed rather than compared as text: these three are the same
       moment, and a string comparison puts them in three different places. */
    const z = timestampKey('2026-06-01T12:00:00Z', 't');
    expect(timestampKey('2026-06-01T12:00:00.000+00:00', 't')).toBe(z);
    expect(timestampKey('2026-06-01T14:00:00+02:00', 't')).toBe(z);
    expect(timestampKey('2026-06-01T11:59:59Z', 't') < z).toBe(true);
  });

  it('rejects a timestamp it cannot parse', () => {
    expect(() => timestampKey('not a date', 't')).toThrow(ValidationError);
    expect(() => timestampKey('', 't')).toThrow(ValidationError);
  });
});
