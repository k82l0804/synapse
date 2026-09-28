# Phase 1 — Self-Hosting Bootstrap

**Goal:** Get Synapse to a state where it can reliably orchestrate its own
development. Fix the 6 critical gaps identified in the agent-context-matrix.

> **Status:** 🔄 Active
> **Source:** Extracted from fox/tools/jobs/ (2026-09-28)

---

## 1-1: Inject read-only rule into every Grok invocation
**Priority:** HIGH — blocking reliable reviews
**Description:** When Grok is invoked via `agent-job.sh`, it receives no
constraint preventing it from editing files. Rule #10 (read-only reviewer
rubric) must be appended to the prompt for every `CLI=grok` dispatch.
**Acceptance criteria:**
- `agent-job.sh` with CLI=grok appends the read-only constraint
- Grok review docs contain findings only, no file edits in logs

## 1-2: Add `--add-dir synapse/` for Grok
**Priority:** HIGH — Grok can't read tasks/ or plans/
**Description:** Grok is dispatched with `--cwd <target-repo>` but needs to
read `synapse/tasks/current/` and `synapse/plans/current/` for task-review
and plan-review. Currently navigates by path strings in prompt only.
**Acceptance criteria:**
- `agent-job.sh` with CLI=grok passes `--add-dir <synapse_root>/`
- Grok can read tasks/current/ and plans/current/ natively

## 1-3: Typecheck gate in review-triage before auto-fix commit
**Priority:** HIGH — broken commits silently fail downstream
**Description:** The review-triage specialist must run `bun run typecheck`
after applying any auto-fix, before committing. If typecheck fails, revert
the fix and mark the finding as ESCALATE.
**Acceptance criteria:**
- review-triage SKILL.md updated with explicit typecheck step
- Auto-fix commits only occur after green typecheck
- Failed typecheck → finding re-classified as ESCALATE, not AUTO-FIX

## 1-4: Deferred items written to tasks/deferred.md via MCP
**Priority:** MEDIUM — deferred items lost in prose today
**Description:** When triage defers a [WARNING] finding, it must append to
`tasks/deferred.md` using the fox-workflow MCP tool (or Synapse equivalent),
not just note it in the triage doc prose. The deferred-items-tracking rule
must be explicitly referenced in the review-triage skill.
**Acceptance criteria:**
- review-triage SKILL.md explicitly instructs deferred → `tasks/deferred.md`
- At least one deferred item from a real triage run appears in deferred.md

## 1-5: Structured test contract format in make-plans
**Priority:** MEDIUM — coders infer tests from prose today
**Description:** The make-plans skill produces prose acceptance criteria but
no structured test contract. Planners must write explicit test contracts in a
machine-readable format so coders implement exactly those tests.
**Format:**
```typescript
// @synapse-feature S-XXX — test contract
// MUST: test that X returns Y when given Z
// MUST: test that rejection with error E when W
// MUST NOT: test internal implementation details of V
```
**Acceptance criteria:**
- make-plans SKILL.md defines the test contract format and requires it per deliverable
- At least one plan in plans/current/ has a test contract section

## 1-6: Define TESTER_SIGNAL and extract tester as separate step
**Priority:** MEDIUM — pipeline can't distinguish test failure from code error
**Description:** Test results are currently embedded in the coder's output.
The pipeline needs a typed signal to act on pass/fail independently.
Define `TESTER_SIGNAL` format and create a specialist skill for it.
**Signal format:**
```
<!-- TESTER_SIGNAL: PASS=Y FAIL=N SKIPPED=M TYPECHECK=green|red -->
```
**Acceptance criteria:**
- TESTER_SIGNAL format documented in docs/specs/
- run-tests skill updated to emit TESTER_SIGNAL
- Pipeline workflow has a distinct `test-cycle` step separate from `fix-tests`

---

## Tasks README

```
tasks/
├── current/phase-1.md     ← you are here
├── future/phase-2.md      (MCP scoping by role, grok config, full self-hosting)
├── done/                  (empty — nothing shipped yet)
└── deferred.md            (items deferred from reviews)
```
