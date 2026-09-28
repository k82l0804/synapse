---
id: S-013
name: signal-parser
status: approved
created: 2026-09-28
updated: 2026-09-28
author: research-to-features
feature_registry_ref: S-013
---

## Overview

The signal parser is the daemon's mechanism for reading agent job results. After a
specialist subprocess completes, the daemon reads the last line of the output artifact
file and parses it as either a `PIPELINE_SIGNAL` or `TESTER_SIGNAL` per the grammar
defined in `specs/pipeline-signal-protocol.md`. The parsed signal updates `synapse.db`
and determines the next pipeline action. A signal that is absent, malformed, or not on
the last line causes the run to be marked `TASK_FAILED` immediately — no retries, no
guessing, no "close enough."

## User, Trigger, Outcome

- **User:** The daemon (internal component — not directly user-facing)
- **Trigger:** A specialist subprocess writes its output artifact and exits
- **Visible Outcome:** `synapse status` reflects the correct next state (advancing, waiting,
  or failed) immediately after the subprocess exits. `synapse.db` signals table contains
  a parsed row with `auto_fix`, `escalate`, `pass`, `fail`, `skipped`, `typecheck` fields.
  If signal is absent: `synapse status` shows `TASK_FAILED` with reason `SIGNAL_ABSENT`.
  If malformed: `TASK_FAILED` with reason `SCHEMA_VIOLATION: <last-line-content>`.
- **Non-Goal:** Does not validate the content of the artifact beyond the last line.
  Does not retry failed signals automatically. Does not support signals anywhere except the last line.

## Acceptance Criteria

- [ ] AC-1: A valid `PIPELINE_SIGNAL` on the last line is parsed and stored in `synapse.db`
- [ ] AC-2: A valid `TESTER_SIGNAL` on the last line is parsed and stored in `synapse.db`
- [ ] AC-3: Absent signal (last line does not match either pattern) → run status `TASK_FAILED`,
            `failure_reason = "SIGNAL_ABSENT"`
- [ ] AC-4: Malformed signal (last line starts with `<!-- PIPELINE_SIGNAL` or `<!-- TESTER_SIGNAL`
            but fails full regex parse) → run status `TASK_FAILED`, `failure_reason = "SCHEMA_VIOLATION: <line>"`
- [ ] AC-5: Signal embedded mid-document (not last line) is ignored — treated as absent
- [ ] AC-6: Parser correctly extracts all fields: `STATUS`, `AUTO-FIX`, `ESCALATE` (PIPELINE_SIGNAL)
            and `PASS`, `FAIL`, `SKIPPED`, `TYPECHECK` (TESTER_SIGNAL)

## High-Level Tasks

1. HLT-1: Implement `readLastLine(filePath)` — reads only the last line of a file (efficient, no full read)
2. HLT-2: Implement `parsePipelineSignal(line)` — regex parse, returns typed result or null
3. HLT-3: Implement `parseTesterSignal(line)` — regex parse, returns typed result or null
4. HLT-4: Implement `parseSignal(artifactPath)` — calls readLastLine, tries both parsers, returns result with type
5. HLT-5: Implement failure classification — maps absent/malformed to `SIGNAL_ABSENT` / `SCHEMA_VIOLATION`
6. HLT-6: Implement DB write — inserts parsed signal into `signals` table, updates `pipeline_runs.last_signal`

## Test Contract

### MUST
- MUST: valid PIPELINE_SIGNAL on last line → parsed correctly with all fields
- MUST: valid TESTER_SIGNAL on last line → parsed correctly with all fields
- MUST: absent signal → `SIGNAL_ABSENT` failure, not a parse error
- MUST: malformed signal → `SCHEMA_VIOLATION` failure with the offending line in the reason
- MUST: signal mid-document (not last line) → treated as absent
- MUST: parser regex matches exactly the format in `specs/pipeline-signal-protocol.md`

### MUST NOT
- MUST NOT: read the entire file to find the signal (must use tail/seek for efficiency)
- MUST NOT: retry or auto-fix a missing signal
- MUST NOT: accept a signal that has any extra text after the closing `-->`
- MUST NOT: accept a signal with fields in the wrong order
