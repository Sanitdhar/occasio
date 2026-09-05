# Decision ledger

Occasio is designed by freezing one decision at a time. Each entry below is settled; changing
one means opening an issue and arguing the case, not working around it in a pull request.

Decisions with enough consequence to need their own reasoning have an [ADR](adr/).

## Product

| #   | Decision                                                                                                                                                                                                     |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| D1  | Multi-tenant event platform (weddings, festivals, conferences, reunions), open source under MIT                                                                                                              |
| D2  | **Tenant config is data that drives design _and_ behaviour.** No per-event code — a new event is a new row. [ADR-0002](adr/0002-tenant-config-drives-everything.md)                                          |
| D3  | "Gossips" = an anonymous attendee board; every post enters a moderation queue and an admin approves it before it goes live                                                                                   |
| D6  | The schedule's primary view is story-style day cards                                                                                                                                                         |
| D11 | …with a list-view toggle, which is also the accessible and reduced-motion path                                                                                                                               |
| D13 | Tasks are one engine with two audiences: a crew/vendor board, and attendee action items. A task may link to a schedule item, which is what makes reminders personal                                          |
| D14 | No in-app map. A location handoff opens the OS maps app with directions                                                                                                                                      |
| D22 | Phase 1 also ships photo gallery, RSVP, guest list & seating, room assignments, and live announcements (in-app; remote push is Phase 2)                                                                      |
| D24 | Seating and rooms unify into one `assignments` + `units` model, so shuttles or buses later cost a config entry rather than a feature                                                                         |
| D25 | Invite-only provisioning: a super admin creates the event and invites its admin. The full `draft → pending_approval → approved` machine is built anyway, so self-serve later is a UI change, not a migration |

## Architecture

| #   | Decision                                                                                                                                                                                                                                     |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D8  | **Monorepo, one Expo app** → iOS, Android and web. `packages/{core,theme,data,ui}` extracted from day one. No duplicated UI, no drift. [ADR-0001](adr/0001-one-expo-app-in-a-monorepo.md)                                                    |
| D9  | `/e/[slug]/…` is the canonical internal route **forever**. Subdomains and custom domains are a hosting-layer rewrite plus a lookup table. [ADR-0003](adr/0003-path-based-tenancy.md)                                                         |
| D7  | No single house aesthetic — a preset library, selected and overridden by tenant config                                                                                                                                                       |
| D10 | Admin customisation is **preset + one brand seed colour**; the engine derives ~150 contrast-safe tokens. No raw token editing                                                                                                                |
| D12 | Gossip identity is a system-assigned, resettable persona plus a salted device hash. Gamification is designed for but not built: a feature registry and a domain event bus provide the seam. [ADR-0006](adr/0006-anonymous-identity-model.md) |
| D15 | Sign-in is required for the whole event; every actor has a `user_id`. Gossip posts still never store one                                                                                                                                     |
| D18 | State is TanStack Query plus a few Contexts. No Zustand, no Redux                                                                                                                                                                            |
| D20 | Read-offline: a persisted query cache and on-disk image cache; writes queue and render as pending. Not full offline-first sync                                                                                                               |
| D21 | i18n-ready structure, English only for now — all copy through `t('key')`                                                                                                                                                                     |

## Engineering standards

| #   | Decision                                                                                                                                                                        |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D16 | TypeScript at maximum strictness — `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, branded ids, zod-inferred types, `typescript-eslint` strict-type-checked |
| D17 | Literal colours and spacing in styles are lint errors                                                                                                                           |
| D19 | Four CI gates: typecheck/lint/unit, adapter contracts, visual regression across tenants, and the web export build                                                               |
| D23 | MIT licence                                                                                                                                                                     |
| D29 | Backend independence is lint-enforced and CI-proven, not assumed. [ADR-0004](adr/0004-adapter-boundary.md)                                                                      |

## Backend and operations

| #   | Decision                                                                                                                                   |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| D5  | Supabase is the backend — behind adapters, so it is replaceable                                                                            |
| D4  | Phase 1 is a UI prototype with no backend; mock data is shaped exactly like the eventual tables                                            |
| D26 | Background jobs are an outbox table plus `pg_cron` → Edge Function. **No workflow engine.** [ADR-0005](adr/0005-no-workflow-engine.md)     |
| D27 | Media sits behind a `StorageAdapter` — Supabase Storage now, Cloudflare R2 when photos arrive                                              |
| D28 | Sign-in is Google OAuth only. Known constraints: Apple requires Sign in with Apple before iOS release, and native Google needs a dev build |
| D30 | Web first — free hosting, no store review. Native follows once the product is proven                                                       |
| D31 | Gossip abuse control: per-device rate limit, silent device block, and attendee reports                                                     |
| D32 | Sentry for errors, PostHog for product analytics, both behind a thin wrapper                                                               |
| D33 | Transactional email is Resend, behind a `MailerAdapter`                                                                                    |

## Process

| #   | Decision                                                                                                                                                                                                                                                     |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| D39 | The repo lives in the **`dharlabs` org**, with Sanit and Sourav both as owners, so ownership is not tied to one personal account and both can be assigned work. (`dhar` was already taken)                                                                   |
| D38 | **CodeRabbit** reviews every PR, and the repo is **public** — which makes CodeRabbit free forever and GitHub Actions minutes unlimited. `.coderabbit.yaml` teaches it the frozen decisions so it reviews for this codebase rather than giving generic advice |
| D34 | **Trunk-based branching.** Short-lived branches off `main`, squash-merged and deleted. `main` is always releasable                                                                                                                                           |
| D35 | **One PR per issue** — issues are scoped to be reviewable in one sitting. A PR that outgrows its issue gets split, not explained                                                                                                                             |
| D36 | **A milestone completing is the release trigger**: tag `v0.x.0`, notes generated from merged PRs. `v1.0.0` means a real event has run on this                                                                                                                |
| D37 | **Six milestones**, each ending in something you can open in a browser and show someone                                                                                                                                                                      |

See [workflow.md](workflow.md) for how this works day to day, and the
[roadmap board](https://github.com/orgs/dharlabs/projects/1) for the issues themselves.

## Still open

- What an event becomes after it ends (archived read-only, or a permanent memory site)
- Data deletion and privacy requests, given anonymous posts must stay untraceable
- Accessibility target (WCAG AA is assumed; the contrast property test already enforces the
  colour half of it)
- Super-admin console depth, and test coverage targets
