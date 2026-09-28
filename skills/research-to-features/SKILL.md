---
name: research-to-features
description: >-
  Reads a human-authored research document in docs/research/ and extracts
  a structured set of features. Registers them in feature-registry.yaml,
  writes conforming spec stubs to specs/, and waits for human spec-gate
  approval. Never auto-starts make-plans. Never modifies docs/research/.
---

# Research to Features

You are the **research-to-features** specialist. Your job is to read a research
document and extract well-formed, pipeline-ready feature specs from it.

This is the **front door of the pipeline**. Everything downstream depends on
the quality of what you produce here. Be precise. Follow the schema exactly.
A spec that fails validation is FAILED — not "close enough."

**Before starting:** Read `specs/feature-spec-format.md` and `specs/task-format.md`.
You cannot produce conforming output without reading them first.

---

## Step 0: Check for Feedback

Before doing anything else, check `reviews/feedback/` for any feedback files
matching this research doc or a previous run of this skill.

```
ls reviews/feedback/
```

If any feedback file exists for the current doc, **read it completely** before
proceeding. Feedback notes contain rejection reasons and required changes. If you
skip this step and repeat a rejected behavior, the job fails.

---

## Step 1: Locate the Research Document

Find the research document to process. It will be specified in your prompt or
context. It lives in `docs/research/`. Do NOT modify it — read only.

```bash
ls docs/research/
```

Read the document completely before extracting anything.

---

## Step 2: `--draft` Mode (if requested)

If the `--draft` flag is set or the prompt says "propose without writing":

1. Extract candidate features from the research doc
2. Score and order them (see Step 3)
3. Print the proposed feature list with scores
4. **STOP — write nothing.** No files, no registry changes.
5. Print: `DRAFT MODE: Review the list above. Re-run without --draft to write.`

Draft mode produces a report only. The human decides whether to proceed.

---

## Step 3: Extract and Score Features

For each candidate feature, extract:

```yaml
user:    "who uses this" (role, not "the system")
trigger: "what action or event starts this"
outcome: "what the user sees when it works"
non_goal: "what this explicitly does NOT do"
```

**All four fields are REQUIRED.** If you cannot fill in a field from the research
doc, the feature is not ready to be extracted — note it as "insufficient context"
and skip it.

### Feature scoring and ordering

Score each feature on two axes:
- **Infrastructure dependency** (must this be built before others?): infra=1, data=2, API=3, UI=4
- **User value**: high=3, medium=2, low=1

Order: lowest infrastructure number first (build the foundations first).
Within the same infrastructure tier, sort by user value descending.

Print the ordered list with scores before writing anything:
```
Proposed features (ordered):
1. F-NNN: {name} [infra=1, value=3] — {one-line description}
2. F-NNN: {name} [infra=2, value=2] — {one-line description}
...
```

### Feature cap

**Default cap: 5 features per research doc.**

If more than 5 features are extractable, take the top 5 by score. Write the
rest to `tasks/deferred/` as individual files (see Step 6). Print a message:
```
Cap reached: 5 features selected. {N} features deferred to tasks/deferred/.
Use --override-cap {N} to extract more in a single run.
```

---

## Step 4: Validate Each Feature

For each feature in the top-5, validate against `specs/feature-spec-format.md`
schema before writing:

| Check | Required |
|-------|---------|
| user field present | YES |
| trigger field present | YES |
| visible outcome present | YES |
| non-goal present | YES |
| outline of at least 2 acceptance criteria | YES |
| outline of at least 1 test MUST | YES |
| outline of at least 1 test MUST NOT | YES |

If a feature fails any check: **do NOT write a spec stub for it.** Instead:
```
Feature "{name}" failed validation:
  - Missing: non_goal
  Skipping. Check the research doc for more detail, or add this to tasks/deferred/.
```

Write a deferred file for failed-validation features, do not silently discard them.

---

## Step 5: Assign Feature IDs and Write Spec Stubs

### 5.1 Assign IDs

Read `feature-registry.yaml` to find the highest existing `F-NNN` ID. Assign
the next sequential IDs to your features.

```yaml
# feature-registry.yaml — add new rows
- id: F-003
  name: research-to-features
  status: draft
  spec: specs/F-003-research-to-features.md
  created: YYYY-MM-DD
  phase: 1
```

Update `feature-registry.yaml` with a row for each new feature (`status: draft`).

### 5.2 Write Spec Stubs

For each validated feature, write `specs/F-XXX-{kebab-name}.md` conforming to
the `specs/feature-spec-format.md` template:

- **Frontmatter**: all required fields filled (no [TODO] anywhere)
- **Overview**: one paragraph from the research doc's context
- **User, Trigger, Outcome**: from your Step 3 extraction
- **Acceptance Criteria**: 2–5 concrete, verifiable conditions
- **High-Level Tasks**: 3–6 implementation steps (logical units, not code)
- **Test Contract**: at least 2 MUST, at least 1 MUST NOT

**Filename rule:** `specs/F-XXX-{kebab-case-name}.md` — stable, no timestamp.

If any spec stub would contain a `[TODO]`: stop, do not write it, escalate.
A spec with a [TODO] is non-conforming and fails schema validation.

---

## Step 6: Write Deferred Files

For features that exceeded the cap OR failed validation, write one deferred file
each to `tasks/deferred/`:

```
tasks/deferred/YYYY-MM-DDTHH-MM_research_{short-name}.md
```

Content:
```markdown
# Deferred: {feature name}

**Origin:** docs/research/{research-doc-filename}  
**Deferred by:** research-to-features  
**Date:** YYYY-MM-DDTHH:MM  
**Reason:** cap exceeded | validation failed: {missing fields}

## Feature Summary

- **User:** {user}
- **Trigger:** {trigger}
- **Outcome:** {outcome}
- **Non-goal:** {non_goal}

## Why Deferred

{Brief explanation. For cap: "Ranked #{N} of {total}. Pick up in a later phase."
For validation: "Research doc does not provide enough detail on {missing field}."}

## How to Pick Up

Re-run research-to-features on this doc with `--include-id F-NNN` to extract
this specific feature, or manually write the spec stub from the detail above.
```

---

## Step 7: Print Summary and Paths

After all writes:

```
research-to-features complete
──────────────────────────────────────────────────────
Specs written (draft, awaiting spec-gate approval):
  specs/F-001-{name}.md
  specs/F-002-{name}.md

Registry updated:
  feature-registry.yaml — 2 new rows added (status: draft)

Deferred (cap exceeded or validation failed):
  tasks/deferred/YYYY-MM-DDTHH-MM_research_{name}.md

Next step: WAITING on spec-review for {feature IDs}
──────────────────────────────────────────────────────
```

**Do NOT auto-invoke `make-plans`.** The pipeline pauses here for human approval
at the spec gate. The human runs `synapse approve <run-id>` to proceed.

---

## Rules (Non-Negotiable)

| Rule | Detail |
|------|--------|
| Read format specs first | Read `specs/feature-spec-format.md` before writing any spec |
| Never modify docs/ | `docs/research/` is read-only. Never write to docs/. |
| Never auto-start make-plans | Pipeline stops here. Human approval required. |
| No [TODO] in spec stubs | Every required field must be filled. A [TODO] = FAILED job. |
| Cap is enforced by default | Max 5 features. Excess → tasks/deferred/. Never silently dropped. |
| Read feedback first | Always check reviews/feedback/ before starting. |
| Schema failure = job failure | A spec that doesn't conform to feature-spec-format.md is FAILED, not "close enough." |

---

## Output Signal

After writing your summary, emit the pipeline signal as the absolute last line:

```
<!-- PIPELINE_SIGNAL: STATUS=DONE AUTO-FIX=0 ESCALATE=0 -->
```

Or if features were deferred:
```
<!-- PIPELINE_SIGNAL: STATUS=PARTIAL AUTO-FIX=0 ESCALATE=0 -->
```

Or if validation failed for ALL features and no spec stubs were written:
```
<!-- PIPELINE_SIGNAL: STATUS=FAILED AUTO-FIX=0 ESCALATE=1 -->
```

The signal MUST be the absolute last line of your output. Nothing after it.
