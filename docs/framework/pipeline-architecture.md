# Synapse Pipeline Architecture

> **Date:** 2026-09-29 (v6)  
> **Status:** Working draft  
> **Supersedes:** `specs/S-011` through `specs/S-015` and `specs/pipeline-signal-protocol.md` are hereby marked **superseded**.

---

## What Is a Pipeline

A pipeline requires four things. Anything less is a checklist.

1. **A unit of work.** The thing that flows. One kind per pipeline.
2. **At least two stages in fixed order.** Each stage has a crisp done test.
3. **A handoff.** A place an item waits after one stage and before the next.
4. **An admission rule.** When may an item enter the next stage? Minimum: previous stage passed its done test.

That is enough. It can be four directories and `mv`.

---

## Overview

Synapse is a pipeline that processes **features** — one at a time, through four stages.

```
design/  →  plan/  →  build/  →  done/
```

The pipeline runs fully autonomous until the triage agent determines it cannot proceed, at which point it halts for human intervention.

---

## The Four Stages

```
┌──────────┐          ┌──────────┐          ┌──────────┐          ┌──────────┐
│ design/  │ ───────▶ │  plan/   │ ───────▶ │  build/  │ ───────▶ │  done/   │
│(design it)│          │ (plan it)│          │(build it)│          │(shipped) │
│human+agent│          │autonomous│          │autonomous│          │ archive  │
└──────────┘          └──────────┘          └──────────┘          └──────────┘
```

| Stage | Bin | What happens | Who | Done test |
|-------|-----|-------------|-----|-----------|
| **Design** | `design/` | Human and agent research, discuss, and define the feature. Agent writes `feature.md` with traceability matrix. Feature is reviewed. | Human + agent (interactive) | Feature reviewed and approved by human |
| **Plan** | `plan/` | Daemon generates specs from feature, reviews specs, generates plans from specs, reviews plans, generates task list from plans. | Daemon (autonomous) | All specs, plans, and task list generated and reviewed |
| **Build** | `build/` | Daemon processes the task list: implement each task, verify, code review, triage. Run feature acceptance tests. | Daemon (autonomous) | All tasks complete + acceptance tests pass |
| **Done** | `done/` | Complete. Feature folder is a full audit trail. | Nobody | — |

### Handoffs

Each `mv` is meaningful — it marks a transition in the kind of work:

| Handoff | Trigger | Admission rule |
|---------|---------|---------------|
| `design/ → plan/` | Human approves feature | Feature reviewed, approved, all `depends_on` resolved |
| `plan/ → build/` | Daemon (auto) | Specs + plans + task list generated and reviewed |
| `build/ → done/` | Daemon (auto) | All tasks complete + acceptance tests pass |

### Error at Any Stage

Error = halt. The feature stays in whichever bin it's in. The pipeline stops. The human is notified, inspects the feature folder (all evidence is there), fixes the problem, and restarts.

---

## The Unit of Work: A Feature Folder

A feature is a directory containing `feature.md` and all artifacts generated during processing.

### In `design/` (just the definition)

```
features/
  design/
    F-042-auth/
      feature.md                    # the only human-created artifact
    F-043-settings/
      feature.md
    F-044-dark-mode/
      feature.md
```

### In `plan/` (specs, plans, tasks accumulate)

```
features/
  plan/
    F-042-auth/
      feature.md
      specs/
        S-042-login.md
        S-043-session.md
      plans/
        P-042.md
        P-043.md
      tasks.md                      # consolidated checklist
      reviews/
        spec-review.md
        plan-review.md
      logs/
```

### In `build/` (implementation artifacts accumulate)

```
features/
  build/
    F-042-auth/
      feature.md
      specs/
      plans/
      tasks.md                      # tasks checked off as completed
      reviews/
        spec-review.md
        plan-review.md
        P-042-code-review.md
        P-043-code-review.md
      logs/
        P-042-implement.log
        P-043-implement.log
      .work/                        # gitignored: agent scratch
```

### In `done/` (complete audit trail)

```
features/
  done/
    F-042-auth/
      feature.md
      specs/
      plans/
      tasks.md                      # all items ✅
      reviews/
      logs/
```

---

## The Design Stage

**Mode:** Interactive (human + agent)  
**What happens:** The human and agent collaborate to define a feature.

### Process

1. **Research.** Human provides documents, URLs, domain knowledge. Agent researches, analyzes, synthesizes.
2. **Discuss.** Human and agent iterate on scope, constraints, success metrics. Back and forth until the feature is well-defined.
3. **Write.** When both agree the feature is ready, the agent writes `feature.md` — including a traceability matrix citing the sources (documents, URLs, conversations).
4. **Review.** A different agent reviews the feature definition for completeness, clarity, and testability.
5. **Approve.** Human approves the feature. It's ready to enter the pipeline.

### Feature Definition (`feature.md`)

```yaml
---
id: F-042
slug: auth
status: approved              # draft | review | approved
depends_on: [F-041]           # must be done/ before this can process
related: [F-043]              # informational, no ordering constraint
sources:
  - type: document
    path: docs/research/auth-comparison.md
    note: "Competitive analysis: all competitors support SSO"
  - type: url
    url: https://oauth.net/2.1/
    note: "OAuth 2.1 spec for implementation reference"
  - type: conversation
    id: 4652af63-...
    note: "Design discussion on auth flow requirements"
---

## Scope
Login flow and session management for the app.

## Success Metrics
- Login flow completes end-to-end
- Session persists across browser refresh

## In-Scope Items
- IS-1: Login endpoint with JWT
- IS-2: Session token storage
- IS-3: Logout + token revocation

## Acceptance Tests
- test: "bun test test/e2e/login.test.ts"
- test: "bun test test/e2e/session.test.ts"
```

### Dependencies

Features in `design/` can have dependencies on each other. When moving features to `plan/`:

- A feature **cannot enter `plan/`** if any of its `depends_on` targets are still in `design/`
- Dependencies must be in `plan/`, `build/`, or `done/` (i.e., ahead in the pipeline)
- When approving a dependency set, move them in dependency order — the dependency goes first
- Since the pipeline is sequential, the dependency will reach `done/` before the dependent feature starts building

```
design/                           plan/
  F-042-auth (approved)    ──▶     F-042-auth    (processed first)
  F-043-settings (approved) ──▶   F-043-settings (processed second, F-042 done by then)
```

### Multiple Features Baking

`design/` holds multiple features concurrently. They're in various states — some being researched, some being refined, some nearly ready, some dependent on each other. This is the creative workspace. The pipeline never looks here — only the human decides when a feature is ready to leave.

---

## The Plan Stage

**Mode:** Autonomous  
**What happens:** The daemon generates all artifacts needed for implementation.

### Process

```
feature.md
  → Generate specs (one per deliverable)
  → Agent review of specs (different model from author)
  → Generate plans (one per spec, 1:1)
  → Agent review of plans (different model from author)
  → Generate task list (consolidated checklist from all plans)
```

Each substep has an agent review. Reviews are committed to `reviews/`. If a review fails after 3 auto-fix iterations, the pipeline halts.

### Done Test

All of these exist in the feature folder and have passed review:
- `specs/` — one spec per deliverable, each with acceptance criteria
- `plans/` — one plan per spec, each with file locations, changes, edge cases, verification
- `tasks.md` — consolidated, ordered task checklist
- `reviews/` — spec review + plan review artifacts

When all artifacts are generated and reviewed, the daemon moves the feature: `plan/ → build/`.

---

## The Build Stage

**Mode:** Autonomous  
**What happens:** The daemon processes the task list — implementing, testing, and reviewing each task.

### Process

```
For each unchecked task in tasks.md:
  → Implement (write code)
  → Verify (typecheck, tests, plan verification commands)
  → Code review (different model from implementer)
  → Triage:
      Pass → mark task done ✅, next task
      Auto-fixable → fix, re-verify (up to 3 iterations)
      Not fixable → HALT (notify human)

All tasks done:
  → Run feature acceptance tests (from feature.md)
  → Pass → move to done/
  → Fail → HALT (notify human)
```

### Agent Reviews

| Review | Author | Reviewer | Rule |
|--------|--------|----------|------|
| Spec review | Planning agent | Different model | 3x auto-fix, then halt |
| Plan review | Planning agent | Different model | 3x auto-fix, then halt |
| Code review | Implementing agent | Different model | 3x auto-fix, then halt |

### Done Test

- All tasks in `tasks.md` marked complete ✅
- Feature acceptance tests pass (from `feature.md`)

When both conditions are met, the daemon moves the feature: `build/ → done/`.

---

## Error Handling

**Simple: error = halt.**

The triage agent is the decision-maker at every failure point. It can auto-fix implementation errors, test failures, and review findings (up to 3 iterations). If it can't resolve the problem, the pipeline halts.

When halted:
- The feature stays in whichever bin it's in (`plan/` or `build/`)
- All artifacts remain — specs, plans, tasks, reviews, logs, diagnostics
- The human is notified with what failed, why, and what was tried
- The pipeline cannot resume until the human addresses the problem

The human can:
- Fix the issue (edit `feature.md`, add context, clarify scope)
- Restart the pipeline (it resumes from where it left off)
- Move the feature back to `design/` (needs rethinking)
- Remove the feature entirely (abandon)

### Resumption

The pipeline reads artifact state to know where to pick up:
- No `specs/`? → Start spec generation
- Specs exist, no `plans/`? → Start plan generation
- Plans exist, no `tasks.md`? → Generate task list
- `tasks.md` exists? → Process next unchecked task
- All tasks done? → Run acceptance tests

No special resume logic — just check what exists and pick up from the first missing piece.

---

## The Human's Role

Two activities:

1. **Design features.** Work with an agent in `design/` — research, discuss, define, review. Creative, strategic, at your own pace.

2. **Fix errors.** When the pipeline halts, read the diagnostics, fix the problem, restart. Reactive, not routine.

The human can also:
- Inspect any stage while the pipeline runs (reviews are committed in real-time)
- Reorder features in `design/` at any time
- Intervene at any stage if they choose (optional, not required)

By default, the pipeline runs unattended. The human is notified on completion or error.

---

## Design Properties

1. **Sequential.** One feature at a time. No concurrency, no leases, no locks.
2. **Autonomous.** Full auto from `plan/` through `build/` to `done/`. No fixed human gates. The triage agent halts when it must.
3. **Self-contained.** The feature folder is the unit of work. Everything accumulates in it. When it reaches `done/`, it's a complete record.
4. **Fail-safe.** Error = halt. No partial states, no cascading failures. Evidence preserved in place.
5. **Resumable.** Check what artifacts exist, pick up from where you left off.

---

## The Pipeline Loop

```
loop:
  if error (pipeline halted):
    WAIT for human to fix and restart

  if build/ has a feature:
    process next unchecked task
    if all tasks done + acceptance tests pass:
      mv build/ → done/

  if plan/ has a feature:
    generate next missing artifact (specs, plans, tasks)
    if all artifacts generated and reviewed:
      mv plan/ → build/

  if plan/ and build/ are empty:
    if design/ has an approved feature (status=approved, depends_on resolved):
      mv design/ → plan/
    else:
      IDLE (wait for human to approve a feature)
```

---

## Design Rule

> **One feature. Four stages. Full auto. Halt on error. Folder is the record.**
