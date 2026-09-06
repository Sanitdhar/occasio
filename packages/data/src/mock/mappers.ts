import {
  MOCK_SNAPSHOT_VERSION,
  type MockSnapshot,
  type MockTableName,
  type MockTables,
} from './tables';

/**
 * The mock adapter's half of the boundary `mappers.ts` describes — and, like it, the only file
 * in this folder where a cast is legal.
 *
 * Two jobs, and they are the same job. Both are the moment an untyped value becomes a branded,
 * typed one:
 *
 *  1. `parseSnapshot` turns the JSON string a browser handed back into `MockTables`. `JSON.parse`
 *     returns `any`; without a checked door into the type system, every read after it is an
 *     unsafe access the linter is right to reject.
 *  2. `cloneJson` copies a document by round-tripping it through JSON, which means typing the
 *     result of `JSON.parse` — the same door, for the same reason.
 *
 * The root `mappers.ts` explains why this exemption exists at all: it is the seam where database
 * output becomes checked data, and the eslint config grants it to `packages/data/src/**\/mappers.ts`
 * precisely so each adapter has one.
 */

/* ---------------------------------------------------------------------------------------------
 * Snapshot parsing
 * ------------------------------------------------------------------------------------------- */

type FieldKind = 'string' | 'number' | 'boolean' | 'object' | 'array';
type RowShape = Readonly<Record<string, FieldKind>>;

/**
 * What every row of each table must carry to be loadable.
 *
 * **This is deliberately not a copy of `rows.ts`.** It lists the columns the adapter itself
 * indexes, scopes and orders on — ids, `tenant_id`, timestamps, `sort_order`, statuses — and
 * nothing else, for one reason: a full mirror of twenty row types would have to be edited every
 * time a column is added, and the failure mode when somebody forgets is that a perfectly good
 * snapshot is rejected and the user's demo writes are silently thrown away. A partial shape fails
 * in the safe direction.
 *
 * That trade is only sound because the threat model is narrow. This document was written by this
 * adapter into a store only this adapter uses, so the realistic corruptions are the ones checked
 * here: an absent key, truncated JSON, another app's value under the same key, and a snapshot
 * from an older row shape — which `version` catches on its own, and which is why bumping
 * `MOCK_SNAPSHOT_VERSION` is not optional when `rows.ts` changes.
 */
const ROW_SHAPES: Readonly<Record<MockTableName, RowShape>> = {
  tenants: {
    id: 'string',
    slug: 'string',
    name: 'string',
    kind: 'string',
    status: 'string',
    timezone: 'string',
    visibility: 'string',
    created_at: 'string',
    updated_at: 'string',
  },
  tenantConfigs: {
    tenant_id: 'string',
    draft_config: 'object',
    created_at: 'string',
    updated_at: 'string',
  },
  users: {
    id: 'string',
    email: 'string',
    display_name: 'string',
    created_at: 'string',
    updated_at: 'string',
  },
  memberships: {
    id: 'string',
    tenant_id: 'string',
    role: 'string',
    status: 'string',
    created_at: 'string',
    updated_at: 'string',
  },
  approvalRequests: {
    id: 'string',
    tenant_id: 'string',
    status: 'string',
    requested_by: 'string',
    requested_at: 'string',
    created_at: 'string',
  },
  venues: {
    id: 'string',
    tenant_id: 'string',
    name: 'string',
    sort_order: 'number',
    created_at: 'string',
    updated_at: 'string',
  },
  sessions: {
    id: 'string',
    tenant_id: 'string',
    title: 'string',
    starts_at: 'string',
    sort_order: 'number',
    status: 'string',
    created_at: 'string',
    updated_at: 'string',
  },
  people: {
    id: 'string',
    tenant_id: 'string',
    name: 'string',
    sort_order: 'number',
    created_at: 'string',
    updated_at: 'string',
  },
  sessionPeople: {
    tenant_id: 'string',
    session_id: 'string',
    person_id: 'string',
    sort_order: 'number',
    created_at: 'string',
  },
  mediaAssets: {
    id: 'string',
    tenant_id: 'string',
    storage_path: 'string',
    kind: 'string',
    mime_type: 'string',
    status: 'string',
    created_at: 'string',
    updated_at: 'string',
  },
  personas: {
    id: 'string',
    tenant_id: 'string',
    label: 'string',
    avatar_key: 'string',
    device_hash: 'string',
    created_at: 'string',
  },
  gossipPosts: {
    id: 'string',
    tenant_id: 'string',
    body: 'string',
    persona_id: 'string',
    author_device_hash: 'string',
    status: 'string',
    reaction_counts: 'object',
    report_count: 'number',
    created_at: 'string',
  },
  tasks: {
    id: 'string',
    tenant_id: 'string',
    title: 'string',
    created_by: 'string',
    status: 'string',
    visibility: 'string',
    priority: 'string',
    sort_order: 'number',
    created_at: 'string',
    updated_at: 'string',
  },
  units: {
    id: 'string',
    tenant_id: 'string',
    kind: 'string',
    label: 'string',
    meta: 'object',
    sort_order: 'number',
    created_at: 'string',
    updated_at: 'string',
  },
  assignments: {
    id: 'string',
    tenant_id: 'string',
    unit_id: 'string',
    user_id: 'string',
    assigned_by: 'string',
    created_at: 'string',
  },
  announcements: {
    id: 'string',
    tenant_id: 'string',
    title: 'string',
    body: 'string',
    pinned: 'boolean',
    created_by: 'string',
    created_at: 'string',
    updated_at: 'string',
  },
  rsvps: {
    tenant_id: 'string',
    user_id: 'string',
    session_id: 'string',
    status: 'string',
    guest_count: 'number',
    responded_at: 'string',
  },
  notificationPreferences: {
    tenant_id: 'string',
    user_id: 'string',
    channels: 'array',
    muted_categories: 'array',
    created_at: 'string',
    updated_at: 'string',
  },
  deviceTokens: {
    id: 'string',
    user_id: 'string',
    platform: 'string',
    token: 'string',
    last_seen_at: 'string',
    created_at: 'string',
  },
  notificationDeliveries: {
    id: 'string',
    tenant_id: 'string',
    user_id: 'string',
    category: 'string',
    channel: 'string',
    dedupe_key: 'string',
    status: 'string',
    scheduled_for: 'string',
    created_at: 'string',
  },
};

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const matchesKind = (value: unknown, kind: FieldKind): boolean => {
  switch (kind) {
    case 'string':
      return typeof value === 'string';
    case 'number':
      return typeof value === 'number' && Number.isFinite(value);
    case 'boolean':
      return typeof value === 'boolean';
    case 'object':
      return isRecord(value);
    case 'array':
      return Array.isArray(value);
  }
};

const matchesShape = (row: unknown, shape: RowShape): boolean => {
  if (!isRecord(row)) return false;
  return Object.entries(shape).every(([field, kind]) => matchesKind(row[field], kind));
};

const isUnknownArray = (value: unknown): value is readonly unknown[] => Array.isArray(value);

/**
 * Reads a persisted snapshot, or returns `null` for anything it cannot vouch for.
 *
 * `null` is not an error — it is the signal to reseed from the fixtures, which is the right
 * response to a first run, a version bump, a half-written value and another app's key alike. A
 * throw here would put a corrupt `localStorage` entry between a user and a working demo forever,
 * with no way out but the browser devtools.
 */
export const parseSnapshot = (raw: string): MockSnapshot | null => {
  let document: unknown;
  try {
    document = JSON.parse(raw);
  } catch {
    return null;
  }

  if (!isRecord(document)) return null;
  if (document['version'] !== MOCK_SNAPSHOT_VERSION) return null;

  const deviceId = document['deviceId'];
  if (typeof deviceId !== 'string' || deviceId.length === 0) return null;

  const nextId = document['nextId'];
  if (typeof nextId !== 'number' || !Number.isInteger(nextId) || nextId < 0) return null;

  const stored = document['tables'];
  if (!isRecord(stored)) return null;

  const tables = parseTables(stored);
  if (tables === null) return null;

  return { version: MOCK_SNAPSHOT_VERSION, deviceId, nextId, tables };
};

/**
 * Validates every table and hands back the whole set, or `null` if any of it fails.
 *
 * The loop runs over `ROW_SHAPES`, which is typed `Record<MockTableName, RowShape>` — so a
 * table added to `MockTables` and forgotten here is a compile error rather than an adapter whose
 * `tables.sessions` is `undefined` at runtime while the cast below promises otherwise. That
 * type link is what makes one cast at the end honest.
 */
const parseTables = (stored: Readonly<Record<string, unknown>>): MockTables | null => {
  const validated: Record<string, readonly unknown[]> = {};
  for (const [name, shape] of Object.entries(ROW_SHAPES)) {
    const value = stored[name];
    if (!isUnknownArray(value)) return null;
    if (!value.every((row) => matchesShape(row, shape))) return null;
    validated[name] = value;
  }
  /* The one cast in this file, and the reason the file exists. Every row above has been checked. */
  return validated as MockTables;
};

/** The document written back. Kept beside the parser so the two shapes cannot drift apart. */
export const serialiseSnapshot = (snapshot: MockSnapshot): string => JSON.stringify(snapshot);

/**
 * A deep copy, by JSON round-trip rather than by `structuredClone`.
 *
 * Hermes does not provide `structuredClone` and React Native does not polyfill it, so the call
 * that works in the web export throws `ReferenceError: Property 'structuredClone' doesn't exist`
 * on the first iOS or Android run — one tree, three platforms (D2), so "web only for now" is a
 * deadline, not an exemption.
 *
 * The round-trip is exact for everything that reaches this function. Both callers clone rows and
 * tenant config, which are JSON documents by construction: `rows.ts` mirrors the Postgres shape,
 * timestamps are ISO strings rather than `Date`s, and there is no `undefined` in a row — a
 * nullable column is `null`. It lives here because it is a cast, and this is one of the two
 * files where a cast is legal.
 *
 * `T extends object` rather than a runtime check on the stringify result. `JSON.stringify`
 * answers `undefined` — not the string — for `undefined` itself, a function and a symbol, and
 * `JSON.parse(undefined)` throws. TypeScript's lib types the return as plain `string`, so the
 * compiler cannot see that, and a guard against it is a branch the linter can prove is dead
 * while the runtime can still reach it. Constraining the parameter removes the case instead of
 * catching it: an object and an array always stringify to a string, and nothing else is a thing
 * this function was ever meant to copy.
 */
export const cloneJson = <T extends object>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
