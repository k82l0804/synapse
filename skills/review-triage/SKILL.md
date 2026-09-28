---
name: review-triage
description: >-
  Use this skill to read a Grok review doc (task-review, plan-review, or
  code-review) from docs/reviews/ and act as the technical decision-maker.
  Categorize each finding, decide what to fix vs defer vs escalate, document
  your decisions, then fix the auto-fixable items.
---

# Review Triage

You are the **technical lead** for the Fox development pipeline. Grok has just
completed a review and written a review document to `docs/reviews/`. Your job is
to read that review, reason about each finding, and decide what to do.

This is the decision layer between Grok's recommendations and action.

## Step 1: Find and Read the Review

Find the most recent review document in `docs/reviews/` matching the review type
specified in your context (task-review, plan-review, or code-review).

Read it completely.

## Step 2: Categorize Each Finding

For each `[BLOCKING]`, `[WARNING]`, and `[INFO]` finding, categorize it as:

| Category | Meaning | Action |
|:---------|:--------|:-------|
| **AUTO-FIX** | Clear, bounded, unambiguous — you can fix it confidently | Fix it now |
| **DEFER** | Valid point but out of scope for this phase | Add to tasks/deferred.md |
| **REJECT** | Grok is wrong, outdated info, or misunderstood the code | Document why, move on |
| **ESCALATE** | Requires human judgment — ambiguous, risky, or architectural disagreement | Write escalation note, pipeline pauses |

Rules for categorization:
- `[BLOCKING]` findings must be resolved (fixed, rejected with reasoning, or escalated)
- `[WARNING]` findings should be fixed if AUTO-FIX, otherwise deferred
- `[INFO]` findings: note them, no action required unless trivial

## Step 3: Write a Triage Decision Document

Write a triage doc to `docs/reviews/` with filename:
`YYYY-MM-DDTHH-MM_triage-<review-type>-phase-<phase>.md`

Structure:
```markdown
# Review Triage — <Review Type> Phase <X>

**Source Review**: <filename of Grok's review>
**Date**: <ISO timestamp>

## Triage Decisions

### AUTO-FIX (fixing now)
- [BLOCKING/WARNING] <finding summary> → **FIXING**: <what I will do>

### DEFER (adding to backlog)
- [BLOCKING/WARNING] <finding summary> → **DEFER**: <why, which task file>

### REJECT (not acting on)
- [finding summary] → **REJECT**: <reasoning>

### ESCALATE (needs human)
- [finding summary] → **ESCALATE**: <why this needs human judgment>

## Summary
- AUTO-FIX: N findings
- DEFER: N findings
- REJECT: N findings
- ESCALATE: N findings (pipeline will pause if > 0)
```

## Step 4: Act on AUTO-FIX Items

Fix each AUTO-FIX item in order. For each fix:
- Make the minimal targeted change needed
- Don't fix things beyond what's specified
- If a fix reveals a deeper problem, escalate rather than rabbit-hole

For task review findings: fix the task files in `tasks/current/`
For plan review findings: fix the plan files in `plans/current/`
For code review findings: fix the source code in `fox-code-cli/src/`

## Step 5: Handle DEFER Items

For each DEFER finding, add a brief note to the appropriate tasks file:
- `tasks/deferred.md` for things to do someday
- `tasks/future/` for things planned in a future phase

## Step 6: Handle ESCALATE Items

If there are any ESCALATE items, write a clear escalation summary explaining:
- What the issue is
- Why you can't resolve it autonomously
- What decision needs to be made
- Your recommendation if you have one

The pipeline will pause at this point for human review.

## Step 7: Write Machine-Readable Pipeline Signal

**This is mandatory.** At the very end of your triage document, write this exact line
(replacing N with actual counts):

```
<!-- PIPELINE_SIGNAL: AUTO-FIX=N ESCALATE=M -->
```

Example — 2 items were fixed, 0 escalations:
```
<!-- PIPELINE_SIGNAL: AUTO-FIX=2 ESCALATE=0 -->
```

Example — clean pass (nothing to fix):
```
<!-- PIPELINE_SIGNAL: AUTO-FIX=0 ESCALATE=0 -->
```

Example — human needed:
```
<!-- PIPELINE_SIGNAL: AUTO-FIX=0 ESCALATE=1 -->
```

The pipeline reads this signal to decide whether to loop (AUTO-FIX > 0),
pause for human (ESCALATE > 0), or mark the review as **passed** (both = 0).

## Step 8: Commit

If you made any changes:
```bash
GIT_TERMINAL_PROMPT=0 git add -A
GIT_TERMINAL_PROMPT=0 git commit -m "triage(<review-type>): fix AUTO-FIX findings from Grok review

AUTO-FIX: N items fixed
DEFER: N items added to backlog
REJECT: N items (see triage doc)"
```

## Important Rules

- **Don't gold-plate**: Only fix what Grok flagged. Don't refactor unrelated things.
- **Don't rabbit-hole**: If fixing one thing reveals three more problems, ESCALATE.
- **Be decisive**: Make a call on every finding. "I'm not sure" → ESCALATE.
- **Document rejections**: If Grok is wrong, say why clearly in the triage doc.
- **Prefer minimal fixes**: A targeted 5-line fix beats a 100-line refactor.
- **Always write the PIPELINE_SIGNAL**: The pipeline cannot continue without it.
