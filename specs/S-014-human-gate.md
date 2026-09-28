---
id: S-014
name: human-gate
status: approved
created: 2026-09-28
updated: 2026-09-28
author: research-to-features
feature_registry_ref: S-014
---

## Overview

The human gate is the pipeline's approval mechanism. When the daemon reaches a step
that requires human review (spec gate, plan gate), it writes a `WAITING` file to
`.synapse/run/` and pauses. The developer sees the gate via `synapse inbox`, reads
the artifact (spec, plan, or review), and either approves or rejects with a mandatory
note. Approval advances the pipeline. Rejection writes a feedback file to
`reviews/feedback/` and triggers the relevant specialist to regenerate. An empty
reject is forbidden — the `--note` flag is required.

## User, Trigger, Outcome

- **User:** Developer who is the human approver in the pipeline
- **Trigger:** Daemon enters `GATE_WAITING` state — written to `.synapse/run/WAITING`
- **Visible Outcome:**
  - `synapse inbox` lists the waiting gate with run-id, product, gate type, and artifact path
  - `synapse approve <run-id>` → pipeline advances to next step, WAITING file deleted
  - `synapse reject <run-id> --note "..."` → feedback file written to `reviews/feedback/`,
    specialist regenerates, new WAITING appears when artifact is ready
  - `synapse reject <run-id>` without `--note` → exits non-zero with error "rejection requires --note"
- **Non-Goal:** No desktop notifications — developer polls `synapse inbox` or sets up a
  filesystem watcher themselves. No GUI approval flow. No auto-approve.

## Acceptance Criteria

- [ ] AC-1: `synapse inbox` lists all `GATE_WAITING` items across all products with run-id and artifact path
- [ ] AC-2: `synapse approve <run-id>` advances the pipeline and deletes the `WAITING` file
- [ ] AC-3: `synapse reject <run-id> --note "text"` writes a feedback file to `reviews/feedback/` and triggers regeneration
- [ ] AC-4: `synapse reject <run-id>` without `--note` exits non-zero with a clear error (empty reject forbidden)
- [ ] AC-5: `synapse inbox --count` prints only the integer count of waiting gates (for scripting)
- [ ] AC-6: Approving a non-existent or already-approved run-id exits non-zero with a clear error

## High-Level Tasks

1. HLT-1: Implement WAITING file writer — daemon writes `.synapse/run/WAITING` with gate metadata on `GATE_WAITING` state entry
2. HLT-2: Implement `synapse inbox` — scans all WAITING files across products, formats output
3. HLT-3: Implement `synapse approve` — validates run-id, transitions pipeline state, deletes WAITING file
4. HLT-4: Implement `synapse reject` — validates `--note` required, writes feedback file to `reviews/feedback/`, triggers regeneration
5. HLT-5: Implement `synapse inbox --count` — prints integer count only
6. HLT-6: Implement error handling — unknown run-id, already-approved, missing note → non-zero exit with message

## Test Contract

### MUST
- MUST: `synapse inbox` shows all waiting gates with run-id and artifact path
- MUST: `synapse approve <run-id>` deletes the WAITING file and advances pipeline
- MUST: `synapse reject <run-id> --note "..."` writes a feedback file with the note text
- MUST: rejection without `--note` exits non-zero
- MUST: `synapse inbox --count` output is parseable as an integer (no extra text)

### MUST NOT
- MUST NOT: allow empty `--note` (e.g., `--note ""`) — must be non-empty
- MUST NOT: auto-approve any gate
- MUST NOT: delete WAITING file on reject (gate stays open until specialist regenerates)
- MUST NOT: require network access or a running GUI
