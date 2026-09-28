# Phase 2 — Synapse Core Engine

**Goal:** Build the working Synapse pipeline — product registration, daemon state machine,
signal parser, human gate (inbox/approve/reject), and artifact index. After Phase 2,
`synapse add ./` + `synapse start synapse` runs the pipeline end-to-end.

> **Status:** ⬜ Not started  
> **Updated:** 2026-09-28  
> **All paths are relative to the synapse repo root.**

---

## Execution Order

```
T-2-1 (signal-parser) ──┐
T-2-2 (registration)  ──┴── T-2-3 (daemon) ──┬── T-2-4 (gate)
                                               └── T-2-5 (artifact-index)
```

T-2-1 and T-2-2 can be implemented in any order (no dependency between them).
T-2-3 requires both. T-2-4 and T-2-5 require T-2-3.

---

## Tasks

### T-2-1: Signal parser + DB schema
type: feature
depends_on: []
feature: S-013
spec: specs/S-013-signal-parser.md
spec_task: HLT-1 through HLT-6
rationale: |
  Foundation for all pipeline state transitions. No daemon can advance
  without parsing signals. Also establishes synapse.db schema.
**Acceptance criteria:**
  - AC-1: Valid PIPELINE_SIGNAL on last line → parsed, stored in DB
  - AC-2: Valid TESTER_SIGNAL on last line → parsed, stored in DB
  - AC-3: Absent signal → run status TASK_FAILED, reason SIGNAL_ABSENT
  - AC-4: Malformed signal → TASK_FAILED, reason SCHEMA_VIOLATION: {line}
  - AC-5: Mid-document signal (not last line) → treated as absent
  - AC-6: All fields correctly extracted for both signal types
**Test contract:**
  - MUST: parsers match regex from specs/pipeline-signal-protocol.md exactly
  - MUST: readLastLine uses file seek (not full read)
  - MUST NOT: accept wrong field order
  - MUST NOT: retry or auto-fix a missing signal
**Priority:** HIGH

---

### T-2-2: Product registration
type: feature
depends_on: []
feature: S-011
spec: specs/S-011-product-registration.md
spec_task: HLT-1 through HLT-6
**Acceptance criteria:**
  - AC-1: `synapse add <path>` exits 0 and prints product name
  - AC-2: Product in `synapse products` with status: idle after add
  - AC-3: repos.yaml updated with new entry
  - AC-4: All 15 required pipeline dirs created (idempotent)
  - AC-5: Re-adding same path is idempotent (exits 0, warning)
  - AC-6: Invalid path exits non-zero with clear error
**Test contract:**
  - MUST: exit 0 and print name for valid repo
  - MUST: all dirs created even if absent
  - MUST NOT: start any subprocess or pipeline step
  - MUST NOT: require AGENTS.md to exist
**Priority:** HIGH

---

### T-2-3: Daemon engine
type: feature
depends_on: [T-2-1, T-2-2]
feature: S-012
spec: specs/S-012-daemon-engine.md
spec_task: HLT-1 through HLT-7
**Acceptance criteria:**
  - AC-1: `synapse start <product>` creates run and begins step 1
  - AC-2: Each step spawns one specialist subprocess
  - AC-3: Daemon reads signal from output artifact after each step
  - AC-4: Absent/malformed signal → TASK_FAILED, pipeline halts
  - AC-5: `synapse status` reflects current step and status
  - AC-6: Daemon restart sets running→stopped (no auto-resume)
  - AC-7: `synapse stop` halts after current step completes
**Test contract:**
  - MUST: start creates pipeline_runs row with status: running
  - MUST: absent signal causes TASK_FAILED
  - MUST: stop halts after step (not mid-step)
  - MUST NOT: run steps in parallel
  - MUST NOT: delete specialist artifacts
**Priority:** HIGH

---

### T-2-4: Human gate
type: feature
depends_on: [T-2-3]
feature: S-014
spec: specs/S-014-human-gate.md
spec_task: HLT-1 through HLT-6
**Acceptance criteria:**
  - AC-1: `synapse inbox` lists all GATE_WAITING items with run-id and artifact path
  - AC-2: `synapse approve <run-id>` advances pipeline, deletes WAITING file
  - AC-3: `synapse reject <run-id> --note "..."` writes feedback file, triggers regeneration
  - AC-4: `synapse reject` without --note exits non-zero
  - AC-5: `synapse inbox --count` prints integer only
  - AC-6: Unknown/already-approved run-id exits non-zero
**Test contract:**
  - MUST: approve deletes WAITING file
  - MUST: reject writes feedback file with note text
  - MUST: empty note exits non-zero
  - MUST NOT: allow empty --note
  - MUST NOT: auto-approve any gate
  - MUST NOT: reject delete WAITING file (gate stays open until regenerated)
**Priority:** HIGH

---

### T-2-5: Artifact index
type: feature
depends_on: [T-2-3]
feature: S-015
spec: specs/S-015-artifact-index.md
spec_task: HLT-1 through HLT-6
**Acceptance criteria:**
  - AC-1: On startup, all pipeline artifacts indexed in synapse.db
  - AC-2: `synapse artifacts <product>` returns list with type, path, status, date
  - AC-3: `synapse artifacts --type spec` returns only specs
  - AC-4: New artifact appears in index without daemon restart
  - AC-5: DB/file mismatch → halt with mismatch report
  - AC-6: File removed from disk → removed from index on next startup scan
**Test contract:**
  - MUST: mismatch halts daemon with clear report
  - MUST: --type filter works
  - MUST NOT: silently resolve any mismatch
  - MUST NOT: index files outside pipeline dirs
  - MUST NOT: write to any file during scan
**Priority:** MEDIUM

---

## Task Status

| Task | Description | Type | Status |
|------|-------------|------|--------|
| T-2-1 | Signal parser + DB schema | feature | ⬜ todo |
| T-2-2 | Product registration | feature | ⬜ todo |
| T-2-3 | Daemon engine | feature | ⬜ todo (depends: 2-1, 2-2) |
| T-2-4 | Human gate | feature | ⬜ todo (depends: 2-3) |
| T-2-5 | Artifact index | feature | ⬜ todo (depends: 2-3) |

---

## Dependency Graph

```
T-2-1 ──┐
         ├── T-2-3 ──┬── T-2-4
T-2-2 ──┘            └── T-2-5
```
