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

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). The short version: decisions live in
[docs/decisions.md](docs/decisions.md), and every convention is enforced by a rule rather than
by review.

## Licence

MIT — see [LICENSE](LICENSE).
