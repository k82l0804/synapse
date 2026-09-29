# Spec Review: S-011..S-015 iter1

> **Reviewer:** Grok (read-only)  
> **Artifact:** `specs/S-011-product-registration.md`, `specs/S-012-daemon-engine.md`, `specs/S-013-signal-parser.md`, `specs/S-014-human-gate.md`, `specs/S-015-artifact-index.md`  
> **Date:** 2026-09-28T22:27  
> **Iteration:** 1

Reviewed against `specs/feature-spec-format.md` (schema), `feature-registry.yaml` (identity), `specs/pipeline-signal-protocol.md` (S-013), and `AGENTS.md` (pipeline step sequence, gate path, directory writers).

---

## Findings

### [BLOCKING] All five specs fail the feature-spec schema on identity

`specs/feature-spec-format.md` §2 and §6 require `id` matching `F-\d{3}`, `feature_registry_ref` equal to that id, and filename `specs/F-XXX-kebab-case-name.md`. A spec that fails any schema check "must not enter registry" and "the job is FAILED."

Every reviewed file uses `S-0NN` in frontmatter, registry ref, and filename:

| File | Frontmatter `id` | Filename required by format |
|------|------------------|-----------------------------|
| `specs/S-011-product-registration.md` | `S-011` | `specs/F-011-product-registration.md` |
| `specs/S-012-daemon-engine.md` | `S-012` | `specs/F-012-daemon-engine.md` |
| `specs/S-013-signal-parser.md` | `S-013` | `specs/F-013-signal-parser.md` |
| `specs/S-014-human-gate.md` | `S-014` | `specs/F-014-human-gate.md` |
| `specs/S-015-artifact-index.md` | `S-015` | `specs/F-015-artifact-index.md` |

`feature-registry.yaml` records the same `S-0NN` ids and points `spec:` at these paths, so the specs match the registry and fail the frozen format. Status is `approved` on all five, which the format defines as "human has reviewed and approved at spec gate." Schema-invalid specs cannot be approved.

**Evidence:** `specs/feature-spec-format.md` lines 33 and 219 (`F-\d{3}`); `specs/S-011-product-registration.md` lines 2 and 8; same pattern on S-012:2, S-013:2, S-014:2, S-015:2; `feature-registry.yaml` lines 82–119.  
**Required action:** Either amend `feature-spec-format.md` (phase task) so `S-\d{3}` and `specs/S-XXX-name.md` are legal and update the checklist, or reissue these contracts as `F-011`..`F-015` and update the registry, tasks, and plans that cite the old ids. Until one of those is done, set `status` back to `draft`. Do not leave `approved` on a schema failure.

---

### [BLOCKING] S-012 does not name the pipeline step sequence it executes

S-012 is the contract for advancing "the pipeline step by step." AC-1 says `synapse start` "begins step 1." HLT-2 says the run "resolves step sequence." Neither the acceptance criteria nor the high-level tasks name step 1 or the ordered list.

`AGENTS.md` already states the corrected sequence:

```
research-to-features
  → spec-review (Grok) → triage (AGY) → [SPEC GATE]
  → task-gen + task-review (Grok) → triage (AGY)
  → make-plans
  → plan-review (Grok) → triage (AGY) → [PLAN GATE]
  → implement
  → test-cycle
  → code-review (Grok) → triage (AGY)
  → done
```

That list is not in the spec. The format says the spec is the source of truth and the plan derives from the spec. Two implementers of S-012 can ship different step orderings and both claim AC-1.

Related gaps that belong in the same section:

- HLT-5 names transitions `running → waiting → running → done/failed`. Overview and AC-4 also use `TASK_FAILED` and `stopped`. `waiting`, `done`, `failed`, `TASK_FAILED`, and `stopped` are not one state machine.
- AC-6 says interrupted runs become `stopped` unless `auto_resume` is set. The product config field, where it lives, and its default are not specified.
- HLT-4 re-implements signal parsing ("reads last line … parses signal") that S-013 owns. The daemon contract should call S-013 and apply its result.

**Evidence:** `specs/S-012-daemon-engine.md` lines 15–18, 35, 46–49, 58–60; `AGENTS.md` lines 126–136.  
**Required action:** Add the ordered step list to S-012, including which steps are gates and which signal type each step emits. Name one status enum and map `synapse stop`, restart, absent signal, and gate pause onto it. State the `auto_resume` default and storage. Reword HLT-4 to invoke the S-013 parser.

---

### [BLOCKING] S-014 reject does not define how regeneration starts

AC-3 and the visible outcome require `synapse reject <run-id> --note "..."` to write a feedback file and "trigger regeneration" so that "a new WAITING appears when artifact is ready." HLT-4 repeats "triggers regeneration." No criterion says which specialist reruns, whether the daemon polls, whether the developer must run `synapse resume`, or what run status is between reject and the next gate.

The format forbids compound criteria and implementation-free ACs that are not independently verifiable. "Triggers regeneration" is not observable until the mechanism is named.

Cross-artifact conflicts an implementer cannot resolve from this spec:

- `AGENTS.md` says the daemon writes `.synapse/run/GATE-{run-id}.md`. S-014 writes `.synapse/run/WAITING` and says inbox "scans all WAITING files across products." One file named `WAITING` cannot list gates across products. A per-run `GATE-{run-id}.md` can. The two contracts disagree, and S-014 never mentions the GATE file.
- MUST NOT says reject must not delete the WAITING file "until specialist regenerates." Visible outcome says a new WAITING appears after regeneration. Overwrite, second file, or delete-then-recreate is unspecified. HLT-2 scanning "all WAITING files" implies many files; a single path implies one.
- MUST NOT forbids empty `--note ""`. AC-4 only covers a missing flag. Whitespace-only notes are unspecified.
- Visible outcome says inbox shows product and gate type. The MUST list requires only run-id and artifact path.

**Evidence:** `specs/S-014-human-gate.md` lines 17–19, 24–30, 38, 48, 56–64; `AGENTS.md` line 219.  
**Required action:** Specify the reject state transition (run status, who reruns which step, and whether a daemon must already be running). Pick one gate-file contract and make inbox, approve, and reject use it. State the one-gate-per-product rule or the multi-file rule. Add a MUST that inbox includes gate type, and a MUST that `--note` is non-empty after trim.

---

### [WARNING] S-011 acceptance depends on commands and checks the contract does not define

AC-2 requires the product to appear in `synapse products` with `status: idle`. No acceptance criterion, task, or MUST defines that command, its output format, or where it reads from (`repos.yaml` vs `synapse.db`). A test for AC-2 cannot be written from this spec.

HLT-1 requires verifying the path is a git repo. AC-6 only covers a path that does not exist. A path that exists and is not a git repo, and a path that is a subdirectory of a git repo, have no acceptance criterion. HLT-2 exits when the path is already registered; it does not say whether identity is path, product name, or both.

MUST NOT says add must not modify any file inside the registered repo except creating dirs. HLT-3 adds `.gitkeep` files. Those are file writes, so the MUST NOT as written fails a conforming implementation of HLT-3.

The visible outcome lists 15 directories. AC-4 says "all required pipeline dirs" and does not enumerate them. `tasks/future/` is in the visible outcome and is not a directory in the AGENTS.md layout contract.

**Evidence:** `specs/S-011-product-registration.md` lines 24–27, 34–36, 42–44, 58.  
**Suggested action:** Define the minimum `synapse products` columns in this spec, or retarget AC-2 at the `repos.yaml` entry and the `synapse.db` row. Add ACs for non-git path and for identity on re-add. Allow `.gitkeep` in the MUST NOT, and make AC-4 list the same directories as the visible outcome.

---

### [WARNING] S-013 failure reasons do not match the signal protocol it cites

S-013 says it parses "per the grammar defined in `specs/pipeline-signal-protocol.md`." The protocol's absent reason is `SIGNAL_ABSENT: no valid signal on last line of artifact`. S-013 AC-3 requires `failure_reason = "SIGNAL_ABSENT"` with no suffix. The protocol's malformed reason is `SCHEMA_VIOLATION: signal present but malformed: {last_line}`. S-013 AC-4 requires `SCHEMA_VIOLATION: <line>`. Tests written to one document fail the other.

AC-4's boundary ("starts with `<!-- PIPELINE_SIGNAL` or `<!-- TESTER_SIGNAL`") is also looser than the protocol regex, which requires `PIPELINE_SIGNAL:` after optional whitespace. A last line of `<!-- PIPELINE_SIGNAL` with no colon is SCHEMA_VIOLATION in the spec and SIGNAL_ABSENT under the protocol regex.

MUST NOT "read the entire file" / "must use tail/seek" cannot be asserted from parser output. It is an implementation constraint with no observable acceptance criterion.

HLT-6 writes a `signals` table and updates `pipeline_runs.last_signal`. No spec in this set defines that schema. The research matrix says the DDL was "captured in S-013 … as DB schema deliverable." S-013 has no schema section.

**Evidence:** `specs/S-013-signal-parser.md` lines 15–18, 28–29, 37–43, 52, 59–60, 65; `specs/pipeline-signal-protocol.md` lines 84–85, 151–152, 163–178.  
**Suggested action:** Quote the protocol reason strings verbatim, and define SCHEMA_VIOLATION as "last line matches the protocol's signal-open pattern but fails the full regex." Drop the seek requirement from the test contract or attach it to a seam that tests can observe. Add the `signals` and `pipeline_runs` columns this feature writes, or point at a schema artifact that exists.

---

### [WARNING] S-015 scan scope, mismatch rule, and type filter disagree inside the spec

AC-1 indexes `specs/`, `plans/current/`, and `reviews/`. HLT-1 also walks `tasks/current/`. Overview says the scan covers `specs/`, `plans/`, `reviews/`, and `tasks/`. AC-6 and HLT-3 remove index rows for files no longer on disk, which is wrong if the scanner never visited `plans/done/` or `tasks/done/`: those rows become ghosts or survive forever, depending on which paragraph the implementer follows.

AC-5 halts when DB `status` and file `status` differ. It does not say what an empty table means on first startup. A scanner that treats "no row" as a mismatch cannot build the index HLT-3 describes. Overview's example mismatch ("DB records a spec as `shipped` but the file records it as `draft`") uses a status value that is not in the feature-spec status enum (`draft | approved | done`).

`--type spec` is the only filter value given. HLT-2's classifier emits `spec`, `plan`, `review`, `triage`, `task` and omits `feedback`, which is a required reviews subdirectory.

AC-4 requires a newly written artifact to appear without restart. That depends on the daemon calling HLT-6. S-012 never mentions the indexer.

**Evidence:** `specs/S-015-artifact-index.md` lines 13–19, 29–31, 36–41, 45–50, 56–63.  
**Suggested action:** One directory list, used by AC-1, HLT-1, and the ghost-record rule. State that a missing DB row is an insert, and a status conflict is a halt. List legal `--type` values. Add an S-012 obligation to call incremental indexing after each successful artifact write.

---

### [INFO] S-012 AC-5 "in real time" is not a property of a DB read

`synapse status` "reflects the current step name and status in real time." The rest of the spec says status is written to `synapse.db` after a step completes. A test can check that status matches the last committed transition. It cannot check "real time."

**Evidence:** `specs/S-012-daemon-engine.md` lines 25–26, 39.  
**Suggested action:** Replace "in real time" with "matches the last committed run row."

---

### [INFO] S-013 User field is "the daemon"

The format asks for a role or persona. "The daemon (internal component — not directly user-facing)" is an honest description of an internal contract. The observable outcomes are still stated as `synapse status` and `synapse.db` rows, so this does not block review.

**Evidence:** `specs/S-013-signal-parser.md` lines 23–29.

---

### [INFO] Section order and counts otherwise match the template

Each file has Overview, User/Trigger/Outcome (all four sub-fields), Acceptance Criteria (6 or 7, each a checkbox), High-Level Tasks (6 or 7, numbered, no forward references inside the file), and Test Contract with at least 2 MUST and 1 MUST NOT. No `[TODO]` literals. Optional sections are absent, which the format allows. Names match the registry `name` field.

**Evidence:** `specs/S-011-product-registration.md` through `specs/S-015-artifact-index.md`, section headings; `feature-registry.yaml` lines 82–119.

---

## Missing Tests / Test Gaps

These are spec-stage gaps: the Test Contract cannot yet drive the assertions the acceptance criteria imply.

- S-011: no MUST for `repos.yaml` entry shape (AC-3) or for non-zero exit on a missing path (AC-6) or a non-git path (HLT-1).
- S-011: no MUST that `synapse products` output format is defined before AC-2 is testable.
- S-012: no MUST naming step 1 or forbidding a step start after `SIGNAL_ABSENT` beyond the existing MUST NOT, which has no step list to attach to.
- S-012: no MUST for `auto_resume` default.
- S-013: no MUST that reason strings equal `specs/pipeline-signal-protocol.md` §4.1 and §4.2.
- S-014: no MUST for gate type in inbox output; no MUST for reject run-status; no MUST that whitespace-only `--note` exits non-zero.
- S-015: no MUST listing the directories that are both indexed and eligible for ghost-record removal; no MUST that an empty `artifacts` table is not a mismatch.

## Architectural & Compatibility Risk

These five specs are the Phase 2 engine, and the task graph already wires them together (`tasks/current/phase-2.md`: T-2-3 depends on T-2-1 and T-2-2; T-2-4 and T-2-5 depend on T-2-3). The contracts do not declare those dependencies, and three shared invariants are split across files that disagree:

1. **Gate file.** AGENTS.md writes `GATE-{run-id}.md`. S-014 writes `WAITING`. Inbox cannot be implemented until one path wins.
2. **Signal failure text.** S-013 and `pipeline-signal-protocol.md` prescribe different `failure_reason` strings for the same events. The daemon (S-012 AC-4) stores whichever the parser returns.
3. **Index vs. daemon.** S-015 AC-4 needs the daemon to index on write. S-012 never calls the indexer. Shipping S-012 alone makes S-015 AC-4 untestable.

`status: approved` on schema-invalid specs also means a later spec gate has nothing left to catch. Implementation tasks that cite these files will treat known gaps as settled contracts.

## Verdict

REQUEST_CHANGES

<!-- PIPELINE_SIGNAL: STATUS=PARTIAL AUTO-FIX=0 ESCALATE=0 -->
