/**
 * The mock adapter (D4) — the whole of Phase 1's backend.
 *
 * `createMockAdapter` returns a `DataAdapter`, so every screen above the data layer is written
 * against the same type the Supabase adapter will produce and none of them can tell which one
 * they were handed. That is the swap point D5 and D29 are about, and the contract suite (#38) is
 * what will prove the two behave alike.
 *
 * There is deliberately no fixture data in this folder. The four events live in #35 and are
 * passed in as `seed`, which is what keeps "the adapter" and "the demo dataset" two things: a
 * test seeds three rows, the app seeds four full events, and neither has to know about the other.
 */

export { createMockAdapter, type MockAdapter, type MockAdapterOptions } from './adapter';

export {
  ADMIN_ROLES,
  CREW_ROLES,
  MODERATOR_ROLES,
  findActiveMembership,
  hasRole,
  requireMembership,
  requireRole,
} from './access';

export { createDefaultStorage } from './defaultStorage';

export {
  DEFAULT_LATENCY,
  MOCK_LATENCY_MAX_MS,
  MOCK_LATENCY_MIN_MS,
  assertLatencyRange,
  createDelay,
  latencyFor,
  realSleep,
  type LatencyRange,
  type Random,
  type Sleep,
} from './latency';

export { parseSnapshot, serialiseSnapshot } from './mappers';

export {
  decodeCursor,
  encodeCursor,
  numericKey,
  paginate,
  resolveLimit,
  timestampKey,
  type Order,
  type PageSpec,
} from './paging';

export { createSeededRandom, seedFromString } from './random';

export {
  createAsyncStorage,
  createMemoryStorage,
  createWebStorage,
  findWebStorage,
  isWebStorageLike,
  type AsyncStorageLike,
  type MockStorage,
  type WebStorageLike,
} from './storage';

export {
  EMPTY_TABLES,
  MOCK_SNAPSHOT_VERSION,
  MOCK_STORAGE_KEY,
  MOCK_TABLE_NAMES,
  type MockSeed,
  type MockSnapshot,
  type MockTableName,
  type MockTables,
} from './tables';

export { createAvatarKey, createDeviceId, createPersonaLabel, deviceHashFor } from './identity';
