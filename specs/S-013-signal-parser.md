---
id: S-013
name: signal-parser
status: draft
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
- [ ] AC-3: Absent signal (last line does not match either signal pattern) → run status `failed`,
            `failure_reason = "SIGNAL_ABSENT: no valid signal on last line of artifact"`
- [ ] AC-4: Malformed signal: last line matches `<!--\s*(PIPELINE|TESTER)_SIGNAL` (with or without
            colon) but fails the full protocol regex → run status `failed`,
            `failure_reason = "SCHEMA_VIOLATION: signal present but malformed: <last_line_content>"`
            A line that does NOT match the signal-open pattern is SIGNAL_ABSENT, not SCHEMA_VIOLATION.
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

## DB Schema

This feature writes to the following `synapse.db` columns/tables:

```sql
-- signals table (insert one row per parsed signal)
signals (
  id           INTEGER PRIMARY KEY,
  run_id       TEXT NOT NULL,
  step_index   INTEGER NOT NULL,
  signal_type  TEXT NOT NULL,  -- 'PIPELINE' or 'TESTER'
  status       TEXT,           -- PIPELINE_SIGNAL: STATUS field
  auto_fix     INTEGER,        -- PIPELINE_SIGNAL: AUTO-FIX count
  escalate     INTEGER,        -- PIPELINE_SIGNAL: ESCALATE count
  pass         INTEGER,        -- TESTER_SIGNAL: PASS count
  fail         INTEGER,        -- TESTER_SIGNAL: FAIL count
  skipped      INTEGER,        -- TESTER_SIGNAL: SKIPPED count
  typecheck    TEXT,           -- TESTER_SIGNAL: TYPECHECK value
  raw_line     TEXT NOT NULL,  -- the full last line as read
  created_at   TEXT NOT NULL   -- ISO 8601
);

-- pipeline_runs column updated
pipeline_runs.last_signal  TEXT  -- set to signals.id of most recent parsed signal
```

## Test Contract

### MUST
- MUST: valid PIPELINE_SIGNAL on last line → parsed correctly with all fields
- MUST: valid TESTER_SIGNAL on last line → parsed correctly with all fields
- MUST: absent signal → `failure_reason = "SIGNAL_ABSENT: no valid signal on last line of artifact"`
- MUST: malformed signal → `failure_reason = "SCHEMA_VIOLATION: signal present but malformed: <line>"`
- MUST: signal mid-document (not last line) → treated as absent
- MUST: parser regex matches exactly the format in `specs/pipeline-signal-protocol.md`

### MUST NOT
- MUST NOT: retry or auto-fix a missing signal
- MUST NOT: accept a signal that has any extra text after the closing `-->`
- MUST NOT: accept a signal with fields in the wrong order

> **Implementation note (not a test assertion):** Implementations should use tail/seek
> for large files rather than reading the full file. This is an efficiency guideline, not
> an observable acceptance criterion.
