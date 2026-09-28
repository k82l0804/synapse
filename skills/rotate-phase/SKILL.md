---
name: rotate-phase
description: >-
  Use this skill to rotate between development phases: verify completion,
  archive completed plans to ../plans/done/, move the completed phase file
  from tasks/current/ to tasks/done/, promote the next phase file from
  tasks/future/ to tasks/current/, and commit.
---

# Rotate Phase

Use this skill to execute the **phase rotation lifecycle** when transitioning from a completed phase to the next batch of tasks. This skill handles archival and promotion only — plan creation is handled by the `make-plans` skill.

## When to Activate

- All tasks in `../tasks/current/` are implemented, reviewed, tested, and committed.
- You are ready to draw the next batch of tasks from `../tasks/future/`.
- Transitioning between roadmap milestones or subphases (e.g., Phase 2G → 2H).

---

## Phase Rotation Workflow

### Step 1: Pre-Rotation Verification

Before rotating, confirm the current phase is genuinely complete:

1. Verify all automated tests pass:
   ```bash
   timeout 60s bun run test:smoke
   ```
2. Verify feature registry is consistent:
   ```bash
   bun run test:features
   ```
3. Verify all code changes are committed and clean:
   ```bash
   GIT_TERMINAL_PROMPT=0 git status
   ```
4. Check `../plans/current/README.md` to ensure no incomplete tasks remain (all should be `✅ Complete`).
5. Verify all tasks in `../tasks/current/` are checked `- [x]`.

---

### Step 2: Archive the Completed Phase

1. **Move plan files to `../plans/done/`**:
   - Move all plan files from `../plans/current/` (excluding `README.md`) into `fox-code-cli/../plans/done/`.
   - Use `git mv` for tracked files; use standard `mv` for untracked files.
   - Retain the original ISO 8601 timestamp prefix on each file (per Rule 8 in `AGENTS.md`).

2. **Update `../plans/done/README.md`**:
   - Add a new section at the top of the phase list:
     ```markdown
     ## Phase <X> — <Phase Name> (<YYYY-MM-DD>)
     - [`<timestamp>_<slug>.md`](./<timestamp>_<slug>.md) — Task <N>: <Task Title>
     ```
   - Ensure all relative links resolve correctly.

3. **Move completed phase to `../tasks/done/`**:
   ```bash
   git mv ../tasks/current/phase-<X>.md ../tasks/done/
   ```

---

### Step 3: Promote the Next Phase

1. **Identify the next batch** in `../tasks/future/`:
   - Determine which phase or subphase is next in the dependency sequence.

2. **Move the next phase file to `../tasks/current/`**:
   ```bash
   git mv ../tasks/future/phase-<Y>.md ../tasks/current/
   ```

3. **Update `../tasks/README.md`**:
   - Update the phase flow line and the current/future/done tables.

4. **Reconcile Scope (Rule 7)**:
   - Ensure every task in the master plan exists in **exactly one** of:
     - `tasks/current/` (one file per active phase)
     - `tasks/future/` (one file per upcoming phase)
     - `tasks/done/` (one file per completed phase or group)
     - `tasks/deferred.md`
   - No task should be duplicated across files or lost during promotion.

---

### Step 4: Pre-Register Features

For each promoted task, ensure the feature → spec → test chain starts here, not at implementation time.

1. **Classify each task**:
   - **New capability** → needs a new feature ID (`F-<phase>-<N>`)
   - **Modification of existing** → tag with existing feature ID
   - **Infrastructure / tooling** → may not need a feature (use judgement)

2. **Resolve the target repo** from `repos.yaml`. Register stubs in the repo's `feature_registry` file:
   For each task, identify which repo it targets (default: `fox-code-cli`). Register in that repo's feature registry:
   ```yaml
   - id: F-<phase>-<N>
     name: <Task Title>
     phase: <phase>
     status: planned
     impact: <critical|high|medium|low>
     spec:
       contract: "TBD — fill in during make-plans"
       invariants: []
       acceptance_criteria: []
     tags: []
     tests: []
   ```

3. **Verify registration**:
   ```bash
   bun run feature list --phase <X>
   ```
   Every promoted task with a new capability should appear in the output.

> [!NOTE]
> The `make-plans` skill will fill in the `spec.contract`, `invariants`, and `acceptance_criteria` fields.
> The `implement-plan` skill will add `@fox-feature` code tags and test entries.
> This step just ensures the feature exists so nothing falls through the cracks.

---

### Step 5: Task Review Gate

Before running `make-plans`, have a **different agent** review the promoted tasks and
their pre-registered features. The reviewer checks:

1. **File paths exist**: Every path in the task description and feature `code_locations` resolves to an actual file (or says "new file" with a real parent directory).
2. **Tier claims match spec**: `min_tier` in features agrees with `docs/specs/*tier-capability-spec.yaml`. Tier C has `supports_tools: false`, `max_steps: 3`.
3. **No duplicates across phases**: Task does not claim the same work as a task in `tasks/future/` or `tasks/deferred.md`.
4. **Acceptance criteria are falsifiable**: "Improve X" is not a check. Each criterion can fail.
5. **Feature IDs don't collide**: New `F-<phase>-N` IDs don't overlap with existing registry entries.

**How to run the review:**
```bash
# Use a different model than the one that wrote the tasks
JOB_REPO=fox-code-cli tools/agent-job.sh grok code-review
# Or directly:
grok --effort xhigh -p "Review tasks/current/phase-<X>.md against the codebase.
Check: file paths exist, tier claims match spec, no phase overlaps,
acceptance criteria are falsifiable. Output findings as BLOCKING/WARNING/INFO."
```

Save the review to `docs/reviews/YYYY-MM-DDTHH-MM_task-review-phase-<X>.md`.

**Gate rule**: All BLOCKING findings must be resolved before `make-plans` runs.

---

### Step 6: Initialize Current Plans Directory

1. **Reset `../plans/current/README.md`**:
   - Update title: `# Current Plans — Phase <Next>: <Phase Name>`
   - State the target implementer and recommended execution order.
   - Initialize a status table listing all promoted tasks:
     ```markdown
     | Plan | Task | Status |
     |------|------|--------|
     | *(pending)* | Task <N>: <Title> | ⏳ Pending |
     ```

---

### Step 7: Checkpoint & Source Control

1. Verify there are no broken links in `../plans/current/README.md`, `../plans/done/README.md`, and `../tasks/current/`.
2. Stage and commit all changes with a standardized message:
   ```bash
   GIT_TERMINAL_PROMPT=0 git add docs/ ../skills/
   GIT_TERMINAL_PROMPT=0 git commit -m "docs(phase): rotate Phase <X> → Phase <Y>"
   GIT_TERMINAL_PROMPT=0 git push
   ```

---

## What Comes Next

After rotation is complete, the next steps in the workflow are:

1. **Create plans** → activate the `make-plans` skill
2. **Implement plans** → activate the `implement-plan` skill
3. **Code review** → activate the `code-review` skill
4. **Rotate again** → activate this skill when the phase is done
