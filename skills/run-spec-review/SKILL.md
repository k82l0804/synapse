---
name: run-spec-review
description: >-
  Full dual-reviewer spec review workflow: Grok (Reviewer 1, blind) then
  Claude (Reviewer 2, sees Grok). Handles output file naming with timestamps,
  optional parallel blind mode, verification pass (iter2), and triage trigger.
  Use this skill any time a spec set needs a formal review gate.
---

# Run Spec Review (Dual-Reviewer Workflow)

Runs the full two-reviewer spec review pipeline per the Multi-Provider Review
policy in `docs/research/*_synapse-foundation-plan.md` §2.9.

## When to use this skill

- After `research-to-features` writes new spec stubs
- After triage fixes are applied to existing specs
- Before advancing from any spec gate in the pipeline

## Prerequisites

- `grok` CLI authenticated
- `claude` CLI authenticated
- Working directory: synapse repo root
- Specs to review are in `specs/`

---

## Mode A: Sequential (policy default)

Grok runs first (blind). Claude runs second, sees Grok's output.
More confirmation depth. Slightly slower.

```bash
cd /home/k82l0804/workarea/fox/synapse   # or your synapse root

SPECS="specs/S-011-product-registration.md specs/S-012-daemon-engine.md \
       specs/S-013-signal-parser.md specs/S-014-human-gate.md \
       specs/S-015-artifact-index.md"
REF="specs/feature-spec-format.md specs/task-format.md \
     specs/pipeline-signal-protocol.md"

# ── Step 1: Reviewer 1 — Grok (blind) ─────────────────────────────────────
GROK_OUT="reviews/spec/$(date +%Y-%m-%dT%H-%M)_grok-spec-review.md"

timeout 600 grok --single \
  "You are a read-only adversarial spec reviewer (Reviewer 1, BLIND).
   Read ALL of these files: $SPECS $REF.
   Do NOT read any prior reviews. Be adversarial.
   Flag BLOCKING issues (ambiguous contracts, untestable MUSTs,
   contradictions between documents, missing state transitions),
   WARNING gaps, and test coverage gaps per spec.
   Write findings to $GROK_OUT.
   Verdict at end: APPROVE or REQUEST_CHANGES.
   Do NOT edit any existing spec file." \
  --allow "Write($GROK_OUT)"

echo "Grok done: $GROK_OUT"

# ── Step 2: Reviewer 2 — Claude (sees Grok) ───────────────────────────────
# Specs: claude-opus-4-5 (Fable). Plans: claude-opus-5-0. Code: claude-sonnet-5-0.
CLAUDE_OUT="reviews/spec/$(date +%Y-%m-%dT%H-%M)_claude-spec-review.md"

timeout 600 claude -p \
  "You are a read-only adversarial spec reviewer (Reviewer 2).
   Read ALL of: $SPECS $REF.
   ALSO read $GROK_OUT (Reviewer 1 findings — confirm + extend,
   go deeper on gaps, do not just re-list Grok's findings).
   Flag BLOCKING issues, WARNING gaps, and test coverage gaps.
   Write findings to $CLAUDE_OUT.
   Verdict at end: APPROVE or REQUEST_CHANGES.
   Do NOT edit any existing spec file." \
  --allowedTools "Write" "Edit"

echo "Claude done: $CLAUDE_OUT"

# ── Step 3: Commit reviews ─────────────────────────────────────────────────
GIT_TERMINAL_PROMPT=0 git add -A
GIT_TERMINAL_PROMPT=0 git commit -m "review: add iter spec reviews (Grok + Claude)"
echo "Reviews committed. Run triage next."
```

---

## Mode B: Parallel blind (both reviewers run simultaneously)

Both reviewers run blind at the same time. Faster. Less confirmation depth.
Use when iteration speed matters more than confirmation.

```bash
cd /home/k82l0804/workarea/fox/synapse

SPECS="specs/S-011-product-registration.md specs/S-012-daemon-engine.md \
       specs/S-013-signal-parser.md specs/S-014-human-gate.md \
       specs/S-015-artifact-index.md"
REF="specs/feature-spec-format.md specs/task-format.md \
     specs/pipeline-signal-protocol.md"

GROK_OUT="reviews/spec/$(date +%Y-%m-%dT%H-%M)_grok-spec-review.md"
CLAUDE_OUT="reviews/spec/$(date +%Y-%m-%dT%H-%M)_claude-spec-review.md"

GROK_PROMPT="You are a read-only adversarial spec reviewer (Reviewer 1, BLIND).
Read ALL of: $SPECS $REF. Do NOT read any prior reviews. Be adversarial.
Flag BLOCKING issues, WARNING gaps, and test coverage gaps per spec.
Write findings to $GROK_OUT. Verdict: APPROVE or REQUEST_CHANGES.
Do NOT edit any existing spec file."

CLAUDE_PROMPT="You are a read-only adversarial spec reviewer (Reviewer 2, BLIND).
Read ALL of: $SPECS $REF. Do NOT read any prior reviews. Be adversarial.
Flag BLOCKING issues, WARNING gaps, and test coverage gaps per spec.
Write findings to $CLAUDE_OUT. Verdict: APPROVE or REQUEST_CHANGES.
Do NOT edit any existing spec file."

# Launch both simultaneously (background)
timeout 600 grok --single "$GROK_PROMPT" --allow "Write($GROK_OUT)" &
GROK_PID=$!
timeout 600 claude -p "$CLAUDE_PROMPT" --allowedTools "Write" "Edit" &
CLAUDE_PID=$!

wait $GROK_PID && echo "Grok: done" || echo "Grok: FAILED ($?)"
wait $CLAUDE_PID && echo "Claude: done" || echo "Claude: FAILED ($?)"

GIT_TERMINAL_PROMPT=0 git add -A
GIT_TERMINAL_PROMPT=0 git commit -m "review: add iter spec reviews (Grok + Claude, parallel blind)"
```

---

## Verification pass (iter2) — after triage fixes applied

Run after applying triage recommendations, before re-approving at the gate.
Claude only (sees all prior reviews + triage doc). Required if iter1 had BLOCKINGs.

```bash
PRIOR_REVIEWS="reviews/spec/*.md reviews/triage/*triage*.md"
OUTFILE="reviews/spec/$(date +%Y-%m-%dT%H-%M)_claude-spec-review-iter2.md"

timeout 600 claude -p \
  "You are a read-only adversarial spec reviewer doing a verification pass (iter2).
   Read ALL of: specs/S-011..S-015, specs/feature-spec-format.md,
   specs/task-format.md, specs/pipeline-signal-protocol.md.
   ALSO read $PRIOR_REVIEWS (prior reviews and triage — verify fixes were
   correctly applied; find issues surface noise in iter1 obscured).
   Write findings to $OUTFILE.
   Verdict: APPROVE or REQUEST_CHANGES. Do NOT edit any existing spec file." \
  --allowedTools "Write" "Edit"
```

---

## What happens after reviews

1. AGY (you) reads both review files and synthesizes findings into a triage doc:
   `reviews/triage/$(date +%Y-%m-%dT%H-%M)_spec-triage.md`

2. Apply triage fixes to specs.

3. If fixes were BLOCKING: run verification pass (iter2) with Claude.

4. If APPROVE (or only INFO/WARNING remaining): set spec frontmatter
   `status: approved`, update `feature-registry.yaml`, and commit.

5. Advance pipeline to task-gen step.

---

## Output file locations

| File | Location |
|------|----------|
| Grok review | `reviews/spec/YYYY-MM-DDTHH-MM_grok-spec-review.md` |
| Claude review | `reviews/spec/YYYY-MM-DDTHH-MM_claude-spec-review.md` |
| Triage | `reviews/triage/YYYY-MM-DDTHH-MM_spec-triage.md` |
| Verification | `reviews/spec/YYYY-MM-DDTHH-MM_claude-spec-review-iter2.md` |

All files are committed to git — full audit trail of every finding.

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| Grok times out on 8 files | `timeout 600` minimum; Grok reads thoroughly |
| Claude creates no file | Check `--allowedTools "Write" "Edit"` is present |
| Both reviewers approve | Great — proceed to triage (confirm no open questions) |
| Conflicting BLOCKING findings | Escalate to human gate with both reviews attached |
