---
name: implement-plan
description: >-
  Use this skill to systematically implement a plan from ../plans/current/.
  Reads the plan, implements each deliverable in order, adds @fox-feature code tags,
  writes tests matching acceptance criteria, updates the feature registry, runs
  verification, and marks the plan as complete.
---

# Implement Plan

Systematically execute an implementation plan from `../plans/current/`. This skill
bridges the gap between "plan exists" and "code review ready" with a repeatable,
verifiable process.

## When to Activate

- When the user says "implement this plan" or "build task N"
- When implementing all plans in a phase: "implement the current plans"
- After `make-plans` has created plans and the user is ready to build

## Inputs

1. **Plan file**: Specific plan from `../plans/current/` (or all plans in order).
2. **Repo registry**: Read `../repos.yaml` to resolve the plan's `target_repo`.
3. **Feature registry**: Read the target repo's `feature_registry` path (from `repos.yaml`) for feature IDs and specs.
4. **Execution order**: From `../plans/current/README.md` or the plan's dependency section.

---

## Procedure

### Step 0: Pre-Implementation Check

1. Read the plan file completely. Understand all deliverables, constraints, and dependencies.
2. Verify dependencies are met (if plan depends on Task M, confirm M is complete).
3. Verify tests pass before starting — push to scheduler:
   ```
   call_mcp_tool(fox-workflow, push_jobs, {preset: "smoke"})
   ```
4. Create a mental checklist of all deliverables.

### Step 1: Implement Each Deliverable

For each deliverable listed in the plan's "Proposed Changes" section:

1. **Read the target file** (if modifying existing code).
2. **Implement the change** following the plan's API contracts exactly.
3. **Add `@fox-feature` tag** at the integration point:
   ```typescript
   // @fox-feature F-2H-4: Feature Name — specific action description
   ```
4. **Check against plan constraints** — verify no forbidden patterns, correct dependencies, etc.

**Order matters**: Implement in the order specified by the plan. Foundation changes first, then integration, then polish.

### Step 2: Write Tests

For each acceptance criterion in the plan (and in the feature spec):

1. **Create or extend a test file** — name it descriptively (e.g., `test/my-feature.test.ts`).
2. **Map criteria to tests**:
   ```typescript
   describe("F-2H-4: Feature Name", () => {
     test("acceptance criterion 1 text", () => { ... })
     test("acceptance criterion 2 text", () => { ... })
     test("invariant: property that must always hold", () => { ... })
   })
   ```
3. **Run the tests**: `timeout 30s bun test test/my-feature.test.ts`
4. **Fix until green** — if tests fail, fix the implementation (not the tests, unless the plan was wrong).

### Step 3: Update Feature Registry

For each new or modified feature, use the MCP tools:

1. **Register new features** via MCP:
   ```
   call_mcp_tool(fox-workflow, register_feature, {
     id: "F-2H-4", name: "Feature Name", phase: "2H",
     status: "implemented", description: "...",
     code_locations: ["src/session/foo.ts:42"],
     tests: ["test/foo.test.ts"]
   })
   ```

2. **Check existing features** before modifying:
   ```
   call_mcp_tool(fox-workflow, get_feature, {id: "F-2H-4"})
   ```

3. **Update modified features**:
   ```
   call_mcp_tool(fox-workflow, update_feature_status, {id: "F-2H-4", status: "implemented"})
   ```

### Step 4: Incremental Verification

After implementing each deliverable (not just at the end), use MCP tools to push checks:

1. **Tier 1** — Run the specific test: `bun test test/<file>.test.ts`
2. **Typecheck** — Push to scheduler:
   ```
   call_mcp_tool(fox-workflow, push_jobs, {preset: "typecheck"})
   ```

After all deliverables are implemented:

3. **Tier 3** — `call_mcp_tool(fox-workflow, push_jobs, {preset: "smoke"})`
4. **Feature validator** — `call_mcp_tool(fox-workflow, push_jobs, {preset: "features"})`
5. **Tier 5** — `call_mcp_tool(fox-workflow, push_jobs, {preset: "full"})`

Check results between waves:
```
call_mcp_tool(fox-workflow, job_history, {limit: 10})
```

### Step 5: Mark Plan Complete

Use MCP tools to update status:

1. **Update plan status**:
   ```
   call_mcp_tool(fox-workflow, update_plan_status, {plan: "<plan-filename>", status: "complete"})
   ```

2. **Mark task done**:
   ```
   call_mcp_tool(fox-workflow, mark_task_done, {taskId: "2H-4a"})
   ```

### Step 6: Implementation Report

Provide a summary for each completed plan:

```markdown
## Task N: <Title> — Implementation Complete

### Deliverables
| File | Action | Lines | Status |
|------|--------|-------|--------|
| `src/session/foo.ts` | Created | 120 | ✅ |
| `src/session/prompt/loop.ts` | Modified | 5 lines added | ✅ |

### Feature Registry
| ID | Name | Tests | Tags |
|----|------|-------|------|
| F-2H-4 | Feature Name | test/foo.test.ts (8 tests) | 2 code tags |

### Verification
| Check | Result |
|-------|--------|
| Typecheck | ✅ 0 errors |
| Unit tests | ✅ 8/8 pass |
| Smoke tests | ✅ 292/292 pass |
| Feature validator | ✅ Pass |

### Notes
- Any deviations from the plan and why
- Any deferred items (→ follow deferred-items-tracking rule)
```

---

## Multi-Plan Execution

When implementing all plans in a phase:

1. Read `../plans/current/README.md` for the execution order.
2. Implement plans in dependency order (never implement Task B before Task A if B depends on A).
3. Run full verification after EACH plan (not just at the end) — catch regressions early.
4. If a plan fails verification, stop and fix before proceeding to the next plan.

---

## Rules to Follow During Implementation

These rules are always active and apply during implementation:

| Rule | What It Requires |
|------|-----------------|
| `feature-registry.md` | Update registry when adding/modifying loop features |
| `fox-cli-testing.md` | Run tests at appropriate tiers |
| `deferred-items-tracking.md` | Track any deferred items |
| `documentation-naming.md` | ISO 8601 prefixes on any new docs |

---

## Quick Reference

| Action | MCP Tool | Fallback (bash) |
|--------|----------|------------------|
| Push typecheck | `push_jobs {preset: "typecheck"}` | `timeout 45s bun run typecheck` |
| Push smoke tests | `push_jobs {preset: "smoke"}` | `timeout 60s bun run test:smoke` |
| Push full suite | `push_jobs {preset: "full"}` | `timeout 180s bun run test` |
| Check results | `job_history {limit: 10}` | `bun run tools/jobs/cli.ts history` |
| Run single test | — (run directly) | `bun test test/<file>.test.ts` |
| Mark task done | `mark_task_done {taskId: "..."}` | Manual edit of `tasks/current/phase-XX.md` |
| Update plan | `update_plan_status {plan: "...", status: "complete"}` | Manual edit of README.md |
| Register feature | `register_feature {...}` | Manual YAML edit |
| Stage files | `git_add {files: [...]}` | `run_command git add` |
| Commit | `git_commit {message: "..."}` | `run_command git commit` |
