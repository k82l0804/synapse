---
id: S-015
name: artifact-index
status: draft
created: 2026-09-28
updated: 2026-09-28
author: research-to-features
feature_registry_ref: S-015
---

## Overview

The artifact index keeps `synapse.db` in sync with the filesystem. On daemon startup,
it scans the registered repo's pipeline directories and rebuilds the `artifacts` table.
The canonical set of scanned directories is:
`specs/`, `plans/current/`, `plans/done/`, `reviews/spec/`, `reviews/plan/`, `reviews/code/`,
`reviews/triage/`, `reviews/feedback/`, `tasks/current/`, `tasks/done/`, `tasks/deferred/`.

If it finds a mismatch between DB state and file state — for example, the DB records a
spec as `approved` but the file records it as `draft` — it reports loudly and halts rather
than silently resolving. On first run (empty DB), all files found are indexed as new records;
an empty `artifacts` table is not a mismatch. During normal operation, whenever a specialist
writes a new artifact, the daemon indexes it immediately (called by S-012 step executor after
each step). `synapse artifacts <product>` queries the index and returns a formatted list.

## User, Trigger, Outcome

- **User:** Developer who wants to find or navigate pipeline artifacts
- **Trigger:** Daemon startup, or S-012 step executor calls incremental indexer after a specialist writes a new artifact
- **Visible Outcome:**
  - `synapse artifacts <product>` lists all artifacts with type, path, status, and date
  - `synapse artifacts <product> --type <t>` filters by type; valid types: `spec`, `plan`, `review`, `triage`, `feedback`, `task`
  - On startup, index is rebuilt from filesystem scan — no stale DB state; missing rows are inserted (not an error)
  - On status mismatch (DB row exists with different `status` than file frontmatter): daemon prints `[MISMATCH] artifacts table out of sync: {details}`, halts
- **Non-Goal:** Does not resolve content conflicts between DB and files — reports and halts only.
  Does not watch the filesystem continuously (scan on startup + index on write only).
  Does not deduplicate or merge artifacts.

## Acceptance Criteria

- [ ] AC-1: On daemon startup, all artifacts in the canonical directory set are indexed in `synapse.db`:
  `specs/`, `plans/current/`, `plans/done/`, `reviews/spec/`, `reviews/plan/`, `reviews/code/`,
  `reviews/triage/`, `reviews/feedback/`, `tasks/current/`, `tasks/done/`, `tasks/deferred/`
- [ ] AC-2: `synapse artifacts <product>` returns a list of artifacts with type, path, status, and created date
- [ ] AC-3: `synapse artifacts <product> --type <t>` returns only artifacts of that type; valid values: `spec`, `plan`, `review`, `triage`, `feedback`, `task`
- [ ] AC-4: After S-012 step executor calls the incremental indexer, `synapse artifacts` includes the new artifact without requiring a restart
- [ ] AC-5: A DB/file status mismatch (existing DB row has different `status` than file frontmatter) causes the daemon to print a clear mismatch report and halt. An empty `artifacts` table on first startup is NOT a mismatch.
- [ ] AC-6: Removing a file from disk and restarting the daemon removes it from the index (no ghost records) for all directories in the canonical set

## High-Level Tasks

1. HLT-1: Implement filesystem scanner — walks the canonical directory set and reads frontmatter/headers from each `.md` file
2. HLT-2: Implement artifact classifier — determines type from path and content: `spec`, `plan`, `review`, `triage`, `feedback`, `task`
3. HLT-3: Implement index builder — upserts artifacts table rows; removes rows for files no longer on disk in the canonical set
4. HLT-4: Implement mismatch detector — compares DB `status` field against file `status` frontmatter for existing rows; missing rows are inserts, not mismatches
5. HLT-5: Implement `synapse artifacts` command — queries DB, formats table output with `--type` filter (valid values: `spec`, `plan`, `review`, `triage`, `feedback`, `task`)
6. HLT-6: Implement incremental indexing — called by S-012 step executor after each specialist writes an artifact

## Test Contract

### MUST
- MUST: startup scan indexes all artifacts in the canonical directory set
- MUST: DB status mismatch causes a halt with a printed mismatch report (not a silent fix)
- MUST: empty `artifacts` table on first startup is not treated as a mismatch
- MUST: `--type` filter returns only artifacts of that type; all six type values must be supported
- MUST: removing a file from disk in the canonical set and restarting removes it from the index

### MUST NOT
- MUST NOT: silently resolve any DB/file status mismatch (existing row with different status)
- MUST NOT: require the daemon to be restarted to see a newly written artifact (incremental indexing via S-012)
- MUST NOT: index files outside the canonical pipeline dirs (`docs/`, `src/`, etc.)
- MUST NOT: write to any artifact file during indexing (read-only scan)
