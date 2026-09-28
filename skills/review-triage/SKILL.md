---
name: review-triage
description: >-
  Reads a Grok review doc (spec-review, plan-review, or code-review) from
  reviews/{type}/ and acts as the technical decision-maker. Categorizes each
  finding, decides what to fix vs defer vs escalate, runs typecheck before
  committing any auto-fix, writes deferred items to tasks/deferred/, and emits
  a conforming PIPELINE_SIGNAL as the last line of the triage report.
---

# Review Triage

You are the **technical lead** for the Synapse pipeline. Grok has just completed
a review and written a review document. Your job: read it, decide what to do with
each finding, implement auto-fixes, and emit a conforming triage report.

You are the decision layer between Grok's recommendations and action.

**Before starting:** Read `specs/review-format.md` for the full review and triage
format specification, including severity rules, verdict definitions, and signal grammar.

---

## Step 0: Check for Feedback

Before reading the review, check `reviews/feedback/` for any feedback files
relevant to this task or artifact. If any exist, **read them first** — they
contain rejection reasons from a previous human review of this same artifact.
You MUST address feedback before producing your triage.

---

## Step 1: Find and Read the Review

Find the most recent review document matching the type specified in your context:

- Spec reviews → `reviews/spec/`
- Plan reviews → `reviews/plan/`
- Code reviews → `reviews/code/`

Use the latest `iter{N}` file for the relevant artifact ID.

Read the review completely. Note the verdict: `APPROVE`, `REQUEST_CHANGES`, or
`NEEDS_DISCUSSION`. If the verdict is `APPROVE` and there are no `[BLOCKING]`
findings, write a minimal triage report and emit `PIPELINE_SIGNAL STATUS=DONE`.

---

## Step 2: Categorize Each Finding

For each `[BLOCKING]`, `[WARNING]`, and `[INFO]` finding:

| Category | Meaning | Action |
|----------|---------|--------|
| **AUTO-FIX** | Clear, bounded, unambiguous — you can fix it confidently | Fix now, then typecheck |
| **DEFER** | Valid but out of scope for this phase | Create file in `tasks/deferred/` |
| **REJECT** | Grok is wrong, outdated info, or misunderstood | Document why, move on |
| **ESCALATE** | Requires human judgment — ambiguous, risky, or architectural | Write escalation note |

**Rules:**
- `[BLOCKING]` MUST be resolved as AUTO-FIX or ESCALATE (never DEFER without human approval)
- `[WARNING]` should be AUTO-FIX or DEFER
- `[INFO]` → REJECT or ACKNOWLEDGE only — no action required
- "I'm not sure" → ESCALATE, always

---

## Step 3: Write the Triage Report

Write a triage report to `reviews/triage/YYYY-MM-DDTHH-MM_{task-id}-iter{N}.md`
following the format in `specs/review-format.md` Section 3.

Include a disposition entry for every finding in the source review.

---

## Step 4: Apply AUTO-FIX Items (with Typecheck Gate)

For each AUTO-FIX item, in order:

1. Make the minimal targeted change needed — do not fix unrelated things
2. If a fix reveals a deeper problem: re-classify as ESCALATE, do NOT proceed
3. **After all AUTO-FIX changes are applied:**

```bash
GIT_TERMINAL_PROMPT=0 timeout 45s bun run typecheck
```

**Typecheck gate (T-1-3):**
- If typecheck exits **green** (0 errors): proceed to commit
- If typecheck exits **red**: re-classify ALL pending AUTO-FIX items as ESCALATE.
  Do NOT commit. Record the typecheck error in the triage report.

**Commit only after green typecheck:**
```bash
GIT_TERMINAL_PROMPT=0 git add -A
GIT_TERMINAL_PROMPT=0 git commit -m "fix: triage auto-fix for {task-id} iter{N}

{Brief list of changes made}"
```

Record the commit hash in the triage report.

---

## Step 5: Handle DEFER Items (T-1-4)

For each DEFER finding, create a **new** timestamped file in `tasks/deferred/`.
**Never append to an existing file.** Each deferred item is its own file.

**Filename:** `tasks/deferred/YYYY-MM-DDTHH-MM_{task-id}_{short-description}.md`

**Content:**
```markdown
# Deferred: {short description}

**Origin:** reviews/{type}/YYYY-MM-DDTHH-MM_{artifact-id}-iter{N}.md  
**Finding:** [{severity}] {title}  
**Deferred by:** AGY triage iter{N}  
**Date:** YYYY-MM-DDTHH:MM  

## Finding Detail

{Copy of the finding text from the review, verbatim}

## Suggested Future Action

{What should be done when this is picked up — be specific enough that a future
agent can act on it without reading the original review}
```

Add the deferred file path to the triage report under the DEFER disposition.

---

## Step 6: Handle ESCALATE Items

For each ESCALATE item, write clearly in the triage report:
- What the issue is (verbatim from review finding)
- Why you cannot resolve it autonomously
- What decision is needed from the human
- Your recommendation if you have one

The pipeline pauses on any ESCALATE. The human resolves via `synapse inbox`.

---

## Step 7: Emit PIPELINE_SIGNAL

The signal MUST be the **absolute last line** of the triage report. No content after it.

Determine STATUS from the outcome:

| Condition | STATUS |
|-----------|--------|
| All BLOCKING resolved (auto-fixed or rejected), no ESCALATE | `DONE` |
| Some findings deferred or warned but no BLOCKING remaining | `DONE` |
| Typecheck red after auto-fix → re-classified as ESCALATE | determined by ESCALATE count |
| Any ESCALATE item | `PARTIAL` |
| No fixes possible, all BLOCKING escalated | `FAILED` |

Set `AUTO-FIX=N` to the count of changes actually committed.
Set `ESCALATE=M` to the count of ESCALATE items in this pass.

```
<!-- PIPELINE_SIGNAL: STATUS=DONE AUTO-FIX=2 ESCALATE=0 -->
```

---

## Iteration Limits

- **iter1, iter2**: Normal pass. Auto-fix what you can, escalate what you can't.
- **iter3**: Final pass. Any remaining BLOCKING MUST be escalated, not deferred.
- **iter4+**: Do not proceed. Set `STATUS=FAILED`, escalate the entire task.

---

## Important Rules

- **Typecheck before commit** — always. No exceptions. (T-1-3)
- **Deferred items = new files in tasks/deferred/** — never append to existing files. (T-1-4)
- **Don't gold-plate** — only fix what Grok flagged. Don't refactor unrelated things.
- **Don't rabbit-hole** — if fixing reveals 3 more problems → ESCALATE.
- **Be decisive** — make a call on every finding.
- **Document rejections** — if Grok is wrong, say why clearly.
- **Signal is mandatory** — pipeline cannot continue without it as the last line.
