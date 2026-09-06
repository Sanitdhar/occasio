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

### Check the review actually happened

**`CodeRabbit: success` does not mean the PR was reviewed.** When the organisation's hourly
review budget is exhausted, CodeRabbit posts a "Review limit reached" comment and sets the
status to:

```
CodeRabbit: success | Review rate limited
```

A merge gate keyed on `success` therefore passes on a PR nothing has read. Three PRs — #121,
#122, #123 — merged that way, reviewed by nothing but CI, because parallel work outran the
budget and the status looked identical to a real pass.

Before merging, run:

```bash
npm run check:reviewed -- <pr-number>
```

It looks for evidence of an actual review — a walkthrough, a finding, or a submitted review —
and exits non-zero if there is none.

### When the budget is exhausted, Claude steps in (D42)

CodeRabbit's "Review limit reached" comment triggers
[`claude-fallback-review.yml`](../.github/workflows/claude-fallback-review.yml), which runs
Claude Code against the PR in CodeRabbit's place. It is a fallback, not a second reviewer — it
never runs on a PR CodeRabbit already reviewed, and `check:reviewed` accepts its findings as
satisfying D40 the same way it accepts CodeRabbit's.

Authenticated with a `CLAUDE_CODE_OAUTH_TOKEN` repository secret (generated via
`claude setup-token`), and requires the official [Claude GitHub app](https://github.com/apps/claude)
installed on the repo — without it, Claude has no permission to post comments back to the PR.

#### Exercising it deliberately

```sh
gh workflow run claude-fallback-review.yml -f pr=<number>
gh run list --workflow claude-fallback-review.yml --limit 1   # then watch it
```

Do this after any change to the workflow, and read the comment it posts rather than trusting a
green run — the run is green whether the review is useful or empty.

The manual trigger exists because for its first nine runs this workflow was `skipped` every
time: no budget had run out, so the `if:` had never matched and not one step had ever executed
(#142). Everything about it was an assumption — the login it posts as, whether `allowed_bots`
opts in correctly, whether `gh pr diff` works without the PR head checked out (changed in #133
and never exercised since), whether the token still has its scopes. A fallback nobody has
watched work is discovered at the one moment there is nothing to fall back to, which is why
`check:reviewed` will not accept a Claude review as satisfying D40 unless CodeRabbit was
actually rate-limited on that PR.

Dispatching needs write access to the repository, so it is available to exactly the people who
could edit the workflow anyway.

### Parallel work is capped by the review budget, not by machines

CodeRabbit's capacity is a rolling, plan-dependent quota — not a number worth hardcoding here,
and the message it posts when exhausted ("you've used all N included reviews currently
available") reflects the plan at that moment. Check the
[review capacity dashboard](https://app.coderabbit.ai/dashboard/review-capacity) for the current
figure.

What matters is the shape rather than the number: **every push to every open PR spends from the
same pool**, and when it runs dry reviews degrade into rate-limit passes rather than queueing.
Running many PRs at once therefore does not raise throughput past that point — it converts
reviews into unreviewed merges. Throughput here is limited by review capacity, not by how much
can be written at once.

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

**2. Retarget children _before_ deleting the merged branch — or check the retarget landed.**

GitHub normally retargets an open PR to the merged PR's base when the head branch is deleted.
That is the documented behaviour and usually what happens.

It is not guaranteed to win a race. Deleting the branch by API three seconds after merging #100
produced this, with no retarget event at all:

```
19:25:32Z  #100  merged
19:25:35Z  #101  base_ref_deleted
19:25:35Z  #101  closed
```

A closed PR's base cannot be changed, and it cannot be reopened while its base is missing — so
#101 was unrecoverable and had to be raised again as #102. The work survived; the PR, its review
threads and its discussion did not.

The safe order costs nothing and is correct whichever way the race falls:

```
merge feat/18  ─▶  retarget children to main  ─▶  delete feat/18
                   (PR Edit box, or PATCH base)
```

If you delete first, check the child is still open rather than assuming it retargeted.

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

## Keeping the pins current

Every action in `.github/workflows` is pinned to a full commit SHA with its release tag in a
trailing comment, and the `visual` gate's Playwright container is pinned by digest ([#106]).
A tag is mutable, so an unpinned action runs whatever was pushed there last. A SHA is not.

The cost of that is a pin with no expiry: it stays at whatever was current the day somebody
wrote it, security fixes included. [`.github/dependabot.yml`](../.github/dependabot.yml) is what
closes that half of the trade for the actions. It watches the `github-actions` ecosystem weekly,
bumps the SHA, and — when the new SHA maps to a tag — rewrites the trailing `# v4` comment with
it. All four actions are grouped into one PR: one review, one CI run. Security updates are
exempt from grouping and arrive on their own, immediately.

Read the group PR rather than rubber-stamping it, and check both halves of every pin. When
Dependabot lands on a commit that carries no tag, the SHA moves and the comment stays where it
was — which is worse than a stale pin, because it is a stale pin that reads as a current one.

### The Playwright pin moves by hand, and never alone

**`ci.yml`'s container digest and the `playwright` version in `package.json` are one pin written
in two places.** The image ships browser binaries built for one client version, so a mismatch
fails when a browser launches rather than when anything installs — the breakage surfaces in the
`visual` gate, some distance from the change that caused it.

Dependabot cannot hold those two together, for two independent reasons:

- It does not read `jobs.<id>.container.image` at all. Its `docker` ecosystem covers
  Dockerfiles, Compose files and Kubernetes manifests, not workflow YAML
  ([dependabot-core#5819](https://github.com/dependabot/dependabot-core/issues/5819), open since
  2022).
- Even if it did, nothing would tell it the two must land together, so it would open two
  unrelated PRs and the first one merged would break CI.

Which is why the npm ecosystem is deliberately **absent** from `dependabot.yml`. Enabling it
without an `ignore` for `playwright` would produce a plausible-looking PR that moves the client
past its container. That is a separate decision from this one; make it deliberately.

Bump both in a single PR:

```bash
npm install --save-exact --save-dev playwright@1.64.0

# The digest the registry serves for the matching image tag. Prints `sha256:…` and nothing
# else: HTTP headers end in CRLF, and a stray carriage return pasted into ci.yml is a pin
# that looks right and resolves to nothing.
curl -fsSI -H 'Accept: application/vnd.oci.image.index.v1+json' \
  https://mcr.microsoft.com/v2/playwright/manifests/v1.64.0-noble |
  tr -d '\r' |
  awk -F': ' 'tolower($1) == "docker-content-digest" { print $2; exit }'
```

Paste that digest into `ci.yml`'s `image:`, update the version named in the comment above it,
and run `npm run test:visual` before pushing. `--save-exact` is not optional: the version is
pinned without a range precisely so `npm ci` cannot float the client away from the container.

[#106]: https://github.com/dharlabs/occasio/pull/106

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
