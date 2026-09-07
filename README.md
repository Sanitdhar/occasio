# Occasio

An open-source, multi-tenant platform for running events — weddings, festivals, conferences,
reunions. Every event gets its own site that looks and behaves completely differently from
every other event's.

The governing idea: **tenant config is data, and that data drives both the look and the
behaviour of the app.** There is no per-event code. A new event is a new row.

> **Status: scaffolding.** The engineering standards, lint enforcement and CI are in place.
> Feature work has not started — see [docs/decisions.md](docs/decisions.md) for the frozen
> design and the build order.

## What it does

- **Themed per event.** An admin picks a preset and one brand colour; the engine derives ~150
  design tokens with contrast guaranteed by algorithm, so a non-designer cannot produce an
  unreadable site.
- **A photo-rich schedule.** Story-style day cards by default, with a scannable list view.
- **Gossips.** An anonymous attendee board where every post is approved by a moderator first.
- **Tasks.** A crew and vendor board, plus personal action items that drive personal reminders.
- **Guest list, seating and rooms**, RSVP, a photo gallery, and live announcements.

## Platforms

One TypeScript codebase renders iOS, Android and web from a single Expo tree. Web ships first —
free to host, no store review, and a link that works the moment you send it.

## Access control in the prototype

Roles gate what the app **offers**, not what it **allows**.

`RoleGate` and `useRole` decide which screens somebody is shown, and they run on a device that
person controls — the bundle can be edited and the check deleted, and the request that follows is
made by their machine either way.

**There is no enforcement behind them today.** D4 puts the backend in a later phase, so there is
no Supabase adapter and no row-level security: the mock adapter applies tenant and membership
checks in memory, which is a rehearsal of the eventual policy and not a substitute for it. When
the Supabase adapter and its RLS policies land, the database will be what actually stops a guest
reading a moderation queue — and those policies are the thing to review, which is why every
repository method takes a tenant as its first argument.

Two consequences worth stating plainly while this is a prototype:

- **The gates are UX and nothing more.** They exist so people are not shown doors that will not
  open. Treating them as security would be a mistake today and is meant to stop being one.
- **A session carries no authority.** Roles are read from the data layer per event, never from a
  token — so revoking somebody's access takes effect on their next read rather than on their
  next sign-in. `AuthUser` has an id and an email and deliberately nothing else.

## Reviewing

Every PR is reviewed by [CodeRabbit](https://coderabbit.ai), configured in
[`.coderabbit.yaml`](.coderabbit.yaml) with this project's frozen decisions so its feedback is
specific rather than generic. The mechanical rules are enforced by lint and CI; CodeRabbit is
there for the judgement calls.

## Requirements

- Node 22 (`.nvmrc` pins it; `nvm use` picks it up)
- npm 10+

## Getting started

```bash
npm install
npm run verify        # typecheck, lint, format, enforcement probes, tests
```

## Repo layout

```
packages/core     pure TypeScript — ids, dates, validation, event bus
packages/theme    the theming engine — ThemeInput -> ~150 resolved tokens (no React)
packages/data     row types, repository interfaces, adapters, fixtures
packages/ui       themed primitives with zero domain knowledge
apps/mobile       the Expo app — iOS, Android, web        (not yet scaffolded)
tools/            the project's own lint rules and enforcement probes
docs/             decisions.md (the ledger) and adr/ (the reasoning)
```

Dependencies flow one way — `core → theme → data → ui → features → app` — and that is enforced
by lint, not by convention.

## Scripts

| Script                       | What it does                                       |
| ---------------------------- | -------------------------------------------------- |
| `npm run typecheck`          | `tsc --noEmit` at maximum strictness               |
| `npm run lint`               | ESLint, including the layer and design-token rules |
| `npm run verify:enforcement` | Proves the architectural rules actually fire       |
| `npm test`                   | Unit tests                                         |
| `npm run test:contracts`     | One shared suite run against every adapter         |
| `npm run verify`             | All of the above                                   |

## Roadmap

Six milestones, each ending in something you can open in a browser and show someone. Every issue
lives on the [roadmap board](https://github.com/orgs/dharlabs/projects/1).

|                        |                                              |
| ---------------------- | -------------------------------------------- |
| **v0.1 Foundations**   | app shell, themed primitives, data layer     |
| **v0.2 Attendee site** | tenancy, sign-in, schedule, directions       |
| **v0.3 Participation** | gossips, RSVP, tasks, gallery, reminders     |
| **v0.4 Admin console** | theme editor, schedule editor, media, people |
| **v0.5 Platform**      | super admin, announcements, offline          |
| **v1.0 Public beta**   | deploy, visual baselines, native pass        |

`v1.0.0` means a real event has run on this — not feature completeness.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) and [docs/workflow.md](docs/workflow.md). The short
version: decisions live in [docs/decisions.md](docs/decisions.md), every convention is enforced by
a rule rather than by review, and it's one PR per issue.

## Licence

MIT — see [LICENSE](LICENSE).
