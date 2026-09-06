import { ValidationError, type ValidationIssue } from '../errors';

/**
 * Simulated latency — the part of the mock that exists to make the app worse.
 *
 * A mock that answers synchronously is a mock that never reveals a missing loading state. Every
 * skeleton, every empty state and every optimistic write in this repo is built against a
 * repository call that takes long enough to see, because the alternative is discovering all of
 * them at once on a phone at a venue with two bars of signal — which is the demo that matters.
 *
 * 80–240ms is chosen rather than a round number: it is roughly a warm Supabase round trip from a
 * phone on decent mobile data, slow enough that a spinner is visible and fast enough that nobody
 * clicking through a demo thinks the app is broken. The spread matters as much as the middle. A
 * fixed delay makes every list settle in the same order every time, which hides exactly the
 * race a variable one exposes.
 */

export const MOCK_LATENCY_MIN_MS = 80;
export const MOCK_LATENCY_MAX_MS = 240;

export type LatencyRange = { readonly minMs: number; readonly maxMs: number };

export const DEFAULT_LATENCY: LatencyRange = {
  minMs: MOCK_LATENCY_MIN_MS,
  maxMs: MOCK_LATENCY_MAX_MS,
};

/** A source of numbers in `[0, 1)` — `Math.random` in the app, a seeded generator in tests. */
export type Random = () => number;

/** Injected so a test can assert what was waited for without waiting for it. */
export type Sleep = (ms: number) => Promise<void>;

export const realSleep: Sleep = (ms) =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

/**
 * Rejects a range that cannot produce a delay, at adapter construction rather than on the first
 * read. A negative or inverted range is a configuration mistake, and one that would otherwise
 * surface as a hang or as a mock that is silently instant again.
 */
export const assertLatencyRange = (range: LatencyRange): void => {
  const issues: ValidationIssue[] = [];
  if (!Number.isFinite(range.minMs) || range.minMs < 0) {
    issues.push({
      path: 'latency.minMs',
      message: 'Expected a finite number of milliseconds >= 0',
    });
  }
  if (!Number.isFinite(range.maxMs) || range.maxMs < 0) {
    issues.push({
      path: 'latency.maxMs',
      message: 'Expected a finite number of milliseconds >= 0',
    });
  }
  if (issues.length === 0 && range.minMs > range.maxMs) {
    issues.push({ path: 'latency.minMs', message: 'minMs must not exceed maxMs' });
  }
  if (issues.length > 0) throw new ValidationError(issues);
};

/**
 * One delay, in whole milliseconds, inside `[minMs, maxMs]` inclusive at both ends.
 *
 * Rounded rather than truncated so the top of the range is reachable: `random()` never returns 1,
 * so truncation would make 240ms impossible and quietly narrow every range by a millisecond.
 */
export const latencyFor = (range: LatencyRange, random: Random): number => {
  const span = range.maxMs - range.minMs;
  const raw = range.minMs + random() * span;
  const rounded = Math.round(raw);
  return Math.min(range.maxMs, Math.max(range.minMs, rounded));
};

/**
 * The delay every repository method awaits before it answers.
 *
 * Set `range` to `{ minMs: 0, maxMs: 0 }` to turn it off — which the adapter's own suite does,
 * because 137 tests each paying a real 160ms is four minutes of CI spent proving `setTimeout`
 * works. The latency itself is tested here, where it can be asserted rather than waited for.
 */
export const createDelay = (options: {
  readonly range: LatencyRange;
  readonly random: Random;
  readonly sleep: Sleep;
}): (() => Promise<void>) => {
  assertLatencyRange(options.range);
  return () => options.sleep(latencyFor(options.range, options.random));
};
