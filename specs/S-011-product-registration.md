---
id: S-011
name: product-registration
status: approved
created: 2026-09-28
updated: 2026-09-29
author: research-to-features
feature_registry_ref: S-011
---

## Overview

Product registration is the entry point to Synapse. A developer runs `synapse add <path>`
to register an existing repo with the Synapse daemon. The command validates the repo layout,
ensures the required pipeline directories exist (creating them if missing), and adds the
product to `repos.yaml` and `synapse.db`. After registration the product's DB row has
`pipeline_status = 'idle'` and a matching entry appears in `repos.yaml`; the product is
ready for a pipeline run.

## User, Trigger, Outcome

- **User:** Developer who wants to use Synapse to orchestrate development of an existing repo
- **Trigger:** Developer runs `synapse add <path>` from any directory
- **Visible Outcome:** The repo is registered. A product row exists in `synapse.db` with
  `pipeline_status = 'idle'`. `repos.yaml` contains the new entry with `name`, `path`,
  `auto_resume: false`, and `id_prefix`. Required dirs exist in the repo (created if absent):
  `tasks/`, `tasks/current/`, `tasks/future/`, `tasks/done/`, `tasks/deferred/`,
  `plans/`, `plans/current/`, `plans/done/`,
  `specs/`, `reviews/`, `reviews/spec/`, `reviews/plan/`, `reviews/code/`,
  `reviews/triage/`, `reviews/feedback/`
  The daemon creates `.synapse/run/` on first gate; `synapse add` adds `.synapse/run/` to `.gitignore`.
- **Non-Goal:** Does not start the pipeline. Does not create specs, tasks, or plans.
  Does not require an `AGENTS.md` to already exist (warns if missing, does not block).

## Acceptance Criteria

- [ ] AC-1: `synapse add <path>` succeeds for a valid repo path and prints the product name and status
- [ ] AC-2: Product row exists in `synapse.db` products table with `pipeline_status = 'idle'` and a matching entry exists in `repos.yaml`. (Note: `synapse products` list command is a future feature not in scope for this spec.)
- [ ] AC-3: `repos.yaml` in the Synapse root contains a new entry with keys: `name` (repo dir name),
  `path` (absolute resolved path), `auto_resume: false`, `id_prefix` (default `S`)
- [ ] AC-4: All required pipeline dirs exist in the target repo after registration (created if absent):
  `tasks/`, `tasks/current/`, `tasks/future/`, `tasks/done/`, `tasks/deferred/`,
  `plans/`, `plans/current/`, `plans/done/`,
  `specs/`, `reviews/`, `reviews/spec/`, `reviews/plan/`, `reviews/code/`,
  `reviews/triage/`, `reviews/feedback/`
- [ ] AC-5: Running `synapse add` on an already-registered path exits 0 with a warning (idempotent); identity check uses absolute resolved path
- [ ] AC-6: Running `synapse add` on a path that doesn't exist exits non-zero with a clear error message
- [ ] AC-7: Running `synapse add` on a path that exists but is not a git repo exits non-zero with a
  clear error message; detection uses `GIT_TERMINAL_PROMPT=0 git -C <path> rev-parse --show-toplevel`
  so submodules (`.git`-as-file) and worktrees pass
- [ ] AC-8: `.synapse/run/` is added to (or already present in) the registered repo's `.gitignore`

## High-Level Tasks

1. HLT-1: Parse and validate the `<path>` argument — resolve to absolute path; verify it is a
   git repo using `GIT_TERMINAL_PROMPT=0 git -C <path> rev-parse --show-toplevel` (succeeds for
   normal repos, submodules with `.git`-as-file, and worktrees; exits non-zero otherwise)
2. HLT-2: Check if already registered (search `repos.yaml` and `synapse.db` by absolute path) — warn and exit 0 if so
3. HLT-3: Create missing pipeline dirs in the target repo using `mkdir -p`; add a `.gitkeep` to each newly created dir
4. HLT-4: Write product entry to `repos.yaml` (Synapse root) with `name`, `path` (absolute),
   `auto_resume: false`, `id_prefix` (default `S`)
5. HLT-5: Insert product row into `synapse.db` products table with `pipeline_status: idle`
6. HLT-6: Add `.synapse/run/` to the registered repo's `.gitignore` (create if absent)
7. HLT-7: Print registration summary and next-step hint (`synapse start <name>` to begin)

## Test Contract

### MUST
- MUST: `synapse add <valid-path>` exits 0 and prints product name
- MUST: product row exists in `synapse.db` with `pipeline_status = 'idle'` after add
- MUST: `repos.yaml` entry contains `name`, `path` (absolute), `auto_resume: false`, `id_prefix`
- MUST: all required dirs exist in the repo after add (even if they were absent)
- MUST: `synapse add` on a `.git`-as-file repo (submodule or worktree) succeeds
- MUST: `synapse add` on an already-registered path is idempotent (exits 0, prints warning)
- MUST: `synapse add` on a non-git path exits non-zero with a clear error message
- MUST: `.synapse/run/` is added to the repo's `.gitignore`
- MUST: `.synapse/run/` line is not duplicated in `.gitignore` if already present (idempotent append — running `synapse add` twice does not add the line twice)

### MUST NOT
- MUST NOT: modify any pre-existing file inside the registered repo; permitted exceptions: (1) creating empty `.gitkeep` markers in newly-created dirs, and (2) appending a single `.synapse/run/` line to an existing `.gitignore` when the line is not already present
- MUST NOT: start any pipeline step or agent subprocess
- MUST NOT: require `AGENTS.md` to exist (warn only)
- MUST NOT: exit non-zero when dirs already exist
