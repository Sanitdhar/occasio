/**
 * Where to go after signing in.
 *
 * The intended route arrives in a query parameter, which means it arrives from a URL, which
 * means anyone can write it. `?next=https://evil.example/login` on an otherwise genuine sign-in
 * link is the whole of an open redirect: the person sees the app's own domain, signs in there,
 * and is handed to somewhere else at the moment they are most primed to type a password.
 *
 * So this accepts only what it can recognise as a route inside this app, and answers `'/'` for
 * everything else. Refusing is cheap — somebody lands on the home page instead of the schedule —
 * and the alternative is not.
 */

/** The one thing every internal route has, and no absolute URL is allowed to fake. */
const INTERNAL = /^\/(?!\/)/;

export const HOME = '/';

export const safeNext = (value: unknown): string => {
  if (typeof value !== 'string' || value === '') return HOME;

  /*
   * Decoded first, because the check has to see what the router will. `%2f%2fevil.example` is
   * `//evil.example`, which a browser reads as protocol-relative and follows off-site — and a
   * malformed escape is not a route.
   */
  let decoded: string;
  try {
    decoded = decodeURIComponent(value);
  } catch {
    return HOME;
  }

  /*
   * A single leading slash and no second one. `//host` is protocol-relative, `https://host` is
   * absolute, and `javascript:` and friends have no slash at all — the one rule rejects all of
   * them without a list of schemes to keep up to date.
   */
  if (!INTERNAL.test(decoded)) return HOME;

  /* A backslash is a slash to several browsers' URL parsers, so `/\evil.example` is `//` by
     another spelling. */
  if (decoded.includes('\\')) return HOME;

  return decoded;
};
