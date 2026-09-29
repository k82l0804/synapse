# Task Format

> **Status:** Frozen — Layer 0 protocol document. Do not modify without a phase task.  
> **Purpose:** Every task block in `tasks/current/phase-N.md` MUST conform to this format.  
> A reader can write a conforming task block from this document alone.

---

## 1. What a Task Is

A task is a discrete unit of work that maps directly to a High-Level Task (HLT)
in an approved feature spec, or is a standalone chore/bugfix/refactor.

```
Spec.HLT-N  →  Task block in tasks/current/phase-N.md
                  └── Plan in plans/current/  (one plan per task)
                        └── Code + Tests
```

**Key rules:**
- One task → one plan. Tasks and plans are 1:1.
- `feature` tasks MUST reference an approved spec. No spec = no task.
- `chore`, `bugfix`, `refactor` tasks MAY omit `spec` and `feature` fields.
- Tasks do NOT contain implementation details — those belong in the plan.

---

## 2. Task Block Format

Each task in a phase file uses this exact structure:

```markdown
### {TASK-ID}: {Short title}
type: feature | chore | bugfix | refactor
depends_on: [] | [TASK-ID, ...]
feature: S-XXX                     # omit for chore/bugfix/refactor
spec: specs/S-XXX-name.md          # omit for chore/bugfix/refactor
spec_task: HLT-1 through HLT-N    # range of HLTs this task covers
rationale: |                       # REQUIRED for refactor; optional for others
  One sentence: why this task exists.
**Acceptance criteria:**
  - AC-1: (verifiable condition)
  - AC-2: ...
**Test contract:**
  - MUST: (testable assertion)
  - MUST NOT: (testable negative)
**Priority:** HIGH | MEDIUM | LOW
```

---

## 3. Fields Reference

### Required Fields (all task types)

| Field | Type | Description |
|-------|------|-------------|
| `TASK-ID` | string | Unique ID in the phase. Format: `T-{phase}-{seq}` or `T-L{layer}-{seq}` |
| `title` | string | Short imperative verb phrase: "Add dark mode toggle" |
| `type` | enum | One of: `feature`, `chore`, `bugfix`, `refactor` |
| `depends_on` | list | IDs of tasks that must complete first. Empty list `[]` if none. |
| `Acceptance criteria` | list | At least 1 verifiable condition |
| `Test contract` | block | At least 1 MUST; at least 1 MUST NOT |
| `Priority` | enum | `HIGH`, `MEDIUM`, or `LOW` |

### Conditional Fields

| Field | Required when | Description |
|-------|--------------|-------------|
| `feature` | `type: feature` | Feature ID from registry: `S-XXX` (prefix matches repo `id_prefix`) |
| `spec` | `type: feature` | Path to spec: `specs/S-XXX-name.md` |
| `spec_task` | `type: feature` | HLT range this task covers: `HLT-1 through HLT-N` (single feature, all HLTs) |
| `rationale` | `type: refactor` | Why this refactor is needed (mandatory for traceability) |

### Optional Fields

| Field | Description |
|-------|-------------|
| `rationale` | For non-refactor types: context that doesn't fit in the title |

---

## 4. Work Type Rules

### `type: feature`

Maps to one **feature** in an approved spec, covering all that feature's HLTs.
The spec MUST be `approved` before the task can enter `tasks/current/`.
Planner creates one plan per feature task (covering all HLTs).

```markdown
### T-2-3: Implement daemon engine (S-012)
type: feature
depends_on: [T-2-1, T-2-2]
feature: S-012
spec: specs/S-012-daemon-engine.md
spec_task: HLT-1 through HLT-7
**Acceptance criteria:**
  - AC-1: `synapse start` begins the pipeline step sequence
  - AC-2: Daemon survives restart; resumes from last committed state
  - AC-3: `synapse status` shows current step and run status
**Test contract:**
  - MUST: daemon writes run state to DB before spawning each step
  - MUST: `synapse stop` halts after the current step completes
  - MUST NOT: lose a committed run record on restart
**Priority:** HIGH
```

### `type: chore`

Setup, tooling, configuration, documentation. No feature ID or spec required.
Acceptance criteria describes the artifact that must exist or the state that must be true.

```markdown
### T-L0-1: Write feature-spec-format document
type: chore
depends_on: []
**Acceptance criteria:**
  - `specs/feature-spec-format.md` exists and is self-contained
  - Every required field is named, typed, and has a worked example
**Test contract:**
  - MUST: an agent can produce a conforming spec from this document alone
  - MUST NOT: leave any [TODO] placeholders in the document
**Priority:** HIGH
```

### `type: bugfix`

Fixes a specific defect. Should reference the symptom (what breaks) in the title
and the root cause (if known) in the rationale.

```markdown
### T-2-4: Fix session token not refreshed on 401
type: bugfix
depends_on: []
rationale: |
  Auth middleware returns 401 but does not attempt token refresh,
  causing permanent logout on token expiry.
**Acceptance criteria:**
  - AC-1: 401 response triggers token refresh and request retry
  - AC-2: After successful refresh, original request completes
**Test contract:**
  - MUST: a simulated 401 triggers exactly one refresh attempt
  - MUST NOT: refresh loop on repeated 401 (max 1 retry per request)
**Priority:** HIGH
```

### `type: refactor`

Structural code change with no user-visible behavior change. MUST have a rationale
doc in `docs/refactor/` OR an inline rationale field. Tests must prove behavior is preserved.

```markdown
### T-3-1: Extract auth middleware to standalone module
type: refactor
depends_on: []
rationale: |
  Auth logic is duplicated in 3 route handlers. Extracting to
  middleware reduces duplication and makes token refresh testable.
  Rationale doc: docs/refactor/2026-09-28T10-00_auth-middleware-extract.md
**Acceptance criteria:**
  - AC-1: Auth logic lives in src/middleware/auth.ts only
  - AC-2: All 3 route handlers use the new middleware
  - AC-3: All existing auth tests pass without modification
**Test contract:**
  - MUST: all pre-refactor passing tests still pass after refactor
  - MUST NOT: change any observable API behavior (same request/response)
**Priority:** MEDIUM
```

---

## 5. Task Status Values

Used in the status table at the bottom of each phase file:

| Symbol | Status | Meaning |
|--------|--------|---------|
| ⬜ | `todo` | Not started |
| 🔄 | `in-progress` | Agent currently working |
| ✅ | `done` | Complete, tests green |
| ❌ | `failed` | Agent failed, needs attention |
| ⏸️ | `blocked` | Waiting on a dependency |

---

## 6. Phase File Structure

A phase file (`tasks/current/phase-N.md`) contains:

```markdown
# Phase N — {Phase Title}

**Goal:** One sentence describing what this phase accomplishes.

> **Status:** 🔄 Active | ⬜ Not started | ✅ Done
> **Updated:** YYYY-MM-DD
> **All paths are relative to the repo root.**

---

## {Layer or Group Name}

### {TASK-ID}: {Title}
... (task blocks) ...

---

## Task Status

| Task | Description | Type | Status |
|------|-------------|------|--------|
| T-N-1 | ... | feature | ⬜ todo |

---

## Dependency graph

\`\`\`
T-N-1 ──┐
T-N-2 ──┴── T-N-3
\`\`\`
```

---

## 7. Schema Checklist (for validators and review agents)

A task block is **non-conforming** if ANY of:

| Check | Rule |
|-------|------|
| ❌ Missing TASK-ID | Must be present in the heading |
| ❌ Missing type | Must be one of: feature, chore, bugfix, refactor |
| ❌ Missing depends_on | Must be present (can be empty list `[]`) |
| ❌ feature task missing spec | type=feature MUST have spec field |
| ❌ feature task missing feature | type=feature MUST have feature field |
| ❌ refactor missing rationale | type=refactor MUST have rationale |
| ❌ Missing acceptance criteria | At least 1 required |
| ❌ Missing test contract | Block with MUST and MUST NOT required |
| ❌ Missing MUST | At least 1 MUST entry required |
| ❌ Missing MUST NOT | At least 1 MUST NOT entry required |
| ❌ Missing Priority | Must be HIGH, MEDIUM, or LOW |
| ❌ [TODO] present | Any field contains "[TODO]" literal |

**Dogfood check:** This format is what `tasks/current/phase-1.md` uses.
If phase-1.md doesn't conform to this doc, this doc is wrong — fix the doc.
