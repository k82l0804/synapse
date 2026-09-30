# Synapse Pipeline Architecture

> **Date:** 2026-09-29 (v5)  
> **Status:** Working draft  
> **Supersedes:** This document supersedes `specs/S-011` through `specs/S-015` and `specs/pipeline-signal-protocol.md`. Those specs are hereby marked **superseded**.

---

## Overview

Synapse processes features one at a time through a three-bin pipeline. The pipeline runs fully autonomous — no human gates — until the triage agent determines it cannot proceed, at which point the pipeline halts for human intervention.

```
  ┌──────────┐          ┌──────────┐          ┌──────────┐
  │ future/  │ ──next─▶ │ current/ │ ──done─▶ │  done/   │
  │ (queue)  │          │ (1 feat) │          │ (archive)│
  └──────────┘          └──────────┘          └──────────┘
       ▲                     │
       │         error? ─── HALT
       │         human fixes, restarts
       └─────────────────────┘
```

**One feature at a time.** The `current/` bin holds exactly one feature. When it completes, it moves to `done/` and the next feature moves from `future/` to `current/`.

**Full auto until error.** Agent reviews happen at every stage. The triage agent auto-fixes what it can (up to 3 iterations). If it can't resolve a problem, the pipeline halts and the human is prompted.

**The folder IS the record.** A feature enters `current/` as a single `feature.md`. As the pipeline processes it, specs, plans, tasks, reviews, and logs accumulate in the folder. When it moves to `done/`, the folder is a complete audit trail of everything that happened.

---

## The Bins

| Bin | Contents | Owner | Purpose |
|-----|----------|-------|---------|
| `future/` | Feature folders (each containing `feature.md`) | Human | Ordered queue of features to process next |
| `current/` | Exactly one feature folder being processed | Daemon | Active processing — all stages happen here |
| `done/` | Completed feature folders (full artifact trail) | Nobody | Archive — queryable via index |

### Transitions

| Transition | Trigger | What happens |
|-----------|---------|-------------|
| `future → current` | Daemon (auto) | Pipeline takes the next feature from queue. Processing begins. |
| `current → done` | Daemon (auto) | All tasks complete + acceptance tests pass. Feature archived. Next feature pulled. |
| Error in `current` | Triage agent | Pipeline **halts**. Feature stays in `current/`. Human prompted. |
| Human fixes error | Human | Human fixes the problem in `current/`, restarts pipeline. |

The human's job is to keep `future/` stocked with well-defined features, ordered by priority. Everything else is autonomous.

---

## Feature Processing Stages

When a feature enters `current/`, the pipeline runs these stages sequentially. Each stage has an agent review. The pipeline advances automatically on pass, halts on unresolvable failure.

```
1. SPEC GENERATION
   feature.md → agent generates specs → agent reviews specs
   Output: specs/ folder populated

2. PLAN GENERATION
   specs → agent generates plans (1:1 with specs) → agent reviews plans
   Output: plans/ folder populated

3. TASK LIST GENERATION
   plans → agent generates consolidated task checklist
   Output: tasks.md (checklist derived from all plans)

4. TASK PROCESSING
   For each task in tasks.md:
     → Implement (code changes)
     → Verify (typecheck, tests)
     → Code review (agent reviewer, different model)
     → Triage:
         Pass → mark task done, next task
         Auto-fixable → fix, re-verify (up to 3 iterations)
         Not fixable → HALT (human prompted)

5. FEATURE ACCEPTANCE
   All tasks done → run feature acceptance tests
   Pass → move to done/, pull next from future/
   Fail → HALT (human prompted)
```

### Stage Details

**1. Spec Generation.** The agent reads `feature.md` (scope, success metrics, in-scope items) and generates spec files — one per deliverable. Each spec has acceptance criteria, MUSTs, and verification commands. A different agent model reviews the specs.

**2. Plan Generation.** One plan per spec (1:1). Each plan details: file locations, proposed changes, architecture decisions, edge cases, verification steps. A different agent model reviews the plans.

**3. Task List Generation.** The agent reads all plans and generates a single `tasks.md` — a consolidated, ordered checklist of implementation steps. This is the agent's working todo list, not a formal artifact. It tracks progress as tasks are completed.

**4. Task Processing.** The core loop. For each task: implement, verify, code review. The code reviewer MUST be a different model from the implementer. The triage agent decides: pass, auto-fix (up to 3 iterations), or halt for human.

**5. Feature Acceptance.** Tests declared in `feature.md` that verify the feature works as a whole — not just that individual specs pass, but that the decomposition was correct. Catches composition failures.

### Agent Reviews

Every stage has an agent review. Reviews are committed to the feature's `reviews/` folder.

| Stage | Author | Reviewer | On failure |
|-------|--------|----------|------------|
| Spec generation | Planning agent | Review agent (different model) | Auto-fix up to 3x, then halt |
| Plan generation | Planning agent | Review agent (different model) | Auto-fix up to 3x, then halt |
| Code review | Implementing agent | Review agent (different model) | Auto-fix up to 3x, then halt |

**The triage agent** is the decision-maker at every failure point. It can:
- Auto-fix and retry (implementation errors, test failures, review findings)
- Halt and prompt the human (spec gaps, fundamental design issues, repeated failures)

---

## Feature Folder Structure

A feature enters `current/` with just `feature.md`. As the pipeline processes it, artifacts accumulate:

```
features/
  current/
    F-042-auth/
      feature.md              # human-authored: scope, metrics, acceptance tests
      specs/                   # stage 1: generated from feature.md
        S-042-login.md
        S-043-session.md
      plans/                   # stage 2: one per spec
        P-042.md
        P-043.md
      tasks.md                 # stage 3: consolidated checklist
      reviews/                 # accumulated at every stage
        2026-09-29T21-00_spec-review.md
        2026-09-29T21-15_plan-review.md
        2026-09-29T22-00_P-042-code-review.md
        2026-09-29T22-30_P-043-code-review.md
      logs/                    # agent output, errors, diagnostics
        spec-gen.log
        plan-gen.log
        P-042-implement.log
        P-043-implement.log
      .work/                   # gitignored: agent scratch, tool traces

  future/                      # queue: just feature.md in each folder
    F-043-settings/
      feature.md
    F-044-dark-mode/
      feature.md

  done/                        # archive: complete folders with all artifacts
    F-040-onboarding/
      feature.md
      specs/
      plans/
      tasks.md                 # all items ✅
      reviews/
      logs/
```

### Feature Definition (`feature.md`)

The only human-authored artifact:

```yaml
---
id: F-042
slug: auth
priority: 1
related: [F-041]
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

Everything else — specs, plans, tasks, reviews — is generated by the pipeline.

---

## Error Handling

**Simple rule: error = halt.**

When the triage agent determines a problem can't be auto-fixed:

1. Pipeline **stops**
2. Feature stays in `current/` exactly where it failed
3. Human is notified with a diagnostic (what failed, why, what was tried)
4. All artifacts remain in the folder — the human can inspect specs, plans, reviews, logs

**The human can:**
- Fix the issue (edit specs, add context, adjust the feature definition)
- Restart the pipeline (it resumes from where it left off)
- Remove the feature from `current/` and put it back in `future/` (defer)
- Remove the feature entirely (abandon)

**Resumption.** The pipeline reads the current state of artifacts to know where to pick up:
- Specs exist? Skip spec gen.
- Plans exist? Skip plan gen.
- `tasks.md` exists? Skip task gen, check which tasks are done.
- Task marked done? Skip it, process next unchecked task.

No special resume logic — the pipeline just checks what artifacts already exist and picks up from the first missing stage.

---

## The Human's Role

The human does two things:

1. **Design features.** Write `feature.md` files and queue them in `future/`, ordered by priority. This is the creative, strategic work.

2. **Fix errors.** When the pipeline halts, the human reads the diagnostic, fixes the problem, and restarts. This is reactive, not routine.

The human **can** also:
- Inspect any stage's output while the pipeline runs (reviews are committed in real-time)
- Intervene to approve/reject at any stage if they choose (optional, not required)
- Reorder `future/` at any time (pipeline only looks at the next feature)

But by default, the pipeline runs unattended. The human is notified on completion or error.

---

## Design Properties

**1. Sequential.** One feature at a time. No concurrency, no leases, no dependency resolution during execution. The human sequences features by ordering `future/`.

**2. Autonomous.** Full auto from `feature.md` through implementation, testing, and review. No fixed human gates. The triage agent decides when to halt.

**3. Self-contained.** The feature folder is the unit of work. Everything generated during processing lives in the folder. When it moves to `done/`, it's a complete, portable audit trail.

**4. Fail-safe.** Error = halt. No partial states, no cascading failures, no orphaned work. The feature sits in `current/` right where it failed, with all evidence intact.

**5. Resumable.** The pipeline reads artifact state to determine where to pick up. Crash recovery is just: restart the pipeline.

---

## The Processing Loop

```
loop:
  if current/ is empty:
    if future/ is empty:
      IDLE (wait for human to queue features)
    else:
      move next feature from future/ to current/

  feature = current/*/

  if no specs/:
    generate specs → agent review → if fail after 3x: HALT
  if no plans/:
    generate plans → agent review → if fail after 3x: HALT
  if no tasks.md:
    generate task list

  for each unchecked task in tasks.md:
    implement → verify → code review
    if review fails:
      triage: auto-fix? → retry (up to 3x)
      triage: can't fix? → HALT (notify human)
    mark task done in tasks.md

  run feature acceptance tests
  if fail: HALT (notify human)

  move feature to done/
  goto loop
```

---

## What This Simplifies

| Previous model (v4) | This model (v5) |
|---------------------|----------------|
| Four bins (future, current, error, done) | Three bins (future, current, done) |
| Multiple features in current/ | One feature at a time |
| SQLite lease management | No leases needed |
| blocked_by dependency resolution | Human sequences features in future/ |
| Error bin + halt-on-error policy | Error = halt in place |
| Handoff validation (check error bin) | No validation needed — one at a time |
| Spec gate (human approves specs) | Full auto — triage agent halts if needed |
| Complex failure taxonomy (failed, superseded, escalated) | Two states: processing or halted |
| Status authority split (human vs daemon) | Daemon owns all status in current/ |
| Feature-batched spec approval | No batching — one feature, one flow |

---

## Design Rule

> **One feature. Full auto. Halt on error. Folder is the record.**
