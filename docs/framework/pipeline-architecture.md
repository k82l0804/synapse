# Synapse Pipeline Architecture — Conceptual Foundation

> **Date:** 2026-09-29 (v3)  
> **Status:** Working draft — incorporates Plod Opus-5 review findings  
> **Context:** Derived from analyzing how fox-code-cli was actually built (Phases 1–2H, 40+ completed plans). Refined with external batch-processing review and Plod architecture review (2026-09-29T20-18).  
> **Supersedes:** This document supersedes the pipeline model described in `specs/S-011` through `specs/S-015` and `specs/pipeline-signal-protocol.md`. Those specs described a flat-directory, 15-step, product-scoped pipeline with PLAN GATE and signal protocol. This document replaces that model with feature-scoped directories, a double-buffer pipeline, query-driven scheduling, and bin-based coordination. Specs S-011–S-015 are hereby marked **superseded**. Any work in `tasks/current/` that references those specs should be re-scoped to implement this architecture instead.

---

## The Double-Buffer Pipeline

Synapse is a single pipeline with two async stages connected by a queue — like a graphics rendering pipeline where the CPU prepares the next frame while the GPU renders the current one.

```
┌─────────────────────┐     ┌──────────────┐     ┌──────────────────────┐
│   DESIGN STAGE      │     │    QUEUE      │     │   EXECUTION STAGE    │
│   (human-driven)    │────▶│  (the swap    │────▶│   (agent-driven)     │
│                     │     │   buffer)     │     │                      │
│  Research           │     │              │     │  Create plans         │
│    → Features       │     │  Approved    │     │    → Implement        │
│      → Specs        │     │  feature     │     │      → Test           │
│        → Approve    │     │  spec sets   │     │        → Review       │
│          → Next...  │     │              │     │          → Done       │
│                     │     │              │     │                      │
│                     │◀────│──────────────│◀────│                      │
│  Handle escalations │     │  Escalation  │     │  Escalate failures   │
└─────────────────────┘     │  backflow    │     └──────────────────────┘
                            └──────────────┘
```

**Key properties:**

1. **Decoupled.** The human doesn't wait for agents to finish before designing the next feature. Agents don't wait for the human to approve before processing the next item in the queue. Both stages run at their own pace.

2. **No tearing.** Artifacts in the execution stage are **frozen** — the human cannot edit specs that are currently being executed against. If the execution stage finds a spec problem, it escalates the feature back to the design stage, where mutation is safe. (See §Bin System.)

3. **Throughput-limited by the slower stage.** If the human designs faster than agents can build, the queue grows. If agents build faster than the human designs, the queue empties and agents idle. The system self-balances.

4. **Artifact-driven.** The queue IS the artifacts. An approved feature sitting in the `current` bin is a queue entry. No separate job queue, no hand-edited manifest — the filesystem is the buffer.

### Consistency with Proven Practice

The execution stage faithfully reflects how fox-code-cli was built: plans as the substantive artifact, todos as scratch, green tests = done, phase-based batching. The design stage (human-approves-spec-sets-then-agents-run) is **new** — fox-code-cli had no pre-approved specs; `feature-registry.yaml` was post-hoc coverage. This model has earned confidence for execution but not yet for design. This document states that plainly so confidence is calibrated.

---

## Three Artifacts, Not Four

| Artifact | Purpose | Who creates | Who approves |
|----------|---------|-------------|-------------|
| **Feature** | "What to build" — scope, success metrics, in-scope items, acceptance tests | Human (with agent research assistance) | Human |
| **Spec** | "The contract" — acceptance criteria, MUSTs, verification | Agent drafts, human reviews | Human (batch per feature) |
| **Plan** | "How to build it" — file changes, architecture, edge cases, tests | Agent creates from approved spec | Agent (peer review, different model) |

### What Happened to Tasks?

In the proven fox-code-cli workflow, "tasks" were two things:
- **Scheduling entries** — checkboxes in phase files ("which plans are in this batch?")
- **Progress trackers** — todo lists agents create from plans ("where am I?")

Neither is a formal artifact. The plan contains all the substance (what to change, how to verify, edge cases). The todo list is a working memory aid for the agent — derived mechanically from the plan, updated as work progresses. Agent scratch (todos, traces, session state) lives in `.work/` and is gitignored.

### Plan-to-Spec Cardinality: 1:1

One plan per spec. If a spec is too big for one plan, split the spec. This keeps the done predicate clean: spec done = its plan done. No ambiguity about partial satisfaction.

---

## The Bin System

The two pipelines are **not** fully independent. They coordinate through a **bin system** — three bins that enforce immutability during execution and clean handoffs between stages.

```
  DESIGN STAGE                           EXECUTION STAGE

  ┌─────────────┐    handoff    ┌─────────────┐   complete   ┌─────────┐
  │   future/   │ ──────────▶  │  current/   │ ──────────▶ │  done/  │
  │  (editable) │              │  (FROZEN)   │             │(archived)│
  │             │ ◀────────── │             │             │         │
  └─────────────┘  escalation  └─────────────┘             └─────────┘
       ▲                                                        │
       │              explicit batched archive                  │
       └────────────────────────────────────────────────────────┘
```

### Bin Rules

| Bin | Owner | Mutable? | Meaning |
|-----|-------|----------|---------|
| `future/` | Human | **Yes** — specs can be edited, revised, reorganized | Features being designed; not yet handed to agents |
| `current/` | Daemon | **No** — frozen while in execution | Features the daemon has claimed and is processing |
| `done/` | Nobody | **No** — archived | Features that passed all verification and acceptance |

### Transitions

| Transition | Who triggers | What happens |
|-----------|-------------|-------------|
| `future → current` | **Human** (the handoff) | Human moves approved feature(s) to `current`. This is the buffer swap. Specs are now frozen. |
| `current → done` | **Daemon** (completion) | All plans verified green + feature acceptance tests pass. Daemon sets `status: done`. |
| `current → future` | **Daemon** (escalation) | Daemon can't resolve a problem. Releases claim, returns feature to `future`. Human can now edit specs. All in-progress plans are discarded; completed sibling plans stay committed. |
| `done → future` | **Human** (re-open) | Rare — a done feature needs rework. Human moves it back explicitly. |

### No-Tearing Guarantee

The producer never writes to what the consumer is reading:
- **Human** cannot edit specs in `current/` (frozen)
- **Daemon** cannot modify features in `future/` (human's domain)
- **Escalation** moves the feature out of `current/` before the human edits anything

This eliminates the need for `spec_version` pinning. The lock is at the bin level, not the artifact level.

### The Fractal Pattern

The same locking pattern applies at every handoff within Pipeline B:

| Boundary | Producer | Consumer | Lock |
|----------|----------|----------|------|
| Pipeline A → B | Human (specs) | Daemon (execution) | Feature in `current/` = frozen |
| Plan author → Plan reviewer | Planning agent | Review agent | Plan locked during review |
| Implementer → Code reviewer | Coding agent | Review agent | Code locked during review |
| Code reviewer → Triage | Review agent | Triage agent | Review findings locked during triage |

**General rule:** Artifacts are immutable while being consumed by the next stage. If a stage needs to change something, it rejects back to the producer, who revises and re-submits. Never edit in place while someone else is reading.

---

## Feature-Scoped Directories

**The filesystem IS the grouping.** Every artifact for a feature lives in its feature directory.

```
features/
  future/                          ← DESIGN STAGE: human is working on these
    F-044-dark-mode/
      feature.md                   # definition, scope, metrics, acceptance tests, status
      research/                    # optional pre-spec research
      specs/
        S-044-toggle.md            # frontmatter: feature: F-044, status: approved
        S-045-persistence.md
    F-045-settings/
      ...

  current/                         ← EXECUTION STAGE: daemon is processing these (FROZEN)
    F-042-auth/
      feature.md
      specs/
        S-042-login.md
        S-043-session.md
      plans/
        P-042.md                   # frontmatter: implements: [S-042], status: in_progress
        P-043.md                   # frontmatter: implements: [S-043], status: draft
      reviews/                     # committed, durable
        2026-09-29T20-18_P-042-code-review-iter1.md
      .work/                       # gitignored: agent todos, scratch, tool traces

  done/                            ← COMPLETED: archived, queryable via index
    2026-Q3/                       # sharded by period for scale
      F-040-onboarding/
      F-041-notifications/
```

### Design Principles

**Filesystem groups.** The directory is the unit of work. An agent processing F-042 reads one directory, honors the bin's freeze, writes artifacts only under it.

**Frontmatter names.** Each artifact declares its own relationships in YAML frontmatter:

```yaml
# features/current/F-042-auth/feature.md
---
id: F-042
slug: auth
status: in_progress       # draft | review | approved | in_progress | escalated | done | failed | superseded
batch: 02                 # scheduling hint (priority grouping)
priority: 2               # within batch
blocked_by: []
related: [F-041]
acceptance_tests:
  - metric: "Login flow completes end-to-end"
    command: "bun test test/e2e/login.test.ts"
    pass: "exit 0"
  - metric: "Session persists across refresh"
    command: "bun test test/e2e/session.test.ts"
    pass: "exit 0"
---
```

```yaml
# features/current/F-042-auth/specs/S-042-login.md
---
id: S-042
feature: F-042
status: approved
acceptance_criteria:
  - id: AC-1
    scope_item: IS-2
    description: "Login endpoint returns JWT on valid credentials"
---
```

```yaml
# features/current/F-042-auth/plans/P-042.md
---
id: P-042
feature: F-042
implements: [S-042]
status: in_progress        # draft | in_progress | done | failed
attempts: 1                # auto-fix iteration count
max_attempts: 3            # configured cap
author_model: gemini-3.8-flash
reviewer_model: grok-3
---
```

**Index queries.** The coverage matrix, the queue, the feature status — all are computed views, not hand-maintained artifacts. Each child artifact declares its edges; the daemon walks frontmatter and writes SQLite. Markdown is the source of truth. SQLite is the query layer.

**Daemon claims.** The daemon scans `features/current/`, reads frontmatter, claims features via SQLite lease (TTL + owner). No hand-edited schedule file.

**Humans gate.** The human approves features and spec sets in the design stage, then moves them to `current/`. That's it. Everything else is the machine.

### The Queue Is a Query, Not a File

There is no `pipeline/current.md`. Status lives on feature frontmatter. The queue is derived:

| Query | Meaning |
|-------|---------|
| `features/current/*/feature.md` where `status=approved AND blocked_by resolved` | Ready for daemon to claim |
| `status=in_progress` | Claimed by daemon, being processed |
| `status=escalated` | Returned to `future/` for human attention |
| `status=done` | Complete, in `done/` bin |

Scheduling order: `ORDER BY batch ASC, priority DESC, id ASC`. Defaults: batch=0, priority=0.

### Coverage Matrix Is Computed

The coverage matrix is not maintained by hand. It's computed from the frontmatter graph:

- Each spec says `feature: F-042` and declares `acceptance_criteria: [{id: AC-1, scope_item: IS-2}]`
- Each plan says `implements: [S-042]`
- The daemon walks these edges and renders the matrix

If coverage drifts, the frontmatter is wrong — fix the data, not a separate document.

### Features Are a Graph

Cross-cutting concerns (shared infrastructure, blocking dependencies) are expressed via frontmatter links, not directory structure:

- `blocked_by: [F-041]` — F-042 can't start until F-041 is done
- `related: [F-043]` — informational, no scheduling effect

**Containment is the default** (the directory). **Links are the exception** (`blocked_by`, `related`).

**Shared specs:** Do not share spec files between features. Promote the shared capability to its own feature and use `blocked_by`. A persistence spec needed by F-042 and F-043 becomes `F-044-persistence` with `F-042.blocked_by: [F-044]` and `F-043.blocked_by: [F-044]`.

### `blocked_by` and Archived Features

The index retains archived features (in `done/`). Blocker resolution queries the index by ID, not by directory scan. `blocked_by: [F-041]` resolves correctly whether F-041 is in `current/`, `done/`, or `done/2026-Q3/`.

Auto-archival never fires on `done`. Archive is explicit and batched — a `synapse archive` command sweeps features in `done/` that are older than the current batch. This prevents silently breaking `blocked_by` resolution for dependents.

### `@spec` Code Markers

Code markers (`@spec S-042`) reference IDs, not paths. The index maps IDs to current locations, including archived features. `git mv` of a feature directory never breaks reverse traceability.

### Agent Scratch Is Gitignored

Agent checklists churn every session. Specs and approved plans are durable. Mixing them pollutes git history.

- `reviews/` — committed, durable, dated filenames (`YYYY-MM-DDTHH-MM_{id}-iter{N}.md`)
- `.work/` — gitignored: session todos, scratch files, tool traces

**Plan frontmatter `status` is resume-authoritative.** The daemon reads plan statuses to know where to pick up after a crash. `.work/` is never needed for recovery.

**On escalation:** the daemon copies relevant `.work/` excerpts (todo state, tool traces, failure diagnostics) into the committed review file, so the human gets evidence, not just a verdict.

### Filesystem Scale

- **Reindex:** Incremental — index on each write, full scan on startup only. Not per-pulse.
- **Archive sharding:** `done/2026-Q3/`, `done/2026-Q4/` etc. to prevent flat directory of hundreds.
- **ID allocation:** SQLite sequence. Globally monotonic, never reused, no filesystem race between concurrent writers.

---

## The Design Stage

**Owner:** Human  
**Pace:** Strategic, deliberate  
**Agent role:** Research assistant, drafter, reviewer — but the human decides

### Flow

```
Research  →  Feature definition  →  Spec drafting  →  Approval  →  Handoff to current/
```

1. **Research.** Human identifies a capability need. Agent assists with competitive analysis, codebase exploration, feasibility assessment. Research artifacts are optional and live in `features/future/F-NNN/research/`.

2. **Feature definition.** Human defines what to build: scope, success metrics, in-scope items, **feature acceptance tests**. Agent may draft, but human owns the "what." Creates `features/future/F-NNN-slug/feature.md` with `status: draft`.

3. **Spec drafting.** Agent drafts ALL specs for a feature as a batch. Feature-scoped: a feature's full spec set is drafted together so composition and coverage are visible. Specs land in `features/future/F-NNN/specs/`.

4. **Approval.** Human reviews the feature's complete spec set — all specs, computed coverage matrix, acceptance criteria — as one decision. Not individual specs. The batch is the unit of approval. Human sets `status: approved`.

5. **Handoff.** Human moves the feature directory from `future/` to `current/`. This is the buffer swap. **Specs are now frozen.** The daemon will pick it up.

### Feature Acceptance Tests

Declared in `feature.md` frontmatter. Written from the feature definition by an agent OTHER than the implementer. These verify the *decomposition* — that the feature works as a whole, not just that individual specs pass.

```yaml
acceptance_tests:
  - metric: "Dark mode toggle persists across browser restart"
    command: "bun test test/e2e/dark-mode-persistence.test.ts"
    pass: "exit 0"
```

Feature acceptance tests are a precondition for `status: done`. They catch composition failure — the one class of defect that spec-level tests structurally cannot catch.

### The Human's Job

- **Keep the queue full** — design ahead of execution
- **Handle escalations** — features returned to `future/` with diagnostic review files
- **Set priorities** — `batch` and `priority` in frontmatter; ordering of handoffs

---

## The Execution Stage

**Owner:** Agents (fully autonomous)  
**Pace:** As fast as compute allows  
**Human role:** Handle escalations only

### Flow

```
Daemon selects approved feature from current/
  → Create plans (one per spec, 1:1)
    → Agent peer review of plans (different model from author)
      → Implement (generate todo in .work/, follow plan)
        → Test (automated verification)
          → Code review (agent reviewer)
            → Triage (auto-fix or escalate)
              → Feature acceptance tests
                → Done → move to done/
```

### Daemon Runtime Loop

```
1. Scan features/current/*/feature.md
2. Select where status=approved AND blocked_by all resolved
3. Claim via SQLite lease (feature_id, owner, expires_at, TTL)
4. Set feature status: in_progress
5. For each spec (ORDER BY id ASC):
   a. Create plan → write to plans/ with status: draft
   b. Agent peer review (different model from author)
      - 2+ consecutive REQUEST_CHANGES → escalate to human
   c. Set plan status: in_progress
   d. Implement (todo in .work/, code committed per plan)
   e. Verify (typecheck, tests, plan verification commands)
   f. Code review (agent reviewer)
   g. Triage:
      - Auto-fixable → fix, re-verify (up to max_attempts, default 3)
      - Not fixable → escalate
   h. Set plan status: done
6. Run feature acceptance tests (from feature.md)
7. If all pass: set feature status: done
8. Repeat
```

### Plan Gate (Agent-Owned)

The plan gate is agent-owned — no human approval needed. But with explicit guardrails:

1. **Different model.** Plan reviewer MUST be a different model from the plan author. (e.g., AGY creates, Grok reviews — as proven in fox-code-cli Phase 2B.)
2. **Escalation trigger.** 2+ consecutive REQUEST_CHANGES on the same plan → auto-escalate to human via the escalation path.
3. **Accepted risk.** This trades a small increase in plan defect rate for significantly higher throughput. Phase 2B caught 4 plan-quality issues via agent review — evidence that agent review works, but not that it catches everything.

### Status Model

**Feature status** (set on `feature.md`):

| Status | Meaning | Writer |
|--------|---------|--------|
| `draft` | Feature being defined | Human |
| `review` | Specs drafted, awaiting human review | Human |
| `approved` | Human approved spec set, ready for handoff | Human |
| `in_progress` | Daemon has claimed, execution underway | Daemon |
| `escalated` | Returned to `future/`, needs human attention | Daemon |
| `done` | All plans + acceptance tests pass | Daemon |
| `failed` | Terminal — requires human replan (attempt cap exceeded) | Daemon |
| `superseded` | Replaced by a newer feature | Human |

**Plan status** (set on plan frontmatter):

| Status | Meaning | Writer |
|--------|---------|--------|
| `draft` | Plan created, not yet reviewed | Daemon |
| `in_progress` | Implementation underway | Daemon |
| `done` | Verified green, code review passed | Daemon |
| `failed` | Attempt cap exceeded, cannot resolve | Daemon |

**Status authority is split:**
- `draft → review → approved`: Human decisions, written by human
- `approved → in_progress → done | escalated | failed`: Mechanical, written by daemon only
- SQLite lease `(feature_id, owner, expires_at)`: Daemon only, never mirrored to markdown

**Consistency assertion:** On every reindex, derive the expected feature status from child plan statuses and assert it matches the actual status. A disagreement is a mismatch halt — investigate, don't auto-correct.

### Failure Handling

**Repeated verification failure.** Each plan tracks `attempts` in frontmatter. After `max_attempts` (default 3) failed auto-fix iterations, the plan is set to `failed`. If any plan is `failed`, the feature is escalated.

**Partial feature failure.** Feature F-042 has P-042 (done, green) and P-043 (failed). The feature goes `escalated` and returns to `future/`. P-042's committed code stays — it's already green and committed. P-043 is marked `failed`. The human sees the diagnostic review, fixes the spec or problem, and the feature re-enters `current/`. On re-entry, the daemon sees P-042 is `done` and picks up from P-043.

**Resume predicate.** After a crash, the daemon reads plan frontmatter:

| `plan.status` | Artifacts present | Next action |
|---------------|-------------------|-------------|
| `draft` | Plan file exists | Review the plan |
| `in_progress` | Partial code committed | Resume implementation |
| `done` | Code + green tests | Skip — already complete |
| `failed` | Failure review | Skip — escalation pending |

Resume requires only committed artifacts. `.work/` is never needed for recovery.

**Escalation exit.** When the human fixes an escalated feature and wants to re-submit:
1. Human revises specs in `future/` (now editable)
2. Human sets `status: approved`
3. Human moves feature back to `current/`
4. On re-entry: failed/stale plans are discarded (specs changed); done plans are kept if their spec is unchanged

### Lease Management

- **TTL:** Configurable, default 30 minutes. Renewed on each stage completion.
- **Expiry recovery:** If a lease expires and `feature.md` says `in_progress` with no live lease, the daemon sets `status: escalated` and drops a review file noting the crash. (After N expiry-crashes on the same feature, set `status: failed`.)
- **Crash reaping:** On startup, the daemon scans for `in_progress` features with expired/missing leases and escalates them.

### Concurrency

**Sequential in v1.** One feature at a time. The lease schema supports `max_concurrent: N` (config) for future parallelism.

When parallelism is enabled, use git worktrees per feature for isolation — fox-code-cli already built this in 2G-3 (ephemeral worktrees + deterministic `PORT`/`TMPDIR`/`DATABASE_URL` allocation, cleanup on SIGINT/SIGTERM). Port that design; do not redesign it. Gate the increase on writing a merge-conflict policy (two features touching the same file).

### Timeouts

Every agent invocation has a timeout (per `AGENTS.md` rules):

| Stage | Timeout |
|-------|---------|
| Plan creation | 300s |
| Plan review | 300s |
| Implementation | 900s |
| Verification | 180s |
| Code review | 300s |
| Feature acceptance tests | 180s |

---

## Escalation: The Backpressure Mechanism

Escalation is a **bin move**, not an in-place edit:

```
features/current/F-042-auth/  →  features/future/F-042-auth/
```

The daemon:
1. Sets `status: escalated` on `feature.md`
2. Copies relevant `.work/` diagnostics into a committed review file
3. Releases the SQLite lease
4. Moves the feature directory from `current/` to `future/`

Now the human can safely edit specs — the feature is back in their domain. Every escalation is **design stage work**: spec gaps, AC issues, fundamental design questions. The human handles it in their normal design flow.

---

## Scheduling: Batches as Tags

Batches group features for priority ordering. They're a **planning tag** on feature frontmatter, not a directory the runtime consults:

```yaml
batch: 02
priority: 2
```

**Selection order:** `ORDER BY batch ASC, priority DESC, id ASC`. Missing values default to 0.

The human controls scheduling by:
1. Setting `batch` and `priority` on features in `future/`
2. Choosing which features to move to `current/` and when (the handoff)

Phase rotation from fox-code-cli maps to: move completed features to `done/`, move the next batch from `future/` to `current/`. The buffer swap is a deliberate human action — the human controls the timing and composition of each batch.

---

## What Changed from the Original Handbook

| Original handbook / S-011–S-015 | This model |
|--------------------------------|-----------|
| Single linear pipeline (Feature → Spec → Plan → Task → Done) | Two async stages with bin-based coordination |
| Four artifact types (Feature, Spec, Plan, Task) | Three artifacts (Feature, Spec, Plan) + runtime trackers |
| Three gates (FEATURE_GATE, SPEC_GATE, PLAN_GATE) | One handoff (`future → current`). Plan gate is agent-owned. |
| Per-artifact approval | Feature-batched approval (all specs reviewed together) |
| Tasks as formal artifacts with templates and status machines | Todos as agent scratch (`.work/`, gitignored) |
| Human as pipeline operator (performing gates) | Human as designer who handles escalations |
| Synchronous gates (pipeline stops for human) | Async producer-consumer (neither blocks the other) |
| Flat artifact directories with naming conventions | Feature-scoped directories with bin system |
| Hand-maintained coverage matrix | Computed from frontmatter graph |
| Hand-edited pipeline/current.md schedule | Queue is a query over feature status |
| spec_version pinning for tearing prevention | Bin-level freeze (simpler, stronger) |
| No feature acceptance tests in done predicate | Feature acceptance tests required for done |
| Flat canonical scan set (S-015) | Feature-scoped directories under bin trees |
| Product-scoped pipeline runs (S-012) | Feature-scoped execution |
| 15-step fixed sequence (S-012) | Dynamic per-feature stage progression |
| PIPELINE_SIGNAL protocol | Daemon reads frontmatter + SQLite (signals replaced by status) |

---

## Design Rule

> **Filesystem groups. Frontmatter names. Index queries. Daemon claims. Bins freeze. Humans gate.**

---

## Repo Layout Addition

Add to `AGENTS.md` §2 (repo layout):

```
features/                        # All feature work
├── future/                      # Design stage: human-editable
│   └── F-NNN-slug/
│       ├── feature.md           # Writer: human
│       ├── research/            # Writer: human + agents
│       └── specs/               # Writer: agents (human reviews)
├── current/                     # Execution stage: FROZEN, daemon-owned
│   └── F-NNN-slug/
│       ├── feature.md           # Writer: daemon (status transitions only)
│       ├── specs/               # FROZEN — no edits
│       ├── plans/               # Writer: daemon (agent-created)
│       ├── reviews/             # Writer: daemon (agent-created, committed)
│       └── .work/               # Gitignored: agent scratch
└── done/                        # Archived: queryable via index
    └── YYYY-QN/
        └── F-NNN-slug/
```
