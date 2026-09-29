# Feature Spec Format

> **Status:** Frozen — Layer 0 protocol document. Do not modify without a phase task.  
> **Purpose:** Every feature spec in `specs/` MUST conform to this template.  
> An agent can produce a valid spec from this document alone.

---

## 1. What a Feature Spec Is

A Feature Spec is the **formal contract** between what the product must do and how
correctness is verified. It is the single source of truth for a feature.

```
Feature (user story)
  └── Spec ← YOU ARE HERE (the contract)
        └── Tasks  (derived from spec by planner agent)
              └── Plan  (how to implement — derived from task + spec)
                    └── Code + Tests  (tests verify the SPEC, not the plan)
```

**Key rule:** Tests verify the spec. If the spec is approved and tests are green,
the feature is done — regardless of what the plan says.

---

## 2. Required Fields (YAML frontmatter)

Every spec file MUST begin with this frontmatter block:

```yaml
---
id: S-XXX                          # REQUIRED — assigned from feature-registry.yaml
name: short-kebab-case-name        # REQUIRED — matches registry entry
status: draft | approved | done    # REQUIRED
created: YYYY-MM-DD                # REQUIRED
updated: YYYY-MM-DD                # REQUIRED — update on every edit
author: human | research-to-features  # REQUIRED — who created this
feature_registry_ref: S-XXX        # REQUIRED — must match id
---
```

**Field rules:**
- `id`: Immutable. Never changes after assignment. Format: `[A-Z]-` + 3-digit zero-padded number.
  The prefix letter is repo-configurable (default `F` for fox-code-cli; `S` for synapse).
  Set `id_prefix` in `repos.yaml` for the repo. All specs in a repo use the same prefix.
- `status`:
  - `draft` — written by agent, not yet human-reviewed
  - `approved` — human has reviewed and approved at spec gate
  - `done` — all feature tasks complete and spec tests green
- `updated`: MUST be updated to today's date on every edit (human or agent)

---

## 3. Required Sections

Every spec MUST contain exactly these sections in this order:

### 3.1 Overview

```markdown
## Overview

One paragraph. Answers: what does this feature do, who uses it, and why does it matter.
No implementation details. No "we will" language — describe the feature as a fact.
```

### 3.2 User, Trigger, Outcome

```markdown
## User, Trigger, Outcome

- **User:** Who uses this feature (role or persona, not "the system")
- **Trigger:** What action or event starts the feature
- **Visible Outcome:** What the user observes when the feature works correctly
- **Non-Goal:** What this feature explicitly does NOT do
```

All four sub-fields are REQUIRED. A spec missing any of them fails schema validation.

### 3.3 Acceptance Criteria

```markdown
## Acceptance Criteria

- [ ] AC-1: (verb phrase describing a verifiable condition)
- [ ] AC-2: ...
```

**Rules:**
- Each criterion starts with a checkbox `- [ ]`
- Each criterion is independently verifiable — no compound criteria ("and" is a red flag)
- Minimum 2 criteria, maximum 10
- No implementation language ("must call function X") — only observable outcomes

### 3.4 High-Level Tasks

```markdown
## High-Level Tasks

1. HLT-1: (verb phrase — implementation step, one per logical unit of work)
2. HLT-2: ...
```

**Rules:**
- Numbered, starting at 1
- Each **feature** maps to exactly one task block in `tasks/current/phase-N.md`.
  That task block covers all the feature's HLTs (via `spec_task: HLT-1 through HLT-N`).
  Per-HLT task blocks are not required and are typically too granular for pipeline tracking.
- Tasks must be in dependency order (no forward references)
- No code-level detail ("add a field to the struct") — logical units only
- Maximum 8 tasks. If more are needed, split into two features.

### 3.5 Test Contract

```markdown
## Test Contract

### MUST
- MUST: (testable assertion — what the feature guarantees)
- MUST: ...

### MUST NOT
- MUST NOT: (testable negative — what the feature must never do)
- MUST NOT: ...
```

**Rules:**
- At least 2 MUST entries, at least 1 MUST NOT entry
- Every MUST/MUST NOT maps to at least one test assertion
- Use concrete, measurable language: "MUST return HTTP 200 when..." not "MUST work correctly"
- The Grok code review MUST verify each MUST/MUST NOT has a corresponding test

---

## 4. Optional Sections

These sections MAY appear after the required sections:

```markdown
## Open Questions
(Unresolved design questions. Human answers these at spec gate. Must be empty before approval.)

## Notes
(Additional context, links to research docs, background reading.)
```

### Optional frontmatter fields

Additional fields MAY appear in the frontmatter after the required fields:

| Field | Type | Description |
|-------|------|-------------|
| `depends_on` | list | IDs of other specs this spec depends on. Format: `[S-001, S-002]`. |

Validators MUST NOT reject a spec for having unrecognized frontmatter fields.

---

## 5. Full Example — F-001

```markdown
---
id: F-001
name: research-to-features
status: approved
created: 2026-09-28
updated: 2026-09-28
author: research-to-features
feature_registry_ref: F-001
---

## Overview

The research-to-features skill reads a human-authored research document and extracts
a structured set of features from it. Each extracted feature is registered in
`feature-registry.yaml` and gets a stub spec file written to `specs/`. The result
is a draft pipeline inbox entry waiting for human spec-gate approval.

## User, Trigger, Outcome

- **User:** Developer using Synapse to start a new product area
- **Trigger:** Developer invokes the research-to-features skill on a research doc
- **Visible Outcome:** A set of timestamped spec stubs appear in `specs/`, each
  with a valid frontmatter id, and new rows appear in `feature-registry.yaml`
  with `status: draft`. The terminal prints paths and "waiting on spec-review."
- **Non-Goal:** Does not start make-plans, does not approve specs, does not modify
  the research doc.

## Acceptance Criteria

- [ ] AC-1: Running the skill on a research doc produces 1–5 spec stub files in `specs/`
- [ ] AC-2: Each spec stub contains valid YAML frontmatter with all required fields
- [ ] AC-3: Each feature appears in `feature-registry.yaml` with `status: draft`
- [ ] AC-4: `--draft` mode prints the proposed features without writing any files
- [ ] AC-5: Features exceeding the cap (default 5) are written to `tasks/deferred/`
            as individual files, not dropped silently

## High-Level Tasks

1. HLT-1: Parse research doc and extract candidate features (user/trigger/outcome/non-goal)
2. HLT-2: Score and order features (infra→data→API→UI); present ordered list for override
3. HLT-3: Validate each feature against the schema; reject non-conforming entries
4. HLT-4: Write accepted features to feature-registry.yaml (status: draft)
5. HLT-5: Write spec stubs to specs/F-XXX-name.md using the feature-spec-format template
6. HLT-6: Write excess features to tasks/deferred/ as individual timestamped files

## Test Contract

### MUST
- MUST: produce spec stubs conforming to feature-spec-format.md schema
- MUST: stop and report in --draft mode without writing any files
- MUST: write excess features to tasks/deferred/, not discard them
- MUST: print the path of every written file before exiting

### MUST NOT
- MUST NOT: produce more than 5 spec stubs from one research doc without --override-cap flag
- MUST NOT: modify any file in docs/research/
- MUST NOT: auto-invoke make-plans after completing
- MUST NOT: write a spec stub that has a [TODO] in any required field
```

---

## 6. Schema Checklist (for validators and review agents)

A spec stub is **non-conforming** (fails schema, must not enter registry) if ANY of:

| Check | Rule |
|-------|------|
| ❌ Missing frontmatter | YAML block must be present and parseable |
| ❌ Missing required field | Any of: id, name, status, created, updated, author, feature_registry_ref |
| ❌ Wrong id format | Must match `[A-Z]-\d{3}` with prefix equal to the repo's configured `id_prefix` (default `F`) |
| ❌ Status not in enum | Must be `draft`, `approved`, or `done` |
| ❌ Missing section | Any of the 5 required sections absent |
| ❌ Missing UTONGs | user, trigger, visible outcome, or non-goal absent |
| ❌ AC count < 2 | Fewer than 2 acceptance criteria |
| ❌ AC count > 10 | More than 10 acceptance criteria |
| ❌ Missing MUST | Test Contract has no MUST entries |
| ❌ Missing MUST NOT | Test Contract has no MUST NOT entries |
| ❌ [TODO] present | Any required field contains "[TODO]" literal |
| ❌ Tasks > 8 | More than 8 High-Level Tasks |

**If a spec fails any check: the job is FAILED, not "close enough."**
The pipeline does not proceed until a conforming spec is produced.

---

## 7. File Naming Convention

```
specs/{PREFIX}-XXX-kebab-case-name.md
```

- **Stable filename** — never changes after creation (tasks and plans reference it by path)
- **No timestamp prefix** (unlike reviews and plans — specs are permanent contracts)
- `{PREFIX}` is the repo-configured `id_prefix` (e.g. `S` for synapse, `F` for fox-code-cli)
- `XXX` is the zero-padded feature ID matching `feature-registry.yaml`

Example: `specs/S-011-product-registration.md` (synapse repo, id_prefix = S)
Example: `specs/F-001-research-to-features.md` (fox-code-cli repo, id_prefix = F)
