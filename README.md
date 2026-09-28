# Synapse

**Agentic pipeline orchestrator for artifact-driven, convergence-loop development.**

Synapse models software development as a graph of specialist agents converging
on correctness — not a linear DAG. Reviews loop back. Fixes trigger re-reviews.
The pipeline exits only when all signals are green.

## Architecture

```
Control Plane (AGY IDE)
  └── dispatches via agent-job.sh
        ├── grok          → Reviewer (read-only)
        ├── agy triage    → Decision-maker + auto-fixer
        ├── agy planner   → Task → Plan + spec + test contract
        ├── agy coder     → Plan → Code + tests
        └── agy tester    → Run → Pass/fail signal
```

## Self-hosting

Synapse uses itself to develop itself:
- `tasks/current/` — active Synapse development tasks
- `plans/current/` — implementation plans
- `docs/specs/`    — feature specs + agent context contracts
- The Synapse pipeline runs on the Synapse codebase

## Key Concepts

- **PIPELINE_SIGNAL** — structured output from triage: `AUTO-FIX=N ESCALATE=M`
- **TESTER_SIGNAL** — structured output from tester: `PASS=Y FAIL=N`
- **Test contracts** — planners write test shape; coders implement exactly those tests
- **Convergence loops** — review → triage → fix → re-review, until PASS

## Status

**Phase 1** — Self-hosting bootstrap (current). See `tasks/current/phase-1.md`.
