# Synapse Framework — Worked Examples

> **Reference for:** [definitions.md](definitions.md) Part 9
> **Examples:** SW Dev (F-042), Nav Sim (F-101), Defect Fix (S-200), Negative Examples

---

## Part 9 — Worked Examples

### Example 1: SW Dev Feature → Spec → Plan

#### Feature: F-042 — Product Registration

```yaml
---
id: F-042
version: 1
name: product-registration
status: APPROVED
work_type: feature
created: 2026-09-28T09:00:00Z
updated: 2026-09-28T14:30:00Z
status_changed: 2026-09-28T14:30:00Z
author: jane.smith
stakeholders:
  - name: dev-experience-team
    role: approver
domain: sw-dev
specs: [S-042]
supersedes: null
superseded_by: null
priority: P1
---

## Feature Description

Developers can register any git repository with Synapse and begin a managed
development pipeline. Registration is a one-command operation that validates
the repository, creates necessary configuration, and confirms readiness.

## Success Metrics

| Metric ID | Condition | Observable Outcome | Measurement | Target | Owner |
|-----------|-----------|-------------------|-------------|--------|-------|
| M-1 | Developer runs registration command | Repository appears in Synapse's managed list | `synapse list` output | Repository listed | QA |
| M-2 | Developer runs registration on invalid repo | Clear error message, no partial state | Command stderr | Error message matches pattern | QA |

## Scope

### In Scope

- IS-1: Single-command registration from repository root
- IS-2: Validation of git repository structure
- IS-3: Persistence of registration to stable storage
- IS-4: Idempotent re-registration (same result if run twice)

### Out of Scope

- OS-1: Multi-repository batch registration → deferred to F-045
- OS-2: Remote repository registration (non-local) → WONTDO: security boundary
- OS-3: Automatic pipeline start after registration → deferred to F-043
```

**Conformance check:**
- Has all required fields ✓
- Stakeholder has role=approver ✓
- At least one metric with all columns ✓
- Out-of-scope items have destinations ✓
- No implementation language in description ✓
- Metrics observable without implementation knowledge ✓

**Feature Coverage Matrix (F-042):**

| Feature Item | Type | Covered By Spec AC |
|--------------|------|-------------------|
| IS-1 | in-scope | S-042 AC-1 |
| IS-2 | in-scope | S-042 AC-2, AC-3 |
| IS-3 | in-scope | S-042 AC-4, AC-5 |
| IS-4 | in-scope | S-042 AC-6 |
| M-1 | metric | S-042 AC-1, AC-4 |
| M-2 | metric | S-042 AC-7 |

*Coverage: 100% — all in-scope items and metrics map to at least one spec AC.*

#### Spec: S-042 — Product Registration Command

```yaml
---
id: S-042
version: 1
name: product-registration-command
status: APPROVED
work_type: feature
created: 2026-09-28T15:00:00Z
updated: 2026-09-28T17:00:00Z
status_changed: 2026-09-28T17:00:00Z
author: agent:agy-planner-001
domain: sw-dev
feature: F-042
depends_on:
  - id: S-041
    type: interface
    contract: "Database schema includes products table"
supersedes: null
superseded_by: null
priority: P1
---

## Overview

The `synapse add <path>` command registers a local git repository as a managed
product. It validates the repository, creates a configuration entry, persists
to the database, and reports success or failure. After registration, the
repository appears in `synapse list` output.

## Trigger Model

**Model:** request-response

| Field | Value |
|-------|-------|
| Actor | Developer at command line |
| Trigger | `synapse add <path>` command invocation |
| Visible Outcome | Success message with product ID, or error message |
| Non-Goal | Does not start any pipeline; does not modify the repository |

## Acceptance Criteria

| AC | Traces To | Criterion |
|----|-----------|-----------|
| AC-1 | IS-1 | Given a valid git repo path, `synapse add <path>` exits 0 and prints product ID |
| AC-2 | IS-2 | Given a non-git directory, command exits non-zero with "not a git repository" error |
| AC-3 | IS-2 | Given a nonexistent path, command exits non-zero with "path not found" error |
| AC-4 | IS-3 | After successful add, `synapse list` includes the registered product |
| AC-5 | IS-3 | Product entry persists across process restart |
| AC-6 | IS-4 | Running `synapse add <path>` twice on same repo exits 0 both times, same product ID |
| AC-7 | M-2 | All error messages include the problematic path in the message |

## High-Level Deliverables

| HLD | Description | Depends On |
|-----|-------------|------------|
| HLD-1 | Path validation (exists, is directory, is git repo) | — |
| HLD-2 | Product entity creation with unique ID generation | HLD-1 |
| HLD-3 | Database persistence layer | HLD-2 |
| HLD-4 | CLI command handler with argument parsing | HLD-1, HLD-2, HLD-3 |

## Validation Contract

### MUST

| ID | Constraint | Covers ACs |
|----|------------|------------|
| MUST-1 | Exit code 0 on success, non-zero on any error | AC-1, AC-2, AC-3 |
| MUST-2 | Product ID is deterministic for same repo (content-addressed or path-based) | AC-6 |
| MUST-3 | Database write is atomic (no partial product entries) | AC-5 |

### MUST NOT

| ID | Constraint | Verification Method |
|----|------------|---------------------|
| MUSTNOT-1 | Must not modify any files in the target repository | Check git status before/after |
| MUSTNOT-2 | Must not leave partial state on error | Check DB after error path |

## Coverage Matrix

| AC | MUST/MUSTNOT | Verification |
|----|--------------|--------------|
| AC-1 | MUST-1 | test:add-valid-repo |
| AC-2 | MUST-1 | test:add-non-git |
| AC-3 | MUST-1 | test:add-nonexistent |
| AC-4 | MUST-3 | test:add-then-list |
| AC-5 | MUST-3 | test:add-restart-list |
| AC-6 | MUST-2 | test:add-idempotent |
| AC-7 | MUST-1 | test:error-messages |
```

**Conformance check:**
- AC count = 7 (≤ 10) ✓
- HLD count = 4 (≤ 7) ✓
- Every AC traces to a feature scope item ✓
- Coverage matrix complete ✓
- No algorithm names in spec ✓
- No file paths in spec ✓

#### Plan: P-042 — Product Registration Implementation

```yaml
---
id: P-042
version: 1
spec: S-042
spec_version: 1
status: APPROVED
work_type: feature
created: 2026-09-28T18:00:00Z
updated: 2026-09-28T20:00:00Z
status_changed: 2026-09-28T20:00:00Z
author: agent:agy-planner-001
feature: F-042
supersedes: null
superseded_by: null
---

## Approach

Implement the registration command using the existing CLI framework (Commander.js)
and Drizzle ORM for database access. Product IDs will be SHA-256 hashes of the
repository's absolute path, ensuring idempotency.

### Design Decisions

| Decision | Choice | Alternatives Considered | Rationale |
|----------|--------|------------------------|-----------|
| D-1 | Path-based SHA-256 for product ID | UUID, auto-increment | Ensures idempotency per AC-6 |
| D-2 | Drizzle ORM for persistence | Raw SQL, Prisma | Matches existing codebase patterns |
| D-3 | Synchronous validation before DB write | Async parallel | Simpler error handling, atomic semantics |

## Deliverables

| HLD | Implementation | Files/Components | Estimated Effort |
|-----|----------------|------------------|------------------|
| HLD-1 | Path validation module with git detection | `src/product/validate.ts` | S |
| HLD-2 | Product entity and ID generation | `src/product/entity.ts` | S |
| HLD-3 | Drizzle schema and repository | `src/db/schema/product.ts`, `src/product/repo.ts` | M |
| HLD-4 | CLI add command | `src/cli/commands/add.ts` | S |

## Implementation Sequence

1. HLD-3 (DB schema) — required before any persistence
2. HLD-1 (validation) — no dependencies, can parallel with HLD-3
3. HLD-2 (entity) — requires HLD-3 for types
4. HLD-4 (CLI) — requires all above

## Verification Plan

| AC | Verification Type | Method | Pass Criterion |
|----|------------------|--------|----------------|
| AC-1 | unit-test | `bun test src/product/validate.test.ts` | exits 0 |
| AC-2 | unit-test | `bun test src/product/validate.test.ts -- --grep "non-git"` | exits 0 |
| AC-3 | unit-test | `bun test src/product/validate.test.ts -- --grep "nonexistent"` | exits 0 |
| AC-4 | integration-test | `bun test test/integration/add-list.test.ts` | exits 0 |
| AC-5 | integration-test | `bun test test/integration/add-restart.test.ts` | exits 0 |
| AC-6 | unit-test | `bun test src/product/entity.test.ts -- --grep "idempotent"` | exits 0 |
| AC-7 | unit-test | `bun test src/cli/commands/add.test.ts -- --grep "error"` | exits 0 |

## Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| R-1 | Path resolution differs across OS | M | M | Use Node's path.resolve, test on Linux/Mac/Windows |
| R-2 | SHA-256 collision | L | H | Acceptable: collision probability negligible for this scale |

## Open Questions

[None — ready for gate]
```

**Conformance check:**
- Every AC has verification method ✓
- Open questions empty ✓
- Spec version matches existing spec ✓
- Names files and algorithms (appropriate for plan) ✓

---

### Example 2: Nav Sim Feature → Spec → Plan

#### Feature: F-101 — Large-Scale Agent Simulation

```yaml
---
id: F-101
version: 1
name: large-scale-agent-simulation
status: APPROVED
work_type: feature
created: 2026-09-28T09:00:00Z
updated: 2026-09-28T14:30:00Z
status_changed: 2026-09-28T14:30:00Z
author: dr.chen
stakeholders:
  - name: simulation-ops-team
    role: approver
domain: nav-sim
specs: [S-101, S-102]
priority: P0
---

## Feature Description

Simulation operators can run agent-based navigation simulations with up to 50,000
agents and receive results that match established reference outputs. Operators
specify agent count and scenario parameters; the system produces trajectory
outputs and summary statistics.

## Success Metrics

| Metric ID | Condition | Observable Outcome | Measurement | Target | Owner |
|-----------|-----------|-------------------|-------------|--------|-------|
| M-1 | Operator submits 50k agent scenario | Simulation completes | Process exits 0 | Completes in < 5 minutes | QA |
| M-2 | Operator compares output to reference | Outputs match within tolerance | Automated comparison script | ≤ 2% divergence | Validation Team |

## Scope

### In Scope

- IS-1: Support for 50,000 simultaneous agents
- IS-2: Trajectory output in standard format
- IS-3: Reproducible results with fixed seed
- IS-4: Performance within time budget

### Out of Scope

- OS-1: Real-time visualization → deferred to F-105
- OS-2: Distributed multi-node execution → deferred to F-110
- OS-3: GPU acceleration → WONTDO: hardware dependency outside project scope
```

**Note:** M-2 uses "2% divergence" which is measurable by the validation team using their comparison script — the stakeholder does not need to understand the internal algorithm to run this check. The measurement procedure is explicit.

**Feature Coverage Matrix (F-101):**

| Feature Item | Type | Covered By Spec AC |
|--------------|------|-------------------|
| IS-1 | in-scope | S-101 AC-1 |
| IS-2 | in-scope | S-102 AC-1, AC-2 |
| IS-3 | in-scope | S-101 AC-4 |
| IS-4 | in-scope | S-101 AC-2 |
| M-1 | metric | S-101 AC-1, AC-2 |
| M-2 | metric | S-101 AC-3 |

*Coverage: 100% — feature spans two specs (S-101 force calculation, S-102 output formatting). All items traced.*

#### Spec: S-101 — Hierarchical Force Calculation

```yaml
---
id: S-101
version: 1
name: hierarchical-force-calculation
status: APPROVED
work_type: feature
created: 2026-09-28T15:00:00Z
updated: 2026-09-28T17:00:00Z
status_changed: 2026-09-28T17:00:00Z
author: agent:agy-planner-001
domain: nav-sim
feature: F-101
depends_on: []
reference_dataset: ref/50k-uniform-t1000.h5
tolerance:
  metric: trajectory_rmse
  threshold: 0.02
  unit: normalized
---

## Overview

The simulation engine calculates inter-agent forces using a hierarchical spatial
decomposition that achieves sub-quadratic scaling. For N agents, force calculation
completes in time proportional to N log N rather than N². This enables the 50k
agent target within the time budget.

## Trigger Model

**Model:** continuous

| Field | Value |
|-------|-------|
| Timestep Event | Each simulation timestep (dt = 0.01s) |
| State Observable | Force vector for each agent |
| Termination | Timestep count reaches scenario limit |

## Acceptance Criteria

| AC | Traces To | Criterion |
|----|-----------|-----------|
| AC-1 | IS-1 | Given 50,000 agents, force calculation completes for all agents each timestep |
| AC-2 | IS-4 | Given 50,000 agents, single timestep force calculation < 100ms |
| AC-3 | M-2 | Given reference dataset, trajectory RMSE ≤ 2% over 1000 timesteps |
| AC-4 | IS-3 | Given fixed seed, two runs produce identical force sequences |

## High-Level Deliverables

| HLD | Description | Depends On |
|-----|-------------|------------|
| HLD-1 | Spatial decomposition structure (tree or grid) | — |
| HLD-2 | Force approximation with configurable accuracy parameter | HLD-1 |
| HLD-3 | Timestep integration with force application | HLD-2 |

## Validation Contract

### MUST

| ID | Constraint | Covers ACs |
|----|------------|------------|
| MUST-1 | Complete force calculation for all agents each timestep | AC-1 |
| MUST-2 | Time complexity demonstrably sub-quadratic | AC-2 |
| MUST-3 | Trajectory deviation within tolerance | AC-3 |

### MUST NOT

| ID | Constraint | Verification Method |
|----|------------|---------------------|
| MUSTNOT-1 | Must not produce NaN or Inf force values | Assert in force calculation |
| MUSTNOT-2 | Must not exceed memory budget (8GB for 50k agents) | Memory profiler |

## Coverage Matrix

| AC | MUST/MUSTNOT | Verification |
|----|--------------|--------------|
| AC-1 | MUST-1 | bench:50k-complete |
| AC-2 | MUST-2 | bench:scaling-analysis |
| AC-3 | MUST-3 | ref-compare:trajectory |
| AC-4 | MUST-1 | test:determinism |
```

**Note:** The spec does NOT name Barnes-Hut or any specific algorithm — that is a plan decision. It specifies the required properties (sub-quadratic, within tolerance) and lets the plan choose the approach.

#### Plan: P-101 — Barnes-Hut Force Calculation

```yaml
---
id: P-101
version: 1
spec: S-101
spec_version: 1
status: APPROVED
work_type: feature
created: 2026-09-28T18:00:00Z
updated: 2026-09-28T20:00:00Z
status_changed: 2026-09-28T20:00:00Z
author: agent:agy-planner-001
feature: F-101
numerical_method: Barnes-Hut octree with θ=0.5
---

## Approach

Implement Barnes-Hut algorithm with octree spatial decomposition. The algorithm
achieves O(N log N) time complexity by approximating distant agent clusters as
single mass points. The accuracy parameter θ controls the approximation threshold.

### Design Decisions

| Decision | Choice | Alternatives Considered | Rationale |
|----------|--------|------------------------|-----------|
| D-1 | Barnes-Hut octree | k-d tree, uniform grid, FMM | Best balance of implementation complexity and performance for our scale |
| D-2 | θ = 0.5 | θ = 0.3, θ = 0.7 | Standard value; validated against reference at this setting |
| D-3 | Tree rebuild each timestep | Incremental update | Simpler, and rebuild cost is small fraction of total |

## Deliverables

| HLD | Implementation | Files/Components | Estimated Effort |
|-----|----------------|------------------|------------------|
| HLD-1 | Octree with configurable depth | `src/spatial/octree.rs` | M |
| HLD-2 | Barnes-Hut traversal with θ parameter | `src/force/barnes_hut.rs` | M |
| HLD-3 | Symplectic integrator (Verlet) | `src/integrator/verlet.rs` | S |

## Verification Plan

| AC | Verification Type | Method | Pass Criterion |
|----|------------------|--------|----------------|
| AC-1 | benchmark | `cargo bench --bench full_step -- --agents 50000` | All agents have valid force vectors |
| AC-2 | benchmark | `cargo bench --bench scaling` | Slope < 1.5 on log-log plot (sub-quadratic) |
| AC-3 | reference-comparison | `cargo test --test ref_compare -- --reference ref/50k-uniform-t1000.h5` | RMSE ≤ 0.02 |
| AC-4 | unit-test | `cargo test --test determinism -- --seed 42` | Bitwise identical outputs |

## Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| R-1 | θ=0.5 exceeds tolerance for clustered scenarios | M | M | Test with clustered reference; reduce θ if needed |
| R-2 | Cache performance degradation at 50k | L | M | Profile and optimize memory layout |

## Open Questions

[None]
```

**Note:** The plan names the algorithm (Barnes-Hut), the data structure (octree), the parameter value (θ=0.5), and the integrator (Verlet). This is appropriate for the plan layer.

---

### Example 3: Non-Feature Work — Defect Fix

#### Spec: S-200 — Fix Signal Parser Crash on Empty Input

```yaml
---
id: S-200
version: 1
name: fix-signal-parser-empty-input
status: APPROVED
work_type: defect
created: 2026-09-29T08:00:00Z
updated: 2026-09-29T09:00:00Z
status_changed: 2026-09-29T09:00:00Z
author: agent:agy-triage-001
domain: sw-dev
feature: NONE
defect_ref: BUG-1234
depends_on: []
---

## Overview

The signal parser crashes with an unhandled exception when given empty input.
This should return a parse error, not crash. The defect was reported in BUG-1234.

## Trigger Model

**Model:** request-response

| Field | Value |
|-------|-------|
| Actor | Pipeline daemon |
| Trigger | Job output parsed for signal |
| Visible Outcome | Parse result (success with signal, or error with message) |
| Non-Goal | Does not validate signal semantics, only syntax |

## Acceptance Criteria

| AC | Traces To | Criterion |
|----|-----------|-----------|
| AC-1 | BUG-1234 | Given empty string input, parser returns error result (not exception) |
| AC-2 | BUG-1234 | Given whitespace-only input, parser returns error result |
| AC-3 | BUG-1234 | Error result includes descriptive message |

## High-Level Deliverables

| HLD | Description | Depends On |
|-----|-------------|------------|
| HLD-1 | Input validation guard in parser entry point | — |
| HLD-2 | Regression tests for empty/whitespace inputs | HLD-1 |

## Validation Contract

### MUST

| ID | Constraint | Covers ACs |
|----|------------|------------|
| MUST-1 | Return Result type, never throw on parse failure | AC-1, AC-2 |

### MUST NOT

| ID | Constraint | Verification Method |
|----|------------|---------------------|
| MUSTNOT-1 | Must not throw exception on any input | Fuzz test with random inputs |

## Coverage Matrix

| AC | MUST/MUSTNOT | Verification |
|----|--------------|--------------|
| AC-1 | MUST-1, MUSTNOT-1 | test:parser-empty |
| AC-2 | MUST-1, MUSTNOT-1 | test:parser-whitespace |
| AC-3 | MUST-1 | test:parser-error-message |
```

**Note:** This spec has `feature: NONE` and `work_type: defect`, with a `defect_ref` pointing to the bug tracker. It follows the same structure but skips the FEATURE GATE.

---

### Negative Examples (What NOT to Do)

#### Bad Feature (Implementation Language)

```yaml
# WRONG: Contains implementation details
name: barnes-hut-optimization  # Algorithm name in feature
---
## Feature Description
Implement Barnes-Hut algorithm with octree...  # HOW, not WHAT

## Success Metrics
| M-1 | Tree construction | O(N log N) cell count | Profile | < N log N | Dev |
# WRONG: "cell count" is implementation detail; O(N log N) is algorithm property
```

#### Bad Spec (Algorithm in Wrong Layer)

```yaml
# WRONG: Spec names algorithm
## Overview
Implement Barnes-Hut traversal with θ = 0.5...  # This belongs in plan
```

#### Bad Plan (Missing Verification)

```yaml
# WRONG: Verification table incomplete
## Verification Plan
| AC | Verification Type | Method | Pass Criterion |
| AC-1 | manual | "looks correct" | reviewer approves |
# WRONG: Not runnable, no concrete pass criterion
| AC-2 | | | |  
# WRONG: Empty row
```

#### Bad Approval (Author = Approver)

```yaml
# WRONG: Self-approval
artifact: S-042
author: jane.smith
approver: jane.smith  # VIOLATION: Author cannot approve own work
```

---

