import { describe, expect, it } from '@jest/globals';
import { firstResolved, isSlug, slugFromPath } from './tenantResolution';

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
