# Pipeline Signal Protocol

> **Status:** Frozen — Layer 0 protocol document. Do not modify without a phase task.  
> **Purpose:** Defines the machine-readable signal grammar that the Synapse daemon
> uses to determine job success, failure, and next action.

---

## 1. Overview

Every agent job (coder, tester, reviewer, triage) MUST emit exactly one signal
as the **last line** of its output artifact. The daemon reads this signal to
determine state transitions. If the signal is absent or malformed, the job is
marked as failed — no exceptions.

```
Agent writes artifact → Signal is last line → Daemon parses → State transition
```

Two signal types:

| Signal | Producer | Purpose |
|--------|----------|---------|
| `PIPELINE_SIGNAL` | Coder, triage, review agents | Report completion status and auto-fix/escalation counts |
| `TESTER_SIGNAL` | Test runner (run-tests skill) | Report test suite results |

---

## 2. PIPELINE_SIGNAL

### 2.1 Grammar

```
<!-- PIPELINE_SIGNAL: STATUS={status} AUTO-FIX={n} ESCALATE={m} -->
```

Placed as an HTML comment so it renders invisibly in markdown previews.

**Field definitions:**

| Field | Type | Required | Values |
|-------|------|----------|--------|
| `STATUS` | enum | YES | `DONE`, `PARTIAL`, `FAILED` |
| `AUTO-FIX` | integer ≥ 0 | YES | Count of findings auto-fixed in this pass |
| `ESCALATE` | integer ≥ 0 | YES | Count of findings escalated to human |

**STATUS values:**

| Value | Meaning | Daemon action |
|-------|---------|--------------|
| `DONE` | Job completed successfully | Advance to next pipeline step |
| `PARTIAL` | Job completed but with warnings | Advance; log warnings to run log |
| `FAILED` | Job failed; cannot proceed | Mark job failed; notify inbox |

### 2.2 Placement Rule

The signal MUST be the **absolute last line** of the artifact file — nothing after it.

```markdown
# Triage Report: T-1-3 iter1

... (triage findings and auto-fix notes) ...

All BLOCKING findings resolved. 1 WARNING deferred to tasks/deferred/.

<!-- PIPELINE_SIGNAL: STATUS=DONE AUTO-FIX=2 ESCALATE=0 -->
```

A signal appearing anywhere other than the last line is treated as absent (job fails).

### 2.3 Examples

```
<!-- PIPELINE_SIGNAL: STATUS=DONE AUTO-FIX=0 ESCALATE=0 -->
<!-- PIPELINE_SIGNAL: STATUS=DONE AUTO-FIX=3 ESCALATE=1 -->
<!-- PIPELINE_SIGNAL: STATUS=FAILED AUTO-FIX=0 ESCALATE=0 -->
<!-- PIPELINE_SIGNAL: STATUS=PARTIAL AUTO-FIX=1 ESCALATE=0 -->
```

### 2.4 Parser Regex (reference implementation)

```typescript
const PIPELINE_SIGNAL_RE =
  /^<!--\s*PIPELINE_SIGNAL:\s*STATUS=(\w+)\s+AUTO-FIX=(\d+)\s+ESCALATE=(\d+)\s*-->$/;
```

---

## 3. TESTER_SIGNAL

### 3.1 Grammar

```
<!-- TESTER_SIGNAL: PASS={p} FAIL={f} SKIPPED={s} TYPECHECK={typecheck} -->
```

**Field definitions:**

| Field | Type | Required | Values |
|-------|------|----------|--------|
| `PASS` | integer ≥ 0 | YES | Count of passing tests |
| `FAIL` | integer ≥ 0 | YES | Count of failing tests |
| `SKIPPED` | integer ≥ 0 | YES | Count of skipped tests |
| `TYPECHECK` | enum | YES | `green` or `red` |

**Daemon interpretation:**

| Condition | Daemon action |
|-----------|--------------|
| `FAIL=0` AND `TYPECHECK=green` | Tests pass — advance pipeline |
| `FAIL>0` OR `TYPECHECK=red` | Tests fail — trigger fix-tests cycle |
| `FAIL>0` AND fix-tests iter ≥ 3 | Escalate to human inbox |

### 3.2 Placement Rule

Same as PIPELINE_SIGNAL: MUST be the absolute last line of the test output artifact.

```markdown
# Test Run: T-1-3

## Typecheck

```
tsc --noEmit: 0 errors
```

## Test Results

```
✓ toggleChangesCssClass (12ms)
✓ persistenceAfterReload (8ms)
✓ noReloadOnToggle (5ms)
```

3 passed, 0 failed

<!-- TESTER_SIGNAL: PASS=3 FAIL=0 SKIPPED=0 TYPECHECK=green -->
```

### 3.3 Examples

```
<!-- TESTER_SIGNAL: PASS=42 FAIL=0 SKIPPED=2 TYPECHECK=green -->
<!-- TESTER_SIGNAL: PASS=39 FAIL=3 SKIPPED=0 TYPECHECK=red -->
<!-- TESTER_SIGNAL: PASS=0 FAIL=0 SKIPPED=0 TYPECHECK=red -->
```

### 3.4 Parser Regex (reference implementation)

```typescript
const TESTER_SIGNAL_RE =
  /^<!--\s*TESTER_SIGNAL:\s*PASS=(\d+)\s+FAIL=(\d+)\s+SKIPPED=(\d+)\s+TYPECHECK=(green|red)\s*-->$/;
```

---

## 4. Absence and Malformation Handling

### 4.1 Signal Absent

If the daemon reads a job's output artifact and finds no valid signal on the last line:

```
job.status = "TASK_FAILED"
job.failure_reason = "SIGNAL_ABSENT: no valid signal on last line of artifact"
```

The pipeline halts for this task. The job appears in `synapse inbox` as failed.
The agent is NOT retried automatically — human review required.

### 4.2 Signal Malformed

If the last line matches `<!-- PIPELINE_SIGNAL` or `<!-- TESTER_SIGNAL` but fails
the full regex parse:

```
job.status = "TASK_FAILED"
job.failure_reason = "SCHEMA_VIOLATION: signal present but malformed: {last_line}"
```

Same handling as absent — pipeline halts, appears in inbox.

### 4.3 Signal in Wrong Position

If a valid signal appears mid-document (not last line), it is treated as absent.
The daemon reads only the last line. This enforces the placement rule without
scanning the entire document.

---

## 5. Agent Instructions

Every agent that produces an output artifact MUST:

1. Write the full artifact content
2. Add one blank line before the signal
3. Write the signal as the absolute last line — nothing after, including trailing newlines

```python
# Pseudocode for any agent producing an artifact
artifact_content = build_artifact_body()
signal = build_signal(status="DONE", auto_fix=n, escalate=m)
write_file(path, artifact_content + "\n" + signal + "\n")
```

> [!CAUTION]
> Do NOT add any content after the signal — not a summary, not a closing note,
> not a "---" separator. The daemon reads only the last line. Anything after the
> signal will cause SIGNAL_ABSENT failure.

---

## 6. Review Agent Signals

Grok review agents also emit PIPELINE_SIGNAL. The values are interpreted as:

| Grok output | STATUS | AUTO-FIX | ESCALATE |
|-------------|--------|----------|----------|
| All findings INFO/WARNING, verdict APPROVE | `DONE` | `0` | `0` |
| BLOCKING findings found, verdict REQUEST_CHANGES | `PARTIAL` | `0` | `0` |
| Cannot determine verdict | `FAILED` | `0` | `0` |

Note: Grok sets `AUTO-FIX=0` always — Grok is read-only and never auto-fixes.
The triage agent (AGY) sets `AUTO-FIX=N` after processing Grok's review.

---

## 7. Signal Iteration Tracking

The daemon tracks iteration counts per pipeline run in `pipeline_runs`:

```sql
-- pipeline_runs table (relevant columns)
current_step     TEXT     -- e.g. "triage"
auto_fix_count   INTEGER  -- cumulative AUTO-FIX across iterations
escalate_count   INTEGER  -- cumulative ESCALATE across iterations
iteration        INTEGER  -- current iteration number (starts at 1)
```

**Max iterations:** 3 auto-fix iterations before mandatory escalation.
After iteration 3 with `FAIL>0` or `ESCALATE>0`: job marked `ESCALATED`,
appears in inbox, pipeline pauses.
