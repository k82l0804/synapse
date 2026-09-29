---
id: S-014
name: human-gate
status: draft
created: 2026-09-28
updated: 2026-09-28
author: research-to-features
feature_registry_ref: S-014
depends_on: [S-012]
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
- **Trigger:** Daemon enters run status `waiting` — daemon writes `.synapse/run/GATE-{run-id}.md`
- **Visible Outcome:**
  - `synapse inbox` lists all pending gates across all products by scanning `.synapse/run/GATE-*.md`,
    showing run-id, product name, gate type, and artifact path for each
  - `synapse approve <run-id>` → pipeline advances to next step; daemon deletes the GATE file
    and sets run status `waiting → running`
  - `synapse reject <run-id> --note "..."` → feedback file written to `reviews/feedback/`;
    daemon sets run status `waiting → running` and rewinds `current_step` per the
    S-012 reject rule (SPEC GATE → step 1; PLAN GATE → step 8; `iteration` incremented);
    the specialist at the rewound step reads `reviews/feedback/` before generating output;
    a new GATE file appears when the regenerated artifact reaches the gate again
  - `synapse reject <run-id>` without `--note` → exits non-zero: "rejection requires --note"
  - `synapse reject <run-id> --note ""` or `--note "   "` → exits non-zero: "note must not be empty"
- **Non-Goal:** No desktop notifications — developer polls `synapse inbox` or sets up a
  filesystem watcher themselves. No GUI approval flow. No auto-approve.
  Gate file naming: each gate is a separate `.synapse/run/GATE-{run-id}.md` file;
  a single pipeline run has at most one GATE file at a time (serial mode invariant).

## Acceptance Criteria

- [ ] AC-1: `synapse inbox` lists all `.synapse/run/GATE-*.md` items across all products, showing run-id, product name, gate type, and artifact path
- [ ] AC-2: `synapse approve <run-id>` deletes the GATE file and advances the pipeline (run status `waiting → running`)
- [ ] AC-3: `synapse reject <run-id> --note "text"` writes a feedback file to `reviews/feedback/` and sets run status `waiting → running` for re-dispatch
- [ ] AC-4: `synapse reject <run-id>` without `--note` exits non-zero with a clear error
- [ ] AC-5: `synapse inbox --count` prints only the integer count of waiting gates (for scripting)
- [ ] AC-6: Approving or rejecting a non-existent or already-resolved run-id exits non-zero with a clear error

## High-Level Tasks

1. HLT-1: Implement GATE file writer — daemon writes `.synapse/run/GATE-{run-id}.md` with this
   frontmatter: `run_id`, `product`, `gate_type` (`spec|plan`), `artifact_path`, `created_at` (ISO 8601).
   **Inbox authority:** `synapse inbox` lists GATE files whose `pipeline_runs.status = 'waiting'`
   (DB is authoritative); a GATE file with status `running` or `stopped` in DB is not shown.
2. HLT-2: Implement `synapse inbox` — scans `.synapse/run/GATE-*.md`, filters to DB-confirmed `waiting` runs,
   formats output with run-id, product, gate type, artifact path
3. HLT-3: Implement `synapse approve` — validates run-id, deletes GATE file, sets run status `waiting → running`
4. HLT-4: Implement `synapse reject` — validates `--note` (required, non-empty after trim), writes feedback file to `reviews/feedback/`, sets run status `waiting → running`
5. HLT-5: Implement `synapse inbox --count` — prints integer count only
6. HLT-6: Implement error handling — unknown run-id, already-resolved, missing/empty note → non-zero exit with message

## Test Contract

### MUST
- MUST: `synapse inbox` shows all waiting gates with run-id, product name, gate type, and artifact path
- MUST: `synapse approve <run-id>` deletes the GATE-{run-id}.md file and advances pipeline
- MUST: `synapse reject <run-id> --note "..."` writes a feedback file containing the note text
- MUST: rejection without `--note` exits non-zero
- MUST: rejection with empty or whitespace-only `--note` exits non-zero
- MUST: `synapse inbox --count` output is parseable as an integer (no extra text)

### MUST NOT
- MUST NOT: allow empty or whitespace-only `--note` — `--note ""` and `--note "  "` both exit non-zero
- MUST NOT: auto-approve any gate
- MUST NOT: delete GATE file on reject (gate stays open until daemon re-dispatches and new GATE appears)
- MUST NOT: require network access or a running GUI
