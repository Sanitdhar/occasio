import { createMemoryStorage, createWebStorage, findWebStorage, type MockStorage } from './storage';

/**
 * Web: `localStorage`, falling back to memory when there is none.
 *
 * Metro resolves this file for the web bundle and `defaultStorage.ts` everywhere else, so the
 * native bundle never contains a reference to `localStorage` and the web bundle never contains
 * the native fallback. A single file branching on `Platform.OS` would ship both.
 *
 * The fallback is not defensive padding. `localStorage` is genuinely absent during a static web
 * export's server render, and genuinely unavailable in a browser configured to block site data —
 * both of which are ordinary, and neither of which should stop a demo from rendering.
 */
export const createDefaultStorage = (): MockStorage => {
  const store = findWebStorage();
  return store === null ? createMemoryStorage() : createWebStorage(store);
};
