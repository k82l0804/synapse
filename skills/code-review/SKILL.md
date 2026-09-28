---
name: code-review
description: >-
  Use this skill to review the implementation of completed tasks against their
  plans. Reads each plan from ../plans/current/, locates the corresponding
  source files, and verifies that the implementation matches the plan's
  specification — checking for missing features, divergences, dead code,
  untested paths, and architectural violations.
---

# Code Review

Review the implementation of completed tasks against their plans. This is a systematic post-implementation audit that verifies the code matches what was specified.

## Inputs

1. **Task list**: Use `call_mcp_tool(fox-workflow, get_current_tasks, {})` to get current tasks.
2. **Plans**: Use `call_mcp_tool(fox-workflow, list_plans, {})` to list plans, then `call_mcp_tool(fox-workflow, read_plan, {name: "<plan>"})` for each.
3. **Source code**: Locate the files referenced in each plan and verify the implementation.

## Procedure

For each plan in `../plans/current/`:

### Step 1: Read the Plan

1. Read the plan file completely.
2. Extract:
   - **Deliverables**: What files/modules/functions were supposed to be created or modified.
   - **Acceptance criteria**: What conditions define "done."
   - **Constraints**: What rules the implementation must follow (e.g., "no new dependencies," "pure function," "must be idempotent").
   - **Test requirements**: What tests were specified.

### Step 2: Locate and Read the Implementation

1. For each file mentioned in the plan's deliverables, use `view_file` to read the actual implementation.
2. If a file doesn't exist, flag it as **MISSING**.
3. If extra files were created that the plan didn't mention, flag them as **UNPLANNED** (may be fine, but note them).

### Step 3: Verify Against Plan

For each deliverable, check:

#### 3a. Feature Completeness
- [ ] Every function/type/export listed in the plan exists in the implementation
- [ ] Every acceptance criterion is satisfied by the code
- [ ] No "TODO" or "FIXME" comments left for planned features
- [ ] Default values match what the plan specified

#### 3b. Constraint Compliance
- [ ] Implementation follows the architectural rules from `AGENTS.md` (tool architecture, HttpApi routes, session LLM, database, config, plugin system)
- [ ] No forbidden patterns (e.g., `Effect.provide(Layer)` inside request handlers)
- [ ] Dependencies are correct (no circular imports, no banned imports)

#### 3c. Test Coverage
- [ ] Tests mentioned in the plan exist
- [ ] Tests cover the happy path AND edge cases specified in the plan
- [ ] Test assertions match the plan's acceptance criteria
- [ ] Run tests if a test command is specified: `timeout 30s CI=true bun test <test-file>`

#### 3d. Integration Points
- [ ] The feature is wired into the system (not just defined but unused)
- [ ] Exports are consumed by the expected callers
- [ ] Config fields are read where they should be
- [ ] Any hooks into the session loop or processor are actually connected

#### 3e. Code Quality
- [ ] No dead code (functions defined but never called)
- [ ] No stale imports
- [ ] Error handling is present where the plan specified it
- [ ] Types are correct (run `timeout 45s bun run typecheck` once for all tasks)

#### 3f. Feature Registry Compliance
- [ ] New features have entries in `docs/feature-registry.yaml` with full spec (contract, invariants, acceptance_criteria)
- [ ] New features have `@fox-feature F-xxx` code tags at integration points
- [ ] Feature registry entries reference the correct test files
- [ ] No orphan `@fox-feature` tags (tags in code without registry entries)
- [ ] Run `bun run test:features` — all errors resolved

### Step 4: Run Typecheck and Tests

After reviewing all plans, push verification jobs via MCP:

```
call_mcp_tool(fox-workflow, push_jobs, {preset: "typecheck"})
call_mcp_tool(fox-workflow, push_jobs, {preset: "smoke"})
call_mcp_tool(fox-workflow, push_jobs, {preset: "features"})
```

Check results:
```
call_mcp_tool(fox-workflow, job_history, {limit: 10})
```

If any fail, include the errors in the review.

For the full test suite:
```
call_mcp_tool(fox-workflow, push_jobs, {preset: "full"})
```

## Output

Create an artifact report with the following structure:

```markdown
# Code Review: Phase [X] — [Phase Name]

## Summary
- **Tasks reviewed**: N
- **Overall status**: ✅ All clear / ⚠️ Issues found / ❌ Critical issues
- **Typecheck**: ✅ Pass / ❌ Fail (N errors)
- **Tests**: ✅ Pass / ❌ Fail (N failures)

## Task [N]: [Task Name]

**Plan**: [link to plan file]
**Status**: ✅ Complete / ⚠️ Partial / ❌ Missing

### Deliverables
| File | Status | Notes |
|---|---|---|
| `path/to/file.ts` | ✅ Implemented | Matches plan |
| `path/to/other.ts` | ⚠️ Diverged | [explanation] |

### Issues Found
1. **[severity]**: [description] — [file:line]
2. ...

### Acceptance Criteria
- [x] Criterion 1 — verified by [how]
- [ ] Criterion 2 — **NOT MET**: [explanation]

---
(repeat for each task)
```

## Severity Levels

- **🔴 Critical**: Feature missing, test missing, or implementation contradicts the plan
- **🟡 Warning**: Minor divergence, missing edge case, or dead code
- **🟢 Note**: Observation, style suggestion, or improvement opportunity

## Rules

- Do NOT fix issues during review — only report them
- Do NOT modify any source files
- Be specific: include file paths, line numbers, and code snippets
- Compare against the plan, not against your own expectations
- If the implementation is better than the plan, note it as a positive divergence
