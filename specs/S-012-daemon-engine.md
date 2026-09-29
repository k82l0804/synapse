---
id: S-012
name: daemon-engine
status: approved
created: 2026-09-28
updated: 2026-09-29
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
stopped   — was `running`; halted by manual stop or daemon restart. `waiting` runs stay `waiting` on restart (GATE file remains; inbox still shows them).
done      — all steps completed successfully
failed    — terminal failure state; pipeline halts
```

**Signal-to-status transition table (B-2 fix):**

| Signal outcome | Run state transition | Notes |
|---|---|---|
| `STATUS=DONE` | `running → running` (next step) or `running → done` (after step 15) | Normal advance |
| `STATUS=PARTIAL` (steps 1–14) | `running → running` (next step) | Daemon logs warnings to run log; advances |
| `STATUS=PARTIAL` (step 15) | `running → failed` | `failure_reason = "unresolved BLOCKING findings"` — pipeline halts; no silent `done` with open BLOCKINGs |
| `STATUS=FAILED` | `running → failed` | Terminal; pipeline halts |
| `ESCALATE>0` | `running → waiting` | Ad-hoc gate: daemon writes GATE file mid-sequence |
| `SIGNAL_ABSENT` | `running → failed` | `failure_reason = "SIGNAL_ABSENT: ..."` |
| `SCHEMA_VIOLATION` | `running → failed` | `failure_reason = "SCHEMA_VIOLATION: ..."` |
| `TESTER FAIL>0` or `TYPECHECK=red` | `running → running` (loop back to step 12) | `iteration` incremented; at iteration ≥ 3 → `waiting` (ESCALATE gate) |

**Reject transition (B-4 fix):**
- `synapse approve <run-id>` → `waiting → running`, `current_step` unchanged, proceed to next step
- `synapse reject <run-id>` → `waiting → running`, `current_step` rewound to the gate's generator step:
  - SPEC GATE (step 4) → rewind to step 1 (`research-to-features`), `iteration` incremented
  - PLAN GATE (step 11) → rewind to step 8 (`make-plans`), `iteration` incremented
  The specialist at the rewound step reads `reviews/feedback/` before generating output.

**Protocol §7 counter ownership:** The daemon's HLT-5 state machine owns `current_step`,
`auto_fix_count`, `escalate_count`, and `iteration` on `pipeline_runs`. S-013 owns `last_signal`.

## User, Trigger, Outcome

- **User:** Developer whose repo is registered and has tasks in `tasks/current/`
- **Trigger:** `synapse start <product>` — or daemon process start after reboot
- **Visible Outcome:** Pipeline advances automatically. `synapse status <product>` shows
  the current step and status. When a gate is reached, the pipeline pauses and writes
  `.synapse/run/GATE-{run-id}.md`. When a specialist job completes, the next step starts
  automatically. On daemon restart after reboot, runs that were `running` are set to
  `stopped`; runs that were `waiting` remain `waiting` (GATE file stays on disk;
  `synapse inbox` still shows them). A `stopped` run requires `synapse resume` to
  continue unless `auto_resume: true` is set in `repos.yaml` (default: `false`).
- **Non-Goal:** No parallel execution (accelerate mode is a future feature). No GUI.
  No per-product separate daemon processes — one shared daemon for all products.

## Acceptance Criteria

- [ ] AC-1: `synapse start <product>` creates a pipeline run record and begins step 1
- [ ] AC-2: Each pipeline step spawns a specialist subprocess and waits for completion
- [ ] AC-3: After each step, the daemon reads the output artifact's signal and updates DB state
- [ ] AC-4: If a signal is absent or malformed, the run is marked `failed` and pipeline halts
- [ ] AC-5: `synapse status <product>` reflects the most recently committed step name and `pipeline_runs.status` from `synapse.db`
- [ ] AC-6: On daemon restart, runs that were `running` become `stopped`; `waiting` runs stay `waiting`; user must `synapse resume` (or `auto_resume: true`)
- [ ] AC-7: `synapse stop <product>` sets status to `stopping`; daemon finishes the current step then halts
- [ ] AC-8: Signal-driven state transitions: `STATUS=PARTIAL` on steps 1–14 advances the pipeline and logs a warning to the run log; `STATUS=PARTIAL` on step 15 sets run status to `failed` with `failure_reason = "unresolved BLOCKING findings"`; `ESCALATE>0` on any non-gate step triggers an ad-hoc gate (`running → waiting`)
- [ ] AC-9: Tester failure and reject: `TESTER FAIL>0` or `TYPECHECK=red` loops back to step 12 with `iteration` incremented; at iteration ≥ 3 escalates to a gate instead of looping; `synapse reject <run-id>` at SPEC GATE rewinds `current_step` to step 1; at PLAN GATE rewinds to step 8; `iteration` is incremented on reject

## High-Level Tasks

1. HLT-1: Implement daemon process entry point — reads DB on startup, sets `running` runs to `stopped`;
   `waiting` runs remain `waiting` (GATE file still on disk; `synapse inbox` still shows them)
2. HLT-2: Implement pipeline run creation — creates `pipeline_runs` record, resolves step sequence from the fixed step list above
3. HLT-3: Implement step executor — spawns `agent-job.sh` subprocess, captures output artifact path; after step completes calls S-015 incremental indexer on the artifact
4. HLT-4: Invoke S-013 `parseSignal(artifactPath)` on the output artifact; apply the signal-to-status
   transition table above to update DB run state
5. HLT-5: Implement run state machine — transitions per the table above; owns `current_step`,
   `auto_fix_count`, `escalate_count`, and `iteration` on `pipeline_runs`; handles reject rewind
6. HLT-6: Implement graceful stop — sets run status to `stopping`; daemon checks after each step completes before starting the next
7. HLT-7: Implement `synapse status` command — reads current run state from `pipeline_runs` in DB, prints step name and status

## Test Contract

### MUST
- MUST: starting a pipeline creates a `pipeline_runs` row with `status: running`
- MUST: each non-gate step spawns exactly one specialist subprocess
- MUST: absent or malformed signal causes run status to become `failed` (not `TASK_FAILED`)
- MUST: `STATUS=PARTIAL` on steps 1–14 advances the pipeline and writes a warning to the run log
- MUST: `STATUS=PARTIAL` on step 15 (code-triage) sets run status to `failed` with `failure_reason = "unresolved BLOCKING findings"` (pipeline cannot reach `done` with unresolved BLOCKINGs)
- MUST: `ESCALATE>0` on a non-gate step transitions `running → waiting` and writes a GATE file
- MUST: `TESTER FAIL>0` or `TYPECHECK=red` loops back to step 12 with `iteration` incremented
- MUST: at iteration ≥ 3 on a tester fail loop, escalate to a gate instead of looping
- MUST: `synapse reject` at SPEC GATE rewinds `current_step` to 1; at PLAN GATE rewinds to 8
- MUST: `synapse stop` halts after the current step completes (not mid-step)
- MUST: daemon restart sets `running` runs to `stopped`; `waiting` runs remain `waiting`
- MUST: `auto_resume: false` is the default; daemon does not auto-resume stopped runs

### MUST NOT
- MUST NOT: run multiple steps in parallel (serial mode only)
- MUST NOT: start a new step if the current step's signal is absent or `STATUS=FAILED`
- MUST NOT: delete or modify any artifact file produced by a specialist
- MUST NOT: require a GUI to start, stop, or monitor
- MUST NOT: stop `waiting` runs on restart (GATE file stays on disk; inbox still shows them)
