import { beforeEach, describe, expect, it } from '@jest/globals';
import { readRecentTenants, rememberTenant } from './recentTenants';
import { LEGACY_KEY, RECENT_KEY } from './recentTenants.shared';

/**
 * The storage layer against a real store, which is where the two failures live that the pure
 * tests cannot see: the key an upgraded installation still holds, and two writes in flight.
 */

const stored = () => window.localStorage.getItem(RECENT_KEY);

describe('recent tenants in storage', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('reads back what it wrote, newest first', async () => {
    await rememberTenant({ slug: 'maple-1999', name: 'Maple Street' });
    await rememberTenant({ slug: 'lila-and-sam', name: 'Lila & Sam' });

    expect(await readRecentTenants()).toEqual([
      { slug: 'lila-and-sam', name: 'Lila & Sam' },
      { slug: 'maple-1999', name: 'Maple Street' },
    ]);
  });

  it('loses nothing when two events are remembered at once', async () => {
    /*
     * `rememberTenant` is read-modify-write across two awaits, so without a queue both calls
     * read the same list and the later write discards the other's event. A deep link resolving
     * while the gate loads another event is exactly this shape, and the symptom — an event
     * missing from the picker — looks like storage being flaky.
     */
    await Promise.all([
      rememberTenant({ slug: 'maple-1999', name: 'Maple Street' }),
      rememberTenant({ slug: 'lila-and-sam', name: 'Lila & Sam' }),
      rememberTenant({ slug: 'dev-summit-2026', name: 'Dev Summit' }),
    ]);

    const slugs = (await readRecentTenants()).map((row) => row.slug).sort();
    expect(slugs).toEqual(['dev-summit-2026', 'lila-and-sam', 'maple-1999']);
  });

  describe('an installation upgrading from the single-slug version', () => {
    it('still finds the event it was last at', async () => {
      /*
       * The previous version wrote a bare slug under a different key. Reading only the new key
       * means an upgrade silently forgets — and on native, where this list is most of the answer
       * to "where was I", that lands a returning attendee on a join screen holding a code they
       * were given once, weeks ago.
       */
      window.localStorage.setItem(LEGACY_KEY, 'lila-and-sam');

      expect(await readRecentTenants()).toEqual([{ slug: 'lila-and-sam', name: 'lila-and-sam' }]);
    });

    it('migrates it rather than reading the old key forever', async () => {
      window.localStorage.setItem(LEGACY_KEY, 'lila-and-sam');
      await readRecentTenants();

      expect(stored()).toBe(JSON.stringify([{ slug: 'lila-and-sam', name: 'lila-and-sam' }]));
      expect(window.localStorage.getItem(LEGACY_KEY)).toBeNull();
    });

    it('ignores a legacy value that is not a slug', async () => {
      window.localStorage.setItem(LEGACY_KEY, '../../etc/passwd');

      expect(await readRecentTenants()).toEqual([]);
      /* Nothing worth keeping, so nothing is written — and the bad key is left alone rather than
         quietly deleted, since removing storage nobody asked us to remove is not ours to do. */
      expect(stored()).toBeNull();
    });

    it('prefers the new key when both are present', async () => {
      window.localStorage.setItem(LEGACY_KEY, 'lila-and-sam');
      window.localStorage.setItem(
        RECENT_KEY,
        JSON.stringify([{ slug: 'maple-1999', name: 'Maple Street' }]),
      );

      expect(await readRecentTenants()).toEqual([{ slug: 'maple-1999', name: 'Maple Street' }]);
    });
  });
});
