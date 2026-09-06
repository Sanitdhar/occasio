import { createMemoryStorage, type MockStorage } from './storage';

/**
 * The default store everywhere Metro does not pick `defaultStorage.web.ts`: native, Node and
 * Jest.
 *
 * **Native does not persist yet, and that is a missing dependency rather than a design.**
 * Persisting on a device means `@react-native-async-storage/async-storage`, which is a native
 * module: adding it to this package would put a native module in the import path of every
 * server-side and test consumer of `@occasio/data`, and the data layer deliberately has no React
 * Native dependency at all. `createAsyncStorage()` in `storage.ts` is the binding, already
 * written and tested; the app passes the module to `createMockAdapter({ storage })` in one line
 * once the dependency lands. Until then the platform that matters is web (D30 — web first, and
 * the only platform currently shipping), where `defaultStorage.web.ts` does persist.
 *
 * In Jest and on a server, memory is the correct answer rather than a compromise: a suite whose
 * fixtures survived between test files would be a suite with order-dependent failures.
 */
export const createDefaultStorage = (): MockStorage => createMemoryStorage();
