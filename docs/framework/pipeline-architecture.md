# Synapse Pipeline Architecture

> **Date:** 2026-09-30 (v9)  
> **Status:** Working draft  
> **Supersedes:** v8 (four-bin model). `specs/S-011` through `specs/S-015` and `specs/pipeline-signal-protocol.md` are marked **superseded**.

## Overview

Synapse is a pipeline that runs on the developer's machine and processes **changes** — one at a time, through three bins.

```
future/  →  current/  →  done/
```

A **change** is the unit that flows through the pipeline. Features, bug fixes, refactors, chores, and spikes are all changes — they share the same bins and the same pipeline loop, with kind-specific templates and done tests.

A change folder starts in `future/`. When the developer is ready, it moves to `current/`. Stages (specs, plans, tasks, build) happen *inside* the folder — artifacts accumulate, and each stage is marked complete by a `done.md` file. When the whole change is done, the folder moves to `done/`.

The pipeline is autonomous between human approval points. Agents draft and execute. The human owns the product: approving the change, approving the spec set, and accepting the result.

A pipeline with today's best models is a strong junior staff: fast drafts, fast implementation of agreed work, decent self-check against tests. It is not a PM, a tech lead, and a user rolled into one process. Wrong intent compiles all the way to green. The approval points are where the human catches that.

On a team, each developer runs their own pipeline on their own branch. Team coordination — ticket assignment, code merging, release management — uses existing tools (Jira, GitLab, etc.). Synapse manages the individual developer's workflow from change to done.

---

## The Review Cycle (RC)

Every artifact produced in the pipeline goes through the same cycle. Define it once, use it everywhere.

```
Author produces artifact
  → Reviewer A reviews (different vendor from Author)
  → Reviewer B reviews (third vendor)
  → Triage (not Author's vendor) applies rubric:
      Both approve, nits only        → auto_advance (or send_back for nit fixes)
      Freeze-point artifact          → human
      Reviewers disagree             → human
      New public surface / behavior  → human
      Still failing after 3 fix iterations → HALT
```

**Structural rules:**
- **One author family per change.** All generation for a change uses the same vendor. Vocabulary drift across vendors looks like design drift.
- **Reviewers never see the generation transcript.** They receive the artifact + its parent only.
- **Triage never sees the generation transcript.** It receives the artifact + two review reports + rubric.
- **Triage cannot edit files.** If fixes are needed, a separate Author run applies them.
- **Auto-advance is illegal at approval points.** Change, spec set, and acceptance always require the human, regardless of reviewer approval.

**At any RC, the human may optionally inspect and approve/reject.** The RC runs autonomously by default — the human is not required unless triage routes to them.

Shorthand: **RC** means this full cycle. When the doc says "→ RC", it means dual review + triage.

---

## The Three Bins

```
┌──────────┐            ┌──────────────────────────┐            ┌──────────┐
│ future/  │ ─────────▶ │       current/           │ ─────────▶ │  done/   │
│ (queue)  │  one at    │  (stages happen inside)  │   when     │(archive) │
│          │  a time    │                          │  done.md   │          │
└──────────┘            └──────────────────────────┘   exists   └──────────┘
```

| Bin | Purpose | Contents |
|-----|---------|----------|
| `future/` | Queue of upcoming changes | One folder per change, each containing `change.md` |
| `current/` | The one active change | At most one change folder, with artifacts accumulating inside |
| `done/` | Completed changes | Full audit trail — change.md + specs + plans + tasks + done.md |

**`current/` has at most one folder.** This enforces "one change at a time" physically, not by policy.

---

## The Pipeline Loop

The daemon watches the filesystem and advances through stages:

```
loop:
  if current/ is empty AND future/ has folders:
    move next change-folder from future/ to current/

  folder = current/C-NNN/

  if folder/change.md not approved:
    WAIT (human + agent collaborate on change, then human approves)

  if folder/specs/ missing:
    run spec-gen → RC

  if folder/specs/reviews/done.md missing:
    WAIT (human approves spec set)

  if folder/plans/ missing:
    run plan-gen → RC

  if folder/plans/reviews/done.md missing:
    WAIT (human reviews, or auto-advance for non-product artifacts)

  if folder/tasks/ missing:
    run task-gen

  if folder/tasks/reviews/done.md missing:
    run build (implement → verify → RC per task)
    when all tasks pass: create tasks/reviews/done.md

  if folder/done.md missing:
    run done-when tests from change.md
    WAIT for human acceptance (Acceptance Gate)
    create done.md

  if folder/done.md exists:
    move folder to done/
```

**Resumption is free.** If the pipeline crashes, restart it. It checks what files exist and picks up at the first missing piece.

---

## Stage Completion: `done.md`

Each stage is marked complete by a `done.md` file in the appropriate directory. This file serves three purposes:

1. **Gate record** — who approved, when
2. **Stage marker** — daemon uses it to decide the next step
3. **Audit trail** — the approval is right there in the change folder

```markdown
# done.md (example: specs/reviews/done.md)

Approved by: jane.smith
Date: 2026-09-30T17:25:00Z
RC iterations: 2
Notes: Good decomposition. S-02 is tight. Proceed to plans.
```

**Rollback:** Delete `specs/reviews/done.md` and the daemon reverts to waiting for spec approval. The specs themselves are unchanged — the human can request revisions.

### Who Creates `done.md`

| Stage | Who creates done.md | Why |
|-------|-------------------|-----|
| `change.md` approval | Human (always) | This is intent. Only the human freezes scope. |
| `specs/reviews/done.md` | Human (always) | This freezes architecture. |
| `plans/reviews/done.md` | Human or daemon (configurable) | Plans are execution. Human skims if they want. |
| `tasks/reviews/done.md` | Daemon (auto) | All tasks verified. Mechanical check. |
| `done.md` (top-level) | Human (always) | Acceptance. Run it, use it, is this the thing you meant? |

---

## Change Folder Structure

A change enters `future/` as just `change.md`. Artifacts accumulate as it progresses through `current/`.

### In `future/` (queued)

```
future/
  C-041/
    change.md
  C-042/
    change.md
  C-043/
    change.md
```

### In `current/` (active — stages accumulate)

```
current/
  C-040/
    change.md                    # the input artifact
    specs/                       # appears during spec-gen
      S-01.md
      S-02.md
      S-03.md
      reviews/                   # RC artifacts for this stage
        iter-1-reviewer-a.md
        iter-1-reviewer-b.md
        iter-1-triage.md
        done.md                  # human approved spec set
    plans/                       # appears during plan-gen
      P-01.md
      P-02.md
      P-03.md
      reviews/
        reviewer-a.md
        reviewer-b.md
        triage.md
        done.md                  # plans approved
    tasks/                       # appears during task-gen
      T-01.md
      T-02.md
      T-03.md
      reviews/
        T-01-code-review.md
        T-02-code-review.md
        done.md                  # all tasks verified
    logs/                        # timestamped, append-only
    .work/                       # gitignored: agent scratch
```

### In `done/` (complete audit trail)

```
done/
  C-039/
    change.md
    specs/
      S-01.md, S-02.md, S-03.md
      reviews/
        done.md
    plans/
      P-01.md, P-02.md, P-03.md
      reviews/
        done.md
    tasks/
      T-01.md, T-02.md, T-03.md
      reviews/
        done.md
    logs/
    done.md                      # top-level: human accepted
```

---

## The `change.md` Template

Every change, regardless of kind:

```yaml
---
kind: feature                # feature | fix | refactor | chore | spike
ticket: JIRA-123             # optional: link to external tracker
status: draft                # draft | approved
depends_on: []               # C-NNN IDs that must be in done/ before this starts
priority: P1                 # P0 (critical) | P1 (high) | P2 (medium) | P3 (low)
sources:
  - type: document
    path: docs/research/auth-comparison.md
    note: "All competitors support SSO"
  - type: url
    url: https://oauth.net/2.1/
    note: "OAuth 2.1 spec reference"
  - type: conversation
    id: 4652af63-...
    note: "Design discussion on auth requirements"
---

# auth-login

## Intent
One sentence: what this change does.

## Non-Goals
What we will not build or fix as part of this change.

## Done-When
Executable done test (if going to build). Prose is not enough.
- test: "bun test test/e2e/login.test.ts"
- test: "bun test test/e2e/session.test.ts"

## Blast Radius
Repos, APIs, users affected.

## Kind-Specific Fields
# (feature: scope, success metrics, in-scope items)
# (fix: repro steps, expected behavior)
# (refactor: seam, behavior invariants)
# (chore: why now)
# (spike: question, time box)
```

The daemon refuses to move a change from `future/` to `current/` if `kind` or `done-when` is missing.

### The Change: Kind System

Every `change.md` declares a `kind`. Same bins, same pipeline. Different template fields and done tests per kind.

| Kind | What the change must freeze | What spec/plan must produce | Done means |
|------|---------------------------|---------------------------|------------|
| `feature` | Problem, user, scope, non-goals, vocabulary | Spec set + plans + tasks | Acceptance tests pass + you used it |
| `fix` | Repro, expected behavior, blast radius, what not to "also clean up" | Tight spec or single plan | Repro is dead; no extra scope landed |
| `refactor` | Why, seam, behavior that must not change | Plan + characterization tests | Behavior unchanged; structure changed |
| `chore` | Why now, blast radius | Often a task list, not a spec set | The chore is done; nothing else rode along |
| `spike` | Question, time box, decision needed | Optional thin plan | Written answer; no shipped product |

Admission rules can be kind-specific (a `chore` may skip spec-gen if the change.md says so).

### Dependencies

- A change **cannot move to `current/`** if any `depends_on` targets are not in `done/`
- The pipeline is sequential — the dependency completes before the dependent starts
- `depends_on` references C-NNN IDs, which map to folder names

### Queue Ordering

`future/` holds changes in priority order. The daemon picks the next change by:
1. **Dependency resolution** — skip changes whose `depends_on` are not in `done/`
2. **Priority** — P0 before P1 before P2 before P3
3. **Order** — lower C-NNN first (FIFO within same priority)

---

## The Design Stage

**Mode:** Interactive (human + agent)  
**Where:** Change starts in `future/`. Human and agent collaborate before moving to `current/`.

### Process

1. **Research.** Human provides documents, URLs, domain knowledge. Agent researches, analyzes, synthesizes.
2. **Discuss.** Human and agent iterate on scope, constraints, success metrics.
3. **Write.** Agent writes `change.md` — including traceability citations in sources.
4. **RC** — a different agent reviews for completeness, clarity, testability.
5. **Human approves** — sets `status: approved` in change.md. The change is ready for `current/`.

---

## The Spec Stage

**Mode:** Autonomous (with human gate)  
**What happens:** The daemon generates specs from the approved change.md.

### Process

1. **Generate specs.** One per deliverable, each with acceptance criteria. (`fix` and `chore` may produce one spec or skip to a direct plan.)
2. **RC** — different agent reviews specs.
3. **Human approves** — creates `specs/reviews/done.md`. Architecture is frozen.

---

## The Plan Stage

**Mode:** Autonomous (human reviews optionally)  
**What happens:** The daemon generates plans from the approved specs.

### Process

1. **Generate plans.** One per spec (1:1). File locations, changes, edge cases, verification.
2. **RC** — different agent reviews plans.
3. **Plans approved** — `plans/reviews/done.md` created (by human or daemon, depending on configuration).

---

## The Task & Build Stage

**Mode:** Autonomous (with human acceptance at the end)  
**What happens:** The daemon generates tasks and implements them.

### Process

```
Generate task list from plans
  → For each task:
      → Implement → Verify → RC
      → Triage: pass → next task | auto-fix (3x) | halt
  → All tasks done: create tasks/reviews/done.md
  → Run done-when tests (from change.md)
  → ACCEPTANCE GATE (human runs it, verifies it's the thing they meant)
  → Human creates done.md → daemon moves folder to done/
```

---

## Error Handling

**Error = halt.** The triage agent auto-fixes what it can (up to 3 iterations). If it can't resolve the problem, the pipeline halts.

When halted:
- Change stays in `current/` with all evidence intact
- Human is notified with what failed, why, and what was tried
- Pipeline cannot resume until the human addresses it

The human can:
- Fix the issue and restart (pipeline resumes from the missing `done.md`)
- Delete sub-stage artifacts to retry (e.g., delete `plans/` to regenerate)
- Move the change back to `future/` for rethinking
- Remove the change entirely

---

## The Human's Role

Three approval points and one workspace:

1. **Design changes** in `future/` — research, discuss, define (creative work, at your pace)
2. **Approve the change** — scope, non-goals, what you refuse to build (set status: approved)
3. **Approve the spec set** — architecture, seams, decomposition (create specs/reviews/done.md)
4. **Accept the result** — run it, use it, is this the thing you meant? (create done.md)

Between the approvals: agents run. The human's scarce resource is **judgment at freeze points**, not eyeballs on every markdown file.

---

## Two Classes of Artifact

| Class | Examples | Human role |
|-------|---------|-----------| 
| **Product artifacts** | change.md, spec set, acceptance criteria | Human is author of record. Agents draft. Human edits until they'd defend the text. |
| **Execution artifacts** | Plans, task lists, code behind a frozen spec | Agents run. Human glances at the plan, watches the tests, inspects risky files. Pulls the brake only when the implementation invents scope. |

---

## Design Properties

1. **Sequential.** One change at a time in `current/`. No concurrency.
2. **Gated.** Three human approval points at intent-freezing moments. Autonomous between them.
3. **Self-contained.** Change folder accumulates everything. `done/` is a complete record.
4. **Fail-safe.** Error = halt. Evidence preserved in place.
5. **Resumable.** Check what `done.md` files exist, pick up where you left off.
6. **File-driven.** State is the filesystem. `done.md` existence is the state machine.

---

## Roles & Tiers

The pipeline has seven roles. Each role requires a specific tier of model capability. Roles are abstract — the actual vendor and model assignment is configuration.

### Pipeline Roles

| Role | What it does | Constraints |
|------|-------------|-------------|
| **Author** | Generates artifacts (changes, specs, plans) | One vendor family per change. Consistency in voice and vocabulary. |
| **Fixer** | Revises artifacts after review findings | Same family as Author. Keeps names and structure stable. |
| **Reviewer A** | First independent review | Must be different vendor from Author. |
| **Reviewer B** | Second independent review | Must be different vendor from both Author and Reviewer A. |
| **Triage** | Decides: `auto_advance` \| `human` \| `send_back` | Must NOT be Author's family. Fresh context. Rubric only. |
| **Implementer** | Writes code behind frozen specs | Can drop a tier. Volume over taste. |
| **Impl Reviewer** | Reviews risky diffs during build | Different vendor from Implementer. Catches invented scope. |

### Model Tiers

Three tiers, defined by capability class, not by vendor:

| Tier | Capability | Use for |
|------|-----------|--------|
| **Flagship** | Best reasoning, longest context, highest quality | Authoring product artifacts, reviewing design artifacts |
| **Mid** | Good reasoning, good tool use, cost-efficient | Implementation, routine plan generation |
| **Fast** | Structured output, quick, cheap | Triage, mechanical tasks, high-volume calls |

### Role → Tier Mapping

| Role | Required Tier | Why |
|------|--------------|-----|
| Author | Flagship | Product quality. One voice across the artifact set. |
| Fixer | Flagship | Same model as Author. Consistency. |
| Reviewer A | Flagship | Must catch scope creep, vagueness, unjustified additions. |
| Reviewer B | Flagship | Must catch set-level coverage gaps and cross-artifact drift. |
| Triage | Fast | Rubric only. Cheap is fine. Independence matters more than intelligence. |
| Implementer | Mid or Fast | Spec is frozen. Paying for turns and tools, not product taste. |
| Impl Reviewer | Flagship | Catches invented surface area. One critic, not a second author. |

### Harness Tiers (Current)

Available agent harnesses and their model tiers:

| Harness | CLI | Flagship | Mid | Fast |
|---------|-----|----------|-----|------|
| **Claude** | `claude -p` | Opus 5 | Sonnet 4.6 | Haiku |
| **Grok** | `grok -p` | Grok 4.7 | — | — |
| **Gemini (AGY)** | `agy -p` | Gemini 2.5 Pro | Gemini 2.5 Flash | Flash Lite |

### Current Assignment (Example)

This is the current recommended assignment. It is a configuration, not architecture — swap vendors as models improve.

| Role | Harness | Model | Tier |
|------|---------|-------|------|
| Author | Claude | Opus 5 | Flagship |
| Fixer | Claude | Opus 5 | Flagship |
| Reviewer A | Grok | Grok 4.7 | Flagship |
| Reviewer B | Gemini (AGY) | Gemini 2.5 Pro | Flagship |
| Triage | Gemini (AGY) | Gemini 2.5 Flash | Fast |
| Implementer | Claude | Sonnet 4.6 | Mid |
| Impl Reviewer | Grok | Grok 4.7 | Flagship |
| Approval Points | — | **You** | — |

**Why this split:** Claude is the strongest structured author. Grok punches at scope and vagueness. Gemini catches coverage and cross-file seams. Two vendors disagreeing is the review you want — not one vendor talking to itself.

**Cost allocation:** Spend flagship tokens on *author once* and *two reviews of design artifacts*. Spend fast tokens on *triage and most implementation*. Spend your time on *three approval points*.

---

## Design Rule

> **One change. Three bins. Three approval points. Halt on error. Folder is the record. `done.md` is the state machine.**
