/**
 * Cursor pagination, present in every collection signature from the first commit.
 *
 * The mock adapter will hold a few dozen fixture rows and could return all of them, so this
 * looks like ceremony today. It is insurance against the one refactor that is genuinely
 * expensive: adding pagination later means changing every repository method, every TanStack
 * Query key, every `useQuery` into a `useInfiniteQuery`, and every list component that assumed
 * it had the whole array. Doing it now costs a type parameter.
 *
 * Cursors rather than `offset`/`limit`, because offsets are wrong on exactly the data this app
 * shows. A gossip board gains rows while it is being read, and page 2 by offset then repeats the
 * item that page 1 ended on. A cursor names a position in an ordering, so an insert above it
 * changes nothing.
 */

/**
 * An opaque continuation token: produced by an adapter, handed back to the same adapter unread.
 *
 * Nothing above the data layer may parse, compare or construct one — it is an encoded sort key
 * for the mock and a Supabase keyset tuple later, and the two have nothing in common. It stays a
 * plain `string` rather than a branded id because minting a branded value takes a cast, and
 * casts are legal in exactly two files (CONTRIBUTING); a brand that every adapter had to
 * circumvent would enforce nothing while looking like it did.
 */
export type Cursor = string;

/**
 * What a caller asks for. Both fields are optional and both are omitted for the first page,
 * which is the common case — `list(tenantId, query)` reads as the whole collection and returns
 * the first page of it.
 */
export type PageRequest = {
  /**
   * How many items to return. Adapters clamp into `[1, MAX_PAGE_SIZE]` and fall back to
   * `DEFAULT_PAGE_SIZE`, so a caller asking for 10,000 gets a page rather than an error; treat
   * the returned `items.length` as authoritative, never the number you asked for.
   */
  readonly limit?: number | undefined;
  /** `nextCursor` from the previous page. Omitted for the first page. */
  readonly cursor?: Cursor | undefined;
};

/**
 * One page of results.
 *
 * Two fields, not three. `hasMore` is deliberately absent: it is `nextCursor !== null`, and two
 * fields that encode one fact are two fields that can eventually disagree. `total` is absent for
 * a harder reason — under row-level security a count is a second query over the same policy, it
 * is stale before it renders, and every UI that displays one ends up needing it to be exact.
 */
export type Page<T> = {
  readonly items: readonly T[];
  /** `null` means this is the last page. Never an empty string. */
  readonly nextCursor: Cursor | null;
};

/** Used when a `PageRequest` omits `limit`. */
export const DEFAULT_PAGE_SIZE = 50;

/**
 * The ceiling every adapter clamps to. A shared constant rather than a per-adapter choice,
 * because the contract suite (#38) asserts the same clamp against all of them — a mock that
 * happily returns 5,000 rows would hide the pagination bug that Supabase then finds in
 * production.
 */
export const MAX_PAGE_SIZE = 200;
