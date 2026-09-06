# ADR-0007 — One sign-in provider, and what it will cost

**Status:** accepted · **Decision:** D28

## Context

Sign-in is required for the whole event (D15): tasks are assigned to somebody, reminders are
somebody's, and an RSVP without a person attached is a row nobody can act on. So the question is
not whether to have accounts but how many ways in to build.

An event app is used once, briefly, by people who did not choose it — a guest at a wedding is
not evaluating an authentication experience, they are trying to find the seating plan before the
speeches. Every additional provider is another button on the one screen standing between them
and that.

## Decision

Google, and nothing else, for now.

`AuthProvider` is an enumeration rather than a string, so adding one is a change somebody makes
here rather than a value somebody passes. `signInWithOAuth` takes it; there is no
`signInWithOtp`, no password field and no magic link.

## Why

One provider is one button, one redirect to test, one set of consent screens to configure and
one failure mode to write copy for. Two providers is an account-linking problem the first time
somebody signs in with the other one — the same email, a different `sub`, and a decision about
whether that is the same person that has to be made before it happens rather than after.

Google specifically, because it is the account most likely to already be signed in on the device
the invitation was opened on, and because Workspace covers most of the conference and corporate
cases the platform is aimed at.

## What it will cost

These are known, dated and not yet paid:

- **Apple requires Sign in with Apple before an iOS release.** Any app offering a third-party
  sign-in on iOS must also offer Apple's, per App Store Review Guideline 4.8. This is not a
  preference — it is a submission blocker, and it means `AuthProvider` gains `'apple'` and the
  sign-in screen gains a second button before the app can ship to the App Store.
- **Native Google sign-in needs a development build.** It is a native module, so it does not run
  in Expo Go — the app has to move to a dev build (or EAS) before sign-in can be exercised on a
  device at all. Until then the mock adapter is what the native app signs in against, which is
  the reason the mock mirrors Supabase Auth's shape rather than being a convenience.
- **A second provider brings account linking with it.** Whatever is decided then is a decision
  about identity, not about buttons, and it belongs in a record of its own.

## Consequences

- The sign-in screen is deliberately shaped around a single provider — one button, no provider
  list, no "or continue with" divider — so adding the second is a visible change rather than a
  slot that was already there.
- `docs/decisions.md` D28 stays as written. This record exists so the constraints above are
  found by somebody planning an iOS release, rather than discovered by them.
