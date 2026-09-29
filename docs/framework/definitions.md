# Synapse Framework: Definitions & Conformance

> **Status:** v2 — Baseline (dual-blind reviewed, traceability added)
> **Scope:** Domain-agnostic core with explicit adaptation mechanism

**This document is the handbook.** Read it top-to-bottom for the complete framework.
Detailed reference material is in companion files:

| File | Contents |
|------|----------|
| **definitions.md** (this file) | Principles, definitions, state machine, conformance, gates, dependencies, domain adaptation, traceability |
| [templates.md](templates.md) | Full YAML templates for Feature, Spec, Plan, Task, and Approval Record |
| [examples.md](examples.md) | 3 worked examples (SW Dev, Nav Sim, Defect Fix) + negative examples |

---

## Table of Contents

1. [Design Principles](#part-1--design-principles)
2. [Definitions](#part-2--definitions)
3. [State Machine](#part-3--state-machine)
4. [Templates](#part-4--templates) → summary; full templates in [templates.md](templates.md)
5. [Conformance Schema](#part-5--conformance-schema)
6. [Gate Protocol](#part-6--gate-protocol)
7. [Dependency System](#part-7--dependency-system)
8. [Domain Adaptation](#part-8--domain-adaptation)
9. [Worked Examples](#part-9--worked-examples) → summary; full examples in [examples.md](examples.md)
10. [Traceability](#part-10--traceability)

---

## Part 1 — Design Principles

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

---

## Part 2 — Definitions

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

## Part 3 — State Machine

### Artifact Lifecycle States

```
                    ┌─────────────────────────────────────────┐
                    │                                         │
                    ▼                                         │
┌──────────┐    ┌──────────┐    ┌───────────┐    ┌──────────┐ │
│  DRAFT   │───▶│ PENDING  │───▶│ APPROVED  │───▶│   DONE   │ │
└──────────┘    │  REVIEW  │    └───────────┘    └──────────┘ │
     │          └──────────┘          │                       │
     │               │                │                       │
     │               ▼                ▼                       │
     │          ┌──────────┐    ┌───────────┐                 │
     │          │ REVISION │    │IN_PROGRESS│                 │
     │          │ REQUESTED│    └───────────┘                 │
     │          └──────────┘          │                       │
     │               │                │                       │
     │               │                ▼                       │
     │               │          ┌───────────┐                 │
     └───────────────┴─────────▶│  BLOCKED  │─────────────────┘
                                └───────────┘
                                      │
                    ┌─────────────────┼─────────────────┐
                    ▼                 ▼                 ▼
              ┌──────────┐    ┌───────────┐    ┌───────────────┐
              │  FAILED  │    │ ABANDONED │    │  SUPERSEDED   │
              └──────────┘    └───────────┘    └───────────────┘
```

### State Definitions

| State | Meaning | Exit transitions |
|-------|---------|------------------|
| `DRAFT` | Initial creation, not yet submitted for review | → PENDING_REVIEW, → ABANDONED |
| `PENDING_REVIEW` | Submitted for gate approval, awaiting decision | → APPROVED, → REVISION_REQUESTED, → BLOCKED |
| `REVISION_REQUESTED` | Gate reviewer requested changes | → DRAFT (rework), → ABANDONED |
| `APPROVED` | Passed gate, authorized for next phase | → IN_PROGRESS, → SUPERSEDED, → BLOCKED |
| `IN_PROGRESS` | Active work (implementation for plans, spec decomposition for features) | → DONE, → BLOCKED, → FAILED |
| `BLOCKED` | Cannot proceed due to external dependency or unresolved issue | → DRAFT, → IN_PROGRESS, → ABANDONED, → FAILED |
| `DONE` | All acceptance criteria verified, artifact complete | → SUPERSEDED (if requirements change) |
| `FAILED` | Verification failed or implementation impossible | → DRAFT (rework), → ABANDONED |
| `ABANDONED` | Intentionally stopped, will not be completed | Terminal |
| `SUPERSEDED` | Replaced by a newer version | Terminal |

### Transition Rules

| Transition | Predicate | Actor |
|------------|-----------|-------|
| DRAFT → PENDING_REVIEW | All required fields present, conformance check passes | Author |
| PENDING_REVIEW → APPROVED | Gate approver signs with no BLOCKING findings | Gate Approver |
| PENDING_REVIEW → REVISION_REQUESTED | Gate approver cites specific required changes | Gate Approver |
| REVISION_REQUESTED → DRAFT | Author acknowledges and begins rework | Author |
| APPROVED → IN_PROGRESS | Work begins (plan: implementation starts; feature: specs written) | Owner |
| IN_PROGRESS → DONE | All ACs pass verification | Verifier (distinct from implementer for plans) |
| IN_PROGRESS → BLOCKED | External blocker identified | Owner |
| IN_PROGRESS → FAILED | Verification fails, rework needed | Verifier |
| BLOCKED → IN_PROGRESS | Blocker resolved | Owner |
| BLOCKED → FAILED | Blocker determined unresolvable | Owner + Approver |
| FAILED → DRAFT | Rework path identified | Author |
| Any → ABANDONED | Intentional cancellation | Owner + Approver |
| DONE → SUPERSEDED | Newer version approved | Author of successor |

### Per-Artifact State Applicability

| State | Feature | Spec | Plan | Task |
|-------|---------|------|------|------|
| DRAFT | ✓ | ✓ | ✓ | ✓ |
| PENDING_REVIEW | ✓ | ✓ | ✓ | — |
| REVISION_REQUESTED | ✓ | ✓ | ✓ | — |
| APPROVED | ✓ | ✓ | ✓ | — |
| IN_PROGRESS | ✓ | — | ✓ | ✓ |
| BLOCKED | ✓ | ✓ | ✓ | ✓ |
| DONE | ✓ | ✓ | ✓ | ✓ |
| FAILED | — | — | ✓ | ✓ |
| ABANDONED | ✓ | ✓ | ✓ | ✓ |
| SUPERSEDED | ✓ | ✓ | ✓ | — |

Note: Specs do not have IN_PROGRESS or FAILED because specs are contracts, not work. Plans have those states because plans are executed.

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

## Part 6 — Gate Protocol

### Gate Definitions

| Gate | Artifact | Approver Role | Approver Must Not Be |
|------|----------|--------------|---------------------|
| FEATURE_GATE | Feature | Stakeholder with role=approver | Author |
| SPEC_GATE | Spec | Engineering lead or delegate | Author |
| PLAN_GATE | Plan | Technical reviewer | Author or spec author |
| SPIKE_GATE | Spike spec | Research lead | Author |

### Approval Process

1. **Submission:** Author sets status to `PENDING_REVIEW`
2. **Review:** Approver evaluates artifact against conformance schema and domain requirements
3. **Decision:** Approver creates an Approval Record with one of:
   - `APPROVED` — artifact may proceed to next phase
   - `REVISION_REQUESTED` — specific changes required, artifact returns to DRAFT
   - `REJECTED` — fundamental issues, artifact transitions to ABANDONED or requires new ID
4. **Record:** Approval record is immutable and linked to artifact version

### Delegation

For unattended/automated pipelines, gates can be delegated:

| Gate | May Delegate To | Delegation Record |
|------|-----------------|-------------------|
| FEATURE_GATE | Director agent with `stakeholder_proxy` permission | Delegation must be recorded in feature metadata |
| SPEC_GATE | Review agent with `engineering_review` permission | Automatic if configured in pipeline |
| PLAN_GATE | Review agent with `technical_review` permission | Automatic if configured in pipeline |

Delegation does not remove the Author ≠ Approver constraint.

### Timeout Behavior

| Gate | Default Timeout | On Timeout |
|------|-----------------|------------|
| FEATURE_GATE | 7 days | Escalate to stakeholder list; after 14 days, BLOCKED |
| SPEC_GATE | 3 days | Escalate to engineering lead; after 7 days, BLOCKED |
| PLAN_GATE | 2 days | Escalate to tech lead; after 5 days, BLOCKED |

Timeouts are configurable per domain profile. BLOCKED artifacts require manual intervention.

### Rejection Handling

When an artifact is rejected (REVISION_REQUESTED):

1. Approver must cite specific findings (BLOCKING items at minimum)
2. Artifact transitions to REVISION_REQUESTED
3. Author has two options:
   - Rework: transition to DRAFT, address findings, resubmit
   - Appeal: escalate to next-level approver with written rationale
4. After 3 revision cycles without approval, artifact transitions to BLOCKED for architectural review

---

## Part 7 — Dependency System

### Dependency Types

| Type | Meaning | Satisfaction Predicate | Invalidation Trigger |
|------|---------|----------------------|---------------------|
| `temporal` | Must complete before this starts | Upstream status = DONE | Never (ordering only) |
| `interface` | Relies on upstream's observable outcome | Upstream status = DONE AND outcome matches contract | Upstream outcome changes |
| `external` | Relies on system outside this framework | External check passes | External system changes |
| `soft` | Preferred but not required ordering | Upstream status = DONE OR timeout elapsed | Never |

### Dependency Declaration

In spec `depends_on`:

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

### Cycle Rejection

Dependency cycles are rejected at SPEC GATE:

1. Build directed graph of all specs with `depends_on` edges
2. Run topological sort
3. If sort fails (cycle detected), reject all specs in the cycle
4. Cycle must be broken by removing an edge (changing a dependency) before any spec in cycle can be approved

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

## Part 8 — Domain Adaptation

### Invariant Core vs. Domain Profile

The framework has an **invariant core** that applies to all domains, and **domain profiles** that customize for specific contexts.

#### Invariant Core (Cannot Be Changed by Domain)

- State machine states and transitions
- Required fields in templates
- Conformance schema rules
- Gate protocol (Author ≠ Approver, approval records)
- Dependency system
- Split and replan protocols
- Coverage matrix requirement

#### Domain Profile (May Be Customized)

| Aspect | What Can Change | Example |
|--------|-----------------|---------|
| Trigger models | Add domain-specific models | Nav Sim: "continuous" with timestep events |
| Verification types | Add domain-specific types | Nav Sim: "reference-comparison" with tolerance |
| Terminology | Rename labels (not semantics) | "Deliverable" → "Work Package" |
| Caps | Adjust AC/HLD limits with justification | Safety-critical: 5 AC max, 3 HLD max |
| Timeouts | Adjust gate timeouts | Research: 30-day FEATURE_GATE timeout |
| Additional fields | Add required fields for domain | Nav Sim: `reference_dataset`, `tolerance` |
| Metric types | Add measurement procedures | Legal: "gold-set F1 score" |

### Domain Profile Schema

```yaml
---
domain_id: nav-sim
name: Navigation Engineering Simulation
version: 1
extends: core                      # Always extends core

# Additional required fields per artifact type
additional_fields:
  spec:
    - name: reference_dataset
      type: string
      required: true
      description: "Identity of reference dataset for validation"
    - name: tolerance
      type: object
      required: true
      schema:
        metric: string
        threshold: number
        unit: string

  plan:
    - name: numerical_method
      type: string
      required: true
      description: "Primary numerical method (e.g., RK4, Verlet, Barnes-Hut)"

# Additional trigger models
trigger_models:
  - id: continuous
    fields:
      - timestep_event: "what triggers each step"
      - state_observable: "what state is visible"
      - termination: "when simulation ends"

# Additional verification types
verification_types:
  - id: reference-comparison
    fields:
      - reference: "dataset or prior run"
      - metric: "comparison metric"
      - tolerance: "acceptable deviation"
      - seed: "random seed for reproducibility"

# Adjusted caps (with justification)
caps:
  ac_max: 10                       # Same as core
  hld_max: 5                       # Reduced: sim components have high coupling
  cap_justification: "Simulation deliverables have high interdependence; smaller chunks reduce integration risk"

# Adjusted timeouts
timeouts:
  feature_gate: 14d                # Longer: requires simulation validation
  spec_gate: 5d
  plan_gate: 3d
---
```

### Profile Inheritance

1. Every domain profile extends `core`
2. Core fields cannot be removed, only added to
3. Core constraints cannot be relaxed, only tightened
4. A profile may extend another profile (single inheritance)

---


## Part 9 — Worked Examples

Full worked examples are in **[examples.md](examples.md)**.

| Example | Domain | Artifacts | Key Lesson |
|---------|--------|-----------|------------|
| **1: Product Registration** | SW Dev | F-042, S-042, P-042 | Full chain: feature → spec → plan with coverage matrix |
| **2: Large-Scale Simulation** | Nav Sim | F-101, S-101, P-101 | Spec says "sub-quadratic" — plan names Barnes-Hut. Layer discipline. |
| **3: Signal Parser Crash** | SW Dev (defect) | S-200 | Non-feature work: `feature: NONE`, `work_type: defect` |
| **Negative Examples** | — | — | What NOT to do: algorithm in feature, file paths in spec, self-approval |

Each example includes conformance checks showing which rules pass, and the Feature Coverage Matrix demonstrating traceability.

---

## Part 10 — Traceability

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

## Appendix A — Quick Reference

### State Transitions Cheat Sheet

| From | To | Trigger |
|------|-----|---------|
| DRAFT | PENDING_REVIEW | Submit for review |
| PENDING_REVIEW | APPROVED | Gate approver signs |
| PENDING_REVIEW | REVISION_REQUESTED | Gate approver requests changes |
| REVISION_REQUESTED | DRAFT | Author begins rework |
| APPROVED | IN_PROGRESS | Work begins |
| IN_PROGRESS | DONE | Verification passes |
| IN_PROGRESS | FAILED | Verification fails |
| FAILED | DRAFT | Rework plan identified |
| Any | BLOCKED | External blocker |
| Any | ABANDONED | Intentional cancellation |
| DONE | SUPERSEDED | Replaced by new version |

### Conformance Checklist

Before submitting for gate review:

- [ ] All required fields present
- [ ] ID format correct (F-NNN, S-NNN, P-NNN, T-NNN)
- [ ] Status = PENDING_REVIEW
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
