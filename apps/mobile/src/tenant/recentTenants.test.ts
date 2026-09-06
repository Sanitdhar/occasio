import { describe, expect, it } from '@jest/globals';
import { parseRecentTenants, withMostRecent, RECENT_LIMIT } from './recentTenants.shared';

/**
 * Storage is not a variable. Everything here was written by an older build of the app or edited
 * in a simulator, and a slug from it becomes a path segment — so the cases lean toward dropping
 * what cannot be trusted, and toward dropping only the entry rather than the list.
 */

const entry = (slug: string, name = 'An event') => ({ slug, name });

describe('parseRecentTenants', () => {
  it('reads back what was written', () => {
    const stored = JSON.stringify([entry('lila-and-sam', 'Lila & Sam'), entry('maple-1999')]);
    expect(parseRecentTenants(stored)).toEqual([
      { slug: 'lila-and-sam', name: 'Lila & Sam' },
      { slug: 'maple-1999', name: 'An event' },
    ]);
  });

  it('is empty when there is nothing stored', () => {
    expect(parseRecentTenants(null)).toEqual([]);
    expect(parseRecentTenants('')).toEqual([]);
  });

  it('drops the entry that cannot be trusted, not the list around it', () => {
    /* One bad row should not cost somebody the other seven — and a slug that is not a slug is
       about to become a path segment. */
    const stored = JSON.stringify([
      entry('../../etc/passwd'),
      entry('lila-and-sam', 'Lila & Sam'),
      { slug: 42, name: 'Not a slug' },
      null,
      'not an object',
      entry('maple-1999', 'Maple Street'),
    ]);
    expect(parseRecentTenants(stored)).toEqual([
      { slug: 'lila-and-sam', name: 'Lila & Sam' },
      { slug: 'maple-1999', name: 'Maple Street' },
    ]);
  });

  it('falls back to the slug when the name is unusable', () => {
    /* A list row has to render as something. An empty name would be a blank button. */
    const stored = JSON.stringify([
      { slug: 'lila-and-sam', name: '   ' },
      { slug: 'maple-1999', name: 7 },
    ]);
    expect(parseRecentTenants(stored).map((row) => row.name)).toEqual([
      'lila-and-sam',
      'maple-1999',
    ]);
  });

  it('keeps the first of a duplicated slug and drops the rest', () => {
    const stored = JSON.stringify([entry('lila-and-sam', 'First'), entry('lila-and-sam', 'Later')]);
    expect(parseRecentTenants(stored)).toEqual([{ slug: 'lila-and-sam', name: 'First' }]);
  });

  it('reads a bare slug written by the previous version', () => {
    /* Somebody upgrading mid-event should not lose the shortcut. The name is replaced the moment
       they open it. */
    expect(parseRecentTenants('lila-and-sam')).toEqual([
      { slug: 'lila-and-sam', name: 'lila-and-sam' },
    ]);
    expect(parseRecentTenants('not json and not a slug')).toEqual([]);
  });

  it('stops at the limit rather than reading a whole history back', () => {
    const stored = JSON.stringify(
      Array.from({ length: RECENT_LIMIT + 5 }, (_, i) => entry(`event-${String(i)}`)),
    );
    expect(parseRecentTenants(stored)).toHaveLength(RECENT_LIMIT);
  });
});

describe('withMostRecent', () => {
  it('puts the event just opened at the front', () => {
    const before = [entry('maple-1999', 'Maple'), entry('dev-summit-2026', 'Dev Summit')];
    expect(withMostRecent(before, entry('lila-and-sam', 'Lila & Sam')).map((r) => r.slug)).toEqual([
      'lila-and-sam',
      'maple-1999',
      'dev-summit-2026',
    ]);
  });

  it('moves an event already in the list rather than duplicating it', () => {
    /* The ordering rule is the whole feature: a list that appended would push the event somebody
       opens most often to the bottom, and eventually off the end. */
    const before = [entry('maple-1999', 'Maple'), entry('lila-and-sam', 'Old name')];
    expect(withMostRecent(before, entry('lila-and-sam', 'Lila & Sam'))).toEqual([
      { slug: 'lila-and-sam', name: 'Lila & Sam' },
      { slug: 'maple-1999', name: 'Maple' },
    ]);
  });

  it('never grows past the limit', () => {
    const before = Array.from({ length: RECENT_LIMIT }, (_, i) => entry(`event-${String(i)}`));
    const after = withMostRecent(before, entry('lila-and-sam'));
    expect(after).toHaveLength(RECENT_LIMIT);
    expect(after[0]?.slug).toBe('lila-and-sam');
    /* The oldest is what falls off, not the newest. */
    expect(after.map((r) => r.slug)).not.toContain(`event-${String(RECENT_LIMIT - 1)}`);
  });

  it('falls back to the slug for an unusable name on the way in', () => {
    expect(withMostRecent([], entry('lila-and-sam', '  ')).at(0)?.name).toBe('lila-and-sam');
  });
});
