# Synapse Framework Specification

> **Status:** Working draft (v1)
> **Date:** 2026-09-30
> **Authority:** This document is the single normative reference for the Synapse artifact model. The [Handbook](handbook.md) provides the conceptual introduction; the [Agent Contract](agent-contract.md) provides agent operating procedures. When in doubt, this document governs.

---

## 1. Scope

This specification defines the artifact model, state machines, conformance rules, and traceability system for the Synapse agentic software pipeline.

It covers:
- Artifact types and their schemas (§2)
- Identification system (§3)
- Status state machines (§4)
- Required fields and conformance (§5)
- Design rules: layer principle, sizing, work types (§6)
- Dependency system (§7)
- Traceability chain (§8)
- Gate definitions (§9)
- Split and replan protocols (§10)
- Templates (§11)

It does not cover pipeline mechanics (stages, the review cycle, roles/tiers) — those are in [Pipeline Architecture](pipeline-architecture.md). It does not cover agent operating procedures — those are in [Agent Contract](agent-contract.md).

---

## 2. Artifact Definitions

### Change

The unit of work that flows through the pipeline. A change has a `kind` — `feature`, `fix`, `refactor`, `chore`, or `spike` — and a slug (kebab-case name). The change is identified by its folder name, not by a numeric ID.

A change enters the pipeline as a folder in `design/` containing `BRIEF.md`. As it progresses through `plan/`, `build/`, and `done/`, artifacts accumulate inside the folder. The folder is the record.

### Brief (`BRIEF.md`)

The human-authored input artifact in `design/`. Captures intent, non-goals, done-when criteria, blast radius, and kind-specific fields. The brief is a product artifact — the human is the author of record, even when an agent drafts it.

A brief is not a spec. It says *what you want* and *what you refuse to build*. It does not say *what the system must do* — that's the spec's job.

### Spec (Specification)

An engineering contract for one atomically-implementable unit of work. Each spec has acceptance criteria (ACs), a validation contract (MUSTs/MUST NOTs), and high-level deliverables (HLDs). Specs answer *what must the system do* without prescribing *how*.

**Properties:**
- **Atomicity:** Implementable without intermediate checkpoints. If partial state must be saved mid-implementation, the spec is too large — split it.
- **Testability:** Every AC has a verification method that produces a binary pass/fail result.
- **Boundedness:** Maximum 10 ACs, maximum 7 HLDs. If more are needed, split.

### Plan

The implementation blueprint for one approved spec. Plans are 1:1 with specs — one plan per spec. A new plan for the same spec is a replan (new identity, linked to predecessor).

Plans are concrete: they name files, functions, algorithms, data structures. They are the *how* layer. Plans are execution artifacts — agents produce them, the human glances at them if they want.

### Task

An assignable work unit derived from a plan deliverable. Tasks are optional but well-defined — they exist when parallel assignment, progress tracking, retry isolation, or audit trail is needed.

**Properties:**
- **Plan-bound:** Created from plan deliverables. One HLD may become 1-3 tasks.
- **Owned:** Every task has exactly one owner (agent or human).
- **Terminal:** Tasks cannot be split after creation. If scope grows, create additional tasks.
- **Initial status:** `NOT_STARTED` (not `DRAFT` — tasks do not go through gate review).

### Approval Record

An immutable record of a gate decision. Created when a human approves, rejects, or requests revision at a gate.

**Properties:**
- **Immutable:** Once written, never modified.
- **Linked:** References the artifact ID and version at the time of decision.
- **Constrained:** `approver ≠ author` is an invariant.

---

## 3. Identification System

### ID Format

| Artifact | Prefix | Format | Sequence |
|----------|--------|--------|----------|
| Change | — | Slug (kebab-case folder name) | — |
| Brief | — | `BRIEF.md` (one per change) | — |
| Spec | `S-` | `S-NNN` | Monotonic global |
| Plan | `P-` | `P-NNN` | Monotonic global |
| Task | `T-` | `T-NNN` | Monotonic per plan |
| Approval Record | `AR-` | `AR-NNN` | Monotonic global |

### Rules

- **Immutable.** Once assigned, an ID never changes. A renamed artifact gets a new ID.
- **Never reused.** Cancelled or abandoned artifacts retain their IDs.
- **Monotonic.** Each new ID is greater than all previous IDs in its sequence.
- **No suffixes on split.** Split artifacts get new sequence numbers (S-043, S-044), not suffixes (S-042a, S-042b).
- **Per-pipeline scope.** ID sequences are local to the pipeline instance (the developer's machine). Two developers independently assigning S-001 is not a collision — each change folder is its own namespace.

### Why Flat IDs

Flat IDs (`S-042` with `feature: F-042` in frontmatter) survive splits, replans, and reorganizations. Hierarchical IDs (`FEAT-042.SPEC-1`) require renaming when artifacts are split or re-parented, breaking all references. Flat IDs + relational fields give the same traceability without the rename cascade.

### Relational Fields

Artifacts reference each other through frontmatter fields, not through ID structure:

```
Change (folder: auth-login/)
  └── Brief: BRIEF.md

Spec S-042
  ├── feature: F-042          ← upward link (or NONE for non-feature work)
  └── depends_on: [S-041]     ← lateral link

Plan P-042
  ├── spec: S-042              ← upward link (1:1)
  └── spec_version: 1          ← version pin

Task T-003
  ├── plan: P-042              ← upward link
  └── hld: HLD-2               ← which deliverable
```

---

## 4. Status State Machine

### Statuses

| Status | Meaning | Applies to |
|--------|---------|------------|
| `NOT_STARTED` | Created but no work begun | Task |
| `DRAFT` | Being written or revised (includes all review iterations) | Spec, Plan |
| `APPROVED` | Passed gate review | Spec, Plan |
| `IN_PROGRESS` | Active work underway | Plan, Task |
| `BLOCKED` | Cannot proceed — external dependency or unresolved issue | Spec, Plan, Task |
| `DONE` | All acceptance criteria verified | Spec, Plan, Task |
| `FAILED` | Verification failed or implementation proved impossible | Plan, Task |
| `ABANDONED` | Intentionally stopped (terminal) | Spec, Plan, Task |
| `SUPERSEDED` | Replaced by a newer version (terminal) | Spec, Plan |

### Transitions

```
Spec/Plan:
  DRAFT ──(gate approval)──→ APPROVED ──→ IN_PROGRESS ──→ DONE
                                              │
                                              ▼
                                           BLOCKED ──→ DRAFT (rework)
                                              │           or FAILED
                                              │           or ABANDONED
                                              ▼
                                           FAILED ──→ DRAFT (rework)
  Any ──→ ABANDONED (intentional cancellation)
  DONE ──→ SUPERSEDED (replaced by newer version)
  BLOCKED ──→ IN_PROGRESS (blocker resolved)

Task:
  NOT_STARTED ──→ IN_PROGRESS ──→ DONE
                       │
                       ▼
                    BLOCKED ──→ IN_PROGRESS (blocker resolved)
                       │
                       ▼
                    FAILED ──→ NOT_STARTED (retry)
  Any ──→ ABANDONED
```

### Key Rules

- **No PENDING_REVIEW status.** Review is part of drafting. The artifact stays in `DRAFT` through all review iterations.
- **Tasks skip DRAFT/APPROVED.** Tasks are operational, not gated. They start at `NOT_STARTED`.
- **Specs skip IN_PROGRESS/FAILED.** Specs are contracts, not work. They go from `APPROVED` to `DONE` when all ACs pass.
- **BLOCKED → IN_PROGRESS.** When a blocker is resolved, work resumes without returning to DRAFT.
- **Post-rejection.** If a gate reviewer rejects, the artifact returns to `DRAFT` for revision. After 3 revision cycles without approval, the artifact transitions to `BLOCKED` for architectural review.

---

## 5. Required Fields and Conformance

### Brief Required Fields

| Field | Type | Constraints |
|-------|------|-------------|
| kind | enum | `feature \| fix \| refactor \| chore \| spike` |
| ticket | string | Optional. External tracker ID (e.g., `JIRA-123`). Links change to coordination layer. |
| status | enum | `draft \| review \| approved` |
| Intent | section | One sentence |
| Non-Goals | section | Present (may be empty with rationale) |
| Done-When | section | At least one executable test (not prose) |
| Blast Radius | section | Present |

### Spec Required Fields

| Field | Type | Constraints |
|-------|------|-------------|
| id | string | Matches `^S-[0-9]{3,}$` |
| version | integer | ≥ 1 |
| name | string | kebab-case, 3-50 chars |
| status | enum | Valid state machine state |
| work_type | enum | `feature \| fix \| refactor \| chore \| spike` |
| created | datetime | ISO 8601 with timezone |
| author | string | Non-empty |
| feature | string | Valid F-XXX or `NONE` |
| Acceptance Criteria | section | 1-10 rows |
| High-Level Deliverables | section | 1-7 rows |
| Coverage Matrix | section | Every AC appears at least once |

### Plan Required Fields

| Field | Type | Constraints |
|-------|------|-------------|
| id | string | Matches `^P-[0-9]{3,}$` |
| spec | string | Valid S-XXX |
| spec_version | integer | Must match approved spec version |
| status | enum | Valid state machine state |
| author | string | Non-empty |
| Verification Plan | section | Every AC from spec has a row |
| Open Questions | section | Present (must be empty for APPROVED transition) |

### Task Required Fields

| Field | Type | Constraints |
|-------|------|-------------|
| id | string | Matches `^T-[0-9]{3,}$` |
| plan | string | Valid P-XXX |
| hld | string | Valid HLD reference from the plan |
| status | enum | Must start as `NOT_STARTED` |
| owner | string | Non-empty (`agent:xxx` or `human:xxx`) |

### Approval Record Required Fields

| Field | Type | Constraints |
|-------|------|-------------|
| id | string | Matches `^AR-[0-9]{3,}$` |
| artifact | string | Valid artifact ID |
| artifact_version | integer | Version at time of decision |
| gate | enum | `BRIEF_GATE \| SPEC_GATE \| PLAN_GATE \| ACCEPTANCE_GATE` |
| decision | enum | `APPROVED \| REVISION_REQUESTED \| REJECTED` |
| timestamp | datetime | ISO 8601 with timezone |
| approver | string | Non-empty, ≠ artifact author |

### Invariants

1. **ID immutability.** Once assigned, `id` never changes.
2. **Version monotonicity.** Version only increments, never decrements.
3. **Temporal ordering.** `status_changed ≥ updated ≥ created`.
4. **Author ≠ Approver.** For any approval record, `approver ≠ author`.
5. **Supersession chain.** If `supersedes: X`, then X must have `superseded_by: this`.
6. **Coverage completeness.** Every AC maps to ≥1 MUST; every MUST maps to ≥1 verification method.
7. **Scope traceability.** Every spec AC cites a brief in-scope item, done-when criterion, or (for non-feature work) an `authorizing_ref`.
8. **Dependency acyclicity.** The `depends_on` graph has no cycles.

### Reject Conditions

An artifact **must be rejected** at its gate if:

1. Any required field is missing or invalid
2. Any invariant is violated
3. Author and approver are the same identity
4. Open questions are non-empty (plans)
5. Coverage matrix is incomplete
6. AC count > 10 or HLD count > 7
7. Dependencies form a cycle
8. `spec_version` does not match the approved spec (plans)

---

## 6. Design Rules

### The Layer Principle

Each artifact layer answers exactly one question:

| Layer | Question | May contain | Must NOT contain |
|-------|----------|-------------|-----------------|
| Brief | What do we want and what's out of scope? | Intent, non-goals, done-when, blast radius | Algorithms, file names, tolerances |
| Spec | What must the system do? | ACs, MUSTs, HLDs, dependencies | Algorithm names, file paths, data structures |
| Plan | How will we build it? | Algorithms, files, functions, sequences | Business outcomes, stakeholder language |
| Task | What's the current assignment? | Deliverable, owner, status | Anything not in the plan |

**Decision rule:** If two competent implementers would make the same choice without discussion, it belongs in the spec. If reasonable implementers would choose differently, it belongs in the plan.

### Sizing

**The sizing rule:** A spec describes what can be implemented atomically — without intermediate checkpoints or partial-state commits.

"Session," "focus time," and temporal measures are rejected as sizing criteria. The test is atomicity: can this be implemented as a single uninterruptible block of work that produces a verifiable deliverable?

**Sizing cascade:**

| Transition | Validator | Signal it's wrong |
|------------|----------|-------------------|
| Brief → Specs | Spec writer | Needs > 10 ACs or > 7 HLDs |
| Spec → Plan | Plan writer | Implementation requires intermediate saves or wait points |
| Plan → Tasks | Task creator | Single HLD becomes > 3 tasks |

Sizing is *estimated* when writing specs and *validated* when writing plans. Mis-sizing discovered at plan time triggers the Split Protocol (§10).

### Work Types

| Kind | Authorizing artifact | Gates |
|------|---------------------|-------|
| `feature` | Brief (with scope, metrics) | Brief + Spec + Acceptance |
| `fix` | Brief (with repro, expected behavior) | Brief + Spec + Acceptance |
| `refactor` | Brief (with seam, behavior invariants) | Brief + Spec + Acceptance |
| `chore` | Brief (with why-now, blast radius) | Brief + Acceptance (may skip Spec Gate if brief says so) |
| `spike` | Brief (with question, time box) | Brief + Spike Gate (time-boxed, no deliverable gate) |

Non-feature specs use `feature: NONE` with a `work_type` field. They follow the same state machine but skip the feature-level scope traceability (Invariant 7 uses `authorizing_ref` instead of feature IS-N).

---

## 7. Dependency System

### Which Artifacts Have Dependencies

| Artifact | Has `depends_on`? | Can depend on | Scope |
|----------|-------------------|---------------|-------|
| Change | Yes (in BRIEF.md) | Other change slugs | Cross-change |
| Spec | Yes | Other specs | Cross-spec |
| Task | Yes | Other tasks in same plan | Intra-plan |
| Plan | No — inherited from spec | — | — |

Plans don't have their own `depends_on` because plans are 1:1 with specs. If spec S-042 depends on S-041, then plan P-042 implicitly cannot start until S-041 is DONE. Duplicating this in the plan creates two sources of truth.

### Dependency Types

| Type | Meaning | Satisfaction | Applies to |
|------|---------|-------------|------------|
| `temporal` | Must complete before this starts | Upstream = DONE | Change, Spec, Task |
| `interface` | Relies on upstream's observable outcome | Upstream = DONE AND outcome matches | Spec, Task |
| `external` | Relies on system outside this framework | External check passes | Spec only |
| `soft` | Preferred but not required ordering | Upstream = DONE OR timeout elapsed | Change, Spec, Task |

### Cycle Rejection

Dependency cycles are rejected at gate review:
1. Build directed graph of all artifacts with `depends_on` edges
2. Run topological sort
3. If sort fails (cycle detected), reject all artifacts in the cycle
4. Cycle must be broken by removing an edge before any artifact in the cycle can be approved

### Ordering Precedence

When multiple orderings conflict:
1. **Dependency edges** (highest) — explicit `depends_on` must be satisfied
2. **HLD order** — logical decomposition order from the spec
3. **Implementation sequence** (lowest) — plan may reorder within HLD constraints

If the plan's implementation sequence violates a dependency edge, the plan is non-conforming.

---

## 8. Traceability

### The Chain

Every piece of implemented functionality traces back to human intent through five links:

```
Brief intent (IS-N / Done-When)
    ↕ Coverage Matrix
Spec AC
    ↕ Validation Contract
MUST / MUST NOT
    ↕ Verification Plan
Test
    ↕ @spec tag
Code
```

| Link | Question |
|------|----------|
| Brief → Spec AC | Does the spec cover what the brief asked for? |
| AC → MUST | Is the acceptance criterion expressed as a testable contract? |
| MUST → Verification | Is there a runnable check for each contract? |
| Verification → Code | Is the code marked with the spec it satisfies? |

### Code Markers

Code references the **spec**, not the plan or task:

```typescript
// @spec S-042 — Product registration command handler
export function handleAddCommand(path: string): Result<ProductId, AddError> { ... }
```

**Why spec and not plan or task:**
- Plans are consumed during implementation. They may be rewritten or superseded.
- Tasks are operational bookkeeping — per-execution, not per-contract.
- Specs are stable contracts. When behavior changes, the spec changes.

**Placement:** Module-level for primary implementation file, function-level for isolated AC implementations. Not needed in test files (tests reference specs via test names).

### Coverage Matrix

Every spec must have a coverage matrix before gate review:

| AC | Traces to (Brief) | MUST | Verification |
|----|--------------------|------|-------------|
| AC-1 | IS-1 | M-1, M-2 | `bun test test/registration.test.ts` |
| AC-2 | IS-2 | M-3 | `bun test test/validation.test.ts` |

**Rules:**
- Every AC must appear in at least one row
- Every MUST must map to at least one verification method
- Empty rows indicate a gap — an AC that has no testable contract

### Completion Predicates

**Spec done:** All ACs' verification methods pass. Every MUST is verified. No MUST NOT is violated.

**Plan done:** All tasks complete (or all deliverables complete, if tasks are not used).

**Change done:** All specs DONE + done-when tests from BRIEF.md pass + human accepts (Acceptance Gate).

A change cannot be marked done if any spec is IN_PROGRESS, BLOCKED, or FAILED, or if any done-when test fails, or if the human has not accepted.

---

## 9. Gate Definitions

| Gate | Artifact | Approver constraint | What it freezes |
|------|----------|-------------------|-----------------|
| `BRIEF_GATE` | Brief | Human (always) | Scope, non-goals, done-when |
| `SPEC_GATE` | Spec set | Human (always) | Architecture, seams, ACs |
| `PLAN_GATE` | Plan | Human or delegated reviewer | Implementation approach |
| `ACCEPTANCE_GATE` | Change | Human (always) | The result is the thing you meant |

### Rules

- **Auto-advance is illegal** at BRIEF_GATE, SPEC_GATE, and ACCEPTANCE_GATE.
- **Author ≠ Approver** for all gates.
- **Spec Gate reviews the set**, not individual specs. The human approves the decomposition as a whole.
- **After 3 revision cycles** without approval → artifact transitions to `BLOCKED` for architectural review.

### Timeouts

| Gate | Default | On timeout |
|------|---------|------------|
| BRIEF_GATE | 7 days | Escalate; after 14 days → BLOCKED |
| SPEC_GATE | 3 days | Escalate; after 7 days → BLOCKED |
| PLAN_GATE | 2 days | Escalate; after 5 days → BLOCKED |
| ACCEPTANCE_GATE | 7 days | Escalate; after 14 days → BLOCKED |

Timeouts are configurable.

---

## 10. Split and Replan Protocols

### Split Protocol

When a spec must be split (AC > 10, HLD > 7, or atomicity violated at plan time):

1. Create new specs with fresh IDs (new sequence numbers, not suffixes)
2. Each original AC must appear in exactly one child spec (scope conservation)
3. Parent spec transitions to `SUPERSEDED`
4. Child specs reference parent: `split_from: S-XXX`
5. All child specs must pass SPEC_GATE before any implementation begins
6. All `@spec` markers in existing code referencing the parent must be re-tagged to the appropriate child

### Replan Protocol

When a plan is rejected or fails:

1. Create new plan with fresh ID
2. New plan's `supersedes` points to old plan
3. Old plan's `superseded_by` points to new plan
4. Old plan transitions to `SUPERSEDED`
5. New plan starts at `DRAFT`
6. The 1:1 spec:plan rule counts only non-superseded plans

---

## 11. Templates

Full YAML templates are in [templates.md](templates.md). Summary of required sections per artifact:

| Artifact | Identity | Content | Relationships |
|----------|----------|---------|---------------|
| Brief | kind, status | Intent, Non-Goals, Done-When, Blast Radius | depends_on, sources |
| Spec | id, version, name, status, work_type | ACs, MUSTs, HLDs, Coverage Matrix | feature, depends_on |
| Plan | id, spec, spec_version, status | Deliverables, Verification Plan, Open Questions | (inherited from spec) |
| Task | id, plan, hld, status, owner | Description, AC subset | depends_on (same plan) |
| Approval Record | id, artifact, gate, decision | Rationale, cited findings | artifact_version |

---

## Appendix: Worked Examples

Full worked examples are in [examples.md](examples.md).

| Example | Kind | Artifacts | Key lesson |
|---------|------|-----------|------------|
| Product Registration | feature | S-042, P-042 | Full chain with coverage matrix |
| Large-Scale Simulation | feature | S-101, P-101 | Layer discipline: spec says "sub-quadratic," plan names Barnes-Hut |
| Signal Parser Crash | fix | S-200 | Non-feature work: `feature: NONE`, `work_type: fix` |
| Negative Examples | — | — | Algorithm in brief, file paths in spec, self-approval |
