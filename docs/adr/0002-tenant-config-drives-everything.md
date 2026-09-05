# ADR-0002 — Tenant config is data that drives look and behaviour

**Status:** accepted · **Decisions:** D2, D7, D10

## Context

Every event must be able to look and behave completely differently. The naive approach — a
branch, a theme file, or a fork per event — does not survive ten events, let alone a thousand.

## Decision

One JSON document per event drives both appearance and behaviour. There is no per-event code.

Appearance goes through a two-layer token model: the admin edits a small `ThemeInput` (~25
fields, the persisted row), and a **pure, synchronous, deterministic** `resolveTheme()` expands
it into ~150 semantic tokens that components read. Behaviour goes through a feature registry —
the tab bar is generated from `nav.tabs` filtered by `features[k].enabled`, and every label
resolves through a copy lookup, so a conference can rename "Gossips" to "Backchannel" without a
code change.

## Why the admin only picks a preset and one colour

Exposing every token is how user-configurable themes become unreadable. Instead the admin picks
_intent_ and the system picks _values_: a preset, a single seed colour, and enumerated choices
(density is cozy/comfortable/airy, never a pixel field).

Colour derivation works in OKLCH rather than HSL, because HSL lightness is perceptually wrong —
yellow at 50% is far brighter than blue at 50% — which is exactly why naive theming produces
unreadable buttons. Contrast is then _enforced in the resolver_, not checked in review, and a
property test runs every preset against hundreds of random seeds in both schemes.

Two rules fall out and are not negotiable: status colours are never derived from the seed (a red
wedding theme must not make errors invisible), and the resolver never imports React or the data
layer, so it stays instantly testable.

## Consequences

- A non-designer cannot produce an unreadable site — and that is a mechanised guarantee.
- The persisted config stays small and forward-compatible, and versioned from day one.
- Live preview is nearly free: screens are pure, so the editor renders the real components under
  a nested provider rather than a duplicate.
- The admin edits `draft_config` and publishes to `published_config`. Retrofitting a publish
  workflow onto a live-saving editor would mean rewriting the editor.
