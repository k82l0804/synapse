---
name: invoke-claude
description: >-
  Invoke Claude Code CLI for a single-turn non-interactive review task.
  Captures the correct flags, model selection by artifact type, output file
  naming, and timeout. Claude is always Reviewer 2 — it sees Reviewer 1
  (Grok)'s output before running, unless running in parallel blind mode.
---

# Invoke Claude (Reviewer 2)

Claude is always **Reviewer 2** in the dual-reviewer pipeline. It sees Grok's
output (Reviewer 1) before running so it can confirm findings AND go deeper
on gaps. Exception: parallel blind mode (both reviewers run simultaneously,
both blind) trades confirmation depth for speed.

## Prerequisites

- `claude` CLI installed and authenticated (`claude --version`)
- Working directory set to the repo root or artifact directory

## Model selection by artifact type

| Artifact | Claude model | Rationale |
|----------|-------------|-----------|
| **Specs** | `claude-opus-4-5` (Fable) | Highest stakes; finds state machine gaps and edge cases |
| **Plans** | `claude-opus-5-0` (Opus 5) | Complex but scoped; Opus 5 sufficient |
| Code | `claude-sonnet-5-0` (Sonnet 5) | Tests carry the load; one review sufficient |
| Tasks | `claude-sonnet-5-0` (Sonnet 5) | Mechanical; low bug surface |

> **Note:** Model names change. Check `claude models` for current names.
> Fable = highest capability model. Opus 5 = second tier. Sonnet 5 = third tier.

## Invocation

```bash
# Compute output path BEFORE launching (timestamp locks in)
OUTFILE="reviews/<type>/$(date +%Y-%m-%dT%H-%M)_claude-<type>-review.md"

timeout 900 claude --model claude-opus-4-5 -p "<PROMPT — include $OUTFILE>" \
  --allowedTools "Read" "Write" "Edit"
```

### Key flags

| Flag | Purpose |
|------|---------|
| `-p "<prompt>"` | Single-turn pipeline mode — runs and exits |
| `--model claude-opus-4-5` | Explicit model selection — **required**; omitting uses the default which may not be the intended tier |
| `--allowedTools "Read" "Write" "Edit"` | Each tool as a separate quoted string — **"Read" is mandatory**; without it Claude cannot read input files and hangs silently for the entire timeout |
| `timeout 900` | Safety ceiling — 15 min; Opus reviews of 8+ files take 10-12 min |

**Do NOT add** `--output-format text` when using `--allowedTools Write` — Claude
writes the file via tool calls; `--output-format text` is only needed when you
want stdout output instead.

## Output file naming

Always compute the timestamp **before** launching so the filename is known
ahead of time and can be included in the prompt:

```bash
OUTFILE="reviews/spec/$(date +%Y-%m-%dT%H-%M)_claude-spec-review.md"
timeout 900 claude --model claude-opus-4-5 -p "...write findings to $OUTFILE..." \
  --allowedTools "Read" "Write" "Edit"
```

This writes directly to the final location — no `git mv` needed, no overwrite risk.

## Prompt templates

### Spec review — Reviewer 2 (sees Grok)

```
You are a read-only adversarial spec reviewer (Reviewer 2).
Read ALL of these files: S-011-product-registration.md,
S-012-daemon-engine.md, S-013-signal-parser.md, S-014-human-gate.md,
S-015-artifact-index.md, feature-spec-format.md, task-format.md,
and pipeline-signal-protocol.md.
ALSO read <grok-review-file> (Reviewer 1 findings — confirm + extend, go
deeper on gaps, do not just re-list Grok's findings).
Be adversarial. Flag BLOCKING issues, WARNING gaps, and test coverage gaps.
Write your full findings to <OUTFILE>.
Verdict at end: APPROVE or REQUEST_CHANGES.
Do NOT edit any existing spec file.
```

### Spec review — Blind (parallel mode)

Same prompt but omit the "ALSO read" line. Use when running Grok and Claude
simultaneously for speed, accepting that Claude won't confirm Grok's findings.

### Plan review — Reviewer 2 (sees Grok)

```
You are a read-only adversarial plan reviewer (Reviewer 2).
Read the plan <plan-file>.md, spec specs/<spec-file>.md,
feature-spec-format.md, and task-format.md.
ALSO read <grok-plan-review-file> (Reviewer 1 findings — confirm + extend).
Flag BLOCKING issues, WARNING gaps, and test coverage gaps.
Write findings to <OUTFILE>.
Verdict: APPROVE or REQUEST_CHANGES. Do NOT edit any existing file.
```

## Full example — spec review (Reviewer 2, sees Grok)

```bash
cd /home/k82l0804/workarea/fox/synapse

GROK_REVIEW="reviews/spec/2026-09-29T00-30_grok-spec-review.md"  # already written
OUTFILE="reviews/spec/$(date +%Y-%m-%dT%H-%M)_claude-spec-review.md"

timeout 900 claude --model claude-opus-4-5 -p \
  "You are a read-only adversarial spec reviewer (Reviewer 2).
   Read ALL of: specs/S-011-product-registration.md,
   specs/S-012-daemon-engine.md, specs/S-013-signal-parser.md,
   specs/S-014-human-gate.md, specs/S-015-artifact-index.md,
   specs/feature-spec-format.md, specs/task-format.md,
   specs/pipeline-signal-protocol.md.
   ALSO read $GROK_REVIEW (Reviewer 1 — confirm + extend).
   Create $OUTFILE with your full findings.
   Verdict: APPROVE or REQUEST_CHANGES. Do NOT edit any existing spec." \
  --allowedTools "Read" "Write" "Edit"
```

## Full example — spec review (blind, parallel with Grok)

```bash
cd /home/k82l0804/workarea/fox/synapse

OUTFILE="reviews/spec/$(date +%Y-%m-%dT%H-%M)_claude-spec-review.md"

# Run simultaneously with Grok (both blind)
timeout 900 claude --model claude-opus-4-5 -p \
  "You are a read-only adversarial spec reviewer (Reviewer 2, BLIND).
   Read ALL of: specs/S-011..S-015, specs/feature-spec-format.md,
   specs/task-format.md, specs/pipeline-signal-protocol.md.
   Do NOT read any prior reviews.
   Create $OUTFILE with your full findings.
   Verdict: APPROVE or REQUEST_CHANGES. Do NOT edit any existing spec." \
  --allowedTools "Read" "Write" "Edit"
```

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| **Hangs for full timeout, no file** | Missing `"Read"` in `--allowedTools` — Claude can't read input files without it. Must be `--allowedTools "Read" "Write" "Edit"` (each tool separately quoted) |
| Exit 0, no output, no file created | Remove `--output-format text`; Claude writes files via tool calls |
| Exit 0, stdout output, no file | Add `--allowedTools "Read" "Write" "Edit"` |
| Billing/rate limit error | Switch to lower model tier (Opus 5 → Sonnet 5) |
| Runs in ~3 seconds with no review | CLI not authenticated or model unavailable; check `claude -p "hello"` |
| Wrong model used | Always pass `--model` explicitly; omitting it uses the CLI default which may not match the review tier |
