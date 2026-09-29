# Synapse Framework — Artifact Templates

> **Reference for:** [definitions.md](definitions.md) Part 4
> **Templates:** Feature, Spec, Plan, Task, Approval Record

---

## Part 4 — Templates

### Feature Template

```yaml
---
# === IDENTITY ===
id: F-XXX                          # REQUIRED. Immutable after creation. Format: F-NNN
version: 1                         # REQUIRED. Increments on each approved revision
name: feature-name-kebab-case      # REQUIRED. Immutable (use new ID for name changes)
status: DRAFT                      # REQUIRED. Enum: see state machine
work_type: feature                 # REQUIRED. Enum: feature | defect | refactor | infra | spike

# === TEMPORAL ===
created: 2026-09-29T10:30:00Z      # REQUIRED. ISO 8601 with timezone
updated: 2026-09-29T10:30:00Z      # REQUIRED. Updated on any change
status_changed: 2026-09-29T10:30:00Z  # REQUIRED. Updated on status transition

# === OWNERSHIP ===
author: jane.smith                 # REQUIRED. Identity of creator
stakeholders:                      # REQUIRED. At least one
  - name: product-team
    role: approver                 # Enum: approver | consulted | informed
domain: sw-dev                     # REQUIRED. Domain profile ID

# === RELATIONSHIPS ===
specs: []                          # Populated as specs are written. Derived, not manually edited.
supersedes: null                   # F-XXX-vN if this replaces a prior version
superseded_by: null                # F-YYY if this was replaced

# === PRIORITY ===
priority: P1                       # OPTIONAL. Enum: P0 (critical) | P1 (high) | P2 (medium) | P3 (low)
---

## Feature Description

[One paragraph. What capability this adds. Why it matters to stakeholders.
Written from the stakeholder's perspective — no implementation language.
Test: A stakeholder can verify this by using the system, not by reading code.]

## Success Metrics

[Each metric must have: condition, outcome, measurement procedure, target, and owner.]

| Metric ID | Condition | Observable Outcome | Measurement | Target | Owner |
|-----------|-----------|-------------------|-------------|--------|-------|
| M-1 | [when X happens] | [stakeholder observes Y] | [how to measure] | [threshold] | [who measures] |

## Scope

### In Scope

[Bullet list. Each item should be traceable to at least one spec AC when specs are written.]

- IS-1: [scope item]
- IS-2: [scope item]

### Out of Scope

[Bullet list. Each item either references a future feature or is marked WONTDO.]

- OS-1: [excluded item] → deferred to F-YYY
- OS-2: [excluded item] → WONTDO: [rationale]
```

---

### Spec Template

```yaml
---
# === IDENTITY ===
id: S-XXX                          # REQUIRED. Immutable. Format: S-NNN
version: 1                         # REQUIRED. Increments on approved revision
name: spec-name-kebab-case         # REQUIRED. Immutable
status: DRAFT                      # REQUIRED. Enum: see state machine
work_type: feature                 # REQUIRED. Enum: feature | defect | refactor | infra | spike

# === TEMPORAL ===
created: 2026-09-29T10:30:00Z
updated: 2026-09-29T10:30:00Z
status_changed: 2026-09-29T10:30:00Z

# === OWNERSHIP ===
author: agent:agy-planner-001      # REQUIRED. Human or agent identity
domain: sw-dev                     # REQUIRED. Domain profile ID

# === RELATIONSHIPS ===
feature: F-XXX                     # REQUIRED for feature work. NONE for non-feature work.
depends_on: []                     # Spec IDs with dependency type. See dependency system.
supersedes: null
superseded_by: null

# === PRIORITY ===
priority: P1                       # Inherited from feature, can be overridden
---

## Overview

[One paragraph. What this unit does. Who uses it. Why it exists.
What changes when it is implemented. Must not name algorithms or files.]

## Trigger Model

[Describes the activation pattern. Choose the appropriate model for your domain.]

**Model:** request-response | continuous | batch | event-driven | scheduled

| Field | Value |
|-------|-------|
| Actor | [who or what initiates: user, system, timer, event, simulation step] |
| Trigger | [what causes activation] |
| Visible Outcome | [what is observable after execution] |
| Non-Goal | [what this unit explicitly does NOT do] |

## Acceptance Criteria

[Maximum 10. Each criterion is independently testable. Format: given [condition] → [observable result].
Each AC must cite a feature in-scope item (IS-N) or metric (M-N) to maintain traceability.]

| AC | Traces To | Criterion |
|----|-----------|-----------|
| AC-1 | IS-1 | Given [condition], [observable result] |
| AC-2 | M-1 | Given [condition], [observable result] |

## High-Level Deliverables

[Maximum 7. These are WHAT gets built, not HOW. Ordered by logical dependency.
Each HLD becomes a task when task tracking is used.]

| HLD | Description | Depends On |
|-----|-------------|------------|
| HLD-1 | [deliverable description] | — |
| HLD-2 | [deliverable description] | HLD-1 |

## Validation Contract

### MUST

[Observable behaviors the unit must exhibit. Each MUST maps to one or more ACs.]

| ID | Constraint | Covers ACs |
|----|------------|------------|
| MUST-1 | [required behavior] | AC-1, AC-2 |

### MUST NOT

[Forbidden behaviors. Each MUST NOT must be verifiable as absent.]

| ID | Constraint | Verification Method |
|----|------------|---------------------|
| MUSTNOT-1 | [forbidden behavior] | [how to verify absence] |

## Coverage Matrix

[Every AC must map to at least one MUST/MUST NOT. Every MUST must map to a verification method.]

| AC | MUST/MUSTNOT | Verification |
|----|--------------|--------------|
| AC-1 | MUST-1 | [test name or method] |
| AC-2 | MUSTNOT-1 | [test name or method] |
```

---

### Plan Template

```yaml
---
# === IDENTITY ===
id: P-XXX                          # REQUIRED. Format: P-NNN. New ID on replan.
version: 1                         # REQUIRED.
spec: S-XXX                        # REQUIRED. The spec this plan implements.
spec_version: 1                    # REQUIRED. Which version of the spec.
status: DRAFT
work_type: feature                 # Inherited from spec

# === TEMPORAL ===
created: 2026-09-29T10:30:00Z
updated: 2026-09-29T10:30:00Z
status_changed: 2026-09-29T10:30:00Z

# === OWNERSHIP ===
author: agent:agy-planner-001
feature: F-XXX                     # Derived from spec

# === RELATIONSHIPS ===
supersedes: null                   # P-YYY if this is a replan
superseded_by: null
---

## Approach

[How the implementer will satisfy the spec. Names algorithms, files, data structures.
Describes key design decisions with rationale for each choice.]

### Design Decisions

| Decision | Choice | Alternatives Considered | Rationale |
|----------|--------|------------------------|-----------|
| D-1 | [chosen approach] | [alternatives] | [why this choice] |

## Deliverables

[Maps spec HLDs to concrete implementation. This is the HOW for each WHAT.]

| HLD | Implementation | Files/Components | Estimated Effort |
|-----|----------------|------------------|------------------|
| HLD-1 | [concrete steps] | [file paths] | [S/M/L] |

## Implementation Sequence

[Explicit ordering when it differs from HLD order. State why.]

1. [Step 1] — [reason for ordering]
2. [Step 2] — [dependency on step 1]

## Verification Plan

[Maps each AC to a concrete, runnable verification method.]

| AC | Verification Type | Method | Pass Criterion |
|----|------------------|--------|----------------|
| AC-1 | unit-test | `bun test src/foo.test.ts` | exits 0 |
| AC-2 | benchmark | `bun run bench:perf` | < 100ms p99 |
| AC-3 | manual-review | checklist item 3 in PR template | reviewer signs |

## Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| R-1 | [H/M/L] | [H/M/L] | [mitigation strategy] |

## Open Questions

[Questions that must be resolved before PLAN GATE approval. Empty = ready for gate.]

- [ ] OQ-1: [question]
```

---

### Task Template

```yaml
---
# === IDENTITY ===
id: T-XXX                          # REQUIRED. Format: T-NNN
plan: P-XXX                        # REQUIRED. Parent plan
hld: HLD-1                         # REQUIRED. Which deliverable this implements
status: NOT_STARTED                # Enum: NOT_STARTED | IN_PROGRESS | BLOCKED | DONE | FAILED | ABANDONED

# === TEMPORAL ===
created: 2026-09-29T10:30:00Z
updated: 2026-09-29T10:30:00Z
started: null                      # Set when status → IN_PROGRESS
completed: null                    # Set when status → DONE

# === OWNERSHIP ===
owner: agent:agy-impl-001          # REQUIRED. Exactly one owner
---

## Description

[What this task accomplishes. Derived from plan deliverable.]

## Acceptance

[Subset of plan verification that applies to this task.]

| AC | Verification |
|----|--------------|
| AC-1 | [method] |

## Blockers

[If BLOCKED, list blockers here.]

- [ ] Blocker 1: [description] — waiting on [dependency]

## Work Log

[Append-only log of significant events.]

| Timestamp | Event |
|-----------|-------|
| 2026-09-29T10:30:00Z | Task created |
```

---

### Approval Record Template

```yaml
---
artifact: S-XXX                    # The artifact being approved
artifact_version: 1                # Which version
gate: SPEC_GATE                    # Enum: FEATURE_GATE | SPEC_GATE | PLAN_GATE | SPIKE_GATE
decision: APPROVED                 # Enum: APPROVED | REVISION_REQUESTED | REJECTED
timestamp: 2026-09-29T10:30:00Z    # ISO 8601 with timezone
approver: jane.smith               # Identity (distinct from author)
---

## Findings Summary

| Severity | Count |
|----------|-------|
| BLOCKING | 0 |
| WARNING | 2 |
| INFO | 1 |

## Decision Rationale

[Why this decision was made. For REVISION_REQUESTED, cite specific changes needed.]

## Conditions

[For APPROVED with conditions. Empty for unconditional approval.]

- Condition 1: [must be satisfied before implementation begins]
```

---

