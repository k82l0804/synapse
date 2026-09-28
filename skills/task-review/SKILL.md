---
name: task-review
description: >-
  Use this skill to review tasks in tasks/current/ before planning begins.
  Checks that tasks are well-formed, non-overlapping, correctly ordered,
  and ready for implementation planning. Outputs a review doc to docs/reviews/.
---

# Task Review

You are performing a **pre-planning task review** for the Fox development pipeline.
Your job is to review the tasks in `tasks/current/` and flag any issues before
implementation planning begins. This is a **read-only review** — do NOT edit files,
create plans, or make any code changes.

## Your Review Checklist

For each task in `tasks/current/`:

### 1. File Path & Reference Validity
- Do referenced source files actually exist in the codebase?
- Are package paths correct (e.g. `packages/core/src/` not `packages/core/`)
- Are import aliases correct (`@/*`, `@opencode-ai/core`, etc.)?

### 2. Task Completeness
- Does each task have: a clear objective, acceptance criteria, and a feature ID?
- Are acceptance criteria falsifiable (testable, not vague)?
- Does the feature ID exist in `fox-code-cli/docs/feature-registry.yaml`?

### 3. Task Ordering & Dependencies
- Are tasks in the correct implementation order?
- Do tasks that depend on others list those dependencies?
- Would implementing them in listed order avoid merge conflicts?

### 4. Scope & Duplication
- Does any task duplicate work from `tasks/done/`?
- Is any task too large (should be split)?
- Is any task too vague (needs more specification)?

### 5. Architectural Alignment
- Do tasks respect the architectural rules in `AGENTS.md`?
- Do they follow Harness-Owns-Done principle?
- Do they target the correct repo (`target_repo` header)?

## Output Format

Write your review to `docs/reviews/` with filename:
`YYYY-MM-DDTHH-MM_task-review-phase-<phase>.md`

Use this structure:

```
# Task Review — Phase <X>

**Date**: <ISO timestamp>
**Tasks Reviewed**: <count>
**Verdict**: READY / NEEDS_FIXES

---

## Findings (by severity)

### [BLOCKING] — Must fix before planning
- <finding>

### [WARNING] — Should fix, not blocking
- <finding>

### [INFO] — Notes for the implementer
- <finding>

---

## Per-Task Notes

### Task <ID>: <name>
- Status: ✅ Ready | ⚠️ Needs work | ❌ Blocking issue
- Notes: <specific notes>

---

## Recommendation
READY TO PLAN | REQUEST_CHANGES
```

If there are zero [BLOCKING] findings, end with `READY TO PLAN`.
If there are any [BLOCKING] findings, end with `REQUEST_CHANGES`.
