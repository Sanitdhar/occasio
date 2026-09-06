import { describe, expect, it } from '@jest/globals';
import { createSeededRandom, seedFromString } from './random';

const take = (count: number, seed: number): readonly number[] => {
  const next = createSeededRandom(seed);
  return Array.from({ length: count }, () => next());
};

describe('createSeededRandom', () => {
  it('replays the same sequence for the same seed', () => {
    /* The reason it exists: "the list settled in a different order that time" is not a bug
       report anyone can act on. */
    expect(take(20, 42)).toEqual(take(20, 42));
  });

  it('gives different seeds different sequences', () => {
    expect(take(20, 42)).not.toEqual(take(20, 43));
  });

  it('stays inside [0, 1)', () => {
    /* `latencyFor` scales this into a delay and `createPersonaLabel` indexes a list with it, so
       a value of exactly 1 is an off-the-end read and a negative is a negative timeout. */
    for (const value of take(500, 7)) {
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });

  it('does not get stuck or fall into a short cycle', () => {
    /* A generator that returns one value forever passes every test above. */
    const values = take(200, 1);
    expect(new Set(values).size).toBe(200);
  });

  it('takes a seed of 0, and a negative or fractional one, without degenerating', () => {
    /* `seedFromString` cannot produce these, but a caller passing a literal can. A generator
       whose state starts at 0 and stays there is the classic version of this bug. */
    expect(new Set(take(50, 0)).size).toBe(50);
    expect(new Set(take(50, -9)).size).toBe(50);
    expect(take(5, 3.7)).toEqual(take(5, 3));
  });

  it('spreads roughly evenly, which is all a delay and a name need', () => {
    const buckets = new Map<number, number>([
      [0, 0],
      [1, 0],
      [2, 0],
      [3, 0],
    ]);
    for (const value of take(4000, 99)) {
      const bucket = Math.floor(value * 4);
      buckets.set(bucket, (buckets.get(bucket) ?? 0) + 1);
    }
    for (const count of buckets.values()) {
      expect(count).toBeGreaterThan(800);
      expect(count).toBeLessThan(1200);
    }
  });
});

describe('seedFromString', () => {
  it('turns the same slug into the same seed, so "the same event" means "the same run"', () => {
    expect(seedFromString('sanit-riyanks.wed')).toBe(seedFromString('sanit-riyanks.wed'));
  });

  it('separates slugs that differ only slightly', () => {
    /* Two tenants whose ids differ by one character must not share a persona sequence. */
    expect(seedFromString('t_wedding1')).not.toBe(seedFromString('t_wedding2'));
    expect(seedFromString('ab')).not.toBe(seedFromString('ba'));
  });

  it('always produces a non-negative 32-bit integer', () => {
    for (const value of ['', 'a', 'sanit-riyanks.wed', 'ही', 'x'.repeat(500)]) {
      const seed = seedFromString(value);
      expect(Number.isInteger(seed)).toBe(true);
      expect(seed).toBeGreaterThanOrEqual(0);
      expect(seed).toBeLessThanOrEqual(0xff_ff_ff_ff);
    }
  });
});
