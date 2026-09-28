# Phase 1 — Self-Hosting Bootstrap

**Goal:** Get Synapse to a state where it can reliably orchestrate its own
development. Layer 0 freezes the protocol formats; Layer 1 fixes the 6 critical
gaps and builds the daemon.

> **Status:** ✅ Done  
> **Updated:** 2026-09-28  
> **All paths are relative to the synapse repo root.**

---

## Layer 0 — Freeze Protocol Documents

These must be written before any agent can produce conforming output.
No implementation work begins until these are complete.

### T-L0-1: Write feature-spec-format document
type: chore
depends_on: []
**Acceptance criteria:**
  - `specs/feature-spec-format.md` exists
  - Defines the exact template for a spec: Acceptance Criteria section, High-Level Tasks section, Test Contract section (MUST / MUST NOT format)
  - Includes a complete worked example (F-001)
  - Includes a JSON schema or markdown checklist validators can use
  - Spec stubs that fail the schema are explicitly marked non-conforming
**Test contract:**
  - MUST: document is self-contained — an agent can produce a valid spec from it alone
  - MUST: every required field is named, typed, and has an example
  - MUST NOT: leave any "fill in as needed" ambiguity
**Priority:** HIGH

---

### T-L0-2: Write task-format document
type: chore
depends_on: []
**Acceptance criteria:**
  - `specs/task-format.md` exists
  - Defines all fields: `type`, `depends_on`, `feature`, `spec`, `spec_task`, `rationale`, `acceptance_criteria`, `test_contract`, `priority`
  - Includes worked examples for each work type: `feature`, `refactor`, `chore`, `bugfix`
  - Specifies which fields are required vs optional per type
  - Format is consistent with what `tasks/current/phase-1.md` itself uses (dogfood)
**Test contract:**
  - MUST: a reader can write a conforming task block from this doc alone
  - MUST NOT: require reading any other document to understand field semantics
**Priority:** HIGH

---

### T-L0-3: Write plan-format document
type: chore
depends_on: []
**Acceptance criteria:**
  - `specs/plan-format.md` exists
  - Defines plan header fields (target_repo, feature, spec ref, task ref, phase)
  - Defines Deliverables section format (numbered, each with files-to-change, spec contract ref)
  - Defines Test Contract section (maps to spec's MUST/MUST NOT)
  - Plans are ephemeral: document the archive convention (move to `plans/done/` when task done)
**Test contract:**
  - MUST: planner agent can produce a conforming plan without guessing
  - MUST NOT: allow plans that don't reference an approved spec
**Priority:** HIGH

---

### T-L0-4: Write pipeline-signal-protocol document
type: chore
depends_on: []
**Acceptance criteria:**
  - `specs/pipeline-signal-protocol.md` exists
  - Defines `PIPELINE_SIGNAL` grammar: `AUTO-FIX=N ESCALATE=M` field names and value types
  - Defines `TESTER_SIGNAL` grammar: `PASS=Y FAIL=N SKIPPED=M TYPECHECK=green|red`
  - Both signals must appear as the LAST line of their artifact (HTML comment format)
  - Specifies what happens when signal is absent (job treated as `TASK_FAILED`)
  - Specifies what happens when signal is malformed (job treated as `SCHEMA_VIOLATION`)
**Test contract:**
  - MUST: daemon can parse both signal types from a one-line regex
  - MUST NOT: allow signals buried mid-document to be valid
**Priority:** HIGH

---

### T-L0-5: Write review-format document
type: chore
depends_on: []
**Acceptance criteria:**
  - `specs/review-format.md` exists
  - Defines severity tags: `[BLOCKING]`, `[WARNING]`, `[INFO]`
  - Defines verdict line: `APPROVE`, `REQUEST_CHANGES`, or `NEEDS_DISCUSSION`
  - Defines required sections: Findings (by severity), Missing Tests, Architectural Risk, Verdict
  - Specifies that Grok is read-only: review docs contain findings only, no code edits
  - Defines review storage locations (type subdirs under `reviews/`):
    - Spec reviews → `reviews/spec/YYYY-MM-DDTHH-MM_F-XXX-iter{N}.md`
    - Plan reviews → `reviews/plan/YYYY-MM-DDTHH-MM_T-XXX-iter{N}.md`
    - Code reviews → `reviews/code/YYYY-MM-DDTHH-MM_T-XXX-iter{N}.md`
    - Triage reports → `reviews/triage/YYYY-MM-DDTHH-MM_T-XXX-iter{N}.md`
    - Feedback notes → `reviews/feedback/YYYY-MM-DDTHH-MM_{type}-{id}.md`
  - Feedback notes are mandatory reading for the next specialist before regenerating
**Test contract:**
  - MUST: a Grok review parsed by the daemon yields a clear approve/reject signal
  - MUST NOT: allow reviews without a verdict line
  - MUST NOT: allow feedback to be empty (synapse reject requires --note)
**Priority:** HIGH

---

## Layer 0 — Repo Initialization

### T-L0-6: Initialize synapse package and AGENTS.md
type: chore
depends_on: []
**Acceptance criteria:**
  - `package.json` exists with name, version, scripts (`synapse`, `test`, `typecheck`)
  - `bunfig.toml` exists
  - `AGENTS.md` (the constitution file) exists — loaded as first context by every specialist
  - `AGENTS.md` covers:
    - Anti-hang rules (non-interactive execution, timeouts)
    - Repo layout contract (which dirs pipeline writes to, that docs/ is read-only to pipeline)
    - Key commands (`bun run synapse`, `bun run test`, `bun run typecheck`)
    - Schema enforcement rule: "if agent output fails the schema, job is FAILED not close enough"
    - Review rubric (severity tags, Grok read-only constraint)
    - Deferred-items rule (deferred findings go to tasks/deferred.md, not lost in prose)
  - `.gitignore` has `.synapse/run/` entry (idempotent — check before appending)
  - `.gitignore` has `synapse.db`, `synapse.db-shm`, `synapse.db-wal` entries (idempotent)
**Test contract:**
  - MUST: `bun run synapse --help` works from the synapse repo root
  - MUST NOT: leave any TODO placeholders in AGENTS.md
  - MUST NOT: AGENTS.md omit the repo layout contract (agents must know where to write)
**Priority:** HIGH

---

## Layer 0 — Skill: Front Door

### T-L0-7: Write research-to-features skill
type: chore
depends_on: [T-L0-1, T-L0-2]
**Acceptance criteria:**
  - `skills/research-to-features/SKILL.md` exists
  - Implements the hardened extraction rules:
    - Cap: max 3–5 features per research doc; extras go to `tasks/deferred.md`
    - Every feature MUST have: user, trigger, visible outcome, non-goal
    - `--draft` flag: propose features without writing, stop for review
    - On confirm: writes registry rows (status: planned) + spec stubs using T-L0-1 template
    - Spec stubs written to `specs/F-XXX-name.md` (stable filename, no timestamp)
    - Prints ordered feature list (infra→data→API→UI) with scores, user can override
    - Spec stubs that fail the T-L0-1 schema do NOT enter the registry (fails the job)
    - NEVER auto-starts make-plans after running
    - NEVER modifies `docs/research/` — reads only
    - Prints paths + "waiting on spec-review" when done
**Test contract:**
  - MUST: a valid run produces conforming spec stubs (checkable against T-L0-1 schema)
  - MUST: --draft mode produces a report only, no file writes
  - MUST NOT: produce more than 5 features from a single research doc without explicit override
**Priority:** HIGH

---

## Layer 1 — Fix Critical Gaps (existing tasks, reformatted)

### T-1-1: Inject read-only rule into every Grok invocation
type: chore
depends_on: [T-L0-6]
**Acceptance criteria:**
  - `agent-job.sh` with CLI=grok appends the read-only constraint to every prompt
  - Grok review docs contain findings only; no file edits appear in logs
**Test contract:**
  - MUST: Grok invocation includes read-only instruction in dispatched prompt
  - MUST NOT: Grok job exit without a review finding doc written
**Priority:** HIGH

---

### T-1-2: Add `--add-dir` for Grok to read synapse task/plan dirs
type: chore
depends_on: [T-1-1]
**Acceptance criteria:**
  - `agent-job.sh` with CLI=grok passes `--add-dir <synapse_root>/`
  - Grok can read `tasks/current/` and `plans/current/` natively, not by path string in prompt
**Test contract:**
  - MUST: Grok job can read a task file from tasks/current/ without it being embedded in the prompt
  - MUST NOT: require hardcoded paths in the prompt to access task/plan files
**Priority:** HIGH

---

### T-1-3: Typecheck gate in triage before auto-fix commit
type: chore
depends_on: [T-L0-5]
**Acceptance criteria:**
  - `skills/review-triage/SKILL.md` includes explicit typecheck step after each auto-fix
  - Auto-fix commits only occur after green typecheck
  - Failed typecheck → finding re-classified as ESCALATE, not AUTO-FIX
**Test contract:**
  - MUST: triage SKILL.md contains `bun run typecheck` before commit step
  - MUST NOT: commit auto-fixes without a typecheck gate
**Priority:** HIGH

---

### T-1-4: Deferred items written to tasks/deferred/ via MCP
type: chore
depends_on: [T-L0-5]
**Acceptance criteria:**
  - `skills/review-triage/SKILL.md` instructs: deferred [WARNING] → create new file in `tasks/deferred/`
  - File naming: `tasks/deferred/YYYY-MM-DDTHH-MM_{artifact-id}_{short-description}.md`
  - Each deferred file is self-contained: includes origin (which review), context, and the deferred finding
  - `skills/review-triage/SKILL.md` explicitly references the deferred-items-tracking rule
  - Triage never appends to an existing file — always creates a new timestamped file
  - At least one deferred item from a real triage run exists in tasks/deferred/ (verified manually)
**Test contract:**
  - MUST: each deferred finding produces a discrete, timestamped file in tasks/deferred/
  - MUST: deferred files are self-contained (readable without the originating review)
  - MUST NOT: triage doc be the only record of a deferred item
  - MUST NOT: triage append to or modify any existing file in tasks/deferred/
**Priority:** MEDIUM

---

### T-1-5: Structured test contract format in make-plans
type: chore
depends_on: [T-L0-3, T-L0-4]
**Acceptance criteria:**
  - `skills/make-plans/SKILL.md` defines the test contract format and requires it per deliverable
  - Format matches T-L0-1 schema (MUST/MUST NOT in structured form)
  - At least one plan in `plans/current/` has a conforming test contract section
**Test contract:**
  - MUST: test contract format in make-plans output is parseable against T-L0-1 schema
  - MUST NOT: plans lack test contracts when spec has a MUST/MUST NOT section
**Priority:** MEDIUM

---

### T-1-6: Define TESTER_SIGNAL and separate tester step
type: chore
depends_on: [T-L0-4]
**Acceptance criteria:**
  - TESTER_SIGNAL format matches exactly what's defined in `specs/pipeline-signal-protocol.md`
  - `skills/run-tests/SKILL.md` exists and emits TESTER_SIGNAL as the last line of its output
    (create if missing; update if it exists but lacks the signal)
  - Pipeline workflow has a distinct `test-cycle` step separate from `fix-tests`
**Test contract:**
  - MUST: run-tests produces a TESTER_SIGNAL parseable by a one-line regex
  - MUST NOT: test results be embedded in the coder's artifact without a signal
**Priority:** MEDIUM

---

## Task Status

| Task | Description | Type | Status |
|------|-------------|------|--------|
| T-L0-1 | specs/feature-spec-format.md | chore | ✅ done |
| T-L0-2 | specs/task-format.md | chore | ✅ done |
| T-L0-3 | specs/plan-format.md | chore | ✅ done |
| T-L0-4 | specs/pipeline-signal-protocol.md | chore | ✅ done |
| T-L0-5 | specs/review-format.md | chore | ✅ done |
| T-L0-6 | package.json + AGENTS.md | chore | ✅ done |
| T-L0-7 | skills/research-to-features/SKILL.md | chore | ✅ done |
| T-1-1 | Grok read-only enforcement | chore | ✅ done |
| T-1-2 | Grok workspace dirs | chore | ✅ done |
| T-1-3 | Typecheck gate in triage | chore | ✅ done |
| T-1-4 | Deferred items in tasks/deferred/ | chore | ✅ done |
| T-1-5 | Test contract in make-plans | chore | ✅ done |
| T-1-6 | TESTER_SIGNAL + tester step | chore | ✅ done |

---

## Dependency graph

```
T-L0-1 ──┐
T-L0-2 ──┴── T-L0-7 (skills/research-to-features)
T-L0-3 ──┐
T-L0-4 ──┼── T-1-5 (test contract in plans)
          └── T-1-6 (TESTER_SIGNAL)
T-L0-5 ──┬── T-1-3 (typecheck gate)
          └── T-1-4 (deferred items)
T-L0-6 ──┬── T-1-1 (Grok read-only)
          └── T-1-1 ── T-1-2 (Grok workspace)

T-L0-1 through T-L0-6: no deps — all can start immediately (serial default)
T-L0-7, T-1-1 through T-1-6: wait for their deps
```
