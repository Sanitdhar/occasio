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

### The loop every PR goes through (D40)

```
open PR ──▶ CI (4 gates) ──▶ CodeRabbit review ──▶ triage every finding ──▶ squash-merge
                                      ▲                     │
                                      └──── push fixes ─────┘
```

**Every finding gets one of three responses. None of them is silence.**

| Response          | When                                                         | What it looks like                                                                                    |
| ----------------- | ------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------- |
| **Fix it**        | The finding is right                                         | Push the fix, then reply on the thread saying what changed and how you verified it                    |
| **Reply why not** | The finding is wrong, or right but deliberately out of scope | Reply on the thread with the reason. "Out of scope, tracked in #96" is a reason; ignoring it is not   |
| **Escalate**      | It exposes a decision, not a defect                          | Ask the maintainer. Anything that would change a frozen decision belongs in an issue, not a PR thread |

Do not merge with findings left unanswered. A stale review thread is indistinguishable from one
nobody read, and six months later nobody can tell which it was.

**Verify before you accept.** A reviewer can be right for the wrong reason, or wrong in a way
that looks right. On #95 the Metro finding was correct, but checking it showed the real problem
was worse than described — the override was not merely redundant, it made Metro watch the whole
repo instead of the four packages Expo detects on its own. Reply with that evidence, not just
"done".

### Stacked PRs (D41)

Work that depends on unmerged work branches off it rather than off `main`, and targets it as the
PR base:

```
main
 └── feat/17-scaffold-expo-app        PR #95  base: main
      └── feat/18-root-layout          PR #97  base: feat/17-scaffold-expo-app
           └── feat/19-route-skeleton  PR #98  base: feat/18-root-layout
```

Each PR's diff then shows only its own change, so review stays honest even when the work is
sequential.

**When a PR lower in the stack changes** — a review fix, usually — rebase everything above it.
Use `--onto`, and pass the branch the work was originally based on:

```bash
git rebase --onto feat/17-scaffold-expo-app feat/17-scaffold-expo-app feat/18-root-layout
git push --force-with-lease
```

Always `--force-with-lease`, never `--force`: it refuses to overwrite commits you have not seen,
which is the difference between rebasing your own stack and silently discarding someone else's
push.

### Merging a stack, in the order that actually works

PRs here are **squash**-merged, which changes both steps below from the obvious ones. Both of
these were learned by getting them wrong (#101).

**1. Rebase with `--onto`, not plain `rebase`.** A squash merge replaces the branch's commits
with one new commit, so the original commits are _not_ ancestors of `main`. `git rebase main`
tries to replay them and conflicts. `--onto` replays only the commits unique to your branch:

```bash
# after PR for feat/18 is squash-merged into main
git fetch origin
git rebase --onto origin/main feat/18-root-layout feat/19-route-skeleton
#            └── new base      └── old base        └── branch to move
git push --force-with-lease
```

**2. Retarget children _before_ deleting the merged branch.** GitHub **closes** a PR whose base
branch is deleted — it does not retarget it. A closed PR's base cannot be changed, and it cannot
be reopened while its base is missing, so the PR is unrecoverable and has to be raised again.

```
merge feat/18  ─▶  retarget its children to main  ─▶  delete feat/18
                   (in the PR's Edit box, or PATCH base)
```

Doing those in the other order is how #101 was lost and had to be reopened as #102.

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
[#5](https://github.com/dharlabs/occasio/issues/5) and
[#4](https://github.com/dharlabs/occasio/issues/4). Until then, treat their green ticks as
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

[Occasio Roadmap](https://github.com/orgs/dharlabs/projects/1) holds every issue. Sixteen epics
group the work; each epic issue carries a checklist of its children and lives in the milestone
that ships it.

Labels: `area:*` says which part of the system, `size:S|M|L` says how big, `epic` marks a parent.
An issue with no `area:` label has not been triaged.
