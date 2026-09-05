# ADR-0001 — One Expo app in a monorepo

**Status:** accepted · **Decision:** D8

## Context

The platform must run as an Android app, an iOS app, and a web app. Flutter and React Native
both do that. The product must also be maintainable and extendable enough to attract outside
contributors.

## Decision

A monorepo with `packages/{core,theme,data,ui}` extracted from day one, and a **single** Expo
app that renders all three platforms.

## Why not Flutter

The deciding question was whether web is a first-class channel or an afterthought. For an event
platform it is first-class: a wedding link gets pasted into a group chat, a conference schedule
gets opened once on a laptop, and most attendees will never install anything.

Flutter renders web to a canvas — heavy first load, no real DOM, weak SEO and link previews, and
accessibility through a translation layer. That makes the weakest surface the one most attendees
actually touch. Flutter wins on native motion polish and pixel-consistency, and would be the
right answer if the store apps were the product and web were a landing page. Here it is the
reverse. React/TypeScript also has a far larger contributor pool than Dart, which matters for an
open-source project.

## Why not Expo plus a separate Next.js web app

A monorepo genuinely shares the theme engine, data layer, types and query hooks — roughly 40% of
the code, with zero drift risk, because both platforms consume the same resolved token object.
What it cannot share is the rendering layer: React Native styles and CSS are different targets.
That is the other 60%, written twice, with every subsequent UI change costing double.

The drift is the real objection, not the initial cost. Tokens stay safe; the hundred small
decisions do not. Someone fixes a card's padding on web and the native card keeps the old value.
In an open-source project this is where quality dies, because a contributor fixes the platform
they run and never notices the other.

The main argument for Next.js was web SEO and server rendering for shared links — and
expo-router now supports static and server web output, which closes most of that gap without a
second UI codebase.

## Consequences

- No UI duplication and no drift, at the cost of some native motion polish versus Flutter.
- Web needs care React Native does not give free: shadows, no media queries, hover and focus
  states, and a real desktop layout for the admin console.
- The escape hatch stays open. Because UI lives in `packages/ui` and `features/`, adding a
  separate web front end later means adding an app, not untangling one.
