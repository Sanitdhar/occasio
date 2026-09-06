import { describe, expect, it } from '@jest/globals';
import { safeNext, HOME } from './nextRoute';

/**
 * This decides where somebody is sent at the moment they have just signed in, from a value that
 * arrived in a URL. Everything below leans toward refusing: landing on the home page instead of
 * the schedule costs a tap, and following an attacker's link costs a session.
 */

describe('safeNext', () => {
  it('keeps a route inside the app', () => {
    for (const route of ['/e/lila-and-sam', '/e/lila-and-sam/schedule', '/discover', '/join']) {
      expect([route, safeNext(route)]).toEqual([route, route]);
    }
  });

  it('keeps the query and fragment a route came with', () => {
    /* A deep link into a filtered list is exactly the kind of destination worth returning to. */
    expect(safeNext('/e/lila-and-sam/schedule?track=main#s-42')).toBe(
      '/e/lila-and-sam/schedule?track=main#s-42',
    );
  });

  it('refuses an absolute URL', () => {
    /*
     * The open redirect. `?next=https://evil.example/login` on an otherwise genuine sign-in link
     * shows the app's own domain, takes a real sign-in, and hands the person somewhere else at
     * the moment they are most primed to type a password.
     */
    for (const value of [
      'https://evil.example',
      'http://evil.example/login',
      'HTTPS://evil.example',
    ]) {
      expect([value, safeNext(value)]).toEqual([value, HOME]);
    }
  });

  it('refuses a protocol-relative URL, however it is spelled', () => {
    /* `//host` is off-site to a browser, and a backslash is a slash to several URL parsers. */
    for (const value of ['//evil.example', '/\\evil.example', '\\\\evil.example', '/\\/evil']) {
      expect([value, safeNext(value)]).toEqual([value, HOME]);
    }
  });

  it('decodes before deciding', () => {
    /* `%2f%2f` is `//`, which passes a naive first-character check and is off-site. */
    expect(safeNext('/%2f%2fevil.example')).toBe(HOME);
    expect(safeNext('%2f%2fevil.example')).toBe(HOME);
  });

  it('refuses a scheme that is not a route at all', () => {
    for (const value of ['javascript:alert(1)', 'data:text/html,x', 'mailto:a@b.c']) {
      expect([value, safeNext(value)]).toEqual([value, HOME]);
    }
  });

  it('refuses a malformed escape rather than throwing', () => {
    expect(safeNext('/%')).toBe(HOME);
    expect(safeNext('/%zz')).toBe(HOME);
  });

  it('falls back home for anything that is not a string', () => {
    /* Route params arrive as `string | string[] | undefined`, and a repeated `?next=` gives the
       array — which has no meaning here and must not be followed. */
    expect(safeNext(undefined)).toBe(HOME);
    expect(safeNext('')).toBe(HOME);
    expect(safeNext(['/discover', '//evil.example'])).toBe(HOME);
    expect(safeNext(42)).toBe(HOME);
  });
});
