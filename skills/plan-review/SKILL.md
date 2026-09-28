---
name: plan-review
description: >-
  Use this skill to review implementation plans in plans/current/ after they
  have been created by AGY. Checks that plans are complete, correct, and
  ready for implementation. Outputs a review doc to docs/reviews/.
---

# Plan Review

You are performing a **post-planning review** for the Fox development pipeline.
Your job is to review plans in `plans/current/` and validate them against the
tasks in `tasks/current/`, the feature registry, and the codebase.
This is a **read-only review** — do NOT edit plans, write code, or make changes.

## Your Review Checklist

For each plan in `plans/current/`:

### 1. Traceability
- Does the plan have a `target_repo` header matching a repo in `repos.yaml`?
- Does each deliverable map to a task in `tasks/current/`?
- Does each deliverable have a `@fox-feature F-xxx` tag?
- Do all feature IDs exist in `fox-code-cli/docs/feature-registry.yaml`?

### 2. File Path Correctness
- Do all referenced source files actually exist?
- Are package aliases correct (`@/*`, `@opencode-ai/core`, etc.)?
- Are new files being created in the right locations?

### 3. API Contracts
- Are function signatures consistent with existing code?
- Are new types/interfaces compatible with the existing type system?
- Does the plan avoid breaking existing exports?

### 4. Testability
- Does each deliverable have specific, runnable acceptance criteria?
- Are test file paths specified and correct?
- Can the acceptance criteria be verified with `bun test`?

### 5. Architectural Rules (from AGENTS.md)
- Does the plan respect Tool Architecture (`Tool.make(...)`, not bypassed)?
- Does it avoid `Effect.provide(Layer)` inside request handlers?
- Does it use `native-request.ts` as the only LLM adapter?
- Does it keep `effect-drizzle-sqlite` generic (no domain tables)?
- Does it follow config precedence rules?

### 6. Completeness
- Does the plan cover ALL tasks in `tasks/current/`? (or explicitly defer some)
- Are deferred items documented in `tasks/deferred.md`?
- Is the implementation order correct (dependencies respected)?

### 7. Risk & Complexity
- Are any deliverables too large for a single implementation step?
- Are there hidden dependencies not listed?
- Any potential for merge conflicts between deliverables?

## Output Format

Write your review to `docs/reviews/` with filename:
`YYYY-MM-DDTHH-MM_plan-review-phase-<phase>.md`

Use this structure:

```
# Plan Review — Phase <X>

**Date**: <ISO timestamp>
**Plans Reviewed**: <count>
**Verdict**: APPROVED / NEEDS_FIXES

---

## Findings (by severity)

### [BLOCKING] — Must fix before implementation
- <finding>

### [WARNING] — Should fix, not blocking
- <finding>

### [INFO] — Notes for the implementer
- <finding>

---

## Per-Plan Notes

### Plan: <filename>
- Target Repo: <repo>
- Tasks Covered: <list>
- Status: ✅ Approved | ⚠️ Minor issues | ❌ Blocking issues
- Notes: <specific notes>

---

## Missing Tests / Test Gaps
- <list any acceptance criteria that aren't testable>

## Architectural & Compatibility Risk
- <list any architectural concerns>

## Recommendation
APPROVE | REQUEST_CHANGES | NEEDS_DISCUSSION
```
