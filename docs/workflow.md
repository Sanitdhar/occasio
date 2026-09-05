# How work moves

Four decisions govern this, frozen alongside the rest in [decisions.md](decisions.md):
**D34** trunk-based branching · **D35** one PR per issue · **D36** tag at each milestone ·
**D37** six milestones, each independently demoable.

## Branching

```
main ──●──●──●──●──●──▶   always releasable, always green
        \    \    \
         PR   PR   PR     short-lived, squash-merged, deleted
```

`main` is the only long-lived branch. Branch from it, name the branch after the issue, and
squash-merge back:

```bash
git switch -c feat/33-story-cards main
# ... work ...
npm run verify          # the same gates CI runs
git push -u origin feat/33-story-cards
```

Branch names: `feat/`, `fix/`, `chore/`, `docs/` followed by the issue number and a short slug.

## One PR per issue

Issues are scoped so that each is reviewable in one sitting — roughly a day's work, which is what
`size:M` means. A PR that has grown past its issue should be split, not explained.

Why this size: each PR gets an independent read from all four CI gates, lands or reverts on its
own, and stays small enough that an outside contributor can follow it. Long-lived epic branches
drift from `main`, and review quality drops sharply past a few hundred lines.

A PR must:

- close exactly one issue (`Closes #33`)
- pass `npm run verify` locally before it is opened
- be green on all four CI gates
- carry a title in conventional-commit form — it becomes the squashed commit message, and the
  release notes are generated from those

## Review

CodeRabbit reviews every PR against `main` automatically (D38). It is configured in
[`.coderabbit.yaml`](../.coderabbit.yaml) with the frozen decisions as path instructions, so it
knows that literal colours are forbidden, that the theme resolver must stay pure, that
`tenantId` is always the first argument, and that a new architectural rule needs a probe proving
it fires.

It does not block merges — `request_changes_workflow` is off, because a solo maintainer blocking
their own PRs achieves nothing. Treat it as the reviewer you would otherwise not have, not as a
gate. `@coderabbitai` in a comment will answer questions or re-review.

The division of labour is deliberate: the four CI gates catch mechanical failures, and
CodeRabbit is there for the judgement-level review — the design call that will hurt in three
months, the case nobody thought to test.

## The four gates

| Gate        | What it protects                                       |
| ----------- | ------------------------------------------------------ |
| `verify`    | Types, layer boundaries, hardcoded colours, logic      |
| `contracts` | The mock → Supabase swap guarantee                     |
| `visual`    | Theme regressions unit tests structurally cannot catch |
| `web-build` | Metro and platform-split mistakes                      |

`visual` and `web-build` currently pass without doing real work — their scripts arrive with
[#5](https://github.com/Sanitdhar/occasio/issues/5) and
[#4](https://github.com/Sanitdhar/occasio/issues/4). Until then, treat their green ticks as
meaning nothing.

## Releases

A milestone completing is the release trigger. There is no fixed cadence — six meaningful
checkpoints instead of continuous version churn.

```bash
git switch main && git pull
git tag -a v0.2.0 -m "v0.2.0 — Attendee site"
git push origin v0.2.0        # release.yml drafts the notes from merged PRs
```

Versions stay `0.x` until a real event has run on the platform. **`v1.0.0` means exactly that** —
not feature completeness.

| Tag      | Milestone     | Means                              |
| -------- | ------------- | ---------------------------------- |
| `v0.1.0` | Foundations   | The skeleton runs on web           |
| `v0.2.0` | Attendee site | Open a link, see an event          |
| `v0.3.0` | Participation | Attendees do things, not just read |
| `v0.4.0` | Admin console | An organiser runs their own event  |
| `v0.5.0` | Platform      | Many events, not one               |
| `v1.0.0` | Public beta   | A real event ran on this           |

## The board

[Occasio Roadmap](https://github.com/users/Sanitdhar/projects/1) holds every issue. Sixteen epics
group the work; each epic issue carries a checklist of its children and lives in the milestone
that ships it.

Labels: `area:*` says which part of the system, `size:S|M|L` says how big, `epic` marks a parent.
An issue with no `area:` label has not been triaged.
