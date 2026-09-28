---
id: S-012
name: daemon-engine
status: draft
created: 2026-09-28
updated: 2026-09-28
author: research-to-features
feature_registry_ref: S-012
---

## Overview

The daemon engine is the heart of Synapse. It is a single long-running process that
manages pipeline runs for all registered products. When started (`synapse start <product>`),
it creates a `pipeline_run` record in `synapse.db`, then advances the pipeline step by step:
spawning specialist subprocesses (agy or grok via `agent-job.sh`), waiting for each to
complete, reading the output artifact's PIPELINE_SIGNAL or TESTER_SIGNAL, and transitioning
state accordingly. The daemon survives restarts by reading DB state on startup. It runs in
serial mode by default (one task at a time, dependency order).

## User, Trigger, Outcome

- **User:** Developer whose repo is registered and has tasks in `tasks/current/`
- **Trigger:** `synapse start <product>` — or daemon process start after reboot
- **Visible Outcome:** Pipeline advances automatically. `synapse status <product>` shows
  the current step and status. When a gate is reached, the pipeline pauses and writes
  `.synapse/run/WAITING`. When a specialist job completes, the next step starts automatically.
  On daemon restart after reboot, runs that were `running` are set to `stopped` — user
  must explicitly `synapse resume` (unless `auto_resume` is set in the product config).
- **Non-Goal:** No parallel execution (accelerate mode is a future feature). No GUI.
  No per-product separate daemon processes — one shared daemon for all products.

## Acceptance Criteria

- [ ] AC-1: `synapse start <product>` creates a pipeline run record and begins step 1
- [ ] AC-2: Each pipeline step spawns a specialist subprocess and waits for completion
- [ ] AC-3: After each step, the daemon reads the output artifact's signal and updates DB state
- [ ] AC-4: If a signal is absent or malformed, the run is marked `TASK_FAILED` and pipeline halts
- [ ] AC-5: `synapse status <product>` reflects the current step name and status in real time
- [ ] AC-6: On daemon restart, runs that were `running` become `stopped`; user must `synapse resume`
- [ ] AC-7: `synapse stop <product>` sets status to `stopping`; daemon finishes the current step then halts

## High-Level Tasks

1. HLT-1: Implement daemon process entry point — reads DB on startup, recovers interrupted runs
2. HLT-2: Implement pipeline run creation — creates `pipeline_runs` record, resolves step sequence
3. HLT-3: Implement step executor — spawns `agent-job.sh` subprocess, captures output path
4. HLT-4: Implement signal reader — reads last line of output artifact, parses signal, updates DB
5. HLT-5: Implement run state machine — transitions: `running → waiting → running → done/failed`
6. HLT-6: Implement graceful stop — sets `stopping` flag, daemon checks after each step completes
7. HLT-7: Implement `synapse status` command — reads current run state from DB, prints formatted output

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
