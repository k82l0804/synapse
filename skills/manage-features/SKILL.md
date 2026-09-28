---
name: manage-features
description: >-
  Use this skill to add, remove, deprecate, or audit features in the Fox feature
  registry. Handles all four operations: registering new features with full specs,
  deprecating existing features, modifying feature behavior, and running the
  full traceability audit (registry ↔ code tags ↔ tests ↔ specs).
---

# Manage Features

Maintain the Fox feature registries, ensuring
the traceability chain Spec → Registry → Code → Tests stays intact.

## Repo Resolution

Feature registries are **local to each repo**. Read `../repos.yaml` to find the
target repo's `feature_registry` path. For example:
- `fox-code-cli` → `fox-code-cli/docs/feature-registry.yaml`
- `fox-acp-client` → `fox-acp-client/docs/feature-registry.yaml`

Default: `fox-code-cli` if no repo is specified.

## Operations

Choose the operation based on what triggered this skill:

| Trigger | Operation |
|---------|-----------|
| "Add a new feature" / implementing new loop behavior | [Add Feature](#add-feature) |
| "Remove feature" / deleting loop behavior | [Deprecate Feature](#deprecate-feature) |
| "Feature changed" / behavior modification | [Modify Feature](#modify-feature) |
| "Audit features" / periodic health check | [Audit](#audit) |

## Quick CLI Reference

```bash
bun run feature list                 # List all features with status & tag counts
bun run feature list --phase 2G      # Filter by phase
bun run feature list --untested      # Filter by missing test coverage
bun run feature trace <ID>           # Deep-dive dossier: spec -> code -> tests
bun run feature test <ID>            # Run tests specifically for this feature
bun run feature matrix               # Generate Markdown traceability matrix
bun run test:features                # Run feature integrity validation
```

---

## Add Feature

When a new behavioral capability is being added to the agent loop.

### Step 1: Assign Feature ID

1. Read the target repo's `feature_registry` (resolved from `../repos.yaml`).
2. Find the current phase (check `../tasks/current/` for the active phase).
3. Find the highest feature number in that phase and increment:
   - Phase 2H, highest existing = `F-2H-3` → new feature = `F-2H-4`
   - Cross-cutting features use `F-X-{N}` (find highest N and increment)

### Step 2: Write the Specification

Before writing code, define the feature's behavioral contract. This is the most important step — it determines what "correct" means.

Write these three fields:

```yaml
spec:
  contract: |
    Plain English description of what the feature does. Be specific about:
    - What triggers it (gate condition)
    - What it produces (output/side effect)
    - What it never does (negative space)
  invariants:
    - "Property that must ALWAYS be true, no matter what"
    - "Another invariant — these become test assertions"
  acceptance_criteria:
    - "Concrete scenario → expected outcome"
    - "Edge case scenario → expected outcome"
    - "Negative case → expected non-outcome"
```

**Guidelines for good specs:**
- **Contract**: Should be readable by someone who's never seen the code. 3-8 lines.
- **Invariants**: Should be falsifiable. "User text is never modified" is good. "Works correctly" is bad.
- **Acceptance criteria**: Should map directly to test cases. Each criterion = one test.

### Step 3: Add Registry Entry

Add the full entry to the target repo's `feature-registry.yaml`:

```yaml
- id: F-2H-4
  name: "Human-Readable Feature Name"
  phase: "2H"
  status: active
  impact: medium          # critical | high | medium | low
  description: >
    One-paragraph summary of the feature.
  code_locations:
    - src/session/prompt/loop.ts:NNN-NNN
    - src/session/other-file.ts
  gate: "condition that enables/disables this feature"
  tests:
    - test/my-feature.test.ts
  observable: true        # can telemetry/logs detect this feature firing?
  spec:
    contract: |
      ...
    invariants:
      - "..."
    acceptance_criteria:
      - "..."
  plan_ref: ../plans/current/plan-file.md  # or null if no plan
```

### Step 4: Tag the Code

At each integration point in source code, add:

```typescript
// @fox-feature F-2H-4: Human-Readable Feature Name — specific action here
```

Place the tag on the line immediately BEFORE the feature's code block. Example:

```typescript
// @fox-feature F-2H-4: Token Budget Guardrail — reject oversized prompts
if (tokenCount > MAX_TOKENS) {
  return Effect.fail(new TokenBudgetExceeded())
}
```

**Tag rules:**
- One tag per integration point (a feature may have multiple tags in different files)
- Tag goes on the line BEFORE the code, not inline
- Include a brief description after the colon
- Use `grep -rn "@fox-feature F-2H-4" src/` to verify all tags are findable

### Step 5: Write Tests

Each acceptance criterion should map to at least one test:

```typescript
describe("F-2H-4: Token Budget Guardrail", () => {
  test("rejects prompt exceeding MAX_TOKENS", () => {
    // acceptance criterion 1
  })
  test("allows prompt under MAX_TOKENS", () => {
    // acceptance criterion 2
  })
})
```

Reference the test file in the registry entry's `tests` field.

### Step 6: Validate

```bash
bun run test:features
```

Fix any errors before committing.

---

## Deprecate Feature

When removing or disabling an existing feature.

### Step 1: Update Registry

In the target repo's `feature-registry.yaml`, change the feature entry:

```yaml
- id: F-2A-6
  status: deprecated          # was: active
  deprecated_reason: "Replaced by F-2H-3 (improved caching strategy)"
  deprecated_date: "2026-09-26"
```

Do NOT delete the entry. Deprecated features serve as historical documentation.

### Step 2: Remove Code Tags

Search for and remove all `@fox-feature F-xxx` comments:

```bash
grep -rn "@fox-feature F-2A-6" src/
```

Remove each tag line.

### Step 3: Update Tests

Either:
- Delete the test file (update `tests: []` in registry)
- Mark tests as `test.skip(...)` with a note: `// Deprecated: F-2A-6`

### Step 4: Remove Code

Remove the feature's implementation code.

### Step 5: Validate

```bash
bun run test:features
bun run test:smoke
```

---

## Modify Feature

When changing the behavior of an existing feature (not just refactoring).

### Step 1: Identify Impact

1. Read the feature's current spec in `docs/feature-registry.yaml`.
2. Determine which invariants or acceptance criteria are changing.
3. If an invariant changes, this is a **breaking change** — document it.

### Step 2: Update Spec

Modify `contract`, `invariants`, and/or `acceptance_criteria` to match the new behavior.

### Step 3: Update Code

Make the code changes. Update `@fox-feature` tag descriptions if the tag text no longer matches.

### Step 4: Update Tests

Modify tests to match the new spec. New acceptance criteria → new tests.

### Step 5: Update Metadata

- `code_locations`: Update if files or line ranges changed significantly.
- `impact`: Reassess if the feature's importance changed.
- `observable`: Update if observability changed.

### Step 6: Validate

```bash
bun run test:features
bun run test:smoke
```

---

## Audit

Periodic health check of the full traceability chain.

### Step 1: Run Validator

```bash
bun run test:features
```

Review output for:
- **Errors (❌)**: High/critical features without tests → must fix
- **Warnings (⚠️)**: Missing code tags or untested medium/low features → should fix
- **Orphan tags**: `@fox-feature` in code without registry entry → investigate

### Step 2: Spec Drift Check

For each feature with a `plan_ref`:
1. Read the plan.
2. Read the spec.
3. Read the code at the `code_locations`.
4. Verify: Does the code match the spec? Does the spec match the plan?

Report any drift as:

```
DRIFT: F-2E-3 — spec says "5k token budget" but code uses CONTEXT_TOKEN_BUDGET = 4096
ACTION: Update spec or code to reconcile
```

### Step 3: Test Coverage Check

For features with tests:
1. Read each `acceptance_criteria` entry.
2. Verify there's a corresponding test assertion.
3. Flag criteria without tests.

### Step 4: Generate Report

Create an audit artifact summarizing:
- Total features / active / deprecated
- Test coverage percentage
- Code tag coverage percentage
- Spec drift findings
- Recommendations

### Step 5: Fix Issues

Address findings in priority order:
1. Errors (critical/high untested features)
2. Spec drift (code doesn't match spec)
3. Missing code tags
4. Missing tests for medium/low features

---

## Quick Reference

### Commands

| Command | Purpose |
|---------|---------|
| `bun run test:features` | Validate registry ↔ code ↔ tests |
| `bun run test:smoke` | Verify code still works after changes |
| `grep -rn "@fox-feature F-xxx" src/` | Find all code locations for a feature |
| `grep "id: F-xxx" docs/feature-registry.yaml` | Find a feature's registry entry |

### File Locations

| File | Purpose |
|------|---------|
| `docs/feature-registry.yaml` | Master feature list with specs |
| `tools/feature-matrix-validator.ts` | Automated validator script |
| `test/loop-integration-wiring.test.ts` | Integration tests for loop features |
| `.agents/rules/feature-registry.md` | Always-on maintenance rule |
