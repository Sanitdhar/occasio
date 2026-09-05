# ADR-0003 — Path-based tenancy is canonical

**Status:** accepted · **Decision:** D9

## Context

Each event is meant to feel like its own site, with its own name. The obvious reading is a
domain or subdomain per event.

## Decision

`/e/[slug]/…` is the canonical internal route, permanently. Subdomains and custom domains are a
hosting-layer rewrite plus a `tenant_domains` lookup table.

## Why

No client framework resolves hostnames — the bundler has no concept of a `Host` header. Custom
domains are always an edge rewrite in front of the app, in every stack. Treating a hostname as a
routing concern inside the app would be the most expensive mistake available here.

Path-based routing also works locally with no DNS or wildcard certificates, which means the
whole thing is demo-able on day one.

## Consequences

- Adding custom domains later is a table, a rewrite rule, and wildcard DNS/TLS. Nothing in
  `TenantProvider` or any screen changes.
- Native has no URL bar, so tenant resolution is platform-split behind one abstraction: web
  reads the hostname then the path; native reads a deep link, then the last visited event, then
  falls back to a join-by-code screen.
- Custom domains carry an operational cost on native: app-link verification files must be served
  from every customer domain.
