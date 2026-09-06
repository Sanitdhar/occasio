import type { UserId } from '@occasio/core';
import type { Unsubscribe } from './repositories';

/**
 * Who is signed in, and nothing about what they may do.
 *
 * Shaped after Supabase Auth so the swap is a file change (D5, D29): the same four operations,
 * the same session-and-listener model, the same event names. What it deliberately does not carry
 * is any of Supabase's `{ data, error }` envelopes — this package throws typed errors everywhere
 * else, and two error conventions inside one adapter layer would mean every caller checking both.
 * Unwrapping those envelopes is what the Supabase adapter is for.
 *
 * **A session says who somebody is. It never says what they may see.** Roles and memberships come
 * from the data layer — `MembershipRepository`, scoped by tenant — and never from a token, for
 * two reasons that both matter. A token is issued once and believed until it expires, so a role
 * revoked at 9am is still in a token minted at 8:50; and a claim in a token is a client-side
 * fact, which makes it a client-side decision, which is not where access decisions belong. D15's
 * gating is UX only — real enforcement is row-level security, against the database's own view of
 * membership rather than against anything the client is holding.
 *
 * That is why `AuthUser` has no `role`, no `tenants` and no `claims` field, and why it should not
 * grow one. If a screen needs to know what somebody may do, it asks the data layer.
 */

export type AuthUser = {
  readonly id: UserId;
  /** The address the provider verified. Display name and avatar live on the `User` row. */
  readonly email: string;
};

export type AuthSession = {
  readonly user: AuthUser;
  /**
   * When this session stops being valid, if the provider says.
   *
   * `null` means "no stated expiry", not "never expires" — the mock has none, and a real
   * provider refreshing in the background may not either. Nothing should treat this as a
   * permission check; it is here so a screen can tell a stale session from a signed-out one.
   */
  readonly expiresAt: string | null;
};

/**
 * The events Supabase Auth emits, minus the ones this app has no use for.
 *
 * `INITIAL_SESSION` is the one that is easy to leave out and expensive to miss: a listener that
 * only hears `SIGNED_IN` never learns about the session that was already restored from storage
 * when the app started, so a returning user renders as signed out until they touch something.
 */
export type AuthEvent = 'INITIAL_SESSION' | 'SIGNED_IN' | 'SIGNED_OUT' | 'TOKEN_REFRESHED';

export type AuthListener = (event: AuthEvent, session: AuthSession | null) => void;

/**
 * The providers sign-in is allowed to use.
 *
 * D28 freezes this on Google, and names the constraint that will widen it: Apple requires Sign
 * in with Apple before an iOS release. An enumeration rather than a string keeps that a decision
 * somebody makes here rather than a value somebody passes.
 */
export type AuthProvider = 'google';

/** The same list at runtime, because a type is not there when a value arrives. */
export const AUTH_PROVIDERS: readonly string[] = ['google'];

/**
 * Whether a value names a provider sign-in is allowed to use.
 *
 * Takes `string`, deliberately. `AuthProvider` has one member, so a check written against the
 * type is provably true and the compiler removes the branch — while the value that actually
 * shows up can come from a JavaScript caller, a stale bundle or a deep link. This is the check
 * that survives, and it is a named predicate rather than a comparison inside the adapter so that
 * it can be tested without pretending to be an untyped caller.
 */
export const isAuthProvider = (value: string): value is AuthProvider =>
  AUTH_PROVIDERS.includes(value);

export type AuthAdapter = {
  /** The session restored from storage, or `null`. Never throws for "nobody is signed in". */
  readonly getSession: () => Promise<AuthSession | null>;

  /**
   * Emits `INITIAL_SESSION` once, then every change.
   *
   * Returns an `Unsubscribe` directly rather than Supabase's `{ data: { subscription } }`,
   * matching `GossipRepository.subscribe` — one shape for every subscription in this codebase.
   */
  readonly onAuthStateChange: (listener: AuthListener) => Unsubscribe;

  /**
   * Starts sign-in with an OAuth provider.
   *
   * Resolves when a session exists. On a real provider that means after the redirect completes,
   * which is why this is not "returns the session": the browser may have navigated away and come
   * back, and the session that arrives is delivered through `onAuthStateChange` either way.
   */
  readonly signInWithOAuth: (provider: AuthProvider) => Promise<void>;

  readonly signOut: () => Promise<void>;
};
