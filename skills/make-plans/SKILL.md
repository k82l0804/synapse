---
name: make-plans
description: >-
  Use this skill to create implementation plans for tasks in tasks/current/.
  Researches the codebase, creates structured plan files in ../plans/current/,
  assigns feature IDs from the registry, writes spec contracts for new features,
  and auto-invokes the refine-plan skill on each result.
---

# Make Plans

Create implementation plans for tasks promoted to `../tasks/current/`. This skill handles the research, plan authoring, feature ID assignment, and refinement pipeline.

## When to Activate

- After `rotate-phase` promotes a new phase file to `tasks/current/`
- When the user says "plan this" or "create plans for phase X"
- When a single new task is added mid-phase and needs a plan

## Inputs

1. **Task list**: Read `../tasks/current/` to identify which tasks need plans.
2. **Existing plans**: Check `../plans/current/` to see which tasks already have plans (skip those).
3. **Repo registry**: Read `../repos.yaml` to determine which repo each task targets.
4. **Feature registry**: Read the target repo's `feature_registry` path (from `repos.yaml`) to determine next available feature IDs.

---

## Procedure

### Step 1: Identify Tasks Needing Plans

1. Read `../tasks/current/`.
2. Read `../plans/current/README.md` to see which plans already exist.
3. Build a list of tasks that need plans (unchecked items without a plan file).

### Step 2: Research Each Task

For each task needing a plan:

1. **Understand the goal**: Read the task description in `tasks/current/phase-<X>.md` and any referenced documents.
2. **Find touchpoints**: Use `grep_search` and `view_file` to locate:
   - Files that will be created or modified
   - Existing patterns to follow (look at how similar features were implemented)
   - Integration points in the loop (`loop.ts`, `processor.ts`, `compaction.ts`, etc.)
   - Config fields that need to be added or read
3. **Check the feature registry**: Determine if this task creates new features or modifies existing ones.
   - New feature → assign the next available `F-{phase}-{N}` ID
   - Modified feature → note which registry entries need spec updates
4. **Check for dependencies**: Does this task depend on another task in the current batch?

### Step 3: Write the Implementation Plan

Create a plan file in `../plans/current/` with the naming format:

```
YYYY-MM-DDTHH-MM_<task-slug>.md
```

**Required plan structure:**

```markdown
# Task <N>: <Task Title>

> **Target Repo**: `fox-code-cli`
> *(Must match a `name` in `repos.yaml`. Determines feature registry, test commands, and CWD.)*

## Goal / Problem Statement
What problem does this solve? Why does it matter?
What is the user-visible or system-visible outcome?

## Feature Registry
- **New features**: F-<phase>-<N> (<name>) — or "No new features"
- **Modified features**: F-xxx (<name>) — what changes
- **Spec contract** (for new features):
  ```yaml
  contract: |
    ...
  invariants:
    - "..."
  acceptance_criteria:
    - "..."
  ```

## Key Code Locations & Touchpoints
| File | Role | Action |
|------|------|--------|
| `src/session/prompt/loop.ts:NNN` | Integration point | Add/modify |
| `src/session/new-module.ts` | New module | Create |

## Proposed Changes & API Contracts
### Change 1: <Description>
- What: ...
- Where: ...
- API: function signature, types, return values
- Side effects: ...

### Change 2: ...

## Edge Cases & Failure Modes
1. **Edge case**: What happens when X? → Expected: Y
2. **Failure mode**: What if Z fails? → Mitigation: ...

## Verification Plan
Look up test commands from `repos.yaml` for the target repo:

1. **New tests**: `test/<test-file>.test.ts` — covers acceptance criteria
2. **Unit**: Run the specific test file
3. **Smoke**: Run the repo's smoke test command
4. **Full**: Run the repo's full test suite (before final sign-off)
5. **Feature validator**: Run the repo's feature validation command (if available)

## Dependencies
- **Target repo**: `<repo-name>` (from `repos.yaml`)
- Depends on: Task <M> (if applicable)
- Blocked by: nothing / <what>

## Estimated Scope
- Files created: N
- Files modified: N
- Tests: N test cases
- Complexity: low / medium / high
```

### Step 4: Assign Feature IDs

For each new feature in the plan:

1. Read `docs/feature-registry.yaml` to find the highest existing ID in the current phase.
2. Assign the next sequential ID.
3. **Do NOT add the registry entry yet** — that happens during implementation (see `implement-plan` skill). The plan just reserves the ID.

### Step 5: Refine Each Plan

After writing each plan, activate the `refine-plan` skill:

1. Read `../skills/refine-plan/SKILL.md` and follow its procedure.
2. Run through the 4 refinement checks:
   - Rename ripple analysis
   - Audit completeness
   - Constraint specificity
   - Abstraction boundary precision
3. Update the plan with refinement findings.
4. Stamp the plan with the refinement outcome.

### Step 6: Update README

Update `../plans/current/README.md` with the new plan:

```markdown
| [Task <N>: <Title>](<timestamp>_<task-slug>.md) | <Brief summary> | ⏳ Pending |
```

### Step 7: Summary Report

After all plans are created, provide a summary:

```markdown
## Plans Created
| Task | Plan File | Features | Complexity |
|------|-----------|----------|------------|
| Task N | <file> | F-xxx, F-yyy | medium |

## Execution Order
Recommended: Task A → Task B → Task C (reason: dependency chain)

## Notes
- Any cross-cutting concerns discovered during research
- Any tasks that should be split or merged
```

---

## Quick Reference

| Command | Purpose |
|---------|---------|
| `grep -c "^  - id: F-" docs/feature-registry.yaml` | Count existing features |
| `grep "id: F-2H-" docs/feature-registry.yaml` | Find highest ID in phase 2H |
| `ls ../plans/current/` | See existing plans |
| `cat ../tasks/current/` | See tasks needing plans |
