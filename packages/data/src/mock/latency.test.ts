import { describe, expect, it } from '@jest/globals';
import { isValidationError } from '../errors';
import {
  DEFAULT_LATENCY,
  MOCK_LATENCY_MAX_MS,
  MOCK_LATENCY_MIN_MS,
  assertLatencyRange,
  createDelay,
  latencyFor,
  type Sleep,
} from './latency';
import { createSeededRandom } from './random';

/**
 * The simulated delay is the one part of the mock whose whole value is that it is inconvenient,
 * so it is also the part most likely to be quietly neutered — a default of zero, a range that
 * collapses, a `sleep` that is never awaited. These assert the three things that would make it
 * stop doing its job, and each was checked against a deliberately broken `latency.ts`:
 *
 *  - truncating instead of rounding in `latencyFor` makes the top of the range unreachable
 *  - dropping the clamp lets `random()` at the boundary escape the range
 *  - returning `sleep(0)` from `createDelay` turns the mock instant again
 *
 * Every case turns one of these red. Delays are asserted rather than waited for: a suite that
 * really slept 160ms per call would be a suite nobody runs.
 */

describe('latencyFor', () => {
  it('stays inside the range for the whole span of random()', () => {
    /* Both ends of `random()` plus a sweep, because the clamp only matters at the boundaries. */
    const probes = [0, 0.0001, 0.25, 0.5, 0.75, 0.9999, 0.99999999];
    for (const value of probes) {
      const delay = latencyFor(DEFAULT_LATENCY, () => value);
      expect(delay).toBeGreaterThanOrEqual(MOCK_LATENCY_MIN_MS);
      expect(delay).toBeLessThanOrEqual(MOCK_LATENCY_MAX_MS);
    }
  });

  it('reaches both ends of the range, so the spread is real', () => {
    /*
     * The point of a range is that a list does not settle in the same order every time. A
     * generator that only ever produced the middle would look correct and hide every race the
     * spread exists to expose, so this asserts the extremes are actually attainable.
     */
    expect(latencyFor(DEFAULT_LATENCY, () => 0)).toBe(MOCK_LATENCY_MIN_MS);
    expect(latencyFor(DEFAULT_LATENCY, () => 0.9999999)).toBe(MOCK_LATENCY_MAX_MS);
  });

  it('is the documented 80–240ms band, not whatever the constants happen to say', () => {
    expect(MOCK_LATENCY_MIN_MS).toBe(80);
    expect(MOCK_LATENCY_MAX_MS).toBe(240);
    expect(DEFAULT_LATENCY).toEqual({ minMs: 80, maxMs: 240 });
  });

  it('spreads across the band rather than clustering on one value', () => {
    const random = createSeededRandom(20260905);
    const seen = new Set<number>();
    for (let index = 0; index < 200; index += 1) seen.add(latencyFor(DEFAULT_LATENCY, random));
    /* A fixed delay would give exactly one distinct value; this is the assertion that catches it. */
    expect(seen.size).toBeGreaterThan(50);
    for (const delay of seen) {
      expect(delay).toBeGreaterThanOrEqual(80);
      expect(delay).toBeLessThanOrEqual(240);
    }
  });

  it('returns whole milliseconds — a fractional setTimeout is a rounding surprise later', () => {
    const random = createSeededRandom(7);
    for (let index = 0; index < 50; index += 1) {
      expect(Number.isInteger(latencyFor(DEFAULT_LATENCY, random))).toBe(true);
    }
  });
});

describe('assertLatencyRange', () => {
  it('accepts a zero range, because that is how a test turns the delay off', () => {
    expect(() => {
      assertLatencyRange({ minMs: 0, maxMs: 0 });
    }).not.toThrow();
  });

  it.each([
    ['inverted', { minMs: 300, maxMs: 100 }],
    ['negative', { minMs: -1, maxMs: 100 }],
    ['not finite', { minMs: 0, maxMs: Number.POSITIVE_INFINITY }],
  ])('rejects a %s range as a ValidationError', (_label, range) => {
    let caught: unknown;
    try {
      assertLatencyRange(range);
    } catch (error) {
      caught = error;
    }
    expect(isValidationError(caught)).toBe(true);
    if (isValidationError(caught)) expect(caught.issues.length).toBeGreaterThan(0);
  });
});

describe('createDelay', () => {
  /**
   * The sleep is held open rather than resolved immediately, which is the difference between
   * this test and one that cannot fail: against `Promise.resolve()`, a `createDelay` that called
   * `sleep(...)` and threw the promise away would pass every assertion below. The delay has to
   * still be pending while the sleep is.
   */
  const heldSleep = (): {
    readonly sleep: Sleep;
    readonly slept: readonly number[];
    readonly release: () => void;
  } => {
    const slept: number[] = [];
    const pending: (() => void)[] = [];
    return {
      slept,
      sleep: (ms) => {
        slept.push(ms);
        return new Promise<void>((resolve) => {
          pending.push(resolve);
        });
      },
      release: () => {
        const resolve = pending.shift();
        if (resolve === undefined) throw new Error('sleep was never called');
        resolve();
      },
    };
  };

  /** One turn of the event loop — long enough for a dropped promise to have settled. */
  const settle = async (): Promise<void> => {
    await new Promise<void>((resolve) => {
      setTimeout(resolve, 0);
    });
  };

  it('stays pending until the sleep it computed resolves', async () => {
    const held = heldSleep();
    const delay = createDelay({
      range: DEFAULT_LATENCY,
      random: createSeededRandom(1),
      sleep: held.sleep,
    });

    let finished = false;
    const pending = delay().then(() => {
      finished = true;
    });

    await settle();
    expect(held.slept).toHaveLength(1);
    /* The assertion the old version of this test could not make. */
    expect(finished).toBe(false);

    held.release();
    await pending;
    expect(finished).toBe(true);
  });

  it('computes a fresh delay inside the range on every call', async () => {
    const held = heldSleep();
    const delay = createDelay({
      range: DEFAULT_LATENCY,
      random: createSeededRandom(1),
      sleep: held.sleep,
    });

    const first = delay();
    held.release();
    await first;
    const second = delay();
    held.release();
    await second;

    expect(held.slept).toHaveLength(2);
    for (const ms of held.slept) {
      expect(ms).toBeGreaterThanOrEqual(MOCK_LATENCY_MIN_MS);
      expect(ms).toBeLessThanOrEqual(MOCK_LATENCY_MAX_MS);
    }
  });

  it('validates the range when it is built, not on the first call', () => {
    expect(() =>
      createDelay({
        range: { minMs: 500, maxMs: 10 },
        random: () => 0.5,
        sleep: () => Promise.resolve(),
      }),
    ).toThrow();
  });
});
