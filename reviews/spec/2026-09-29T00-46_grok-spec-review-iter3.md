# Spec Review: S-011..S-015 iter3

> **Reviewer:** Grok (read-only)  
> **Artifact:** `specs/S-011-product-registration.md`, `specs/S-012-daemon-engine.md`, `specs/S-013-signal-parser.md`, `specs/S-014-human-gate.md`, `specs/S-015-artifact-index.md`  
> **Date:** 2026-09-29T00:46  
> **Iteration:** 3

Reviewed blind against `specs/feature-spec-format.md`, `specs/task-format.md`, and `specs/pipeline-signal-protocol.md`. No prior review was read. No spec file was edited.

Schema shape of all five files is conforming: required frontmatter, required sections in order, UTO fields present, AC count 6–11, HLT count 6–7, at least two MUST and one MUST NOT. Findings below are contract contradictions an implementer cannot resolve from these specs alone.

---

## Findings

### [BLOCKING] S-012 restart rule contradicts its own visible outcome

S-012 states two incompatible restart transitions for the same run status.

The run-status enum says `` `waiting` runs stay `waiting` on restart `` and AC-6 / HLT-1 / the restart MUST all say `waiting` is preserved. The visible outcome says the opposite: on daemon restart, runs that were `running` **or** `waiting` are set to `stopped`, and the user must `synapse resume` unless `auto_resume: true`.

Those are different user-visible outcomes. A test written from the visible outcome fails a test written from AC-6. `auto_resume: true` is mentioned only in the visible outcome; no AC, HLT, or MUST says what the daemon does when it is true, so the exception cannot be tested either.

**Evidence:** `specs/S-012-daemon-engine.md:57` ("`waiting` runs stay `waiting` on restart"); `specs/S-012-daemon-engine.md:91-93` ("runs that were `running` or `waiting` are set to `stopped`"); `specs/S-012-daemon-engine.md:104` (AC-6 preserves `waiting`)  
**Required action:** Make the visible outcome match the enum and AC-6: restart sets `running` to `stopped` and leaves `waiting` as `waiting`. Add an AC and a MUST for `auto_resume: true` (which runs it resumes, and that `waiting` is not auto-resumed) or drop the flag from the visible outcome.

---

### [BLOCKING] S-012 and S-014 disagree on who writes the GATE file and what reject does to it

S-012 says gate steps pause the daemon and write `.synapse/run/GATE-{run-id}.md`, and that `ESCALATE>0` writes a GATE file. S-014 says the same file is written when the daemon enters `waiting`. Neither spec names the writer as a single owner. S-012 HLT-1 through HLT-7 do not include "write GATE file." S-014 HLT-1 says the daemon writes it, but S-014's non-goal says it does not start the pipeline, and its user is the human approver. Two features both claim the write.

Reject is worse. S-012's reject transition sets `waiting → running` and rewinds `current_step` immediately, with no mention of the GATE file. S-014 MUST NOT says: "delete GATE file on reject (gate stays open until daemon re-dispatches and new GATE appears)." If reject rewinds and starts the generator while the old GATE file remains, S-014's own invariant ("a single pipeline run has at most one GATE file at a time") is already broken, and `synapse inbox` will keep listing a gate whose run is `running`. HLT-1 says a GATE file whose DB status is `running` is not shown — so the file is both "open" and invisible. On the next gate the daemon writes a second `GATE-{run-id}.md` for the same run-id (the filename has no step), colliding with the file that was kept.

Approve is only in S-014 (delete GATE, `waiting → running`, `current_step` unchanged). S-012 states the status transition but has no MUST that approve advances, and no rule for what happens if approve and the daemon both try to delete or rewrite the file.

**Evidence:** `specs/S-012-daemon-engine.md:45`, `specs/S-012-daemon-engine.md:69`, `specs/S-012-daemon-engine.md:74-79`; `specs/S-014-human-gate.md:40-41`, `specs/S-014-human-gate.md:54-57`, `specs/S-014-human-gate.md:78`  
**Required action:** Assign GATE-file write to exactly one feature. Specify reject as one sequence: either delete the GATE file on reject (and drop S-014's MUST NOT), or keep it and define how re-dispatch replaces it without a same-path collision and without inbox showing a non-waiting run. State whether approve is owned by S-014 only, and add the matching MUST to whichever spec owns the transition.

---

### [BLOCKING] S-013 claims status writes that S-012 says it alone owns

S-012 says: "The daemon's HLT-5 state machine owns `current_step`, `auto_fix_count`, `escalate_count`, and `iteration` on `pipeline_runs`. S-013 owns `last_signal`."

S-013 HLT-6 and its DB schema say the parser updates `pipeline_runs.last_signal`, `pipeline_runs.status`, and `pipeline_runs.failure_reason`. S-013's visible outcome says a parsed signal "determines the next pipeline action" and that `synapse status` reflects advancing, waiting, or failed immediately after parse.

Status transitions in S-012 are not a function of the signal alone. `STATUS=DONE` stays `running` until step 15, then becomes `done`. `ESCALATE>0` becomes `waiting`. `TESTER FAIL>0` stays `running` and loops to step 12, unless iteration ≥ 3, in which case it becomes `waiting`. If S-013 writes `pipeline_runs.status` from the signal, it either duplicates HLT-5 or overwrites it. The protocol's run-status column is not the signal `STATUS` field; storing `DONE` into `pipeline_runs.status` would put a value outside S-012's enum (`idle|running|waiting|stopping|stopped|done|failed`).

`failure_reason` is claimed by S-013 and also implied by S-012's transition table (`failure_reason = "SIGNAL_ABSENT: ..."`). Neither spec says the other must not write it.

**Evidence:** `specs/S-012-daemon-engine.md:81-82`, `specs/S-012-daemon-engine.md:62-72`; `specs/S-013-signal-parser.md:16-18`, `specs/S-013-signal-parser.md:58-59`, `specs/S-013-signal-parser.md:83-86`  
**Required action:** S-013 writes the `signals` row and `pipeline_runs.last_signal` only, plus a parse outcome (`ok | SIGNAL_ABSENT | SCHEMA_VIOLATION`) and the reason string. S-012 HLT-5 is the only writer of `pipeline_runs.status`. Say so in both specs. If `failure_reason` is written by S-013, S-012 must read it and must not write it.

---

### [BLOCKING] S-012 tester-fail loop has no defined iteration baseline

AC-10 and the transition table say `TESTER FAIL>0` or `TYPECHECK=red` loops to step 12 and increments `iteration`, and at iteration ≥ 3 escalates to a gate.

Nothing states the value of `iteration` when the run is created, or when it resets. Protocol §7 says iteration starts at 1. If the daemon increments before the compare, the third failure is `iteration=3` and escalates. If it compares then increments, the third failure still loops and the fourth escalates. Reject also increments `iteration` (S-012 lines 77-78). A reject at the spec gate therefore consumes the same counter the tester loop uses. A run that was rejected twice would escalate on the first tester failure.

Protocol §7 also says escalation happens "after iteration 3 with `FAIL>0` or `ESCALATE>0`." S-012 escalates when `ESCALATE>0` immediately, on any non-gate step, with no iteration check. Review-format §3.2 says iter3 remaining BLOCKING must escalate and iter4+ is mandatory escalation. S-012 has no rule that maps review iteration onto `pipeline_runs.iteration`, and no step that reads a review verdict. A REQUEST_CHANGES review whose signal is `STATUS=PARTIAL` and `ESCALATE=0` (the value protocol §6 requires for that verdict) advances the pipeline. The review-format iteration cap is unreachable from this spec.

**Evidence:** `specs/S-012-daemon-engine.md:72`, `specs/S-012-daemon-engine.md:77-78`, `specs/S-012-daemon-engine.md:108`; `specs/pipeline-signal-protocol.md:214-221`, `specs/pipeline-signal-protocol.md:240-242`; `specs/review-format.md:223-233`  
**Required action:** Define `iteration` initial value, whether the tester loop compares before or after increment, and that reject uses a separate counter (or resets `iteration` at step boundaries). Add an explicit rule for review verdicts: either `REQUEST_CHANGES` is carried by `ESCALATE>0` and the protocol §6 row is what S-012 implements, or S-012 reads the verdict. State which document wins.

---

### [BLOCKING] S-014 inbox location cannot see gates for every registered product

AC-1 and the visible outcome require `synapse inbox` to list pending gates across all products by scanning `.synapse/run/GATE-*.md`.

S-011 puts that directory inside the registered repo, and adds it to that repo's `.gitignore`. S-014's scan path is `.synapse/run/` with no product root. Read from the Synapse repo, that glob sees only Synapse's own gates. Read from an arbitrary cwd, it sees none. HLT-2 says the same scan. There is no rule that inbox walks every `repos.yaml` path and globs `{product}/.synapse/run/GATE-*.md`.

A second product registered by S-011 therefore produces gates S-014 cannot list, so AC-1 is unsatisfiable for the multi-product case the visible outcome promises. Approve and reject take a run-id and do not say which product root holds the GATE file, so they have the same lookup hole.

**Evidence:** `specs/S-014-human-gate.md:27-28`, `specs/S-014-human-gate.md:45`, `specs/S-014-human-gate.md:58`; `specs/S-011-product-registration.md:31`, `specs/S-011-product-registration.md:51`  
**Required action:** Define inbox, approve, and reject as iterating registered product roots from `repos.yaml` and reading `{path}/.synapse/run/GATE-{run-id}.md`. State that the Synapse repo root is not the scan root.

---

### [BLOCKING] S-015 indexes task files that have no status frontmatter, then halts on mismatch

S-015's mismatch rule compares DB `status` to file frontmatter `status` for an existing row, and halts the daemon on difference. The canonical set includes `tasks/current/`, `tasks/done/`, and `tasks/deferred/`.

Task format does not put `status` in the task block. Status lives in a table at the bottom of `tasks/current/phase-N.md` (`⬜ todo`, `🔄 in-progress`, `✅ done`, `❌ failed`, `⏸️ blocked`). A phase file contains many tasks. S-015 has one row per file (path is the identity implied by AC-6) and one `status` field. There is no mapping from the status-table symbols to a frontmatter `status`, and phase files have no frontmatter.

On the second startup the row exists. The file still has no `status` frontmatter. The comparison is either "missing vs stored" (halt — daemon cannot boot a repo that has tasks) or "skip" (then task status is never checked, and AC-5's "file frontmatter" rule is false for one of the six types). Plans and reviews also have no `status` field in their format docs; only feature specs do. The overview's example (DB `approved` vs file `draft`) is the spec case. Applying that comparison to every indexed type makes startup halt on the common case.

AC-2 also requires a created date. Spec frontmatter has `created`. Review filenames have a timestamp. Task phase files have an `Updated` line and no per-artifact created date. The column is unspecified for five of the six types.

**Evidence:** `specs/S-015-artifact-index.md:19-20`, `specs/S-015-artifact-index.md:34`, `specs/S-015-artifact-index.md:47`, `specs/S-015-artifact-index.md:55`; `specs/task-format.md:173-183`  
**Required action:** Define status extraction per type. For specs, compare frontmatter `status`. For tasks, either index one row per task block and map the status-table symbol, or exclude tasks from the mismatch check and say so in AC-5. State the created-date source per type, including the value used when the file has none.

---

### [WARNING] S-012 step 1 has no input contract

The fixed sequence always starts at step 1, `research-to-features`. The visible outcome says the user is a developer whose repo already has tasks in `tasks/current/`. `synapse start` creates a run and begins step 1 with no flag to start at task-gen or implement. Research-to-features, per the feature-spec-format example, reads a human research doc and writes spec stubs. S-012 never says which doc, or what happens when `docs/research/` is empty, or when specs already exist and are approved.

A second `synapse start` after a `done` run is also unspecified: new run from step 1 (regenerates specs) or refuse because a run exists. AC-1 only says a run record is created and step 1 begins.

**Evidence:** `specs/S-012-daemon-engine.md:26-28`, `specs/S-012-daemon-engine.md:86-87`, `specs/S-012-daemon-engine.md:99`  
**Suggested action:** State the start-step rule and the research-doc input. If mid-pipeline start is out of scope, say `synapse start` always begins at step 1 and name the input file.

---

### [WARNING] S-012 depends on S-013 and S-015, which do not depend on S-012, but call each other

S-012 `depends_on: [S-013, S-015]`. S-013 has no `depends_on` and writes `pipeline_runs.status`, which only exists once S-012's run table exists. S-015 has no `depends_on` and is invoked by S-012's step executor. S-014 depends on S-012 and then owns transitions S-012 also specifies.

Feature-spec-format defines `depends_on` as "IDs of other specs this spec depends on" and does not say whether the edge means build-order or call-direction. An implementer reading only the edges builds S-013 and S-015 first, then finds both specs call back into S-012.

**Evidence:** `specs/S-012-daemon-engine.md:9`; `specs/S-013-signal-parser.md:1-8`; `specs/S-015-artifact-index.md:1-8`; `specs/S-014-human-gate.md:9`  
**Suggested action:** Either add the reverse edges or add one sentence to each spec: `depends_on` is build order, and runtime calls into a dependent are allowed only through the named function (`parseSignal`, incremental index).

---

### [WARNING] S-011 registration identity is path-only and can fork one repo into two products

HLT-2 treats a product as already registered only when the absolute resolved path matches `repos.yaml` or `synapse.db`. AC-5 says the same. `name` is the repo directory name (AC-3) and is not part of the identity check.

Two different directories with the same basename both register. `synapse start <product>` and `synapse status <product>` take that name. The spec does not say which row wins, whether the second add fails, or whether `name` must be unique. A symlink to an already-registered repo resolves to the same path and is idempotent; a bind mount or a renamed parent directory is a new path and a second registration of the same git toplevel. HLT-1 already runs `rev-parse --show-toplevel` and does not use that result as the identity key.

AC-2 is a compound of "DB row exists" and "repos.yaml entry exists," which the format flags ("and" is a red flag). The parenthetical about `synapse products` is a note, not a criterion. Not blocking on its own because both halves are also stated separately in AC-3 and the DB MUST.

**Evidence:** `specs/S-011-product-registration.md:37-40`, `specs/S-011-product-registration.md:58`  
**Suggested action:** Make `name` unique in `repos.yaml` and fail the second add with a clear error. Use `rev-parse --show-toplevel` as the stored `path`. Split AC-2 so the DB assertion stands alone.

---

### [WARNING] S-011 MUST NOT forbids the `.gitignore` write S-011 requires

MUST NOT: "modify any pre-existing file inside the registered repo; creating empty `.gitkeep` markers in newly-created dirs is permitted."

HLT-6 and AC-8 require editing the repo's `.gitignore` when it already exists, to append `.synapse/run/`. That is a modification of a pre-existing file. The exception names only `.gitkeep`. A test that enforces the MUST NOT as written fails AC-8. A test that enforces AC-8 violates the MUST NOT.

HLT-3 adds a `.gitkeep` to every newly created dir, including `tasks/current/` and `reviews/feedback/`. The format docs treat those directories as places agents write. A `.gitkeep` is a tracked file the pipeline did not ask for. The MUST NOT permits it; no AC says whether an existing `.gitkeep` is left alone (it must be — "newly created" only).

**Evidence:** `specs/S-011-product-registration.md:63`, `specs/S-011-product-registration.md:79`  
**Suggested action:** Add `.gitignore` append to the MUST NOT exception, limited to adding the `.synapse/run/` line when absent. State that existing files, including an existing `.gitignore` line, are not rewritten.

---

### [WARNING] S-013 last-line rule is one terminator stricter than the protocol, and the malformation regex is wider than the protocol

Protocol §5 says the writer emits `artifact_content + "\n" + signal + "\n"`. S-013 HLT-1 strips exactly one trailing terminator and treats `-->\n\n` as an empty last line, hence `SIGNAL_ABSENT`. That matches a writer that followed the protocol and then a tool added a trailing blank line. It also means a conforming writer that ends in a single `\n` works. Good — but protocol §4.3 says the daemon reads only the last line and does not define stripping. S-013 is the stricter contract. Implementations that follow the protocol regex against the raw file including a trailing empty line will classify conforming artifacts as absent. The spec should say S-013's strip rule is the one the daemon uses, so the protocol's "last line" means "last non-implementation-defined line after one strip."

AC-4's open-pattern is `<!--\s*(PIPELINE|TESTER)_SIGNAL` with or without a colon. Protocol §4.2 says malformation is a last line that matches `<!-- PIPELINE_SIGNAL` or `<!-- TESTER_SIGNAL` and then fails the full regex. A line such as `<!-- PIPELINE_SIGNAL_NOTES -->` matches S-013's open pattern and becomes `SCHEMA_VIOLATION`. The protocol would treat it as `SIGNAL_ABSENT`. Tests cannot satisfy both documents.

S-013 also does not say which parser wins if a line matches both, or that an unknown signal type is absent. The protocol only defines two types, so this is a gap rather than a contradiction.

**Evidence:** `specs/S-013-signal-parser.md:49-52`, `specs/S-013-signal-parser.md:39-42`; `specs/pipeline-signal-protocol.md:172-174`, `specs/pipeline-signal-protocol.md:199-203`  
**Suggested action:** State that the protocol §4.2 open-pattern is `<!-- PIPELINE_SIGNAL` or `<!-- TESTER_SIGNAL` after the one-terminator strip, and that S-013's open-pattern must be that prefix, not `PIPELINE_SIGNAL` as a substring.

---

### [WARNING] S-014 reject does not specify the feedback file the specialist is required to read

Review-format §4 defines the feedback note: path `reviews/feedback/YYYY-MM-DDTHH-MM_{type}-{id}.md`, heading, author, rejected artifact, date, run id, rejection note, and "Required Before Next Iteration." It says the dispatcher injects `reviews/feedback/` and the next specialist must read it.

S-014 HLT-4 says "writes feedback file to `reviews/feedback/`." AC-3 and the MUST say the file contains the note text. They do not require the review-format filename, the run-id in the file, the rejected artifact path, or the type (`spec` vs `plan`). S-012 says the rewound specialist "reads `reviews/feedback/`" with no rule for which file, or for a directory that already has notes from another run. A specialist that reads the newest file can apply another run's note. A specialist that reads all files can apply a stale note from a previous reject of the same run.

S-014 also does not say which repo receives the file when inbox is multi-product. Combined with the inbox-path finding, the feedback write has no root.

**Evidence:** `specs/S-014-human-gate.md:31-34`, `specs/S-014-human-gate.md:61`, `specs/S-014-human-gate.md:71`; `specs/review-format.md:237-262`  
**Suggested action:** Require the review-format filename and body, with `{type}` taken from `gate_type` and `{id}` from the run-id. State that the rewound specialist reads the feedback file whose run-id matches the current run, in the product repo.

---

### [WARNING] S-012 names `synapse resume` and never specifies it

Visible outcome: the user must explicitly `synapse resume` unless `auto_resume: true`. No AC, HLT, or MUST defines `synapse resume`: which statuses it accepts (`stopped` only, or also `failed` and `waiting`), whether it continues at `current_step` or restarts the step, and what it does if the step's subprocess is gone. After a restart, a `running` run is now `stopped` mid-step. Resume has to re-spawn that step or skip it. The spec does not say which.

**Evidence:** `specs/S-012-daemon-engine.md:91-93`  
**Suggested action:** Add an AC: `synapse resume <product>` on a `stopped` run re-spawns the current step and sets `running`. State that `failed` and `waiting` are not resumed by this command.

---

### [WARNING] S-015 incremental index has no identity key and no mismatch behavior

AC-4 says that after the S-012 step executor calls the incremental indexer, `synapse artifacts` includes the new artifact without a restart. HLT-6 is one line. It does not say what happens when the artifact path already has a row, when the new file's status differs from the stored status, or when the specialist rewrote a file in place (spec triage does this). Startup treats status difference as a halt. Incremental index is the path that observes the write. If it upserts silently, the next startup no longer sees a mismatch and AC-5 never fires for pipeline-authored edits. If it halts, every spec-status change during a run kills the daemon.

Canonical dirs also omit `tasks/future/` and `plans/` itself (only `plans/current/` and `plans/done/`). S-011 creates `tasks/future/`. A task file written there is invisible to the index. That may be intentional; it is not stated.

**Evidence:** `specs/S-015-artifact-index.md:22-24`, `specs/S-015-artifact-index.md:46`, `specs/S-015-artifact-index.md:57`  
**Suggested action:** Define the upsert key (`product_id` + relative path). State that incremental index inserts and path-updates, and that status mismatch halts only on startup scan, or halts on both — one of the two, written down. List `tasks/future/` as excluded.

---

### [INFO] S-011 `updated` is 2026-09-28 while the file has clearly been revised

Feature-spec-format says `updated` MUST be today's date on every edit. All five specs say `updated: 2026-09-28`. If these bodies were edited on 2026-09-29, the field is stale. This review does not treat a date field as a behavioral defect. Noted so triage can bump it if an edit lands.

**Evidence:** `specs/S-011-product-registration.md:6` (same field on S-012 through S-015)  
**Suggested action:** None for this review.

---

### [INFO] S-013 documents a DB schema the feature-spec format does not list

The DB Schema section sits between High-Level Tasks and Test Contract. Feature-spec-format says required sections appear in order and optional sections may appear after the required sections. A section inserted before Test Contract is extra structure. The schema content is necessary; the placement is the only issue. Validators that require "exactly these sections in this order" could reject S-013 for a section the format does not name. S-012's Pipeline Step Sequence and Run Status Enum sections have the same shape and are also load-bearing.

**Evidence:** `specs/S-013-signal-parser.md:61`; `specs/feature-spec-format.md:55-57`, `specs/feature-spec-format.md:136-138`  
**Suggested action:** None required for correctness. If a schema validator is strict about section order, move DB Schema under Notes.

---

## Missing Tests / Test Gaps

Mapped to MUST / MUST NOT entries that are missing, untestable as written, or that contradict an AC.

- S-012 MUST "daemon restart sets `running` runs to `stopped`; `waiting` runs remain `waiting`" cannot be tested together with the visible outcome that sets both to `stopped`. One of the two assertions has no passing test.
- S-012 has no MUST for `auto_resume: true`, which the visible outcome makes user-visible.
- S-012 MUST "`synapse reject` at SPEC GATE rewinds `current_step` to 1" does not say the GATE file is kept or deleted. S-014 MUST NOT "delete GATE file on reject" has no paired test for "inbox hides a GATE file whose run is `running`" versus "inbox still lists it."
- S-012 transition table has no MUST that `STATUS=DONE` on step 15 sets `done`, or that `STATUS=DONE` on steps 1-14 stays `running`. AC-1 covers start only.
- S-012 has no MUST for `synapse approve` (the advance half of the gate). S-014's approve MUST does not assert `current_step` is unchanged, which S-012 requires.
- S-012 has no MUST that `ESCALATE>0` on a gate step does not write a second GATE file.
- S-013 MUST for `SCHEMA_VIOLATION` does not include the protocol §4.2 case (prefix matches, body fails) as distinct from S-013 AC-4's wider open-pattern. A test for `<!-- PIPELINE_SIGNAL_NOTES -->` cannot satisfy both.
- S-013 has no MUST that `pipeline_runs.status` is left to S-012. Its HLT-6 says the parser writes status, so a test of "parser sets status to `failed`" collides with a test of "only HLT-5 writes status."
- S-014 has no MUST that `synapse inbox` finds a GATE file in a second registered product's `{path}/.synapse/run/`. AC-1 requires it.
- S-014 has no MUST that approve/reject of a run-id resolves the product root from `repos.yaml`.
- S-014 has no MUST that the feedback file follows `reviews/feedback/YYYY-MM-DDTHH-MM_{type}-{id}.md` or contains the run-id. The MUST only requires that the note text appear somewhere in the file.
- S-015 has no MUST for status extraction from a phase file that has no `status` frontmatter. AC-5's mismatch test cannot be written for `tasks/current/` until the mapping exists.
- S-015 has no MUST that incremental indexing of an existing path with a changed status either halts or does not. AC-4 and AC-5 currently demand opposite behavior for that case.
- S-011 has no MUST that a second repo with the same directory basename is rejected or disambiguated. `synapse start <product>` is then untestable.
- S-011 MUST NOT "modify any pre-existing file" has no exception test for the `.gitignore` append that AC-8 requires. The two assertions cannot both pass.

## Architectural & Compatibility Risk

These five specs are the runtime spine: register, run, parse, gate, index. The contradictions are on the boundaries, which is where the daemon will deadlock or double-write.

The highest risk is split ownership of `pipeline_runs.status` and of the GATE file. If S-013 and S-012 both write status, a tester failure can be stored as `failed` by the parser and as `running` by the state machine in either order. If S-014 keeps the GATE file on reject while S-012 immediately re-dispatches, inbox and the serial-mode "one GATE file" invariant diverge, and the next gate clobbers the feedback trail's only pointer.

S-015's mismatch halt, applied to task files that have no frontmatter status, will stop the daemon on the first restart after indexing tasks. That makes S-012's restart MUST untestable in a repo that has a phase file.

S-014's inbox glob, rooted at the process cwd rather than each product path, means a second registered product's gates never appear. S-011's purpose is registering that second product.

Protocol §6 (`REQUEST_CHANGES` → `STATUS=PARTIAL`, `ESCALATE=0`) plus S-012's rule that `PARTIAL` advances means a blocking spec review does not pause the pipeline. The review-format iteration cap never engages. That is a pipeline-control hole, not a wording nit.

## Verdict

REQUEST_CHANGES

<!-- PIPELINE_SIGNAL: STATUS=PARTIAL AUTO-FIX=0 ESCALATE=0 -->
