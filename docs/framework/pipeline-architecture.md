# Synapse Pipeline Architecture

> **Date:** 2026-09-30 (v8)  
> **Status:** Working draft  
> **Supersedes:** `specs/S-011` through `specs/S-015` and `specs/pipeline-signal-protocol.md` are hereby marked **superseded**.

## Overview

Synapse is a pipeline that processes **changes** — one at a time, through four stages.

```
design/  →  plan/  →  build/  →  done/
```

A **change** is the unit that flows through the pipeline. Features, bug fixes, refactors, chores, and spikes are all changes — they share the same bins and the same move rules, with kind-specific templates and done tests.

The pipeline is autonomous between three human gates. Agents draft and execute. The human owns the product: approving the brief, approving the spec set, and accepting the result.

A pipeline with today's best models is a strong junior staff: fast drafts, fast implementation of agreed work, decent self-check against tests. It is not a PM, a tech lead, and a user rolled into one process. Wrong intent compiles all the way to green. The three gates are where the human catches that.

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
- **Reviewers never see the generation transcript.** They receive the artifact + its parent (feature/spec) only.
- **Triage never sees the generation transcript.** It receives the artifact + two review reports + rubric.
- **Triage cannot edit files.** If fixes are needed, a separate Author run applies them.
- **Auto-advance is illegal at gates.** Brief, spec set, and acceptance always require the human, regardless of reviewer approval.

**At any RC, the human may optionally inspect and approve/reject.** The RC runs autonomously by default — the human is not required unless triage routes to them.

Shorthand: **RC** means this full cycle. When the doc says "→ RC", it means dual review + triage.

---

## The Three Gates

Not every review point needs the human. But three do — because they freeze intent, and wrong intent is expensive to unwind.

| Gate | When | Human role | Why |
|------|------|-----------|-----|
| **Brief Gate** | `design/ → plan/` | **Always. Hard gate.** | This is the intent. Scope, non-goals, vocabulary, what you refuse to build. |
| **Spec Gate** | After specs generated in `plan/` | **Always. Hard gate.** Review the spec *set*, not individual files. | This freezes architecture and seams. "We shouldn't be building this module at all" can only be caught here. |
| **Acceptance Gate** | `build/ → done/` | **Always. Hard gate.** Run it, use it, decide it's the thing you meant. | Green tests ≠ the product you wanted. Acceptance is a product act, not a test result. |

Between the gates, agents run autonomously. Plans, task lists, code diffs — the human skims if they want. The human's job shifts from *writing* to *spotting invention*: a helper class, a new flag, a "while I was here" abstraction that wasn't in the brief.

### Two Classes of Artifact

| Class | Examples | Human role |
|-------|---------|-----------|
| **Product artifacts** | Brief, spec set, acceptance criteria | Human is author of record. Agents draft. Human edits until they'd defend the text. |
| **Execution artifacts** | Plans, task lists, code behind a frozen spec | Agents run. Human glances at the plan, watches the tests, inspects risky files. Pulls the brake only when the implementation invents scope. |

---

## The Four Stages

```
┌──────────┐  BRIEF     ┌──────────┐  SPEC     ┌──────────┐  ACCEPT   ┌──────────┐
│ design/  │ ──GATE───▶ │  plan/   │ ──GATE──▶ │  build/  │ ──GATE──▶ │  done/   │
│(design it)│            │ (plan it)│           │(build it)│           │(shipped) │
│human+agent│            │autonomous│           │autonomous│           │ archive  │
└──────────┘            └──────────┘           └──────────┘           └──────────┘
```

| Stage | Bin | What happens | Done test |
|-------|-----|-------------|-----------|
| **Design** | `design/` | Human and agent research, discuss, define the change. Agent writes `BRIEF.md`. → RC → **Brief Gate** (human approves). | Brief reviewed, approved by human |
| **Plan** | `plan/` | Daemon generates specs → RC → **Spec Gate** (human approves set) → generates plans → RC → generates task list. | All specs, plans, task list generated; specs approved by human |
| **Build** | `build/` | Daemon processes task list: implement → verify → RC. Per task. Then acceptance tests. → **Acceptance Gate** (human accepts). | All tasks complete + acceptance tests pass + human accepts |
| **Done** | `done/` | Complete. Change folder is a full audit trail. | — |

### Handoffs

| Handoff | Trigger | Admission rule |
|---------|---------|---------------|
| `design/ → plan/` | **Human** (Brief Gate) | Brief reviewed, approved, all `depends_on` resolved |
| Spec Gate (within `plan/`) | **Human** | Spec set reviewed as a set, approved by human |
| `plan/ → build/` | Daemon (auto) | Plans + task list generated and reviewed |
| `build/ → done/` | **Human** (Acceptance Gate) | All tasks complete + acceptance tests pass + human accepts |

### Error at Any Stage

Error = halt. The change stays in whichever bin it's in. The pipeline stops. The human is notified, inspects the folder, fixes the problem, and restarts.

---

## Change Folder Structure

A change enters `design/` as just `BRIEF.md`. Artifacts accumulate as it moves through stages.

### In `design/`
```
changes/design/auth-login/
  BRIEF.md              # kind: feature | fix | refactor | chore | spike
```

```
changes/design/fix-geofence-race/
  BRIEF.md              # kind: fix
```

### In `plan/` (after spec + plan generation)
```
changes/plan/auth-login/
  BRIEF.md
  specs/
    S-042-login.md
    S-043-session.md
  plans/
    P-042.md
    P-043.md
  tasks.md
  reviews/
    spec-review.md
    plan-review.md
  logs/
```

### In `build/` (implementation artifacts accumulate)
```
changes/build/auth-login/
  BRIEF.md
  specs/
  plans/
  tasks.md                     # tasks checked off as completed
  reviews/
    spec-review.md
    plan-review.md
    P-042-code-review.md
    P-043-code-review.md
  logs/
  .work/                       # gitignored: agent scratch
```

### In `done/` (complete audit trail)
```
changes/done/auth-login/
  BRIEF.md
  specs/
  plans/
  tasks.md                     # all items ✅
  reviews/
  logs/
```

---

## The Design Stage

**Mode:** Interactive (human + agent)  
**What happens:** The human and agent collaborate to define a change.

### Process

1. **Research.** Human provides documents, URLs, domain knowledge. Agent researches, analyzes, synthesizes.
2. **Discuss.** Human and agent iterate on scope, constraints, success metrics.
3. **Write.** Agent writes `BRIEF.md` — including traceability matrix citing sources.
4. **RC** — a different agent reviews for completeness, clarity, testability.
5. **Brief Gate** — human approves. The change enters the pipeline.

### The Change: Kind System

Every `BRIEF.md` declares a `kind`. Same bins, same pipeline. Different template fields and done tests per kind.

| Kind | What `design/` must freeze | What `plan/` must produce | `build/ → done/` means |
|------|--------------------------|--------------------------|------------------------|
| `feature` | Problem, user, scope, non-goals, vocabulary | Spec set + plans + tasks | Acceptance tests pass + you used it |
| `fix` | Repro, expected behavior, blast radius, what not to "also clean up" | Tight spec or single plan | Repro is dead; no extra scope landed |
| `refactor` | Why, seam, behavior that must not change | Plan + characterization tests | Behavior unchanged; structure changed |
| `chore` | Why now, blast radius | Often a task list, not a spec set | The chore is done; nothing else rode along |
| `spike` | Question, time box, decision needed | Optional thin plan | Written answer; no shipped product |

Admission rules can be kind-specific (a `chore` may skip multi-spec review if the brief says so). The bins stay `design/ plan/ build/ done/`.

### BRIEF.md Template

Every change, regardless of kind:

```yaml
---
kind: feature              # feature | fix | refactor | chore | spike
status: draft              # draft | review | approved
depends_on: []             # slugs that must be in done/ before this enters plan/
related: []                # informational only
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
Executable done test (if going to build/). Prose is not enough.
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

The daemon refuses to admit a change to `plan/` if `kind` or `done-when` is missing.

### Dependencies

- A change **cannot enter `plan/`** if any `depends_on` targets are still in `design/`
- When approving a dependency set, move them in dependency order
- The pipeline is sequential — the dependency reaches `done/` before the dependent starts

### Multiple Changes Baking

`design/` holds multiple changes concurrently in various states. This is the creative workspace. The pipeline never looks here.

---

## The Plan Stage

**Mode:** Autonomous (with one human gate for specs)  
**What happens:** The daemon generates all artifacts needed for implementation.

### Process

```
BRIEF.md → gen specs → RC → SPEC GATE (human approves set) → gen plans → RC → gen tasks
```

1. **Generate specs.** One per deliverable, each with acceptance criteria. (`fix` and `chore` may produce one plan directly — no spec set needed if the brief says so.)
2. **RC** — different agent reviews specs.
3. **Spec Gate** — **human reviews the spec set as a set** (not individual files). This freezes architecture. Human approves or sends back.
4. **Generate plans.** One per spec (1:1). File locations, changes, edge cases, verification.
5. **RC** — different agent reviews plans. (Human skims if they want — low leverage if spec was tight.)
6. **Generate task list.** Consolidated, ordered checklist from all plans.

### Done Test

Specs approved by human. Plans and task list generated and reviewed. → `mv plan/ → build/`.

---

## The Build Stage

**Mode:** Autonomous (with human acceptance at the end)  
**What happens:** The daemon processes the task list.

### Process

```
For each unchecked task in tasks.md:
  → Implement → Verify → RC
  → Triage: pass → next task | auto-fix (3x) | halt

All tasks done:
  → Run done-when tests (from BRIEF.md)
  → ACCEPTANCE GATE (human runs it, verifies it's the thing they meant)
  → Pass → mv build/ → done/
```

### Done Test

All tasks complete ✅ + done-when tests pass + **human accepts**.

---

## Error Handling

**Error = halt.** The triage agent auto-fixes what it can (up to 3 iterations). If it can't resolve the problem, the pipeline halts.

When halted:
- Change stays in its current bin with all evidence intact
- Human is notified with what failed, why, and what was tried
- Pipeline cannot resume until the human addresses it

The human can:
- Fix the issue and restart
- Move the change back to `design/` for rethinking
- Remove the change entirely

### Resumption

Check what artifacts exist, pick up from the first missing piece:
- No specs? → Start spec generation
- Specs exist, no plans? → Start plan generation  
- Plans exist, no tasks? → Generate task list
- Tasks exist? → Process next unchecked task

---

## The Human's Role

Three gates and one workspace:

1. **Design features** in `design/` — research, discuss, define (creative work, at your pace)
2. **Feature Gate** — approve the feature (scope, non-goals, what you refuse to build)
3. **Spec Gate** — approve the spec set (architecture, seams, decomposition)
4. **Acceptance Gate** — accept the result (run it, use it, is this the thing you meant?)

Between the gates: agents run. The human's scarce resource is **judgment at freeze points**, not eyeballs on every markdown file.

---

## Design Properties

1. **Sequential.** One feature at a time. No concurrency, no leases.
2. **Gated.** Three human gates at intent-freezing points. Autonomous between them.
3. **Self-contained.** Feature folder accumulates everything. `done/` is a complete record.
4. **Fail-safe.** Error = halt. Evidence preserved in place.
5. **Resumable.** Check what exists, pick up where you left off.

---

## The Pipeline Loop

```
loop:
  if halted:
    WAIT for human to fix and restart

  if build/ has a feature:
    process next unchecked task → verify → RC
    if all tasks done:
      run acceptance tests
      WAIT for human acceptance (Acceptance Gate)
      mv build/ → done/

  if plan/ has a feature:
    if no specs: gen specs → RC → WAIT for Spec Gate
    if specs approved but no plans: gen plans → RC
    if plans but no tasks: gen tasks
    if all artifacts ready: mv plan/ → build/

  if plan/ and build/ empty:
    if design/ has approved feature (depends_on resolved):
      mv design/ → plan/
    else:
      IDLE
```

## Roles & Tiers

The pipeline has seven roles. Each role requires a specific tier of model capability. Roles are abstract — the actual vendor and model assignment is configuration.

### Pipeline Roles

| Role | What it does | Constraints |
|------|-------------|-------------|
| **Author** | Generates artifacts (features, specs, plans) | One vendor family per feature. Consistency in voice and vocabulary. |
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
| Gates (Feature, Spec, Accept) | — | **You** | — |

**Why this split:** Claude is the strongest structured author. Grok punches at scope and vagueness. Gemini catches coverage and cross-file seams. Two vendors disagreeing is the review you want — not one vendor talking to itself.

**Cost allocation:** Spend flagship tokens on *author once* and *two reviews of design artifacts*. Spend fast tokens on *triage and most implementation*. Spend your time on *three gates*.

---

## Design Rule

> **One feature. Four stages. Three gates. Halt on error. Folder is the record.**
