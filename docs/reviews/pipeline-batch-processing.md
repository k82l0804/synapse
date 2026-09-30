Option B is the right grouping primitive. The fragile part of the proposal is treating `pipeline/current.md` and a hand-written coverage matrix as a second source of truth. That recreates Option A inside a nicer folder tree.

## What B actually fixes

The unit of work should be a directory an agent can open and finish without grepping the repo. Spec Kit does this as `specs/<NNN-feature>/`. OpenSpec does it as `changes/<change-id>/`. Both beat flat `specs/` + `plans/` + “remember the ID scheme.”

Fox’s current `docs/master-plan/current-tasks.md` + `current-plans/` is Option A. It works until a plan moves, a task ID is reused, or two agents disagree about what “current” means. B kills that class of bug.

Keep stable IDs. Drop them only as a *grouping* mechanism.

```yaml
# features/F-042-dark-mode/feature.md
---
id: F-042
slug: dark-mode
status: approved          # draft | review | approved | in_progress | blocked | done | escalated
gate: human               # none | human | guardian
batch: 02                 # scheduling hint, not a location
blocked_by: []
related: [F-041]
code:
  - src/ui/theme.ts
---
```

Pipeline keys off `id`. The folder name is for humans. `git mv features/F-042-dark-mode features/F-042-theme` should not break anything.

## Where B breaks if you ship it as drawn

**1. `pipeline/current.md` becomes the new fragile index.**  
Two agents, one human, one rebase — that file is a lockfile pretending to be a document. Status belongs on `feature.md`. The queue is a *query*:

- ready = `status=approved` and `gate` cleared and `blocked_by` empty  
- in flight = claimed in the daemon  
- done = `status=done`

If you want a readable batch file, generate it from the index. Do not let humans or agents edit it as the live schedule.

**2. The coverage matrix will drift.**  
The moment a human maintains “spec S-042 → plan P-042 → task 7” in `feature.md`, you have Option C with extra steps. Each child artifact should declare its own edges; the matrix is a view.

```yaml
# features/F-042-dark-mode/specs/S-042-toggle.md
---
id: S-042
feature: F-042
status: approved
implements: []
---
```

```yaml
# features/F-042-dark-mode/plans/P-042.md
---
id: P-042
feature: F-042
status: draft
implements: [S-042, S-043]
tasks: [T-007, T-008]
---
```

Daemon walks the feature dir, parses frontmatter, writes SQLite. That is Option C with no hand-maintained manifest — which is the Synapse model you already wanted: markdown is source of truth, SQLite is the query layer.

**3. Features are not a tree. They are a graph.**  
A persistence spec used by dark mode *and* settings, a shared infra change, “F-043 blocked on F-042 landing” — directories cannot express that. Do not invent a second tree. Put `blocked_by` / `related` / `implements` in frontmatter and query the index. Containment is the default; links are the exception.

**4. Living product spec vs work packet.**  
`features/` answers “what are we building now.” It does not answer “what does auth do today after 40 shipped features.” OpenSpec splits this on purpose: `specs/` is the living baseline, `changes/` is the packet, archive merges the delta back.

You do not need that on day one. You do need an archive so the working set stays small:

```
features/
  F-042-dark-mode/     # active
  archive/
    F-040-...
```

`ls features/` is “what the pipeline can touch.” History is still git.

**5. Todos do not belong next to specs.**  
Agent checklists churn every session. Specs and approved plans are durable. Mix them and git history on the feature becomes noise.

```
features/F-042-dark-mode/
  feature.md
  specs/
  tasks/
  plans/
  reviews/
  .work/               # gitignored: session todos, scratch, tool traces
```

Reviews stay committed. Dated filenames are fine. “Latest” is `status: accepted` on the newest review, not “sort by date and hope.”

## A layout that matches the actual lifecycle

Your pipeline is research → feature → specs → tasks → plans → code/tests, with human gates. B as drawn skipped `tasks/` and over-weighted phase files.

```
features/F-042-dark-mode/
  feature.md                 # definition, scope, gate, status
  research/                  # optional, pre-spec
  specs/
    S-042-toggle.md
    S-043-persistence.md
  tasks/
    T-007-theme-token.md
    T-008-toggle-wiring.md
  plans/
    P-042.md                 # how; files; acceptance; maps to tasks
  reviews/
    2026-09-29_spec.md
    2026-09-29_P-042_code.md
  .work/
```

Stage of a feature is not a folder it lives in. It is the *minimum* child status:

| Feature status | Rule |
|---|---|
| `draft` | feature.md exists, specs incomplete |
| `review` | specs written, gate=human |
| `approved` | human (or guardian) flipped the gate |
| `in_progress` | daemon claimed it; plans/code in flight |
| `blocked` / `escalated` | frontmatter reason + owner |
| `done` | plans done, reviews accepted, tests listed |

An agent processing F-042 does one thing: read that directory, honor the gate, write artifacts only under it.

## Scheduling without a second database

Batches are a planning tag, not a directory the runtime consults.

```yaml
batch: 02
priority: 2
```

Runtime loop for the daemon:

1. Reindex feature dirs (watch or on pulse).  
2. Select `approved` features whose blockers are `done`.  
3. Claim one feature (SQLite lease, TTL, owner).  
4. Run the next missing stage: plan → implement → review.  
5. Never proceed past a `gate: human` row.  
6. On failure, set `status: escalated` and drop a review file. Do not invent `pipeline/escalations/` as a parallel store.

`pipeline/current.md` can still exist as a generated COP for you and the dashboard. If it is not generated, delete it from the design.

## What I would not do

- Flat dirs + hand YAML manifest (C). You will spend the year writing sync repair.  
- IDs-only grouping (A). You already felt that pain.  
- One `tasks.md` mega-checklist as the only task record once a feature has more than one plan. Fine as a generated rollup; bad as the object the agent mutates.  
- Putting code review, spec review, and agent scratch in the same folder without a status field.

## Decision rule

**Filesystem groups. Frontmatter names. Index queries. Daemon claims. Humans gate.**

B is the grouping. C is a derived cache. A remains only as human-readable IDs inside a feature. If those four stay in their lanes, the pipeline question — “which artifacts belong together, and what stage is this at?” — is just `ls` plus one SELECT.