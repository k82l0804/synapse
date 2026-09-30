# Synapse Agent Contract

> **Status:** Working draft (v1)
> **Date:** 2026-09-30
> **Audience:** AI agents operating inside the Synapse pipeline. This document tells you *what to do*. Read the [Specification](specification.md) for *what things are* (schemas, state machines, invariants). Read the [Handbook](handbook.md) for *why the process works this way*.

---

## 1. Your Role in the Pipeline

You are one of seven roles in a pipeline that processes software changes. The pipeline runs on the developer's machine. The developer is the human at the gates. You produce artifacts, review artifacts, or implement code — depending on which role you've been assigned.

**You do NOT:**
- Approve artifacts (only the human does)
- Decide when to stop iterating (the triage rubric decides, or the human decides)
- Skip gates (auto-advance is illegal at Change approval, Spec approval, and Acceptance)
- Edit files during a review (reviewers are read-only)

**You DO:**
- Produce artifacts that conform to the [Specification](specification.md)
- Review artifacts against the conformance schema and produce findings documents
- Fix artifacts when triage routes findings back to you
- Implement code behind frozen specs
- Emit signals so the pipeline daemon knows your result

---

## 2. Artifact Creation Procedures

### Create Change

```
1. Create future/C-NNN/change.md
2. Set kind: feature | fix | refactor | chore | spike
3. Set ticket: {external tracker ID} (if applicable)
4. Set status: draft
5. Write: Intent (one sentence), Non-Goals, Done-When (executable tests), Blast Radius
6. Write kind-specific fields (see Pipeline Architecture — Kind System)
7. Add sources: documents, URLs, conversations that informed the change
8. Submit for Review Cycle (RC)
```

### Create Spec

```
1. Assign S-NNN (monotonic within this change folder, never reused)
2. Set status = DRAFT
3. Populate: id, version, name, author
5. Write: Overview, Trigger Model, Acceptance Criteria (≤ 10)
6. Write: High-Level Deliverables (≤ 7), Validation Contract (MUSTs/MUST NOTs)
7. Write: Coverage Matrix (every AC → MUST → verification method)
8. Set depends_on (other specs this depends on, with type)
9. Validate: every AC traces to a change in-scope item or done-when criterion
10. Submit for RC → Spec approval (human approves)
```

### Create Plan

```
1. Assign P-NNN (monotonic, never reused)
2. Set status = DRAFT
3. Set spec = S-NNN, spec_version = N (must match approved version)
4. Populate: id, author
5. Write: Approach, Design Decisions, Deliverables (per HLD)
6. Write: Implementation Sequence, Verification Plan (every AC has a method)
7. Write: Risks & Mitigations, Open Questions
8. Validate: Open Questions must be EMPTY before submitting for gate
9. Submit for RC → PLAN_APPROVAL
```

### Create Task

```
1. Assign T-NNN (monotonic per plan, never reused)
2. Set status = NOT_STARTED (NOT DRAFT — tasks are not gated)
3. Set plan = P-NNN, hld = HLD-N
4. Set owner = agent:{id} or human:{id}
5. Write: Description, Acceptance subset (which ACs this task covers)
6. Set depends_on (other tasks in same plan only)
```

### Create Approval Record

```
1. Assign AR-NNN (monotonic, never reused)
2. Set artifact = {artifact ID}, artifact_version = {version at time of decision}
3. Set gate = CHANGE_APPROVAL | SPEC_APPROVAL | PLAN_APPROVAL | ACCEPTANCE
4. Set decision = APPROVED | REVISION_REQUESTED | REJECTED
5. Set timestamp, approver (approver ≠ artifact author)
6. Write: Findings Summary (severity counts), Decision Rationale, Conditions
```

---

## 3. Review Protocol

When assigned as a reviewer, you produce a findings document. You do not modify the artifact.

### Procedure

```
REVIEW artifact:
  1. Read the artifact and its parent (change.md for specs, spec for plans)
  2. Check against conformance schema (Specification §5)
  3. Classify each issue:
     BLOCKING  — violates a MUST, missing required field, contradicts parent layer
     WARNING   — ambiguous wording, missing edge case, suboptimal structure
     INFO      — style suggestion, future consideration
  4. Output findings document with:
     - Severity per finding (BLOCKING | WARNING | INFO)
     - Specific line/field reference
     - Suggested fix (for BLOCKING findings)
     - Verdict: PASS | FAIL | NEEDS_REVISION
  5. DO NOT set status
  6. DO NOT approve
  7. DO NOT modify the artifact
  8. Return findings to triage
```

### Findings Document Format

```markdown
# {Type} Review — {artifact ID} (Iteration {N})

**Reviewer:** {agent identity}
**Date:** {ISO 8601}
**Artifact:** {path to artifact}
**Parent:** {path to parent artifact}

## Findings

| # | Severity | Field/Line | Finding | Suggested Fix |
|---|----------|-----------|---------|---------------|
| 1 | BLOCKING | AC-3 | Missing verification method | Add test command |
| 2 | WARNING  | HLD-2 | Ambiguous deliverable | Clarify scope |
| 3 | INFO     | Overview | Passive voice | Rewrite active |

## Summary

- BLOCKING: {count}
- WARNING: {count}
- INFO: {count}

## Verdict

{PASS | FAIL | NEEDS_REVISION}

<!-- PIPELINE_SIGNAL: REVIEW_VERDICT={PASS|FAIL|NEEDS_REVISION} -->
```

### Reviewer Constraints

- **Reviewers never see the generation transcript.** You receive the artifact + its parent only.
- **Reviewers must be a different vendor from the author.** If the author is Claude, you cannot be Claude.
- **Read-only.** You produce a document. You do not edit files.

---

## 4. Triage Protocol

When assigned as triage, you receive an artifact, two review reports, and a rubric. You decide what happens next.

### Procedure

```
TRIAGE:
  1. Read the artifact
  2. Read both review reports
  3. For each finding, assign a disposition:
     AUTO-FIX    — clear fix, can be applied mechanically
     ESCALATE    — requires human judgment or architectural decision
     DEFER       — valid but not blocking; record for future
     ACKNOWLEDGE — noted, no action needed (INFO items)
  4. Count AUTO-FIX and ESCALATE items
  5. Apply decision rules (below)
  6. Write triage document with dispositions
  7. End document with PIPELINE_SIGNAL
```

### Decision Rules

```
IF escalate_count > 0:
  → Route to human. Pipeline pauses.

IF auto_fix_count == 0 AND escalate_count == 0:
  → PASS. Artifact advances.

IF auto_fix_count > 0 AND escalate_count == 0:
  → SEND_BACK. Author fixes AUTO-FIX items. Review cycle repeats.

IF iteration >= 3 AND auto_fix_count > 0:
  → HALT. Max iterations reached. Escalate to human.
```

### Auto-Fix Rules

When triage sends back for fixes:
- The **Fixer** (same vendor family as Author) applies fixes
- Fixer runs: fix → typecheck → commit if green
- If typecheck fails, fix the typecheck failure too
- After fixing, the Review Cycle repeats from the top

### Triage Constraints

- **Triage must NOT be the Author's vendor family.** Fresh context, rubric only.
- **Triage cannot edit files.** If fixes are needed, a separate Author/Fixer run applies them.
- **Triage does not see the generation transcript.** It receives artifact + reviews + rubric.

### Pipeline Signal

Every triage document must end with:

```
<!-- PIPELINE_SIGNAL: AUTO-FIX={N} ESCALATE={M} -->
```

Where N = count of AUTO-FIX items and M = count of ESCALATE items. The daemon parses this to decide the next step. If the signal is missing or malformed, the daemon assumes `AUTO-FIX=1 ESCALATE=0` (fail-safe: keep looping).

---

## 5. Implementation Protocol

When assigned as implementer, you write code behind a frozen spec.

### Procedure

```
IMPLEMENT task:
  1. Read the plan (P-NNN) and spec (S-NNN)
  2. Read the specific HLD assigned to this task
  3. Implement the deliverable
  4. Add @spec marker: // @spec S-NNN — {brief description}
  5. Write or update tests that verify the relevant ACs
  6. Run verification: the test command from the plan's Verification Plan
  7. If tests pass: commit with message referencing task and spec
  8. If tests fail: fix and re-run (up to 3 attempts)
  9. If still failing after 3 attempts: report failure, do not commit broken code
```

### Code Marker Format

```
// @spec S-NNN — {brief description}
```

- Place above the function/class/block that satisfies the spec
- One marker per spec per implementation site
- Module-level for primary implementation file
- Function-level for isolated AC implementations
- Not needed in test files (tests reference specs via test names)

### Implementer Constraints

- **Do not invent scope.** If the spec doesn't mention it, don't build it. No "while I'm here" additions.
- **Do not contradict the spec.** If you think the spec is wrong, report it — don't silently deviate.
- **Spec is frozen.** You implement what the spec says. Design decisions are in the plan. If the plan doesn't address something, use your judgment but document it in a commit message.

---

## 6. Validation Rules (Reject Conditions)

These are mechanical checks. Apply them before submitting any artifact.

```
REJECT change.md IF:
  kind is missing
  done-when is missing or contains only prose (no executable test)

REJECT spec IF:
  ac_count > 10
  hld_count > 7
  missing: id | version | name | feature | status | author
  missing: acceptance_criteria | coverage_matrix
  any AC without verification trace to change
  depends_on contains cycle
  feature field is empty AND work_type not in [fix, refactor, chore, spike]

REJECT plan IF:
  missing: id | spec | spec_version | author
  open_questions is not empty
  any AC from spec without verification method
  spec_version != approved spec version
  implementation_sequence violates dependency edge

REJECT any artifact IF:
  id format invalid (S-NNN | P-NNN | T-NNN | AR-NNN)
  timestamps missing timezone
  author == approver (for gated artifacts)
```

---

## 7. Status Transition Rules

```
IF artifact.status == DRAFT
  AND all_required_fields_present
  AND conformance_check_passes
  AND human_approves (at gate)
THEN → APPROVED

IF artifact.status == APPROVED
  AND work_begins
THEN → IN_PROGRESS

IF artifact.status == IN_PROGRESS
  AND all_ACs_verified
THEN → DONE

IF artifact.status == IN_PROGRESS
  AND verification_fails
THEN → FAILED

IF artifact.status == FAILED
  AND rework_path_identified
THEN → DRAFT (for gated artifacts) or NOT_STARTED (for tasks)

IF external_blocker_identified
THEN → BLOCKED

IF blocker_resolved
  AND artifact.status == BLOCKED
THEN → IN_PROGRESS

IF intentional_cancellation
THEN → ABANDONED

IF artifact.status == DONE
  AND newer_version_created
THEN → SUPERSEDED
```

---

## 8. Sizing Check

```
WHEN writing or reviewing a spec:
  ASK: Can this be implemented atomically — no intermediate checkpoints?
  IF requires_intermediate_saves THEN spec is too large → Split Protocol

WHEN writing or reviewing a plan:
  ASK: Does the implementation require mandatory wait points between HLDs?
  IF yes THEN spec is not atomic → report in Open Questions → blocks PLAN_APPROVAL

WHEN decomposing plan into tasks:
  ASK: Can one agent complete this task without context overflow?
  IF single HLD becomes > 3 tasks THEN HLD is too coarse → revise plan
```

Note: "session" is not a sizing criterion. Context overflow is.

---

## 9. Traceability Audit

Run this audit to verify the traceability chain is intact.

```
FOR each change in done/:
  1. Read change.md — extract in-scope items and done-when tests
  2. List all specs in specs/
  3. For each spec:
     a. Check every AC traces to a change in-scope item or done-when
     b. Check @spec S-NNN exists in the codebase (grep -rn "@spec S-NNN" ./src/)
     c. Check all ACs have passing verification
  4. Run done-when tests from change.md
  5. Result: PASS if all checks green, FAIL with specific gaps listed
```

### Stale Marker Detection

```
FOR each @spec marker in codebase:
  1. Extract the S-NNN reference
  2. Check if S-NNN exists in specs/
  3. If S-NNN does not exist → STALE (code references deleted spec)
  4. If S-NNN status == SUPERSEDED → check superseded_by and verify new marker exists
  5. Report all stale markers
```

---

## 10. File Paths Quick Reference

| Artifact | Location within change folder | Naming |
|----------|------------------------------|--------|
| Change | `change.md` | Always `change.md` |
| Specs | `specs/S-NNN-kebab-name.md` | Stable after creation |
| Plans | `plans/P-NNN.md` | Stable after creation |
| Tasks | `tasks.md` | Consolidated checklist |
| Reviews | `reviews/{type}-review.md` | Append iteration number |
| Logs | `logs/` | Timestamped, append-only |
| Agent scratch | `.work/` | Gitignored |
| Approval records | `reviews/AR-NNN.md` | Immutable after creation |

---

## 11. Pipeline Signal Reference

Signals are how you communicate results to the daemon. Every agent job that the daemon invokes must end with a parseable signal.

### Review Signal

```
<!-- PIPELINE_SIGNAL: REVIEW_VERDICT={PASS|FAIL|NEEDS_REVISION} -->
```

### Triage Signal

```
<!-- PIPELINE_SIGNAL: AUTO-FIX={N} ESCALATE={M} -->
```

### Implementation Signal

```
<!-- PIPELINE_SIGNAL: STATUS={DONE|FAILED} TESTS_PASSED={true|false} -->
```

### Signal Rules

- Signal must be the **last line** of the output document
- Nothing after the signal (no trailing whitespace, no blank lines)
- If the signal is missing or malformed, the daemon assumes failure (fail-safe)
- The daemon parses signals with: `/<\!--\s*PIPELINE_SIGNAL:\s*(.+?)\s*-->/`
