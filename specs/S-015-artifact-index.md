---
id: S-015
name: artifact-index
status: approved
created: 2026-09-28
updated: 2026-09-28
author: research-to-features
feature_registry_ref: S-015
---

## Overview

The artifact index keeps `synapse.db` in sync with the filesystem. On daemon startup,
it scans the registered repo's pipeline directories (`specs/`, `plans/`, `reviews/`,
`tasks/`) and rebuilds the `artifacts` table. If it finds a mismatch between DB state
and file state — for example, the DB records a spec as `shipped` but the file records
it as `draft` — it reports loudly and halts rather than silently resolving. During
normal operation, whenever a specialist writes a new artifact, the daemon indexes it
immediately. `synapse artifacts <product>` queries the index and returns a formatted list.

## User, Trigger, Outcome

- **User:** Developer who wants to find or navigate pipeline artifacts
- **Trigger:** Daemon startup, or specialist job completes and writes a new artifact
- **Visible Outcome:**
  - `synapse artifacts <product>` lists all artifacts with type, path, status, and date
  - `synapse artifacts <product> --type spec` filters to specs only
  - On startup, index is rebuilt from filesystem scan — no stale DB state
  - On mismatch: daemon prints `[MISMATCH] artifacts table out of sync: {details}`, halts
- **Non-Goal:** Does not resolve content conflicts between DB and files — reports and halts only.
  Does not watch the filesystem continuously (scan on startup + index on write only).
  Does not deduplicate or merge artifacts.

## Acceptance Criteria

- [ ] AC-1: On daemon startup, all artifacts in `specs/`, `plans/current/`, `reviews/` are indexed in `synapse.db`
- [ ] AC-2: `synapse artifacts <product>` returns a list of artifacts with type, path, status, and created date
- [ ] AC-3: `synapse artifacts <product> --type spec` returns only spec artifacts
- [ ] AC-4: After a specialist writes a new artifact, `synapse artifacts` includes it without requiring a restart
- [ ] AC-5: A DB/file state mismatch causes the daemon to print a clear mismatch report and halt (not silently fix)
- [ ] AC-6: Removing a file from disk and restarting the daemon removes it from the index (no ghost records)

## High-Level Tasks

1. HLT-1: Implement filesystem scanner — walks `specs/`, `plans/current/`, `reviews/`, `tasks/current/` and reads frontmatter/headers
2. HLT-2: Implement artifact classifier — determines type from path and content (`spec`, `plan`, `review`, `triage`, `task`)
3. HLT-3: Implement index builder — upserts artifacts table rows, removes rows for files no longer on disk
4. HLT-4: Implement mismatch detector — compares DB `status` field against file `status` field, reports delta
5. HLT-5: Implement `synapse artifacts` command — queries DB, formats table output with optional `--type` filter
6. HLT-6: Implement incremental indexing — called by daemon after each specialist writes an artifact

## Test Contract

### MUST
- MUST: startup scan indexes all artifacts in the correct dirs
- MUST: DB mismatch causes a halt with a printed mismatch report (not a silent fix)
- MUST: `--type` filter returns only artifacts of that type
- MUST: removing a file from disk and restarting removes it from the index

### MUST NOT
- MUST NOT: silently resolve any DB/file state mismatch
- MUST NOT: require the daemon to be restarted to see a newly written artifact
- MUST NOT: index files outside the declared pipeline dirs (`docs/`, `src/`, etc.)
- MUST NOT: write to any artifact file during indexing (read-only scan)
