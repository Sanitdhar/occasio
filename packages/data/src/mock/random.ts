import type { Random } from './latency';

/**
 * A seeded generator, so a mock run reproduces.
 *
 * The mock uses randomness in two places — the simulated delay and the persona label handed to a
 * new device — and both are things a failing test needs to reproduce exactly. `Math.random` is
 * the app default; a seed is what turns "the list settled in a different order that time" into a
 * bug someone can re-run.
 *
 * mulberry32: 32-bit state, one multiply-xor-shift round, uniform enough for a delay and a name.
 * It is deliberately not cryptographic and nothing here depends on it being unpredictable.
 */
export const createSeededRandom = (seed: number): Random => {
  let state = Math.trunc(seed) >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

/** Turns a slug or a tenant id into a seed, so "the same event" means "the same run". */
export const seedFromString = (value: string): number => {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
};
