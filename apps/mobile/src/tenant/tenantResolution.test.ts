import { describe, expect, it } from '@jest/globals';
import { firstResolved, isSlug, pathFromLink, slugFromPath } from './tenantResolution';

/**
 * A slug from here becomes a path segment and then a repository argument, and it arrives from a
 * hostname map, a URL somebody can edit, or this device's own storage. So the cases below lean
 * toward rejecting: a slug wrongly refused lands on the join screen, which a person can recover
 * from, and one wrongly accepted is a request built out of whatever was in a URL.
 */

describe('isSlug', () => {
  it('accepts the shape the routes actually use', () => {
    for (const slug of ['lila-and-sam', 'harvest-lights', 'dev-summit-2026', 'a', 'a1']) {
      expect([slug, isSlug(slug)]).toEqual([slug, true]);
    }
  });

  it('refuses anything that would not survive being a path segment', () => {
    const refused = [
      '',
      '..',
      '.',
      'a/b',
      'a b',
      'a%2fb',
      'Lila-And-Sam',
      '-leading',
      'trailing-',
      'double--hyphen',
      'a?b=c',
      'a#b',
      'a.b',
      '../../etc/passwd',
      'a'.repeat(65),
    ];
    for (const value of refused) {
      expect([value, isSlug(value)]).toEqual([value, false]);
    }
  });

  it('accepts the longest slug that is still in range', () => {
    /* The boundary in both directions, so an off-by-one in the length check cannot hide. */
    expect(isSlug('a'.repeat(64))).toBe(true);
  });
});

describe('slugFromPath', () => {
  it('reads the canonical route', () => {
    expect(slugFromPath('/e/lila-and-sam')).toBe('lila-and-sam');
    expect(slugFromPath('/e/lila-and-sam/schedule')).toBe('lila-and-sam');
    expect(slugFromPath('/e/lila-and-sam/schedule/s-42')).toBe('lila-and-sam');
  });

  it('tolerates the spellings a router and a deep link produce', () => {
    expect(slugFromPath('e/lila-and-sam')).toBe('lila-and-sam');
    expect(slugFromPath('//e//lila-and-sam//')).toBe('lila-and-sam');
    expect(slugFromPath('/e/lila-and-sam/')).toBe('lila-and-sam');
  });

  it('answers null for the routes that are deliberately not tenant routes', () => {
    /* `/join` and `/discover` live outside `/e/` on purpose, so this is the right reading of
       them rather than a failure to parse. */
    expect(slugFromPath('/')).toBeNull();
    expect(slugFromPath('/discover')).toBeNull();
    expect(slugFromPath('/join')).toBeNull();
    expect(slugFromPath('/events/lila-and-sam')).toBeNull();
    expect(slugFromPath('/e')).toBeNull();
    expect(slugFromPath('/e/')).toBeNull();
  });

  it('decodes before deciding, so an encoded traversal cannot look like a slug', () => {
    /* `%2e%2e` is `..`, which passes a naive character check and is not a slug at all. */
    expect(slugFromPath('/e/%2e%2e')).toBeNull();
    expect(slugFromPath('/e/%2e%2e%2f%2e%2e')).toBeNull();
    expect(slugFromPath('/e/lila%2Dand%2Dsam')).toBe('lila-and-sam');
  });

  it('answers null for a malformed escape rather than throwing', () => {
    /* `decodeURIComponent` throws on a lone `%`. A URL is attacker-supplied on web. */
    expect(slugFromPath('/e/%')).toBeNull();
    expect(slugFromPath('/e/%zz')).toBeNull();
  });
});

describe('pathFromLink', () => {
  /**
   * The two spellings of the same deep link, which do not parse the same way. This is native's
   * primary source, and the first version of the rule dropped the authority segment of a custom
   * scheme — so `occasio://e/lila-and-sam` produced `/lila-and-sam`, matched no route, and the
   * app fell through to storage or to the join screen. Silently, on the one path a person had
   * just deliberately followed.
   */
  it('keeps the authority segment of a custom scheme, where it is really the first path segment', () => {
    expect(pathFromLink({ scheme: 'occasio', hostname: 'e', path: 'lila-and-sam' })).toBe(
      '/e/lila-and-sam',
    );
    expect(pathFromLink({ scheme: 'occasio', hostname: 'e', path: 'lila-and-sam/schedule' })).toBe(
      '/e/lila-and-sam/schedule',
    );
  });

  it('drops it for an http(s) link, where it is a real host', () => {
    expect(pathFromLink({ scheme: 'https', hostname: 'occasio.app', path: 'e/lila-and-sam' })).toBe(
      '/e/lila-and-sam',
    );
    expect(pathFromLink({ scheme: 'HTTP', hostname: 'occasio.app', path: 'e/x' })).toBe('/e/x');
  });

  it('reaches the same slug from either spelling', () => {
    /* The property that matters, stated as one: a link is a link. */
    const viaScheme = pathFromLink({ scheme: 'occasio', hostname: 'e', path: 'lila-and-sam' });
    const viaHttps = pathFromLink({
      scheme: 'https',
      hostname: 'occasio.app',
      path: 'e/lila-and-sam',
    });

    expect(slugFromPath(viaScheme)).toBe('lila-and-sam');
    expect(slugFromPath(viaScheme)).toBe(slugFromPath(viaHttps));
  });

  it('handles a triple-slash custom scheme, where the authority is empty', () => {
    /* `occasio:///e/lila-and-sam` is legal and puts everything in the path. Prepending an empty
       hostname would produce a leading empty segment. */
    expect(pathFromLink({ scheme: 'occasio', hostname: '', path: 'e/lila-and-sam' })).toBe(
      '/e/lila-and-sam',
    );
    expect(pathFromLink({ scheme: 'occasio', hostname: null, path: 'e/lila-and-sam' })).toBe(
      '/e/lila-and-sam',
    );
  });

  it('produces a canonical path, with no doubled slashes', () => {
    /*
     * `slugFromPath` discards empty segments anyway, so this changes no outcome today — which
     * is exactly why it is pinned here. The function's contract is a path, and a link that ends
     * at the authority (`occasio://e`) is the shape that would otherwise start producing `/e/`
     * the day something else reads this value.
     */
    expect(pathFromLink({ scheme: 'occasio', hostname: 'e', path: '' })).toBe('/e');
    expect(pathFromLink({ scheme: 'https', hostname: 'occasio.app', path: '' })).toBe('/');
  });

  it('answers a bare slash when the link carries nothing', () => {
    /* `slugFromPath` reads that as no tenant, which is the right answer for a link that names
       no event — an app opened by its icon, say. */
    expect(pathFromLink({})).toBe('/');
    expect(slugFromPath(pathFromLink({}))).toBeNull();
  });
});

describe('firstResolved', () => {
  it('takes the first source that has an answer, and records which it was', () => {
    expect(
      firstResolved([
        ['domain', null],
        ['path', 'lila-and-sam'],
        ['recent', 'harvest-lights'],
      ]),
    ).toEqual({ kind: 'resolved', slug: 'lila-and-sam', source: 'path' });
  });

  it('keeps the order it is given, because the order is the policy', () => {
    /* A deep link the person just followed beats where they were last week. Reversing these two
       is a product decision, and it should have to be written at the call site to happen. */
    expect(
      firstResolved([
        ['link', 'harvest-lights'],
        ['recent', 'lila-and-sam'],
      ]),
    ).toMatchObject({ slug: 'harvest-lights', source: 'link' });
  });

  it('skips a candidate that is not a slug rather than stopping at it', () => {
    /* Storage holding rubbish must not shadow a perfectly good path. Returning `unresolved` on
       the first bad value would let a stale key blank out the URL the person is looking at. */
    expect(
      firstResolved([
        ['recent', '../../etc/passwd'],
        ['path', 'lila-and-sam'],
      ]),
    ).toMatchObject({ slug: 'lila-and-sam', source: 'path' });
  });

  it('is unresolved when nothing answers', () => {
    expect(firstResolved([])).toEqual({ kind: 'unresolved' });
    expect(
      firstResolved([
        ['domain', null],
        ['path', null],
      ]),
    ).toEqual({ kind: 'unresolved' });
  });
});
