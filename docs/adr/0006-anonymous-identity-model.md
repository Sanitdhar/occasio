# ADR-0006 — Anonymous to humans, device-tracked underneath

**Status:** accepted · **Decisions:** D3, D12, D31

## Context

The gossip board is anonymous. But anonymity with no identifier at all means no rate limiting,
no blocking a spammer, and no way for someone to see or delete their own pending post. There is
also a standing intent to add gamification, which needs continuity to attach points to.

## Decision

Each post stores a **system-assigned persona** (a name and avatar the app gives you, resettable)
and a **salted device hash**. It never stores a `user_id`, even though sign-in is required for
the rest of the app.

Abuse control is a per-device rate limit, a silent device block, and attendee reports.

## Why

Anonymity here is a property of the table's schema rather than a consequence of being logged
out, which is what lets the rest of the app require sign-in without compromising the board.

The persona resolves the tension with gamification: points can accrue to something persistent
that no one — including the event admin — can map to a person. The known cost is that a
persistent persona makes posts _linkable to each other_, so a chatty persona can be deanonymised
by inference; the reset button ("new mask") is the mitigation, and it forfeits any streak.

The device block is deliberately **silent**: a blocked device's posts still show to that poster
as awaiting approval. Telling someone they are blocked just makes them reset the app and come
back. This is the one place in the product where being less transparent is the correct design.

## Consequences

- `author_device_hash` must exist from the first fixture. It cannot be retrofitted without
  either breaking the anonymity guarantee or losing all history.
- The UI must state the boundary plainly — nobody can see who posted, but posts are rate-limited
  and blockable by device. Guests should not believe it is more anonymous than it is, nor less.
- On Supabase this implies anonymous sign-in, so every attendee holds a revocable, rate-limitable
  token while staying anonymous to other people.
