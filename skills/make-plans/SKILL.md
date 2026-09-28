---
name: make-plans
description: >-
  Use this skill to create implementation plans for tasks in tasks/current/.
  Researches the codebase, creates structured plan files in plans/current/
  conforming to specs/plan-format.md, verifies each plan against the referenced
  spec, and emits a PIPELINE_SIGNAL at the end.
---

# Make Plans

Create implementation plans for tasks in `tasks/current/`. Plans must conform
exactly to `specs/plan-format.md`. A plan that doesn't conform is FAILED — not
"close enough."

**Before starting:** Read `specs/plan-format.md` and `specs/task-format.md`.
You cannot produce conforming plans without reading them first.

## When to Activate

- After `rotate-phase` promotes a new phase file to `tasks/current/`
- When the user says "plan this" or "create plans for phase X"
- When a single new task is added mid-phase and needs a plan

## Inputs

1. **Task list**: Read `tasks/current/` to identify which tasks need plans
2. **Existing plans**: Check `plans/current/` to see which tasks already have plans (skip those)
3. **Repo registry**: Read `repos.yaml` to determine which repo each task targets
4. **Feature registry**: Read `feature-registry.yaml` for next available feature IDs
5. **Referenced specs**: For `type: feature` tasks, read `specs/F-XXX-name.md` (must be `status: approved`)

---

## Procedure

### Step 1: Identify Tasks Needing Plans

1. Read `tasks/current/`
2. Check `plans/current/` for existing plans (skip tasks that already have one)
3. Build the list: tasks with no plan file yet

### Step 2: Research Each Task

For each task needing a plan:

1. **Read the task block** in `tasks/current/phase-N.md` — confirm it conforms to `specs/task-format.md`
2. **For `type: feature` tasks**: read the referenced spec (`specs/F-XXX-name.md`)
   - Verify `status: approved` — a plan MUST NOT be created for a non-approved spec
   - Extract the Acceptance Criteria and Test Contract from the spec
3. **Find touchpoints**: use `grep_search` and `view_file` to locate files to change
4. **Check dependencies**: does this task depend on another task in the batch?

### Step 3: Write the Implementation Plan

Create a plan file in `plans/current/` with naming from `specs/plan-format.md`:

```
plans/current/YYYY-MM-DDTHH-MM_plan-{TASK-ID}.md
```

**Required plan structure** (must conform to `specs/plan-format.md`):

```markdown
# Plan: {Short Task Title}

> **Task:** {TASK-ID}  
> **Type:** feature | chore | bugfix | refactor  
> **Target Repo:** `{repo-name}`  (must match repos.yaml key)
> **Feature:** F-XXX              (omit for chore/bugfix/refactor)
> **Spec:** `specs/F-XXX-name.md` (omit for chore/bugfix/refactor)
> **Spec Task:** HLT-N            (omit for chore/bugfix/refactor)
> **Phase:** N  
> **Created:** YYYY-MM-DDTHH:MM  
> **Status:** draft

## Context

{Current state of codebase relevant to this task. No implementation details.}

## Deliverables

### D-1: {What is produced}

**Files to change:**
- `exact/path/to/file.ts` — what changes (add X, modify Y)
- `exact/path/to/new-file.ts` — NEW FILE — what it contains

**Spec contract ref:** AC-N, HLT-N  (omit for chore/bugfix/refactor)

**Implementation notes:**
- Key constraint or decision the coder must know

---

### D-2: {Next deliverable}
...

## Test Contract

(For feature tasks — table format mapping spec requirements to test files)

| Spec Requirement | Test File | Test Case | Verifies |
|-----------------|-----------|-----------|----------|
| MUST: {assertion from spec} | `test/{file}.test.ts` | `{testCaseName}` | AC-N |
| MUST NOT: {assertion from spec} | `test/{file}.test.ts` | `{testCaseName}` | AC-N |

(For chore/bugfix/refactor — plain assertions)

- MUST: `bun run typecheck` exits 0
- MUST: all tests in `test/{relevant}.test.ts` pass
- MUST NOT: any observable API behavior changes (refactor only)

## Verification Steps

1. `bun run typecheck`
2. `bun test test/{specific-file}.test.ts`
3. `bun run test:smoke`
```

**Test Contract rules (T-1-5):**
- For `type: feature`: every MUST and MUST NOT from the spec's Test Contract must appear
  in the plan's Test Contract table with a test file and case name
- Missing a spec MUST/MUST NOT → the plan is non-conforming (FAILED)
- For other types: at minimum typecheck + relevant test file + smoke

### Step 4: Assign Feature IDs

For each new feature in the plan:

1. Read `feature-registry.yaml` to find the highest existing `F-NNN` ID
2. Assign the next sequential ID
3. **Do NOT add the registry entry yet** — that happens during implementation
   (see `implement-plan` skill). The plan just reserves the ID.

### Step 5: Refine Each Plan

After writing each plan, activate the `refine-plan` skill:

1. Read `skills/refine-plan/SKILL.md` and follow its procedure
2. Run through the 4 refinement checks:
   - Rename ripple analysis
   - Audit completeness
   - Constraint specificity
   - Abstraction boundary precision
3. Update the plan with refinement findings
4. Stamp the plan with the refinement outcome

### Step 6: Summary Report and Signal

After all plans are created, write a summary and emit the signal:

```markdown
## Plans Created
| Task | Plan File | Features | Complexity |
|------|-----------|----------|------------|
| T-N | plans/current/YYYY-MM-DDTHH-MM_plan-T-N.md | F-XXX | medium |

## Execution Order
Recommended: T-A → T-B → T-C (reason: dependency chain)

## Notes
- Any cross-cutting concerns discovered during research
```

Emit as the absolute last line of your output:

```
<!-- PIPELINE_SIGNAL: STATUS=DONE AUTO-FIX=0 ESCALATE=0 -->
```

If any plan could not be written (e.g., spec not approved):
```
<!-- PIPELINE_SIGNAL: STATUS=PARTIAL AUTO-FIX=0 ESCALATE=1 -->
```

---

## Quick Reference

| Command | Purpose |
|---------|---------|
| `ls plans/current/` | See existing plans |
| `ls tasks/current/` | See tasks needing plans |
| `grep -n 'status:' feature-registry.yaml` | Find existing feature IDs |
| `grep -c 'id: F-' feature-registry.yaml` | Count existing features |
