import { describe, expect, it, jest } from '@jest/globals';
import { createStyleCache } from './styleCache';

describe('style cache', () => {
  it('builds once per theme and reuses the result', () => {
    const cache = createStyleCache<{ n: number }>();
    const build = jest.fn(() => ({ n: 1 }));

    const first = cache.get('theme-a', build);
    const second = cache.get('theme-a', build);

    expect(build).toHaveBeenCalledTimes(1);
    expect(second).toBe(first);
  });

  it('rebuilds when the theme id changes', () => {
    const cache = createStyleCache<{ id: string }>();
    expect(cache.get('a', () => ({ id: 'a' }))).not.toBe(cache.get('b', () => ({ id: 'b' })));
  });

  it('evicts the least recently used theme past the bound', () => {
    const cache = createStyleCache<string>(3);
    for (const id of ['a', 'b', 'c']) cache.get(id, () => id);

    cache.get('a', () => 'a'); // 'a' is now the most recent, 'b' the least
    cache.get('d', () => 'd'); // pushes past the bound

    expect(cache.size()).toBe(3);
    expect(cache.keys()).toEqual(['c', 'a', 'd']);
  });

  it('stays bounded through a colour-picker drag', () => {
    /* The failure this cache exists to prevent: an editor resolving a new theme per frame. */
    const cache = createStyleCache<number>(8);
    for (let frame = 0; frame < 500; frame += 1) cache.get(`draft-${String(frame)}`, () => frame);

    expect(cache.size()).toBe(8);
    expect(cache.keys()).toEqual([
      'draft-492',
      'draft-493',
      'draft-494',
      'draft-495',
      'draft-496',
      'draft-497',
      'draft-498',
      'draft-499',
    ]);
  });

  it('caches a value that is itself undefined instead of rebuilding forever', () => {
    const cache = createStyleCache<number | undefined>();
    const build = jest.fn(() => undefined);

    cache.get('a', build);
    cache.get('a', build);

    /* `get() !== undefined` would read the cached undefined as a miss every time. */
    expect(build).toHaveBeenCalledTimes(1);
  });

  it('refuses a capacity that is not a real bound', () => {
    expect(() => createStyleCache(0)).toThrow(RangeError);
    expect(() => createStyleCache(-1)).toThrow(RangeError);
    /* Infinity passed the old guard and silently disabled eviction entirely. */
    expect(() => createStyleCache(Number.POSITIVE_INFINITY)).toThrow(RangeError);
    expect(() => createStyleCache(Number.NaN)).toThrow(RangeError);
    expect(() => createStyleCache(2.5)).toThrow(RangeError);
  });
});
