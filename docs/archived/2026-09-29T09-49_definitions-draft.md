# Synapse Framework: Definitions & Templates

> **Status:** Draft for review
> **Scope:** Domain-agnostic — applies equally to SW Dev, Nav Sim, or any knowledge work

---

## Part 1 — Definitions

### Feature

> A **feature** is a stakeholder-observable capability that delivers value.

A feature answers: *"What new capability does this add to the world?"*

Features are written from the stakeholder's perspective, not the implementer's. They carry **success metrics** (measurable outcomes), not implementation assertions. A feature may be implemented by one spec or several, depending on scope.

**Properties:**
- Has a named stakeholder who can say "yes, this delivers value"
- Success metrics are observable without knowing implementation details
- Scope boundaries state what is NOT included
- Approved at the stakeholder level before any engineering contract is written

**Examples across domains:**
| Domain | Feature |
|--------|---------|
| SW Dev | "Developers can register any git repo with Synapse and start a pipeline run" |
| Nav Sim | "Simulation engine supports 50k agent swarms with < 2% divergence from reference" |
| Legal Doc | "Contract analyzer flags non-standard indemnification clauses automatically" |

---

### Spec (Feature Specification)

> A **spec** is an engineering contract for one **implementable unit** of a feature.

A spec answers: *"What must this unit do, and how will we verify it?"*

A spec is scoped to what a single specialist (human or agent) can implement in one focused session. It does not say HOW to build anything — that belongs in the plan. It is the **gate artifact**: nothing is implemented without an approved spec (for feature work).

**Properties:**
- One spec = one independently-deliverable unit
- Contains: what, acceptance criteria, high-level deliverables, validation contract
- Approved at the engineering level before any plan is written
- The `depends_on` field captures ordering between specs — no separate scheduling artifact needed
- Uses observable, testable language ("users can X" not "the system tries to X")

**Scope discipline:** If you need more than 10 acceptance criteria, the spec is too large — split it.

**Examples across domains:**
| Domain | Spec |
|--------|------|
| SW Dev | "S-011: `synapse add <path>` validates, registers, and persists a product to DB and repos.yaml" |
| Nav Sim | "S-101: Barnes-Hut tree construction for N agents in O(N log N) with configurable θ" |
| Legal Doc | "S-201: Indemnification clause extractor — identifies and normalizes standard vs. non-standard clauses" |

---

### Plan

> A **plan** is the implementation blueprint for one approved spec.

A plan answers: *"How will we build what the spec describes?"*

The plan is written by the implementer (or a planning agent) after the spec is approved. It contains domain-specific implementation details: algorithms, files, data structures, numerical methods, validation methodology. It is the second gate artifact: nothing is executed without an approved plan.

**Properties:**
- One plan per spec (1:1)
- Domain-specific: SWE plans name files and functions; Nav Sim plans name algorithms and data structures
- Each acceptance criterion maps to a concrete verification method
- Design decisions are documented with rationale (so reviewers can evaluate them)
- Approved at the technical level before implementation begins

---

## Part 2 — Templates

### Feature Template

```markdown
---
id: F-XXX
name: <feature-name>
status: draft | approved | done
created: YYYY-MM-DD
updated: YYYY-MM-DD
domain: <sw-dev | nav-sim | legal | ...>
stakeholders:
  - <name or role>
specs: []   # populated as specs are written: [S-XXX, S-YYY]
---

## Feature Description

One paragraph. What capability this adds. Why it matters to stakeholders.
Written from the stakeholder's perspective — no implementation language.

## Success Metrics

How stakeholders will know this feature is done. Observable, measurable.
Not implementation tests — these are business/user-level outcomes.

- Metric 1: [condition] → [observable outcome]
- Metric 2: ...

## Scope

### In Scope
Bullet list of what this feature covers.

### Out of Scope
Bullet list of what this feature explicitly does NOT include.
```

---

### Spec Template

```markdown
---
id: S-XXX
name: <spec-name>
status: draft | approved | done
created: YYYY-MM-DD
updated: YYYY-MM-DD
domain: <sw-dev | nav-sim | legal | ...>
feature: F-XXX      # parent feature
depends_on: []      # spec IDs that must be implemented first
---

## Overview

One paragraph. What this unit does. Who uses it (user, system, daemon, analyst...).
Why it exists. What changes when it is implemented.

## User / Trigger / Outcome

- **User:** who or what initiates this unit (person, system, timer, event)
- **Trigger:** what causes this unit to execute
- **Visible Outcome:** what is observable in the world after execution
- **Non-Goal:** what this unit explicitly does NOT do (prevents scope creep)

## Acceptance Criteria

Numbered list. Each criterion is a single, independently-testable assertion.
Format: given [condition] → [observable result]
Maximum 10 criteria. If you need more, split the spec.

- [ ] AC-1: ...
- [ ] AC-2: ...

## High-Level Deliverables

Numbered list of coherent sub-units. Each is a logical chunk one specialist
can build independently. These are "what gets built," not "how to build it."
Maximum 7 deliverables. Ordered by dependency.

1. HLD-1: ...
2. HLD-2: ...

## Validation Contract

### MUST
Observable behaviors the unit must exhibit. Each MUST maps to one or more ACs.
Use domain-appropriate language:
- SW Dev: "MUST: parsing a valid signal returns all fields correctly"
- Nav Sim: "MUST: tree construction produces O(N log N) cell count for N=10k"
- Legal: "MUST: non-standard indemnification clause triggers a finding"

### MUST NOT
Behaviors that are forbidden. Verifiable as absent.
- "MUST NOT: retry on absent signal"
- "MUST NOT: exceed 5% divergence from reference at timestep 1000"
```

---

### Plan Template

```markdown
---
id: P-XXX
spec: S-XXX
status: draft | approved | done
created: YYYY-MM-DD
updated: YYYY-MM-DD
author: <planner name or agent>
---

## Approach

How the implementer will satisfy the spec. Domain-specific details.
Describe the key design decisions made here — what approach was chosen and why.

Examples:
- SW Dev: key abstractions, files to create/modify, libraries
- Nav Sim: algorithm selection (Barnes-Hut vs. brute-force), data structures, numerical method
- Legal: extraction strategy (regex vs. LLM), normalization schema, edge case handling

## Deliverables

Numbered list, mirroring the spec's High-Level Deliverables, with implementation
specifics for each. This is the HOW for each WHAT in the spec.

1. HLD-1 → [concrete implementation steps]
2. HLD-2 → [concrete implementation steps]

## Implementation Order

Dependencies and recommended sequencing. Which deliverable must come first and why.

## Verification Plan

Maps each Acceptance Criterion to a concrete verification method.

| AC | Verification Method |
|----|---------------------|
| AC-1 | [test name / benchmark / comparison to reference / human review] |
| AC-2 | ... |

## Known Risks & Decisions

Design decisions made during planning. Alternatives considered. Why this approach.
Flag anything the plan reviewer should scrutinize.

- Decision 1: [choice made] — [rationale]
- Risk 1: [what could go wrong] — [mitigation]
```

---

## Part 3 — Relationship Summary

```
Feature  →  answers: WHAT does the stakeholder get?       (business gate)
  └── Spec  →  answers: WHAT must the unit do?             (engineering gate)
        └── Plan  →  answers: HOW will we build it?        (implementation gate)
              └── Implementation  →  DO it
```

**Gate flow:**
1. Feature approved by stakeholder → specs can be written
2. Spec approved at SPEC GATE → plan can be written
3. Plan approved at PLAN GATE → implementation begins

**No task layer required** for serial agentic execution.
Tasks emerge naturally if you need parallel assignment (multiple agents or human teams)
or human project tracking (Kanban). When needed, tasks are derived FROM the plan, not
between the spec and plan.

---

## Part 4 — Domain Adaptation Notes

The templates above are intentionally domain-neutral. When adapting:

| Section | SW Dev | Nav Engineering Sim |
|---------|--------|---------------------|
| User | developer, daemon, CLI user | simulation operator, analysis script |
| Trigger | CLI command, API call, file write | run command, parameter file, timestep event |
| Visible Outcome | DB state, file written, exit code | output file, convergence metric, log entry |
| Validation MUST | unit test passes | benchmark within tolerance of reference |
| Deliverables | files, functions, tests | algorithms, data structures, validation datasets |
| Plan Approach | architecture, key abstractions | numerical method, algorithm, precision tradeoff |
