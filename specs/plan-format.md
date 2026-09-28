# Plan Format

> **Status:** Frozen — Layer 0 protocol document. Do not modify without a phase task.  
> **Purpose:** Every plan in `plans/current/` MUST conform to this template.  
> A planner agent can produce a conforming plan from this document alone.

---

## 1. What a Plan Is

A plan is the **implementation blueprint** for a single task. It is ephemeral:
created when a task starts, archived to `plans/done/` when the task is complete.

```
Task (in tasks/current/) → Plan (in plans/current/) → Code + Tests
                                 ↑
                          YOU ARE HERE
```

**Key rules:**
- One plan per task. Plans and tasks are 1:1.
- `feature` plans MUST reference an approved spec. A plan without an approved spec is invalid.
- Plans describe *how* to implement — they do NOT restate *what* (that's the spec).
- Tests verify the SPEC's Test Contract, not the plan's deliverables.
- When a task moves to `done/`: `git mv plans/current/{plan} plans/done/`

---

## 2. Plan File Naming

```
plans/current/YYYY-MM-DDTHH-MM_plan-{TASK-ID}.md
```

Examples:
- `plans/current/2026-09-28T10-00_plan-T-1-3.md`
- `plans/current/2026-09-28T14-30_plan-T-L0-1.md`

Timestamp = when the plan was created (not when the task started).  
Filename is stable after creation — not re-timestamped on edits.

---

## 3. Required Sections

### 3.1 Header Block

Every plan MUST begin with this metadata block:

```markdown
# Plan: {Short Task Title}

> **Task:** {TASK-ID}  
> **Type:** feature | chore | bugfix | refactor  
> **Target Repo:** `{repo-name}` (must match a key in repos.yaml)  
> **Feature:** F-XXX  (omit for chore/bugfix/refactor)  
> **Spec:** `specs/F-XXX-name.md` (omit for chore/bugfix/refactor)  
> **Spec Task:** HLT-N  (omit for chore/bugfix/refactor)  
> **Phase:** N  
> **Created:** YYYY-MM-DDTHH:MM  
> **Status:** draft | in-progress | complete
```

**Field rules:**
- `Target Repo`: must match a key in `repos.yaml`. Agents must not guess.
- `Spec`: if present, the spec MUST have `status: approved` before this plan is executed.
- `Status`: transitions `draft → in-progress → complete`. Never goes backward.

### 3.2 Context

```markdown
## Context

One paragraph. What is the current state of the codebase relevant to this task?
What exists that this task builds on, changes, or is adjacent to?
No implementation details yet — this is orientation.
```

### 3.3 Deliverables

The core of the plan. Each deliverable is a numbered, atomic unit of work:

```markdown
## Deliverables

### D-1: {Short description of what is produced}

**Files to change:**
- `path/to/file.ts` — what changes (add X, modify Y, delete Z)
- `path/to/new-file.ts` — NEW FILE — what it contains

**Spec contract ref:** AC-N, HLT-N  (omit for chore/bugfix/refactor)

**Implementation notes:**
- Key decision or constraint the coder must know
- Another note

---

### D-2: {Next deliverable}
...
```

**Deliverable rules:**
- Numbered sequentially starting at D-1
- Each deliverable is independently committable (can be reviewed in isolation)
- `Files to change` uses exact repo-relative paths — no guessing
- `Spec contract ref` cites which AC and HLT this deliverable satisfies
- Maximum 8 deliverables. If more needed: split the task.

### 3.4 Test Contract

```markdown
## Test Contract

Maps the spec's Test Contract to concrete test locations:

| Spec Requirement | Test File | Test Case | Verifies |
|-----------------|-----------|-----------|---------|
| MUST: toggle changes CSS class | `test/dark-mode.test.ts` | `toggleDarkMode` | AC-3 |
| MUST NOT: cause page reload | `test/dark-mode.test.ts` | `noReloadOnToggle` | AC-3 |
```

**For chore/bugfix/refactor:** Replace the table with plain MUST/MUST NOT assertions
and the files that will contain the verification:

```markdown
## Test Contract

- MUST: `bun run typecheck` exits 0 after changes
- MUST: all tests in `test/auth.test.ts` pass without modification
- MUST NOT: any new exports added (refactor only, no API surface change)
```

### 3.5 Verification Steps

```markdown
## Verification Steps

Steps the coder (and CI) runs to confirm this plan is complete:

1. `bun run typecheck` — must exit 0
2. `bun test test/dark-mode.test.ts` — all tests pass
3. `bun run test:smoke` — no regressions
```

**Rules:**
- Steps must be runnable commands, not descriptions
- Must include typecheck as step 1 (always)
- Must include the specific test files that cover this plan's scope
- Must include a smoke/regression check as the final step

---

## 4. Full Example — Feature Plan

```markdown
# Plan: Implement Dark Mode Toggle

> **Task:** T-1-3  
> **Type:** feature  
> **Target Repo:** `fox-code-cli`  
> **Feature:** F-041  
> **Spec:** `specs/F-041-dark-mode.md`  
> **Spec Task:** HLT-3  
> **Phase:** 1  
> **Created:** 2026-09-28T10:00  
> **Status:** draft

## Context

The settings panel (`src/tui/settings.tsx`) currently has a single column of
toggles. Theme preference is stored in `src/foxcode/config/config.ts` via the
existing `kv` store. The root component (`src/tui/app.tsx`) applies a class name
to the root element. Dark mode requires wiring a new toggle to the kv store and
propagating the class to the root.

## Deliverables

### D-1: Add dark mode toggle to settings panel

**Files to change:**
- `src/tui/settings.tsx` — add `<Toggle label="Dark mode" value={darkMode} onChange={setDarkMode} />`

**Spec contract ref:** AC-1, HLT-3

**Implementation notes:**
- Use the existing `<Toggle>` component from `src/tui/components/toggle.tsx`
- State is local until D-2 wires it to kv

---

### D-2: Persist dark mode preference via kv store

**Files to change:**
- `src/foxcode/config/config.ts` — add `theme.darkMode: boolean` to kv schema
- `src/tui/settings.tsx` — read initial value from kv, write on change

**Spec contract ref:** AC-2, HLT-3

**Implementation notes:**
- Key: `theme.darkMode`, default: `false`
- Write is synchronous (kv.set is sync in current impl)

---

### D-3: Wire dark mode class to root component

**Files to change:**
- `src/tui/app.tsx` — subscribe to kv `theme.darkMode`, apply `class="dark"` to root

**Spec contract ref:** AC-3, HLT-3

---

### D-4: Add tests

**Files to change:**
- `test/dark-mode.test.ts` — NEW FILE — tests for AC-1, AC-2, AC-3

**Spec contract ref:** All ACs, full Test Contract

## Test Contract

| Spec Requirement | Test File | Test Case | Verifies |
|-----------------|-----------|-----------|---------|
| MUST: toggle changes CSS class within 50ms | `test/dark-mode.test.ts` | `toggleChangesCssClass` | AC-3 |
| MUST: preference survives reload | `test/dark-mode.test.ts` | `persistenceAfterReload` | AC-2 |
| MUST NOT: cause page reload | `test/dark-mode.test.ts` | `noReloadOnToggle` | AC-3 |

## Verification Steps

1. `bun run typecheck`
2. `bun test test/dark-mode.test.ts`
3. `bun run test:smoke`
```

---

## 5. Chore Plan Example

```markdown
# Plan: Write feature-spec-format document

> **Task:** T-L0-1  
> **Type:** chore  
> **Target Repo:** `synapse`  
> **Phase:** 1 (Layer 0)  
> **Created:** 2026-09-28T09:00  
> **Status:** complete

## Context

No spec format document exists. Agents producing specs have no formal contract
to follow, leading to inconsistent output that validators cannot check.

## Deliverables

### D-1: Write specs/feature-spec-format.md

**Files to change:**
- `specs/feature-spec-format.md` — NEW FILE — the frozen spec template

**Implementation notes:**
- Must be self-contained: agent can produce a valid spec from it alone
- Must include: required fields, all sections, a complete worked example (F-001)
- Must include: schema checklist for validators

## Test Contract

- MUST: document exists at `specs/feature-spec-format.md`
- MUST: every required field has a name, type description, and example
- MUST: a worked example spec (F-001) appears in the document
- MUST NOT: contain any [TODO] placeholders

## Verification Steps

1. `ls specs/feature-spec-format.md` — file exists
2. Manual review: does the worked example F-001 conform to the template it describes?
```

---

## 6. Schema Checklist

A plan is **non-conforming** if ANY of:

| Check | Rule |
|-------|------|
| ❌ Missing header block | All required metadata fields must be present |
| ❌ Missing Target Repo | Must match a key in repos.yaml |
| ❌ Feature plan missing Spec | type=feature must have Spec field |
| ❌ Spec not approved | Spec field must point to a spec with status: approved |
| ❌ Missing Context section | Must be present |
| ❌ Missing Deliverables | At least 1 deliverable required |
| ❌ Deliverable missing Files | Each deliverable must list files to change |
| ❌ Deliverables > 8 | Split the task if more than 8 are needed |
| ❌ Missing Test Contract | Must be present |
| ❌ Missing Verification Steps | Must be present with runnable commands |
| ❌ No typecheck step | Step 1 must be `bun run typecheck` |
| ❌ [TODO] present | Any field contains "[TODO]" literal |
| ❌ Non-existent file path | File paths in Deliverables must exist or be marked NEW FILE |
