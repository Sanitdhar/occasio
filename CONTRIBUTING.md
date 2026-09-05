# Contributing to Occasio

## The meta-rule

**Every convention is machine-enforced, or it does not exist.** Rules in a document get skipped;
rules in a lint config get fixed before the PR opens. If you find yourself explaining a
convention in code review, that convention is missing a rule — add one.

## Before you start

Read [docs/decisions.md](docs/decisions.md). It is the numbered ledger of every architectural
decision and why it was made. Those decisions are frozen: if you want to change one, open an
issue arguing the case rather than working around it in a PR.

## Setup

```bash
nvm use          # Node 22, pinned in .nvmrc
npm install
npm run verify
```

## The rules you will actually hit

| Rule                                            | Why it exists                                                                                                                                         |
| ----------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| No literal colours or spacing in styles         | One hardcoded `#fff` silently breaks every tenant's theme, and stays invisible until someone views the event in dark mode                             |
| Layers only import downward                     | `core → theme → data → ui → features → app`. Backward imports create the cycle that makes refactors impossible                                        |
| No `expo-router` in `ui/` or `features/`        | Screens are pure components so the theme editor can render them live under a preview provider                                                         |
| No `@supabase/*` outside its adapter            | "Portable to any backend" is a property CI proves, not a claim in a README                                                                            |
| No `as` casts outside `mappers.ts` and `ids.ts` | Casts hide the type errors that branded ids exist to catch                                                                                            |
| Branded ids                                     | `TenantId` and `SessionId` are both strings at runtime; branding turns a transposed argument into a compile error instead of a cross-tenant data leak |

## Adding a rule

If you add an architectural rule, add a case to `tools/enforcement/verify-enforcement.mjs`
proving it fires. This is not ceremony — two rules in this repo were configured, looked correct,
and did nothing at all until a probe caught them.

## Writing components

- Read tokens from the theme: `t.color.*`, `t.space(n)`, `t.radius.*`, `t.type.*`.
- Keep screens pure: props in, JSX out. Route files read params and pass them down.
- Model state as discriminated unions (`{ status: 'loading' } | { status: 'ready', data }`),
  never as several booleans that can contradict each other.
- Every data call takes `tenantId` explicitly, even when it could be inferred from context.
  That mirrors how row-level security works and prevents cross-tenant leaks later.

## How work moves

Branch off `main`, one PR per issue, squash-merge, delete the branch. Conventional commit titles
(`feat:`, `fix:`, `docs:`, `refactor:`, `chore:`) — the PR title becomes the squashed commit and
the release notes are generated from those. Run `npm run verify` before pushing; CI runs the same
gates and will not merge without them.

Pick something to work on from the [roadmap board](https://github.com/users/Sanitdhar/projects/1).
Issues are scoped so `size:M` is about a day. The full process, including how releases are cut,
is in [docs/workflow.md](docs/workflow.md).
