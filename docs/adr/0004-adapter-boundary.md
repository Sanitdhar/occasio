# ADR-0004 — Backend independence is enforced, not assumed

**Status:** accepted · **Decisions:** D5, D29

## Context

Supabase is the chosen backend, but the platform is open source and self-hosted by people who
may want Postgres, Firebase, or something else. "We could move backends" is a claim every
codebase makes and almost none can honour.

## Decision

Five adapters — `DataAdapter`, `AuthAdapter`, `StorageAdapter`, `NotifierAdapter`,
`MailerAdapter` — with two mechanical guarantees:

1. A lint rule: `@supabase/*` may only be imported under `packages/data/src/supabase/**`.
2. One shared contract test suite that runs against every implementation.

## Why mechanically

An adapter interface that is merely documented leaks within months, especially in an open-source
repo where a contributor reaches for the client directly because it is right there. The lint rule
makes the leak impossible; the contract suite makes divergence visible.

Supporting conventions matter as much: every repository call takes `tenantId` explicitly even
though it could be read from context, because that mirrors row-level security and prevents an
ambient-tenant habit that would become cross-tenant leaks. The mock throws `ForbiddenError` when
a caller passes a tenant it has no membership in — a simulated RLS check that catches leaks
during the prototype rather than in production.

## Consequences

- The mock adapter is async, paginated, subscribable and error-typed from the start, even where
  the mock ignores it — otherwise those seams get bolted on badly later.
- The prototype's loading and empty states are real, because the mock has simulated latency.
- Row types are snake_case and match Postgres exactly; domain objects are camelCase; `mappers.ts`
  is the only place the two meet, and one of only two files allowed to use a cast.
