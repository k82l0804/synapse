# Synapse Framework — Definitions Handbook

> **Audience:** AI agents creating and reviewing artifacts, human operators making gate decisions, and contributors onboarding to the Synapse workflow.

## What This Framework Does

This framework defines how work moves from an idea to verified code. It gives every artifact (feature, spec, plan, task) a standard structure, a lifecycle with review gates, and a traceability chain that connects stakeholder intent to tested implementation.

### The Workflow in 30 Seconds

```
Stakeholder need
    ↓
Feature (F-NNN)          ← what capability to build, why it matters
    ↓
Spec (S-NNN)             ← what the system must do (acceptance criteria, contracts)
    ↓
Plan (P-NNN)             ← how to implement it (deliverables, verification)
    ↓
Tasks (T-NNN)            ← atomic units of work for an agent or developer
    ↓
Code + Tests             ← implementation with @spec markers for traceability
    ↓
Feature Acceptance Test  ← independent proof the feature works end-to-end
```

Each artifact is **reviewed** before the next layer begins. Specs and plans get dual-blind agent review + human approval. The human decides when to stop iterating — agents never approve.

### Companion Files

| File | Contents |
|------|----------|
| **definitions.md** (this file) | Definitions, lifecycle, design rules, conformance, dependencies, traceability |
| [templates.md](templates.md) | Full YAML templates for Feature, Spec, Plan, Task, and Approval Record |
| [examples.md](examples.md) | 3 worked examples (SW Dev, Nav Sim, Defect Fix) + negative examples |
| [domain-adaptation.md](domain-adaptation.md) | Domain-agnostic design: what's invariant vs customizable (design intent only) |

---

## Table of Contents

1. [Definitions](#part-1--definitions) — Feature, Spec, AC, Plan, Task, Identification System
2. [Artifact Lifecycle & Review](#part-2--artifact-lifecycle--review) — Statuses, review cycle, gates, delegation
3. [Design Rules](#part-3--design-rules) — Sizing, layer principle, task scope, non-feature work
4. [Templates](#part-4--templates) → summary; full templates in [templates.md](templates.md)
5. [Conformance Schema](#part-5--conformance-schema) — Validation rules, field constraints
6. [Dependency System](#part-6--dependency-system) — Scope, types, cycles, ordering
7. [Traceability](#part-7--traceability) — Chain, coverage matrices, @spec markers, completion predicates
8. [Worked Examples](#part-8--worked-examples) → summary; full examples in [examples.md](examples.md)

---

## Part 1 — Definitions

### Feature

> A **feature** is a stakeholder-observable capability that delivers measurable value.

**Formal properties:**
- **Stakeholder-observable:** The capability can be described and verified without implementation knowledge. The stakeholder can say "yes, this is working" by using the system, not by reading code or metrics dashboards.
- **Measurable value:** Each feature carries at least one success metric with a defined measurement procedure.
- **Scope-bounded:** In-scope and out-of-scope are explicit. Every out-of-scope item either references a future feature ID or is marked `WONTDO` with rationale.

**What a feature may NOT contain:**
- Algorithm names (Barnes-Hut, BFS, regex)
- Tolerance values (< 2%, O(N log N))
- File names, function names, schema names
- Implementation-relative metrics ("cache hit rate" requires knowing there's a cache)

**Boundary test:** If evaluating the metric requires running the implementation or reading the code, it belongs in a spec, not the feature.

---

### Spec (Specification)

> A **spec** is an engineering contract for one **atomically-implementable** unit of work.

**Formal properties:**
- **Atomicity:** The unit can be implemented without intermediate checkpoints. If partial state must be saved mid-implementation, the spec is too large — split it.
- **Testability:** Every acceptance criterion has a verification method that produces a binary pass/fail result.
- **Boundedness:** Maximum 10 acceptance criteria. If more are needed, split the spec. (Rationale: cognitive load limit for review; empirically, specs over 10 AC have > 30% defect escape rate in agentic pipelines.)

**What a spec may contain:**
- Acceptance criteria (observable behaviors)
- Validation contract (MUST/MUST NOT constraints)
- High-level deliverables (what gets built, not how)
- Dependencies on other specs (interface contracts)

**What a spec may NOT contain:**
- Algorithm selection (that's a plan decision)
- File paths or function names (that's implementation)
- Specific data structures (that's a plan decision)

**Boundary test:** If two competent implementers would make the same choice without discussion, it belongs in the spec. If reasonable implementers would choose differently, it belongs in the plan.

---

### Plan

> A **plan** is the implementation blueprint for one approved spec.

**Formal properties:**
- **Spec-bound:** One plan per spec. A new plan for the same spec is a replan (new identity, linked to predecessor).
- **Concrete:** Names files, functions, algorithms, data structures — the implementation choices.
- **Verifiable:** Every acceptance criterion maps to a concrete verification method (test name, benchmark command, or review checklist item).

**What a plan may contain:**
- Algorithm selection with rationale
- File and function names
- Data structures and schemas
- Implementation sequence
- Risk assessment and mitigation

---

### Acceptance Criterion (AC)

> An **acceptance criterion** is a single testable statement of expected behavior, scoped to one spec.

**Format:** Given [condition], [observable result].

**Properties:**
- **Binary:** Pass or fail, no partial credit
- **Independent:** Each AC can be verified without running other ACs
- **Traceable:** Every AC cites a feature in-scope item (IS-N) or metric (M-N)
- **Verifiable:** Every AC maps to at least one MUST/MUST NOT in the validation contract

A spec has 1-10 ACs. ACs are the atomic unit of verification — 'spec done' means all ACs pass.

---

### Task

> A **task** is an assignable work unit derived from a plan deliverable.

**Formal properties:**
- **Plan-bound:** Tasks are created from plan deliverables. One deliverable may become one or more tasks.
- **Owned:** Every task has exactly one owner (agent ID or human identity).
- **Terminal:** A task cannot be split after creation. If scope grows, create additional tasks.
- **Stateful:** Tasks have explicit status (not_started, in_progress, blocked, done, failed, abandoned).

**When to use tasks:**
- Parallel execution: Multiple agents working on different deliverables
- Progress tracking: Need to know which deliverables are complete
- Retry isolation: Need to re-execute one deliverable without restarting
- Audit trail: Need to record who did what and when

**When tasks are unnecessary:**
- Serial execution by a single agent
- Plan small enough to complete atomically
- No audit requirements

---

### Identification System

Every artifact has a unique, immutable ID. The ID system is how artifacts reference each other, how code traces back to requirements, and how audits verify coverage. Industry standards (ISO 26262, DO-178C) require traceability but do not mandate a specific format — the convention below follows the Prefix + Flat Numbering pattern used in Requirements Traceability Matrices (RTMs).

#### ID Format

| Artifact | Prefix | Format | Example | Sequence |
|----------|--------|--------|---------|----------|
| Feature | `F-` | `F-NNN` | F-042 | Monotonic per domain |
| Spec | `S-` | `S-NNN` | S-042 | Monotonic global |
| Plan | `P-` | `P-NNN` | P-042 | Monotonic global |
| Task | `T-` | `T-NNN` | T-003 | Monotonic per plan |

**Rules:**
- IDs are **immutable** — once assigned, never change. A renamed artifact gets a new ID.
- IDs are **never reused** — cancelled or abandoned artifacts retain their IDs.
- IDs are **monotonic** — each new ID is greater than all previous IDs in its sequence.
- Split artifacts get **new IDs** (not suffixes like S-042a — use S-043, S-044).

#### Flat IDs vs Hierarchical IDs (Design Decision)

Industry practice offers two approaches:

| Approach | Example | Pros | Cons |
|----------|---------|------|------|
| **Flat + relational fields** (our choice) | S-042 with `feature: F-042` | IDs survive splits and supersession; parentage is queryable; simpler regex | Must read frontmatter to find parent |
| Hierarchical / composite | FEAT-042.SPEC-1.PLAN-A | Parentage visible in the string | IDs must change when artifacts are split, moved, or re-parented; harder to parse |

**Why we chose flat:** Specs get split (Split Protocol). Plans get rewritten (Replan Protocol). Features get reorganized. In all three cases, flat IDs remain stable — the artifact keeps its identity. With hierarchical IDs, splitting S-042 would require renaming FEAT-042.SPEC-1 to FEAT-042.SPEC-1a or similar, breaking all references. Flat IDs + relational fields give us the same traceability without the rename cascade.

#### Relational Fields (How Artifacts Reference Each Other)

Each artifact carries fields that link it to its parent and children. These are the traceability edges:

```
Feature F-042
  └── specs: [S-042, S-043]          ← derived (populated as specs are written)

Spec S-042
  ├── feature: F-042                  ← upward link
  └── depends_on: [{id: S-041, ...}] ← lateral link

Plan P-042
  ├── spec: S-042                     ← upward link (1:1)
  └── spec_version: 1                ← version pin

Task T-003
  ├── plan: P-042                     ← upward link
  └── hld: HLD-2                      ← which deliverable
```

**Traceability is maintained by relational fields, not by ID structure.** Given any artifact, you can navigate up (`spec → feature`), down (`feature → specs`), or laterally (`spec → depends_on`).

#### Code Markers

Implemented code references the spec it satisfies using `@spec` tags:

```typescript
// @spec S-042 — Product registration command handler
export function handleAddCommand(path: string): Result<ProductId, AddError> { ... }
```

This is equivalent to the industry `@trace` convention (see ISO 26262 §8.4.4, DO-178C §5.5). We use `@spec` instead of `@trace` because we only mark specs in code — plans and tasks are NOT marked (see Part 9: Traceability for rationale).

**CI / audit support:** A simple regex extracts all traced specs from the codebase:

```bash
grep -rn "@spec S-" ./src/          # Find all spec references in code
grep -rn "@spec S-042" ./src/       # Find all code implementing S-042
```

Cross-referencing this against the spec registry produces a coverage report: which specs have code, which don't, and which code references non-existent specs.

#### RTM (Requirements Traceability Matrix)

The full traceability chain, as maintained by the identification system:

```
Feature IS-N / M-N                    (what the stakeholder wants)
    ↕ Feature Coverage Matrix
Spec AC-N                             (what the system must do)
    ↕ Coverage Matrix
MUST / MUST NOT                       (the contract)
    ↕ Verification Plan
Test                                  (the proof)
    ↕ @spec tag
Code                                  (the implementation)
```

Each `↕` is maintained by a different mechanism: relational fields for artifact-to-artifact links, coverage matrices for AC-to-MUST links, verification plans for MUST-to-test links, and `@spec` tags for test/code-to-spec links.

---

## Part 2 — Artifact Lifecycle & Review

### Artifact Statuses

Every artifact has a status that tracks where it is in its lifecycle:

| Status | Meaning | Applies To |
|--------|---------|------------|
| `DRAFT` | Being written or revised. Includes all review iterations. | Feature, Spec, Plan, Task |
| `APPROVED` | Passed gate review, authorized for next phase | Feature, Spec, Plan |
| `IN_PROGRESS` | Active work underway | Feature, Plan, Task |
| `BLOCKED` | Cannot proceed — external dependency or unresolved issue | Feature, Spec, Plan, Task |
| `DONE` | All acceptance criteria verified, artifact complete | Feature, Spec, Plan, Task |
| `FAILED` | Verification failed or implementation proved impossible | Plan, Task |
| `ABANDONED` | Intentionally stopped, will not be completed (terminal) | Feature, Spec, Plan, Task |
| `SUPERSEDED` | Replaced by a newer version (terminal) | Feature, Spec, Plan |

**Simplified transitions:**

```
DRAFT ──(review cycle)──→ APPROVED ──→ IN_PROGRESS ──→ DONE
                                            │             │
                                            ▼             ▼
                                         BLOCKED      SUPERSEDED
                                            │
                                      ┌─────┼─────┐
                                      ▼     ▼     ▼
                                   DRAFT  FAILED  ABANDONED
```

Note: Specs do not have IN_PROGRESS or FAILED because specs are contracts, not work. Plans have those states because plans are executed. Tasks do not go through gate review (they are operational).

### The Review Cycle

Artifacts stay in DRAFT throughout all review iterations. The review cycle is iterative refinement, not a single-pass gate:

```
Author writes draft
  ↓
Reviewer 1 (blind) produces findings doc
  ↓
Author fixes obvious issues
  ↓
Reviewer 2 (blind or sees Reviewer 1) produces findings doc
  ↓
Findings merged into single review doc
  ↓
Triage: classify each finding as must-fix / implementer-decides / deferred
  ↓
Must-fix patches applied to draft
  ↓
Human decision: APPROVE (→ status becomes APPROVED) or iterate again
```

**Key points:**
- The artifact stays in `DRAFT` through all of this. There is no "PENDING_REVIEW" status — review is part of drafting.
- Agent reviewers produce findings. They do NOT approve. Approval is a human decision.
- Multiple reviewers (ideally independent/blind) find more issues than a single reviewer. Our empirical experience: dual-blind review (Grok + Claude) surfaces 2-3x more issues than single review.
- Findings are classified by severity: `BLOCKING` (must fix), `WARNING` (should fix), `INFO` (note for future).

#### The Iteration Problem (Open)

**We do not have a precise method for determining when to stop iterating.** This is an honest gap.

The risks of each direction:

| Too few iterations | Too many iterations |
|---|---|
| Real defects escape to implementation | LLMs start inventing problems that don't exist |
| Cost compounds downstream (spec bug → plan bug → code bug → test bug) | Diminishing returns — iteration 4 finds cosmetic issues, not structural ones |
| False confidence in artifacts | Review doom loop — never converge, never ship |

**Current heuristics (not rules):**

1. **Iteration 1** always finds real issues. Do at least one review pass.
2. **Iteration 2** with a different reviewer catches what the first missed. Usually worth doing for specs and plans.
3. **Iteration 3** is the judgment call. If iteration 2 found BLOCKING issues, iterate. If it found only WARNINGs and INFOs, triage and approve.
4. **After iteration 3**, the human should exercise the gate — approve with known limitations, or declare the artifact needs architectural rethinking (not more review passes).
5. **Never let the reviewers decide when to stop.** That's the human's job. Reviewers will always find something.

**The triage step is critical.** Not every finding requires a fix. The human classifies:

| Classification | Action |
|---|---|
| Must-fix | Patch the artifact before approval |
| Implementer-decides | Record in the plan; the implementer chooses the approach |
| Deferred | Record in `tasks/deferred.md`; scheduled for a future phase |
| Disagree | Document rationale for rejecting the finding |

#### Graduated Review Depth

Not all artifacts need the same review intensity:

| Artifact Type | Recommended Review | Rationale |
|---|---|---|
| **Specs** | Dual-blind (2 independent reviewers) | Spec bugs amplify 4-5x downstream |
| **Plans** | Dual-blind (2 independent reviewers) | Contract artifact; expensive to fix post-implementation |
| **Code** | Single reviewer + test suite | Tests are the independent signal; review catches design issues |
| **Tasks** | Single reviewer | Derived from approved specs; lower risk |
| **Features** | Stakeholder review | Business decision, not technical review |

### Gate Definitions

Despite the iterative review process, approval decisions are formal:

| Gate | Artifact | Approver Role | Approver Must Not Be |
|------|----------|--------------|---------------------|
| FEATURE_GATE | Feature | Stakeholder with role=approver | Author |
| SPEC_GATE | Spec | Engineering lead or delegate | Author |
| PLAN_GATE | Plan | Technical reviewer | Author or spec author |
| SPIKE_GATE | Spike spec | Research lead | Author |

**Author ≠ Approver** is an invariant. Agent reviewers inform the decision; the human (or delegated authority) makes it.

### Gate Timeouts

| Gate | Default Timeout | On Timeout |
|------|-----------------|------------|
| FEATURE_GATE | 7 days | Escalate to stakeholder list; after 14 days → BLOCKED |
| SPEC_GATE | 3 days | Escalate to engineering lead; after 7 days → BLOCKED |
| PLAN_GATE | 2 days | Escalate to tech lead; after 5 days → BLOCKED |

BLOCKED artifacts require manual intervention. Timeouts are configurable per domain.

### Approval Records

When a gate decision is made, an Approval Record is created:
- Decision: `APPROVED`, `REVISION_REQUESTED`, or `REJECTED`
- Approval records are immutable and linked to artifact version
- If REJECTED, the approver must cite specific BLOCKING findings
- After 3 revision cycles without approval, the artifact transitions to BLOCKED for architectural review
- **Appeal path:** Author may escalate to next-level approver with written rationale if they disagree with a rejection

### Delegation

For automated pipelines, gates can be delegated to agents:

| Gate | May Delegate To | Constraint |
|------|-----------------|------------|
| FEATURE_GATE | Director agent with `stakeholder_proxy` permission | Delegation recorded in feature metadata |
| SPEC_GATE | Review agent with `engineering_review` permission | Automatic if configured in pipeline |
| PLAN_GATE | Review agent with `technical_review` permission | Automatic if configured in pipeline |

Delegation does not remove the Author ≠ Approver constraint.

---

## Part 3 — Design Rules

### The Sizing Rule

**A spec describes what can be implemented atomically — without requiring intermediate checkpoints or partial-state commits.**

This is the only sizing rule. "Session," "focus time," and other temporal measures are explicitly rejected as sizing criteria because:
- Agent context windows vary by model tier
- Human focus blocks vary by person and domain
- External blockers (data, review, compute) are unpredictable

The test is atomicity: can this unit be implemented as a single uninterruptible block of work that produces a verifiable deliverable? If the answer is "only with intermediate saves," the spec is too large.

#### How sizing cascades through layers

Atomicity is **estimated** when writing specs and **validated** when writing plans and tasks. Each layer transition is a checkpoint where mis-sizing is discovered and corrected:

| Transition | Who validates | What they check | Signal it's wrong |
|------------|-------------|-----------------|-------------------|
| Feature → Specs | Spec writer | Can I define this as one atomic unit? | Need > 10 ACs, > 7 HLDs, or can't describe without "then checkpoint and..." |
| Spec → Plan | Plan writer | Can I implement this without intermediate saves? | Implementation sequence requires waiting on external results between steps, or plan needs > 7 HLDs |
| Plan → Tasks | Task creator | Can one agent complete each HLD without context overflow? | Single HLD becomes > 3 tasks, or task requires mid-task coordination |

**Spec writing (estimation):** The spec writer sizes by asking "can a single specialist implement this atomically?" This is an estimate — the writer hasn't built it yet. The caps (≤ 10 ACs, ≤ 7 HLDs) are heuristics that correlate with atomicity but do not guarantee it.

**Plan writing (first validation):** The planner decomposes the spec into concrete implementation steps. This is where mis-sizing is discovered. If the planner finds:
- An HLD requires checkpoint-saving because a later HLD depends on its output through an external system
- The implementation sequence has mandatory wait points (external compute, human review, data availability)
- They need more than 7 HLDs to cover the spec

Then the spec is not atomic. The planner must:
1. Record the finding in the plan's **Open Questions** section
2. Open Questions must be empty before PLAN GATE — so this forces the issue
3. The resolution is either: (a) amend the spec via the Split Protocol, or (b) the plan reviewer confirms the implementation is genuinely atomic despite appearances

**Task creation (second validation):** If tasks are used, each HLD should become 1-2 tasks. If a single HLD becomes > 3 tasks, the HLD was too coarse and the plan should be revised. Tasks are terminal — they cannot be split after creation. If scope grows mid-task, create additional tasks (don't expand existing ones).

#### What happens when sizing is wrong

The framework does not assume specs are correctly sized on first attempt. Sizing errors are caught and corrected:

```
Spec written (estimate)
  ↓
Plan written → planner discovers spec isn't atomic
  ↓
Open Question recorded: "S-042 requires intermediate checkpoint after HLD-3"
  ↓
PLAN GATE blocks (open questions non-empty)
  ↓
Resolution: split S-042 into S-042 + S-043 via Split Protocol
  ↓
New specs go through SPEC GATE
  ↓
New plans written for each
```

This is not a failure — it is the framework working as intended. The cost of splitting at plan time is lower than the cost of discovering mid-implementation that the work can't be completed atomically.

### The Layer Principle

Each artifact layer answers exactly one question:

| Layer | Question | Owner | Gate |
|-------|----------|-------|------|
| Feature | What capability does the stakeholder get? | Stakeholder | FEATURE GATE |
| Spec | What must this unit do? (contract) | Engineering Lead | SPEC GATE |
| Plan | How will we build it? (blueprint) | Technical Reviewer | PLAN GATE |
| Task | What is the current work assignment? | Implementer/Agent | None (operational) |

**Decision rule for layer assignment:**
- Names an algorithm, data structure, file, or implementation choice → Plan or lower
- Names a tolerance, benchmark target, or verification method → Spec or lower
- Names a business outcome observable without running code → Feature

### The Task Layer

Tasks are **optional but well-defined**. They exist when:
1. Parallel assignment is needed (multiple agents or human teams)
2. Progress tracking is needed below the plan level
3. Retry isolation is needed (re-execute one deliverable without restarting the plan)
4. Audit trail is needed for individual work units

When tasks are not used, the plan's deliverables serve as implicit work units, but with reduced traceability. The framework does not pretend tasks are unnecessary — it makes their use explicit.

### Non-Feature Work

Not all work delivers stakeholder-observable capability. The framework recognizes:

| Work Type | Authorizing Artifact | Gate |
|-----------|---------------------|------|
| Feature work | Feature → Spec → Plan | All three gates |
| Defect fix | Defect ticket (external) → Spec → Plan | SPEC + PLAN gates |
| Refactor | Refactor proposal → Spec → Plan | SPEC + PLAN gates |
| Infrastructure | Infra ticket → Spec → Plan | SPEC + PLAN gates |
| Research spike | Research question → Spike spec | SPIKE gate (time-boxed, no deliverable gate) |

Non-feature specs use `feature: NONE` with a `work_type` field. They follow the same state machine but skip the FEATURE GATE.

### Domain Agnosticism

This framework is domain-agnostic by design. The core (statuses, templates, conformance, gates, dependencies, traceability) is invariant; terminology, caps, timeouts, and verification types can be customized per domain. See [domain-adaptation.md](domain-adaptation.md) for details.

---

## Part 4 — Templates

Full templates are in **[templates.md](templates.md)**.

| Template | Purpose | Required Fields |
|----------|---------|----------------|
| **Feature** | Stakeholder-observable capability | id, version, name, status, work_type, author, stakeholders, domain, metrics, scope, **acceptance tests** |
| **Spec** | Engineering contract for one atomic unit | id, version, name, status, feature, ACs (1-10), HLDs (1-7), coverage matrix |
| **Plan** | Implementation blueprint for one spec | id, spec, spec_version, deliverables, verification plan, open questions |
| **Task** | Assignable work unit from a plan deliverable | id, plan, hld, status, owner |
| **Approval Record** | Immutable gate decision | artifact, artifact_version, gate, decision, timestamp, approver |

Each template includes identity, temporal, ownership, and relationship sections with full field-level constraints.

---

## Part 5 — Conformance Schema

### Required Fields

An artifact is **non-conforming** if any required field is missing or invalid.

#### Feature Required Fields

| Field | Type | Constraints |
|-------|------|-------------|
| id | string | Matches `^F-[0-9]{3,}$` |
| version | integer | ≥ 1 |
| name | string | kebab-case, 3-50 chars |
| status | enum | Valid state machine state |
| work_type | enum | `feature` |
| created | datetime | ISO 8601 with timezone |
| updated | datetime | ISO 8601 with timezone, ≥ created |
| author | string | Non-empty |
| stakeholders | array | At least one with role=approver |
| domain | string | Valid domain profile ID |
| Success Metrics | section | At least one metric row |
| In Scope | section | At least one item |
| Out of Scope | section | Present (may be empty with rationale) |

#### Spec Required Fields

| Field | Type | Constraints |
|-------|------|-------------|
| id | string | Matches `^S-[0-9]{3,}$` |
| version | integer | ≥ 1 |
| name | string | kebab-case, 3-50 chars |
| status | enum | Valid state machine state |
| work_type | enum | `feature \| defect \| refactor \| infra \| spike` |
| created | datetime | ISO 8601 with timezone |
| author | string | Non-empty |
| domain | string | Valid domain profile ID |
| feature | string | Valid F-XXX or `NONE` |
| Acceptance Criteria | section | 1-10 rows |
| High-Level Deliverables | section | 1-7 rows |
| Coverage Matrix | section | Every AC appears at least once |

#### Plan Required Fields

| Field | Type | Constraints |
|-------|------|-------------|
| id | string | Matches `^P-[0-9]{3,}$` |
| spec | string | Valid S-XXX |
| spec_version | integer | Must match an existing spec version |
| status | enum | Valid state machine state |
| author | string | Non-empty |
| Verification Plan | section | Every AC from spec has a row |
| Open Questions | section | Present (must be empty for APPROVED transition) |

### Invariants

1. **ID immutability:** Once assigned, `id` never changes. A renamed artifact gets a new ID.
2. **Version monotonicity:** Version only increments, never decrements.
3. **Temporal ordering:** `status_changed` ≥ `updated` ≥ `created`
4. **Author ≠ Approver:** For any approval record, `approver` ≠ artifact `author`
5. **Supersession chain:** If `supersedes: X`, then X must have `superseded_by: this`
6. **Coverage completeness:** Every AC maps to ≥1 MUST; every MUST maps to ≥1 verification method
7. **Scope traceability:** Every spec AC cites a feature in-scope item or metric
8. **Dependency acyclicity:** The `depends_on` graph has no cycles (validated at SPEC GATE)

### Reject Conditions

An artifact **must be rejected** at its gate if:

1. Any required field is missing or invalid
2. Any invariant is violated
3. Author and approver are the same identity
4. Open questions are non-empty (for plans)
5. Coverage matrix is incomplete
6. AC count exceeds 10 or HLD count exceeds 7
7. Dependencies form a cycle

### Split Protocol

When a spec must be split (AC count > 10, HLD count > 7, or atomicity violated):

1. Create new specs with fresh IDs (S-XXX-a, S-XXX-b is forbidden — use new sequence numbers)
2. Each original AC must appear in exactly one child spec (conservation)
3. Parent spec transitions to SUPERSEDED
4. Child specs reference parent in metadata: `split_from: S-XXX`
5. All child specs must pass SPEC GATE before any implementation begins
6. Feature's spec list is updated atomically

### Replan Protocol

When a plan is rejected or fails and rework is needed:

1. Create new plan with fresh ID (P-NNN+1)
2. New plan's `supersedes` points to old plan
3. Old plan's `superseded_by` points to new plan
4. Old plan transitions to SUPERSEDED
5. New plan starts at DRAFT
6. The 1:1 spec:plan rule counts only non-superseded plans

---

---

## Part 6 — Dependency System

### Which Artifacts Have Dependencies

Not all artifact types declare dependencies in the same way:

| Artifact | Has `depends_on`? | Can depend on | Example |
|----------|-------------------|---------------|---------|
| **Feature** | Yes | Other features | F-101 (simulation) depends on F-042 (registration) |
| **Spec** | Yes | Other specs | S-013 (parser) depends on S-011 (registration) |
| **Plan** | No — inherited from spec | (inherited) | If S-042 depends on S-041, then P-042 cannot start until S-041 is DONE |
| **Task** | Yes | Other tasks within the same plan | T-002 (handlers) depends on T-001 (schema) |

**Why plans don't have their own `depends_on`:** Plans are 1:1 with specs. If spec S-042 depends on S-041, then plan P-042 implicitly cannot start until S-041 is DONE (because the interface or temporal dependency hasn't been satisfied). Duplicating this in the plan would create two sources of truth. The spec's `depends_on` is the single source.

**Tasks can only depend on tasks within the same plan.** Cross-plan task dependencies don't exist — if a task in P-042 needs something from P-041, that's a spec-level dependency (S-042 depends on S-041), not a task-level one.

### Dependency Types

| Type | Meaning | Satisfaction Predicate | Invalidation Trigger |
|------|---------|----------------------|---------------------|
| `temporal` | Must complete before this starts | Upstream status = DONE | Never (ordering only) |
| `interface` | Relies on upstream's observable outcome | Upstream status = DONE AND outcome matches contract | Upstream outcome changes |
| `external` | Relies on system outside this framework | External check passes | External system changes |
| `soft` | Preferred but not required ordering | Upstream status = DONE OR timeout elapsed | Never |

#### Which types apply where

| Type | Feature → Feature | Spec → Spec | Task → Task |
|------|-------------------|-------------|-------------|
| `temporal` | ✓ | ✓ | ✓ |
| `interface` | — | ✓ | ✓ |
| `external` | — | ✓ | — |
| `soft` | ✓ | ✓ | ✓ |

Features use `temporal` or `soft` only — features don't have interfaces (specs do). Tasks don't use `external` — external dependencies are declared at the spec level and inherited by the plan/tasks.

### Dependency Declaration

**In feature frontmatter:**

```yaml
# === RELATIONSHIPS ===
depends_on:                          # OPTIONAL. Other features this depends on.
  - id: F-042
    type: temporal                   # Feature must be DONE before this feature starts
```

**In spec frontmatter:**

```yaml
depends_on:
  - id: S-011
    type: interface
    contract: "repos.yaml exists and contains product entry"
  - id: S-010
    type: temporal
  - id: external:gitlab-api
    type: external
    check: "curl -f http://localhost:8929/api/v4/projects"
    timeout: 30s
```

**In task frontmatter:**

```yaml
depends_on:                          # OPTIONAL. Other tasks in same plan.
  - id: T-001
    type: temporal                   # Schema must be created before handlers
```

### Cycle Rejection

Dependency cycles are rejected at gate review:

1. Build directed graph of all artifacts with `depends_on` edges
2. Run topological sort
3. If sort fails (cycle detected), reject all artifacts in the cycle
4. Cycle must be broken by removing an edge (changing a dependency) before any artifact in cycle can be approved

Feature-level cycles are checked at FEATURE GATE. Spec-level cycles at SPEC GATE. Task-level cycles are checked by the plan author before task creation.

### Cross-Feature Dependencies

When a spec depends on a spec from a different feature:

1. The dependency must be `temporal` or `interface` (not `soft`)
2. If upstream feature is deprioritized (priority demoted), downstream feature's status transitions to BLOCKED
3. Cross-feature interface dependencies require explicit approval at SPEC GATE with rationale

### Ordering Precedence

When multiple orderings conflict:

1. **Dependency edges** (highest): explicit `depends_on` must be satisfied
2. **HLD order** (spec): logical decomposition order
3. **Implementation sequence** (plan): may reorder within HLD constraints for practical reasons

If plan's implementation sequence violates a dependency edge, the plan is non-conforming.

---

## Part 7 — Traceability

### The Traceability Chain

Every piece of implemented functionality traces back to stakeholder value through a five-link chain:

```
Feature (IS-N / M-N) → Spec AC → MUST/MUST NOT → Verification → Code (@spec tag)
```

| Link | Artifact | Question Answered |
|------|----------|-------------------|
| 1 | Feature IS-N / M-N | What does the stakeholder get? |
| 2 | Spec AC | What observable behavior proves it? |
| 3 | MUST / MUST NOT | What contract does the implementation satisfy? |
| 4 | Verification | What runnable check confirms the contract? |
| 5 | Code `@spec` tag | Where is this implemented? |

**Forward trace:** Stakeholder need → Code that delivers it.
**Reverse trace:** Code → Why it exists.

### Feature Coverage Matrix

Every feature must have a coverage matrix before SPEC GATE approval of its final spec. The matrix proves that no in-scope item or metric was lost during decomposition.

**Template:**

| Feature Item | Type | Covered By Spec AC |
|--------------|------|-------------------|
| IS-1 | in-scope | S-XXX AC-1 |
| IS-2 | in-scope | S-XXX AC-2, S-YYY AC-1 |
| M-1 | metric | S-XXX AC-3 |

**Rules:**
- Every IS-N must appear in at least one spec AC's "Traces To" column
- Every M-N must appear in at least one spec AC's "Traces To" column
- Empty rows indicate scope loss — the feature promised something that no spec delivers
- A single IS-N may map to multiple ACs (decomposition); a single AC may trace to multiple IS-N (consolidation)

**Validation:** At SPEC GATE, the approver verifies:
1. Matrix has no empty "Covered By" cells
2. Every cited AC actually exists in the referenced spec
3. The AC's criterion plausibly addresses the feature item

### Code Markers

Implemented code references the **spec**, not the plan or task:

```typescript
// @spec S-042 — Product registration command handler
export function handleAddCommand(path: string): Result<ProductId, AddError> {
  // ...
}
```

**Why spec and not plan or task?**
- **Plans are consumed:** A plan describes how to build; once built, the plan's value is historical. Plans may be rewritten, superseded, or consolidated without changing what the code does.
- **Tasks are operational:** Tasks track who did what and when. They are bookkeeping, not contracts.
- **Specs are contracts:** The spec defines what the code must do. When behavior changes, the spec changes. The spec is the stable "why this code exists."

**Format:** `@spec S-XXX` — just the ID. The spec file contains the full context.

**Placement:**
- Module-level comment for the primary implementation file
- Function-level comment for isolated AC implementations
- Not needed for test files (tests reference specs via test names)

### Feature Acceptance Tests

Spec tests verify individual ACs. **Feature acceptance tests verify the stakeholder outcome end-to-end.**

This distinction matters because:
- Spec tests are narrow: each tests one AC in isolation
- All spec tests can pass while the feature is broken (composition failure)
- The pipeline says "done" based on exit codes, not based on understanding
- Feature acceptance tests are the independent proof that the decomposition was correct

**What a feature acceptance test is:**
- Tests the **metric** directly, not the ACs
- Exercises the full user-observable workflow, not isolated units
- Written against the feature description and success metrics, not against spec internals
- Can be run by someone who has never read the specs

**What it is NOT:**
- Not a spec test (those test ACs)
- Not an integration test (those test component wiring)
- Not a smoke test (those test "does it start")

**Every feature metric must have a runnable acceptance test.** The test is defined in the Feature artifact and maps directly to the Success Metrics table:

```
| Metric | Acceptance Test | Pass Criterion |
|--------|----------------|----------------|
| M-1    | test:feature:f042-registration | exits 0, output contains product ID |
| M-2    | test:feature:f042-error-paths  | exits 0, all error patterns matched |
```

**When to write acceptance tests:** After specs are approved, before or during implementation. They can be written by a different agent than the implementer — the test author reads the feature, not the plan.

**Why this is independent of the pipeline:** The pipeline runs spec tests as part of plan verification. Feature acceptance tests run **after** the pipeline claims the feature is done. They are the external audit. If all spec tests pass but the feature acceptance test fails, the decomposition was wrong — a spec is missing an AC, or the ACs don't compose.

### Completion Predicates

**Spec done:**
All ACs' verification methods pass. Specifically:
- Every row in the Coverage Matrix has a passing verification
- No MUST is unverified
- No MUST NOT is violated

**Feature done:**
1. All specs with `feature: F-XXX` have status = DONE
2. Feature Coverage Matrix has no empty rows (no scope loss)
3. Each metric (M-N) has a passing measurement recorded
4. **All feature acceptance tests pass** (the independent proof)

A feature cannot be marked DONE if any spec is still IN_PROGRESS, BLOCKED, or FAILED, or if any acceptance test is failing.

**The difference between steps 1-3 and step 4:** Steps 1-3 verify the process was followed. Step 4 verifies the outcome is correct. A feature can satisfy 1-3 and fail 4 — that means the process worked but the decomposition was wrong. This is the signal to amend specs, not to rerun the pipeline.

### Reverse Trace

Given a code file, you can always navigate back to the stakeholder need:

```
Code @spec S-042 → specs/S-042.md → feature: F-042 → features/F-042.md → IS-N, M-N
```

This reverse trace answers: "Why does this code exist? What stakeholder need does it serve?"

**Tooling support:** A simple grep for `@spec S-XXX` across the codebase produces the implementation footprint of a spec. Aggregating by feature produces the implementation footprint of a feature.

### Why NOT Mark Tasks or Plans in Code

| Artifact | Persistence | Code Marker? | Reason |
|----------|-------------|--------------|--------|
| Feature | Long (years) | No | Too coarse — features span many files |
| Spec | Long (years) | **Yes** | Right granularity, stable contract |
| Plan | Medium (weeks) | No | Consumed during implementation; may be rewritten |
| Task | Short (days) | No | Operational bookkeeping, not contract |

Marking plans or tasks in code creates stale references:
- Plans get superseded; the code would reference a dead document
- Tasks are per-execution; multiple tasks may implement the same spec

The spec is the Goldilocks artifact: stable enough to survive, granular enough to be useful.

---

## Part 8 — Worked Examples

Full worked examples are in **[examples.md](examples.md)**.

| Example | Domain | Artifacts | Key Lesson |
|---------|--------|-----------|------------|
| **1: Product Registration** | SW Dev | F-042, S-042, P-042 | Full chain: feature → spec → plan with coverage matrix |
| **2: Large-Scale Simulation** | Nav Sim | F-101, S-101, P-101 | Spec says "sub-quadratic" — plan names Barnes-Hut. Layer discipline. |
| **3: Signal Parser Crash** | SW Dev (defect) | S-200 | Non-feature work: `feature: NONE`, `work_type: defect` |
| **Negative Examples** | — | — | What NOT to do: algorithm in feature, file paths in spec, self-approval |

Each example includes conformance checks showing which rules pass, and the Feature Coverage Matrix demonstrating traceability.

---

## Appendix A — Quick Reference

### Status Transitions Cheat Sheet

| From | To | Trigger |
|------|-----|---------|
| DRAFT | APPROVED | Human approves after review cycle |
| APPROVED | IN_PROGRESS | Work begins |
| IN_PROGRESS | DONE | Verification passes |
| IN_PROGRESS | FAILED | Verification fails |
| FAILED | DRAFT | Rework path identified |
| Any | BLOCKED | External blocker |
| Any | ABANDONED | Intentional cancellation |
| DONE | SUPERSEDED | Replaced by new version |

### Conformance Checklist

Before submitting for gate review:

- [ ] All required fields present
- [ ] ID format correct (F-NNN, S-NNN, P-NNN, T-NNN)
- [ ] Status = DRAFT (review happens while in DRAFT)
- [ ] Timestamps have timezone
- [ ] Author field populated
- [ ] For specs: AC count ≤ 10, HLD count ≤ 7
- [ ] For specs: Every AC traces to feature scope or metric
- [ ] For specs: Coverage matrix complete
- [ ] For plans: Every AC has verification method
- [ ] For plans: Open questions empty
- [ ] For plans: spec_version matches approved spec
- [ ] Dependencies: No cycles in depends_on graph

### ID Allocation

| Artifact | Format | Sequence | Scope |
|----------|--------|----------|-------|
| Feature | F-NNN | Monotonic | Per domain |
| Spec | S-NNN | Monotonic | Global |
| Plan | P-NNN | Monotonic | Global |
| Task | T-NNN | Monotonic | Per plan |

IDs are never reused. Cancelled artifacts retain their IDs. Split artifacts get new IDs (not suffixes).

---

## Appendix B — Migration from Draft v1

If you have artifacts conforming to the v1 draft:

1. **Add missing fields:** version, status_changed, work_type
2. **Convert status:** `draft` → `DRAFT`, `approved` → `APPROVED`, `done` → `DONE`
3. **Add timestamps:** Convert `YYYY-MM-DD` to `YYYY-MM-DDTHH:MM:SSZ`
4. **Add coverage matrix:** Create matrix linking ACs to MUSTs to verifications
5. **Separate tasks:** If plan has progress tracking needs, create task files
6. **Add approval records:** Create records for already-approved artifacts (mark as `migrated`)

The `tasks/deferred/` directory continues to serve its purpose — the framework now formally recognizes deferred items via out-of-scope destinations.

---

*End of document.*
