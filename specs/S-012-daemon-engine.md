---
id: S-012
name: daemon-engine
status: draft
created: 2026-09-28
updated: 2026-09-28
author: research-to-features
feature_registry_ref: S-012
depends_on: [S-013, S-015]
---

## Overview

The daemon engine is the heart of Synapse. It is a single long-running process that
manages pipeline runs for all registered products. When started (`synapse start <product>`),
it creates a `pipeline_run` record in `synapse.db`, then advances the pipeline step by step:
spawning specialist subprocesses (agy or grok via `agent-job.sh`), waiting for each to
complete, reading the output artifact's signal via the S-013 signal parser, and transitioning
state accordingly. The daemon survives restarts by reading DB state on startup. It runs in
serial mode by default (one task at a time, dependency order).

## Pipeline Step Sequence

The daemon executes steps in this fixed order. Each step's role and signal type is shown:

```
Step  Name                  Role        Signal type       Gate?
1     research-to-features  Architect   PIPELINE_SIGNAL   No
2     spec-review           Reviewer    PIPELINE_SIGNAL   No
3     spec-triage           Architect   PIPELINE_SIGNAL   No
4     [SPEC GATE]           Approver    —                 YES
5     task-gen              Planner     PIPELINE_SIGNAL   No
6     task-review           Reviewer    PIPELINE_SIGNAL   No
7     task-triage           Planner     PIPELINE_SIGNAL   No
8     make-plans            Planner     PIPELINE_SIGNAL   No
9     plan-review           Reviewer    PIPELINE_SIGNAL   No
10    plan-triage           Planner     PIPELINE_SIGNAL   No
11    [PLAN GATE]           Approver    —                 YES
12    implement             Coder       PIPELINE_SIGNAL   No
13    test-cycle            Coder       TESTER_SIGNAL     No
14    code-review           Reviewer    PIPELINE_SIGNAL   No
15    code-triage           Planner     PIPELINE_SIGNAL   No
```

Gate steps pause the daemon and write `.synapse/run/GATE-{run-id}.md`. Non-gate steps
proceed automatically based on the signal from the previous step.

## Run Status Enum

All run status values across the daemon use this single enum:

```
idle      — product registered, no pipeline run started
running   — a step is actively executing
waiting   — daemon paused at a gate (GATE file written)
stopping  — stop requested; daemon will halt after current step
stopped   — was running or waiting; halted (manual stop or restart)
done      — all steps completed successfully
failed    — a step produced SIGNAL_ABSENT or SCHEMA_VIOLATION
```

`TASK_FAILED` in signals maps to run status `failed`. There is no other run status.

## User, Trigger, Outcome

- **User:** Developer whose repo is registered and has tasks in `tasks/current/`
- **Trigger:** `synapse start <product>` — or daemon process start after reboot
- **Visible Outcome:** Pipeline advances automatically. `synapse status <product>` shows
  the current step and status. When a gate is reached, the pipeline pauses and writes
  `.synapse/run/GATE-{run-id}.md`. When a specialist job completes, the next step starts
  automatically. On daemon restart after reboot, runs that were `running` or `waiting` are
  set to `stopped` — user must explicitly `synapse resume` unless `auto_resume: true` is
  set in the product's entry in `repos.yaml` (default: `false`).
- **Non-Goal:** No parallel execution (accelerate mode is a future feature). No GUI.
  No per-product separate daemon processes — one shared daemon for all products.

## Acceptance Criteria

- [ ] AC-1: `synapse start <product>` creates a pipeline run record and begins step 1
- [ ] AC-2: Each pipeline step spawns a specialist subprocess and waits for completion
- [ ] AC-3: After each step, the daemon reads the output artifact's signal and updates DB state
- [ ] AC-4: If a signal is absent or malformed, the run is marked `TASK_FAILED` and pipeline halts
- [ ] AC-5: `synapse status <product>` reflects the most recently committed step name and `pipeline_runs.status` from `synapse.db`
- [ ] AC-6: On daemon restart, runs that were `running` become `stopped`; user must `synapse resume`
- [ ] AC-7: `synapse stop <product>` sets status to `stopping`; daemon finishes the current step then halts

## High-Level Tasks

1. HLT-1: Implement daemon process entry point — reads DB on startup, sets any `running`/`waiting` runs to `stopped`
2. HLT-2: Implement pipeline run creation — creates `pipeline_runs` record, resolves step sequence from the fixed step list above
3. HLT-3: Implement step executor — spawns `agent-job.sh` subprocess, captures output artifact path; after step completes calls S-015 incremental indexer on the artifact
4. HLT-4: Invoke S-013 `parseSignal(artifactPath)` on the output artifact, apply the result to update DB run state
5. HLT-5: Implement run state machine — transitions using the status enum above: `running → waiting` (gate), `waiting → running` (approve/reject), `running → done/failed`
6. HLT-6: Implement graceful stop — sets run status to `stopping`; daemon checks after each step completes before starting the next
7. HLT-7: Implement `synapse status` command — reads current run state from `pipeline_runs` in DB, prints step name and status

## Test Contract

### MUST
- MUST: starting a pipeline creates a `pipeline_runs` row with `status: running`
- MUST: each step spawns exactly one specialist subprocess
- MUST: absent or malformed signal causes run status to become `TASK_FAILED`
- MUST: `synapse stop` halts after the current step completes (not mid-step)
- MUST: daemon restart sets `running` runs to `stopped` (no auto-resume by default)

### MUST NOT
- MUST NOT: run multiple steps in parallel (serial mode only)
- MUST NOT: start a new step if the current step's signal is absent
- MUST NOT: delete or modify any artifact file produced by a specialist
- MUST NOT: require a GUI to start, stop, or monitor
