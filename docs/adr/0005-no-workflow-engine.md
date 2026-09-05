# ADR-0005 — An outbox table instead of a workflow engine

**Status:** accepted · **Decision:** D26

## Context

The app schedules reminders ahead of events, sends invitations, moves events through an approval
process, and processes uploaded images. That list _sounds_ like a job for a durable workflow
engine such as Temporal.

## Decision

An outbox table polled by `pg_cron`, calling an Edge Function, with
`FOR UPDATE SKIP LOCKED` to prevent double-sends. No workflow engine.

## Why

Examined individually, none of those are workflows:

- **Reminders** are a row with a `scheduled_for` timestamp and a poller.
- **Invitations** send on insert.
- **Approvals** are a status column — a state field, not an orchestration.
- **Image processing** is best done on-device before upload anyway.

Temporal earns its keep for long-running, multi-step orchestration across unreliable services
with retries and compensation. Nothing here qualifies.

The cost is also real: Temporal Cloud has no production free tier (roughly $100/month to start),
and self-hosting means running a database cluster plus several services 24/7 — which on a
cost-conscious project is more expensive than the problem it solves.

## Consequences

- The entire orchestration surface is one table and one cron job, and it is free on every host.
- Because the outbox is just a table, moving to another backend means rewriting one worker.
- If genuinely complex orchestration appears later — multi-party approvals with compensation,
  say — this decision should be revisited rather than worked around.
