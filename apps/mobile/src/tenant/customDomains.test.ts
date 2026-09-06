import { describe, expect, it } from '@jest/globals';
import { normaliseHost, slugFor, slugForHost } from './customDomains';

/**
 * ADR-0003 keeps custom domains to a lookup, so the only things worth testing are the lookup's
 * edges — and the one that matters is the app's own hostname, where a wrong answer pins every
 * page to one event and reads as the router being broken.
 */

describe('normaliseHost', () => {
  it('reduces the spellings of one site to one key', () => {
    for (const host of [
      'lila-and-sam.com',
      'LILA-AND-SAM.com',
      'www.lila-and-sam.com',
      'WWW.Lila-And-Sam.com:8081',
      '  lila-and-sam.com  ',
    ]) {
      expect([host, normaliseHost(host)]).toEqual([host, 'lila-and-sam.com']);
    }
  });
});

describe('slugForHost', () => {
  it('maps a configured domain to its event', () => {
    expect(slugForHost('lila-and-sam.com')).toBe('lila-and-sam');
    expect(slugForHost('www.harvestlights.co.uk:443')).toBe('harvest-lights');
  });

  it('never maps the app’s own hostnames, even when the map says otherwise', () => {
    /*
     * The failure this guards is quiet and total: one wrong row and every local page resolves to
     * one event, with the canonical path route unreachable and nothing to suggest the hostname
     * is why.
     *
     * Tested against a map that *does* contain those hostnames. Against the real fixture it
     * proves nothing — no app host is in there, so the lookup answers null on its own and
     * deleting the guard entirely changes no result. That is the same defect this suite is for,
     * one level up, and it survived a first version of this test.
     */
    const hostile = { localhost: 'oops', '127.0.0.1': 'oops', 'occasio.app': 'oops' };

    for (const host of [
      'localhost',
      'localhost:8081',
      '127.0.0.1',
      'occasio.app',
      'www.occasio.app',
    ]) {
      expect([host, slugFor(hostile, host)]).toEqual([host, null]);
      expect([host, slugForHost(host)]).toEqual([host, null]);
    }
  });

  it('refuses a mapped value that is not a slug', () => {
    /* The map becomes a `tenant_domains` table, and a row is an operator's typing. It must not
       reach the router unexamined. */
    expect(slugFor({ 'a-domain.com': '../../etc/passwd' }, 'a-domain.com')).toBeNull();
    expect(slugFor({ 'a-domain.com': '' }, 'a-domain.com')).toBeNull();
  });

  it('answers null for a hostname nobody configured', () => {
    /* Not an error: almost every request arrives on the app's own domain and the path carries
       the slug. */
    expect(slugForHost('example.com')).toBeNull();
    expect(slugForHost('')).toBeNull();
    expect(slugForHost('   ')).toBeNull();
  });
});
