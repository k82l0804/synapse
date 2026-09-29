---
name: invoke-grok
description: >-
  Invoke Grok CLI for a single-turn non-interactive review task. Captures the
  correct flags, permission model, output file naming, and timeout for
  headless spec/plan/code reviews. Always run Grok BLIND (no prior reviews
  in context) as Reviewer 1.
---

# Invoke Grok (Reviewer 1 — Blind)

Grok is always **Reviewer 1** in the dual-reviewer pipeline. It runs blind —
no prior review output in context. Its value is independent discovery.

## Prerequisites

- `grok` CLI installed and authenticated
- Working directory set to the artifact directory (e.g., `synapse/specs/`)

## Invocation

```bash
cd <artifact-dir>
timeout 300 grok --single "<PROMPT>" \
  --allow "Write(<output-filename>)"
```

### Key flags

| Flag | Purpose |
|------|---------|
| `--single "<prompt>"` | Single-turn headless mode — prints response and exits |
| `--always-approve` | Auto-approve all tool executions (read + write) — **required** for headless use; without it Grok may stall waiting for read permissions |
| `--allow "Write(<file>)"` | Additional write-scope restriction (optional; `--always-approve` covers it) |
| `timeout 900` | Safety ceiling — 15 min; 10 min is too short for an 8-file deep review |

**Do NOT use** `grok` bare (launches interactive TUI — blocks terminal).

## Prompt templates

### Spec review (Reviewer 1, blind)

```
You are a read-only adversarial spec reviewer (Reviewer 1, BLIND).
Read ALL of these files: S-011-product-registration.md,
S-012-daemon-engine.md, S-013-signal-parser.md, S-014-human-gate.md,
S-015-artifact-index.md, feature-spec-format.md, task-format.md,
and pipeline-signal-protocol.md.
Do NOT read any prior reviews.
Be adversarial. Flag BLOCKING issues (ambiguous contracts, untestable MUSTs,
contradictions between documents), WARNING-level gaps, and test coverage gaps
per spec. Create <output-file> in this directory with your full findings.
Verdict at the end: APPROVE or REQUEST_CHANGES.
Do NOT edit any existing spec file.
```

### Plan review (Reviewer 1, blind)

```
You are a read-only adversarial plan reviewer (Reviewer 1, BLIND).
Read the plan: <plan-file>.md and its referenced spec: specs/<spec-file>.md.
Also read feature-spec-format.md and task-format.md.
Do NOT read any prior reviews.
Flag BLOCKING issues (plan diverges from spec, missing HLT coverage,
untestable acceptance criteria, architectural violations).
Create <output-file> in this directory with your findings.
Verdict: APPROVE or REQUEST_CHANGES.
Do NOT edit any existing file.
```

### Code review (Reviewer 1, single)

```
You are a read-only adversarial code reviewer.
Read the plan <plan-file>.md, the spec specs/<spec-file>.md,
and the implementation files listed in the plan's deliverables.
Flag BLOCKING issues (missing deliverables, MUST violations, broken tests),
WARNING gaps, and INFO notes.
Create <output-file> with findings. Do NOT edit any source file.
```

## Output file naming

```bash
# After grok completes, move to reviews/<type>/ with ISO timestamp:
git mv specs/<grok-output>.md reviews/spec/$(date +%Y-%m-%dT%H-%M)_grok-<type>-review.md
git add -A && git commit -m "review: add Grok spec review (Reviewer 1)"
```

## Full example

```bash
cd /home/k82l0804/workarea/fox/synapse/specs

timeout 300 grok --single \
  "You are a read-only adversarial spec reviewer (Reviewer 1, BLIND).
   Read ALL of these files: S-011-product-registration.md,
   S-012-daemon-engine.md, S-013-signal-parser.md, S-014-human-gate.md,
   S-015-artifact-index.md, feature-spec-format.md, task-format.md,
   and pipeline-signal-protocol.md. Do NOT read any prior reviews.
   Be adversarial. Create grok-spec-review.md with your findings.
   Verdict: APPROVE or REQUEST_CHANGES. Do NOT edit existing specs." \
  --allow "Write(grok-spec-review.md)"

git mv specs/grok-spec-review.md \
  reviews/spec/$(date +%Y-%m-%dT%H-%M)_grok-spec-review.md
```

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| Exit 0, no output, no file | Added `--allow` for wrong filename; check `--allow "Write(<exact-name>)"` |
| TUI launched | Used bare `grok` — use `grok --single` |
| Timeout hit | Increase to `timeout 600`; normal for 8+ file reviews |
