# Spec Review: S-011..S-015 (independent pass)

> **Reviewer:** Claude (read-only)
> **Artifact:** `specs/S-011-product-registration.md`, `specs/S-012-daemon-engine.md`, `specs/S-013-signal-parser.md`, `specs/S-014-human-gate.md`, `specs/S-015-artifact-index.md`
> **Date:** 2026-09-28T00:00
> **Iteration:** 1 (independent review — see Note below on prior Grok iter1)

> **Note:** `reviews/spec/2026-09-28T22-27_grok-spec-review.md` and the superseding
> `reviews/triage/2026-09-28T22-35_spec-triage-phase-2-v2.md` already cover this batch in
> depth. This review was produced independently against the specs and `feature-spec-format.md`
> directly. It confirms the load-bearing findings from that pair (they are real, not
> reviewer artifacts) and adds one finding neither document raised: `tasks/current/phase-2.md`
> itself violates the spec-to-task mapping rule, so fixing the specs alone will not close the gap.

---

## Findings

### [BLOCKING] All five specs use an `id`/filename scheme the frozen format rejects

`specs/feature-spec-format.md` §2 and §6 require `id: F-\d{3}`, a matching
`feature_registry_ref`, and filename `specs/F-XXX-kebab-case-name.md`. All five files use
`S-0NN` in frontmatter, registry ref, and filename, and all five carry `status: approved` —
which the format defines as "human has reviewed and approved at spec gate." A schema-invalid
spec cannot legally be `approved` (§6: "must not enter registry... the job is FAILED").

**Evidence:** `specs/feature-spec-format.md:33,219`; `specs/S-011-product-registration.md:2,8`
(same pattern S-012:2, S-013:2, S-014:2, S-015:2); `feature-registry.yaml:82-119`.
**Required action:** Pick one: (a) amend `feature-spec-format.md` to make the prefix
repo-configurable (e.g. `[A-Z]-\d{3}` with an `id_prefix` field), or (b) renumber to
`F-011..F-015` and update every reference in `feature-registry.yaml` and
`tasks/current/phase-2.md`. Do not leave `status: approved` standing on a schema failure in
the meantime — this is the same call the prior triage (`B-1`) already made; it has not yet
been applied to any file.

---

### [BLOCKING] Gate-file contract is defined two different, incompatible ways

`fox/synapse/AGENTS.md` §10 states the daemon writes `.synapse/run/GATE-{run-id}.md`. S-014
says the daemon writes a single `.synapse/run/WAITING` file, and its own AC-1 requires
`synapse inbox` to list "all `GATE_WAITING` items **across all products**." A daemon that is
"one shared daemon for all products" (S-012, Non-Goal) and runs pipelines for multiple
products can have more than one run waiting on a gate at once. A single un-parameterized
`WAITING` file cannot represent more than one waiting gate — there is nowhere to put the
second product's run-id, artifact path, or gate type. S-014's own MUST ("`synapse inbox`
shows all waiting gates with run-id and artifact path") is unimplementable against its own
Visible Outcome ("writes a `WAITING` file"). This is not just a docs/spec mismatch — it's a
spec that contradicts itself once more than one product exists.

**Evidence:** `fox/synapse/AGENTS.md` §10 ("Gate path: `.synapse/run/GATE-{run-id}.md`");
`specs/S-014-human-gate.md:24-30,38,48,56`.
**Required action:** Adopt the per-run `GATE-{run-id}.md` naming everywhere: S-014 (inbox
scans `.synapse/run/GATE-*.md`; approve deletes the matching file; reject keeps it and sets
run status back to a re-dispatchable state), and propagate the same fix into
`tasks/current/phase-2.md` T-2-4 (currently: "deletes WAITING file" / "reject delete WAITING
file" — same wrong name, same bug, in the task block that will be handed to the implementer).

---

### [BLOCKING] S-012 never names the step sequence it is a contract for

AC-1 says `synapse start` "begins step 1." HLT-2 says the run "resolves step sequence."
Nothing in the spec enumerates step 1, the ordered list of steps, which steps are gates, or
which signal type (`PIPELINE_SIGNAL` vs `TESTER_SIGNAL`) each step emits. `AGENTS.md` §5
already states the corrected sequence (research-to-features → spec-review → triage → [SPEC
GATE] → task-gen → task-review → triage → make-plans → plan-review → triage → [PLAN GATE] →
implement → test-cycle → code-review → triage → done), but S-012 doesn't reference it. Per
`feature-spec-format.md`, the spec — not the plan, not AGENTS.md — is the source of truth;
two implementers could ship different step orderings and both satisfy AC-1 as written.

Compounding this, the state vocabulary is inconsistent within the same spec: HLT-5 names
`running → waiting → running → done/failed`; the Overview and AC-4 separately use
`TASK_FAILED` and `stopped`. These are not reconciled into one enum anywhere in the file.

**Evidence:** `specs/S-012-daemon-engine.md:15-18,35,46-49,58-60`; `fox/synapse/AGENTS.md` §5.
**Required action:** Add an explicit step-sequence section (numbered steps + gate markers +
signal type per step) and a single status enum that every AC/HLT/MUST in the file uses
consistently, including where `TASK_FAILED` and `stopped` map onto it.

---

### [BLOCKING] `tasks/current/phase-2.md` violates the spec's own task-mapping rule (new finding)

`feature-spec-format.md` §3.4 is explicit: "Each task maps to exactly one task block in
`tasks/current/phase-N.md`" — a 1:1 mapping between a High-Level Task and a task block. Every
task in `tasks/current/phase-2.md` instead bundles an entire feature's HLTs into one task
block via `spec_task: HLT-1 through HLT-6` (T-2-1 through T-2-5 all do this). This isn't a
cosmetic deviation: it means a single task block (e.g. T-2-1) is really six units of
independent work (`HLT-1` through `HLT-6` of S-013) with no per-HLT status tracking, no way to
mark HLT-3 done while HLT-4 is still in progress, and no way for the daemon's task-review step
to review one HLT in isolation. This will need to be fixed at the same time as the S-0NN/F-0NN
decision above, since renumbering the specs also touches every `feature:`/`spec:` reference in
this file.

**Evidence:** `specs/feature-spec-format.md:104-106` ("Each task maps to exactly one task
block"); `tasks/current/phase-2.md:28-142` (all five task blocks use `spec_task: HLT-1
through HLT-N`).
**Required action:** Either split each task block into one per HLT (T-2-1-1 .. T-2-1-6, etc.),
or amend `feature-spec-format.md` §3.4 to explicitly allow a task block to cover a range of
HLTs for a single feature (documenting that the 1:1 rule is per-feature, not per-HLT). Pick one
and apply it uniformly — right now the phase file silently does the opposite of what the frozen
format says.

---

### [WARNING] S-013's failure-reason strings don't match the protocol it cites verbatim

S-013 says it parses "per the grammar defined in `specs/pipeline-signal-protocol.md`." That
protocol's absent-signal reason is `"SIGNAL_ABSENT: no valid signal on last line of artifact"`
and its malformed-signal reason is `"SCHEMA_VIOLATION: signal present but malformed: {last_line}"`.
S-013's own AC-3 asks only for `failure_reason = "SIGNAL_ABSENT"` (no suffix) and AC-4 asks for
`"SCHEMA_VIOLATION: <line>"` (no `"signal present but malformed:"` infix). A test written
against S-013 verbatim will fail a test written against the protocol verbatim, and vice versa.
This has already propagated downstream: `tasks/current/phase-2.md` T-2-1 AC-4 copies S-013's
looser wording (`"SCHEMA_VIOLATION: {line}"`), not the protocol's.

**Evidence:** `specs/S-013-signal-parser.md:37-40`; `specs/pipeline-signal-protocol.md:164-178`;
`tasks/current/phase-2.md:41`.
**Suggested action:** Quote the protocol's reason strings verbatim in S-013's AC-3/AC-4, then
fix the same wording in T-2-1's acceptance criteria.

---

### [WARNING] S-011's `MUST NOT` forbids the file writes its own `HLT-3` requires

Test Contract MUST NOT: "`synapse add` must not modify any file inside the registered repo
except creating dirs." HLT-3 requires creating `.gitkeep` files inside those new dirs (called
out explicitly: "adds `.gitkeep`"). A `.gitkeep` is a file write, not a directory creation, so a
conforming implementation of HLT-3 fails this MUST NOT as literally written.

**Evidence:** `specs/S-011-product-registration.md:43-44,58`.
**Suggested action:** Reword to "MUST NOT modify any pre-existing file inside the registered
repo; creating empty `.gitkeep` markers in newly-created dirs is permitted."

---

### [WARNING] S-015's three directory lists disagree, and its own mismatch example uses a status value outside the enum

Overview says the scan covers `specs/`, `plans/`, `reviews/`, `tasks/`. AC-1 names `specs/`,
`plans/current/`, and `reviews/`. HLT-1 adds `tasks/current/` but neither `plans/done/`,
`reviews/feedback/`, nor `tasks/done/`/`tasks/deferred/`. Since AC-6/HLT-3 remove index rows
for files no longer found on disk, any directory the scanner never visits accumulates ghost
rows forever (or never gets indexed at all) depending on which of the three lists an
implementer follows. Separately, the Overview's own mismatch example — "DB records a spec as
`shipped` but the file records it as `draft`" — uses `shipped` where `feature-spec-format.md`'s
status enum is only `draft | approved | done`; `shipped` is a `feature-registry.yaml` status
value, not a spec-file status value, so the example describes a comparison that can't occur in
the way it's described.

**Evidence:** `specs/S-015-artifact-index.md:13-19,29-31`; `specs/feature-spec-format.md:45-48`.
**Suggested action:** Collapse to one canonical directory list used by Overview, AC-1, HLT-1,
and the ghost-removal rule (include `plans/done/`, `reviews/feedback/`, `tasks/done/`,
`tasks/deferred/`); fix the mismatch example to compare like statuses (e.g. spec file `draft`
vs. DB row still recorded as `approved`).

---

### [WARNING] S-012 re-describes signal parsing instead of delegating to S-013, and never calls S-015's indexer

HLT-4 of S-012 says "reads last line of output artifact, parses signal, updates DB" — this is
S-013's entire job description, restated inline rather than referenced. Nothing in S-012 says
"invoke S-013's parser"; an implementer could legitimately write a second, divergent parser
inside the daemon. Symmetrically, S-015 AC-4 requires a newly-written artifact to appear in
`synapse artifacts` "without requiring a restart," which depends on the daemon calling the
incremental indexer after each step — but S-012's step executor (HLT-3) never mentions
indexing at all. Shipping S-012 alone (its dependency order in `tasks/current/phase-2.md` has
T-2-3 before T-2-5) makes S-015 AC-4 untestable until someone remembers to wire this up.

**Evidence:** `specs/S-012-daemon-engine.md:48,50`; `specs/S-015-artifact-index.md:39`;
`tasks/current/phase-2.md:75-142` (T-2-3 depends on nothing that forces the S-015 call).
**Suggested action:** Reword S-012 HLT-4 to "invokes S-013's `parseSignal`" and add an HLT (or
extend HLT-3) requiring the step executor to call S-015's incremental indexer after each
completed step.

---

### [INFO] S-013's `User` field names an internal component, not a persona

"User: The daemon (internal component — not directly user-facing)." `feature-spec-format.md`
asks for "who uses this feature (role or persona, not 'the system')." This is arguably the same
pattern the format is trying to rule out, but the section still reads as an honest, unambiguous
description and every downstream observable outcome (`synapse status`, `synapse.db` rows) is
still user-facing. Not blocking, but worth a one-line human call at spec gate rather than
silent acceptance, since strictly the checklist has no exception carved out for internal
components.

**Evidence:** `specs/S-013-signal-parser.md:23`.

---

### [INFO] Non-observable implementation constraints sit in Test Contracts, then leak into the task file

S-013's MUST NOT: "read the entire file to find the signal (must use tail/seek for
efficiency)" and T-2-1's mirrored MUST: "readLastLine uses file seek (not full read)" are both
implementation-detail assertions, not observable behavior a black-box test can check (a test
can observe correct parsing of the last line; it cannot observe *how* the file was read without
inspecting internals). `feature-spec-format.md` doesn't explicitly forbid this for Test
Contract entries, but the Acceptance Criteria section does forbid implementation language
("no 'must call function X'"), and the same spirit applies here. Not blocking on its own, but
worth folding into whatever pass fixes S-013 for the wording issue above, since it's already
been copy-pasted into the task file and will otherwise get copy-pasted into the code-review
checklist too.

**Evidence:** `specs/S-013-signal-parser.md:65`; `tasks/current/phase-2.md:46`.

---

## Missing Tests / Test Gaps

- S-011: no MUST for the shape of the new `repos.yaml` entry (AC-3), and no MUST covering a
  path that exists but is not a git repo (HLT-1 checks for this; no AC does).
- S-012: no MUST naming what "step 1" is, since no step sequence exists yet to name it from; no
  MUST for the `auto_resume` default or where it's stored.
- S-013: no MUST that failure-reason strings equal `pipeline-signal-protocol.md` verbatim (see
  finding above).
- S-014: no MUST that `synapse inbox` output includes gate *type* (Visible Outcome mentions it,
  the MUST list under Test Contract does not); no MUST for the run-status transition on reject.
- S-015: no MUST stating that an empty `artifacts` table on first startup is not itself a
  mismatch (AC-5 as written could be read to require a DB row to already exist for every file).

## Architectural & Compatibility Risk

Three invariants are split across files that disagree, and a fourth is split across a spec and
its own task file:

1. **Gate file naming** — `AGENTS.md` (`GATE-{run-id}.md`) vs. S-014 (`WAITING`) vs. S-014's own
   multi-product inbox requirement, which only the `AGENTS.md` naming can satisfy.
2. **Signal failure text** — S-013 vs. `pipeline-signal-protocol.md`, propagated into
   `tasks/current/phase-2.md` T-2-1.
3. **Indexing trigger** — S-015 AC-4 needs the daemon to call the indexer; S-012 never commits
   to that call.
4. **HLT-to-task granularity** — `feature-spec-format.md` §3.4 requires one task block per HLT;
   `tasks/current/phase-2.md` gives one task block per *feature* (spanning all of that
   feature's HLTs). This means the task file is already out of conformance with the frozen
   format independent of anything wrong in the specs themselves — fixing the specs will not
   fix this.

None of the five features need redesigning — the underlying design (registration → daemon →
signal parsing → gate → index) is coherent. The gaps are naming/schema drift between documents
that were written close together but not cross-checked against each other or against the frozen
format documents they're supposed to conform to.

## Verdict

REQUEST_CHANGES

<!-- PIPELINE_SIGNAL: STATUS=PARTIAL AUTO-FIX=0 ESCALATE=0 -->
