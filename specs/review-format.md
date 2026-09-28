# Review Format

> **Status:** Frozen — Layer 0 protocol document. Do not modify without a phase task.  
> **Purpose:** Defines the format every Grok review and AGY triage report must follow.  
> A Grok review parsed by the daemon MUST yield a clear approve/reject signal.

---

## 1. Review Types and Storage

| Type | Producer | Storage location | Filename pattern |
|------|----------|-----------------|-----------------|
| Spec review | Grok | `reviews/spec/` | `YYYY-MM-DDTHH-MM_F-XXX-iter{N}.md` |
| Plan review | Grok | `reviews/plan/` | `YYYY-MM-DDTHH-MM_T-XXX-iter{N}.md` |
| Code review | Grok | `reviews/code/` | `YYYY-MM-DDTHH-MM_T-XXX-iter{N}.md` |
| Triage report | AGY | `reviews/triage/` | `YYYY-MM-DDTHH-MM_T-XXX-iter{N}.md` |
| Feedback note | Human | `reviews/feedback/` | `YYYY-MM-DDTHH-MM_{type}-{id}.md` |

**Iteration rule:** Each new review cycle for the same artifact increments `{N}`.
`iter1` → rejected → `iter2` → rejected → `iter3` → escalated if still failing.
Never overwrite an existing iter file — always create a new one.

---

## 2. Grok Review Format (spec, plan, code)

### 2.1 Required Structure

```markdown
# {Type} Review: {Artifact ID} iter{N}

> **Reviewer:** Grok (read-only)  
> **Artifact:** `{path/to/reviewed/artifact}`  
> **Date:** YYYY-MM-DDTHH:MM  
> **Iteration:** {N}

---

## Findings

### [BLOCKING] {short title}

{Description of the finding. Be specific: what is wrong, where, and why it matters.}

**Evidence:** `{file}:{line}` or direct quote from artifact  
**Required action:** {What must change before this can be approved}

---

### [WARNING] {short title}

{Description. Warnings should be fixed but are not blockers if the reviewer
provides explicit justification for deferring.}

**Evidence:** ...  
**Suggested action:** ...

---

### [INFO] {short title}

{Observation, question, or note. No required action.}

---

## Missing Tests / Test Gaps

- {Test case that should exist but doesn't, mapped to a MUST/MUST NOT from the spec}
- {Another gap}

(Write "None identified" if no gaps found.)

## Architectural & Compatibility Risk

{Any concerns about how this change fits the broader system, affects other
features, or creates technical debt. Write "None" if none.}

## Verdict

{One of exactly three values — no other text on this line:}

APPROVE
```

or

```markdown
REQUEST_CHANGES
```

or

```markdown
NEEDS_DISCUSSION
```

### 2.2 Severity Tag Rules

| Tag | When to use | Blocks approval? |
|-----|-------------|-----------------|
| `[BLOCKING]` | Spec violated, test missing, security issue, architectural invariant broken | YES — must be resolved before APPROVE |
| `[WARNING]` | Code quality, style, non-critical gap, tech debt | NO — can be deferred with justification |
| `[INFO]` | Observation, question, FYI | NO — no action required |

**A review with zero BLOCKING findings MUST use verdict `APPROVE` or `NEEDS_DISCUSSION`.**  
**A review with one or more BLOCKING findings MUST use verdict `REQUEST_CHANGES`.**

### 2.3 Verdict Definitions

| Verdict | Meaning | Daemon action |
|---------|---------|--------------|
| `APPROVE` | No blocking issues. Artifact can proceed. | Advance pipeline to next step |
| `REQUEST_CHANGES` | Blocking issues found. Must be addressed. | Trigger triage / fix cycle |
| `NEEDS_DISCUSSION` | Fundamental question that requires human decision before proceeding | Escalate to inbox immediately |

### 2.4 Grok Read-Only Constraint

Grok MUST NOT edit any source file, spec, plan, task, or review.
The review artifact is the ONLY file Grok writes.

**If a code fix is obvious and trivial:** describe it in the finding under
"Required action" — do not implement it. The triage agent (AGY) implements fixes.

### 2.5 Code Review Checklist (mandatory for code reviews)

For every MUST and MUST NOT in the spec's Test Contract, Grok MUST verify:

```markdown
## Spec Test Contract Coverage

| Spec Requirement | Test File | Test Case | Status |
|-----------------|-----------|-----------|--------|
| MUST: toggle changes CSS class | test/dark-mode.test.ts | toggleChangesCssClass | ✅ present and correct |
| MUST NOT: cause page reload | test/dark-mode.test.ts | noReloadOnToggle | ❌ MISSING |
```

A missing test for a MUST/MUST NOT entry is automatically a `[BLOCKING]` finding.

---

## 3. AGY Triage Report Format

```markdown
# Triage Report: {Task ID} iter{N}

> **Triager:** AGY  
> **Source Review:** `reviews/{type}/YYYY-MM-DDTHH-MM_{id}-iter{N}.md`  
> **Date:** YYYY-MM-DDTHH:MM  
> **Iteration:** {N}

---

## Finding Disposition

### [BLOCKING] {finding title from review}

**Decision:** AUTO-FIX | ESCALATE  
**Rationale:** {why this decision}  
**Action taken:** {description of what was changed, or "escalated — see GATE file"}

---

### [WARNING] {finding title from review}

**Decision:** AUTO-FIX | DEFER | ACKNOWLEDGE  
**Rationale:** {why}  
**Action taken:** {change made, or path to deferred file if DEFER}

---

## Typecheck Result

`bun run typecheck`: green | red  
(If red: finding re-classified as ESCALATE — see note below)

## Commit

{Git commit hash of auto-fix commit, or "none" if no fixes applied}

## Summary

{N} BLOCKING findings: {n} auto-fixed, {m} escalated  
{K} WARNING findings: {k} auto-fixed, {j} deferred, {l} acknowledged

<!-- PIPELINE_SIGNAL: STATUS={status} AUTO-FIX={n+k} ESCALATE={m} -->
```

### 3.1 Triage Decision Rules

| Finding severity | Allowed decisions |
|-----------------|------------------|
| `[BLOCKING]` | `AUTO-FIX` (apply fix + typecheck) or `ESCALATE` (cannot fix) |
| `[WARNING]` | `AUTO-FIX`, `DEFER` (write to tasks/deferred/), or `ACKNOWLEDGE` |
| `[INFO]` | `ACKNOWLEDGE` only |

**Auto-fix commit rules:**
1. Fix the code
2. Run `bun run typecheck` — must be green
3. If typecheck is red: re-classify the finding as ESCALATE, do NOT commit
4. If typecheck is green: `git commit -m "fix: {brief description} [triage iter{N}]"`

**DEFER rule:** A deferred WARNING creates a new file:
`tasks/deferred/YYYY-MM-DDTHH-MM_{task-id}_{short-description}.md`

Contents of a deferred file:
```markdown
# Deferred: {short description}

**Origin:** reviews/code/YYYY-MM-DDTHH-MM_T-XXX-iter1.md  
**Finding:** [WARNING] {title}  
**Deferred by:** AGY triage iter{N}  
**Date:** YYYY-MM-DDTHH:MM  

## Finding Detail

{Copy of the WARNING finding from the review}

## Suggested Future Action

{What should be done when this is picked up}
```

### 3.2 Iteration Limits

| Iteration | Auto-fix | Escalate | Action |
|-----------|----------|----------|--------|
| iter1 | YES | if needed | Normal auto-fix pass |
| iter2 | YES | if needed | Normal auto-fix pass |
| iter3 | YES | mandatory | Final pass — any remaining BLOCKING must escalate |
| iter4+ | NO | REQUIRED | Pipeline escalates entire task to inbox |

After 3 iterations with unresolved BLOCKING findings: `PIPELINE_SIGNAL STATUS=FAILED`
and the pipeline pauses. Human resolves via `synapse inbox`.

---

## 4. Human Feedback Notes

Written by the human via `synapse reject <run-id> --note "..."`.

```markdown
# Feedback: {type} {artifact id}

> **Author:** Human  
> **Rejected artifact:** `{path}`  
> **Date:** YYYY-MM-DDTHH:MM  
> **Run ID:** {run-id}

## Rejection Note

{Human's note — free text explaining what is wrong and what should change.
Can reference specific sections of the spec or plan.}

## Required Before Next Iteration

{List of things the agent must address. The next specialist MUST read this
file before regenerating.}
```

**Feedback is mandatory reading:** The dispatcher injects `reviews/feedback/`
files as context for the next specialist. A specialist MUST NOT regenerate
without reading the feedback.

---

## 5. Schema Checklist

### Grok Review — Non-conforming if ANY of:

| Check | Rule |
|-------|------|
| ❌ Missing header block | Reviewer, Artifact, Date, Iteration required |
| ❌ Missing Findings section | Must be present (can have no findings but must say so) |
| ❌ Missing Test Contract Coverage | Required for code reviews; omit for spec/plan reviews |
| ❌ Missing Verdict | Must end with APPROVE, REQUEST_CHANGES, or NEEDS_DISCUSSION |
| ❌ Wrong verdict | BLOCKING findings + APPROVE is a schema violation |
| ❌ Grok edits a file | Any file edit in logs = constraint violation |
| ❌ Signal absent | PIPELINE_SIGNAL must be last line |

### Triage Report — Non-conforming if ANY of:

| Check | Rule |
|-------|------|
| ❌ Missing disposition for each finding | Every BLOCKING/WARNING must have a decision |
| ❌ Missing typecheck result | Required after any AUTO-FIX |
| ❌ Auto-fix commit without green typecheck | Commit must not happen if typecheck is red |
| ❌ Missing PIPELINE_SIGNAL | Must be last line |
| ❌ DEFER without deferred file | Each DEFER must create a file in tasks/deferred/ |
