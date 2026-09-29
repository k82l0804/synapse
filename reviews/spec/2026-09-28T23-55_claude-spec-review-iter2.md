# Spec Review: S-011..S-015 iter2

> **Reviewer:** Claude (read-only)
> **Artifact:** `specs/S-011-product-registration.md`, `specs/S-012-daemon-engine.md`, `specs/S-013-signal-parser.md`, `specs/S-014-human-gate.md`, `specs/S-015-artifact-index.md` (plus `specs/feature-spec-format.md`, `specs/task-format.md` as touched by the fixes)
> **Date:** 2026-09-28T23:30
> **Iteration:** 2
> **Verifies:** `reviews/triage/2026-09-28T23-06_spec-triage-phase-2-v3.md` (16 decisions), applied in commit `4dcbd83`
> **Prior iteration:** `reviews/spec/2026-09-28T22-58_claude-spec-review.md` (REQUEST_CHANGES, 4 BLOCKING)

---

## Triage v3 Fix Verification

Each triage decision checked against the current spec text (commit `4dcbd83`).

| ID | Decision | Applied? | Notes |
|----|----------|----------|-------|
| B-1 | Allow `[A-Z]-\d{3}` prefix in `feature-spec-format.md` | **PARTIAL** | §2 field rule updated. §6 Schema Checklist still says `F-\d{3}`; §7 filename convention still hard-codes `F-XXX`. See BLOCKING-1. |
| B-2 | S-012 step sequence + status enum + auto_resume | **PARTIAL** | Step table and enum added; `auto_resume` specified. But AC-4 and the MUST still assert literal `TASK_FAILED`; the enum covers only two of the protocol's failure outcomes. See BLOCKING-2, WARNING-1. |
| B-3 | `GATE-{run-id}.md` naming in S-014 + AGENTS.md | **PARTIAL** | All normative sections (UTO, AC, HLT, Test Contract) use `GATE-{run-id}.md`. Overview line 15 still says "writes a `WAITING` file"; Trigger still names a `GATE_WAITING` state that S-012's enum does not define. Re-dispatch target on reject is undefined. See BLOCKING-4, WARNING-2. |
| B-4 | §3.4 one task block per feature | **PARTIAL** | `feature-spec-format.md` §3.4 updated. `task-format.md` (also frozen) still says one task = one HLT and defines `spec_task: HLT-N` as a single HLT. See BLOCKING-5. |
| W-4 | S-011 allow `.gitkeep` in new dirs | **YES** | MUST NOT reworded correctly. |
| W-5 | S-011 AC-2 test against DB row | **PARTIAL** | AC-2 fixed and annotated "future feature, not in scope". Overview, Visible Outcome, and the MUST "product appears in `synapse products` after add" still require the out-of-scope command. See BLOCKING-3. |
| W-6 | S-011 add non-git AC-7 | **YES** | AC-7 present. No corresponding MUST (test gap). |
| W-7 | S-013 failure strings verbatim | **YES** | AC-3, AC-4, and both MUSTs quote `pipeline-signal-protocol.md` §4 exactly. `tasks/current/phase-2.md` T-2-1 AC-4 fixed; AC-3 still abbreviated (see task-file notes). |
| W-8 | S-013 DB schema section | **YES (incomplete)** | `signals` table defined. `pipeline_runs.failure_reason` and `pipeline_runs.status`, which S-013 AC-3/AC-4 write, are not listed. `last_signal TEXT` references `signals.id INTEGER`. See WARNING-6. |
| W-9 | S-015 one canonical dir list; fix `shipped` | **YES** | Overview, AC-1, AC-6, HLT-1, HLT-3 all use the same 11-dir list. Example now `approved` vs `draft`. |
| W-10 | S-012 HLT-3 calls indexer; S-015 cross-ref | **YES** | Both sides reference each other. New `depends_on: [S-013, S-015]` on S-012 inverts the task-file dependency order. See WARNING-3. |
| W-11 | S-012 AC-5 "real time" → committed DB state | **YES** | |
| W-12 | S-012 `auto_resume` default false, in `repos.yaml` | **YES** | Specified in Visible Outcome only; no AC or MUST covers it (test gap). |
| W-13 | S-014 add MUST for gate type in inbox | **YES** | |
| W-14 | S-015 first-run empty DB not a mismatch | **YES** | Overview, Visible Outcome, AC-5, HLT-4, and a MUST all agree. |
| W-15 | S-015 list all `--type` values | **YES** | Six values, consistent across Visible Outcome, AC-3, HLT-2, HLT-5, MUST. |

Summary: 9 fully applied, 6 partially applied, 1 applied but incomplete. None of the partial applications is cosmetic; each leaves a normative section (a MUST, an AC, or a frozen-format checklist) contradicting the fixed text elsewhere.

---

## Findings

### [BLOCKING] B-1 incomplete: `feature-spec-format.md` §6 checklist still rejects every `S-0NN` spec

The B-1 fix changed §2's prose rule to `[A-Z]-\d{3}` with a repo-configurable prefix. It did not change §6, the Schema Checklist that the document itself designates "for validators and review agents". §6 still reads `Wrong id format | Must match F-\d{3}`. §7 still mandates the filename `specs/F-XXX-kebab-case-name.md`. A validator implementing §6 as written fails all five Phase 2 specs, which is exactly the iter1 BLOCKING this fix was meant to close. The frontmatter template in §2 was also flipped from `F-XXX` to `S-XXX` while the same section says the default prefix is `F`; the §5 full example still uses `F-001`. The document now disagrees with itself in three places about what a valid id looks like.

**Evidence:** `specs/feature-spec-format.md:33,39,44-46,223,242,249`
**Required action:** Update §6 row to `Must match [A-Z]-\d{3}, prefix equal to the repo's configured id_prefix`; update §7 to `specs/{PREFIX}-XXX-kebab-case-name.md`; make the §2 template placeholder prefix-neutral (`{P}-XXX`) or restore `F-XXX` to match the stated default.

---

### [BLOCKING] S-012 state machine has no transition for valid non-DONE signals

The new Run Status Enum defines `failed` as "a step produced SIGNAL_ABSENT or SCHEMA_VIOLATION" and closes with "There is no other run status." The frozen protocol defines four further outcomes the daemon must act on, none of which has a legal target state in S-012:

1. `PIPELINE_SIGNAL STATUS=FAILED` (valid, well-formed). Protocol §2.1: "Mark job failed; notify inbox." S-012's `failed` definition excludes this case.
2. `PIPELINE_SIGNAL ESCALATE>0`. `AGENTS.md` §5: "ESCALATE converts any step into an ad-hoc gate." S-012's step table marks only steps 4 and 11 as gates and its state machine has no path from a non-gate step to `waiting`.
3. `TESTER_SIGNAL FAIL>0` or `TYPECHECK=red`. Protocol §3.1: "trigger fix-tests cycle", escalate at iteration ≥ 3. S-012's fixed 15-step list has no fix-tests step and no loop-back.
4. `STATUS=PARTIAL`. Protocol says "Advance; log warnings to run log." S-012 never mentions PARTIAL or a run log.

The protocol §7 columns `current_step`, `auto_fix_count`, `escalate_count`, `iteration` on `pipeline_runs` are owned by nobody: S-013 HLT-6 updates only `last_signal`; S-012 HLT-4 says "apply the result to update DB run state" without naming any column. Two implementers of HLT-4/HLT-5 could ship different behaviors for a `STATUS=FAILED` triage signal and both satisfy the spec as written.

**Evidence:** `specs/S-012-daemon-engine.md:26-43,52-62,92-93`; `specs/pipeline-signal-protocol.md:49-53,108-112,228-242`; `AGENTS.md` §5 line 113
**Required action:** Extend the enum text so `failed` covers `STATUS=FAILED`; state that `ESCALATE>0` transitions `running → waiting` and writes a GATE file (ad-hoc gate, per AGENTS.md); state the daemon action on `TESTER_SIGNAL FAIL>0`/`TYPECHECK=red` (either a bounded loop-back to step 12 with `iteration` incremented, or `failed` with a note that fix-tests is deferred, with a matching file in `tasks/deferred/`); name which component increments the protocol §7 counters. Add one MUST per outcome.

---

### [BLOCKING] W-5 incomplete: S-011 Test Contract still requires an out-of-scope command

AC-2 now says "`synapse products` list command is a future feature not in scope for this spec." The Test Contract MUST list still contains "product appears in `synapse products` after add", and the Overview and Visible Outcome both describe `synapse products` output as the observable result. Per `feature-spec-format.md` §3.5 every MUST must map to a test assertion; this MUST cannot, by the spec's own note. `plans/current/2026-09-28T17-51_plan-T-2-2.md:157` already maps a test `productAppearsInRegistry` to it, so the contradiction has propagated.

**Evidence:** `specs/S-011-product-registration.md:16-17,23,34,58`
**Required action:** Either (a) delete the MUST and reword Overview/Visible Outcome to the DB row + `repos.yaml` entry, or (b) decide `synapse products` is in scope, add an HLT for it, and drop the "future feature" note from AC-2. Pick one and apply to all four locations.

---

### [BLOCKING] S-014 reject: "re-dispatches the same step" targets the gate itself

The B-3 fix defines the reject transition as `waiting → running` "so it re-dispatches the same step." In S-012's step table the step the run is paused on is step 4 `[SPEC GATE]` or step 11 `[PLAN GATE]`, which spawn no specialist. Re-dispatching "the same step" re-enters the gate and immediately writes a new GATE file for the identical artifact. The intended behavior (a specialist regenerates after reading `reviews/feedback/`) requires the daemon to rewind `current_step` to a generator step, and neither spec says which one: step 1 (regenerate specs), step 3 (re-triage), step 8 (re-plan), or step 10. S-012, which owns the state machine (HLT-5 lists `waiting → running (approve/reject)` as a single arrow), does not distinguish approve from reject at all.

**Evidence:** `specs/S-014-human-gate.md:31-34,46,56`; `specs/S-012-daemon-engine.md:26-43,93`
**Required action:** In S-012, define the reject transition explicitly: `waiting → running` with `current_step` set to the gate's generator step (SPEC GATE → step 1, PLAN GATE → step 8), `iteration` incremented. In S-014, replace "re-dispatches the same step" with a reference to that rule. Add a MUST in S-012 that reject at the SPEC GATE causes step 1 to be re-spawned.

---

### [BLOCKING] B-4 incomplete: `task-format.md` still mandates one task per HLT

`feature-spec-format.md` §3.4 now says one task block per feature covering all HLTs via `spec_task: HLT-1 through HLT-N`. `task-format.md`, equally frozen, still says: "A task is a discrete unit of work that maps directly to a High-Level Task (HLT)" (§1), defines `spec_task: HLT-N — which HLT in the spec this task implements` (§2, §3), and "Maps to exactly one HLT in an approved spec" (§4). The two frozen Layer 0 documents now contradict each other, and `tasks/current/phase-2.md` conforms to one and violates the other. The iter1 BLOCKING said "pick one and apply it uniformly"; it was applied to one document.

**Evidence:** `specs/task-format.md:11-12,37,68,90`; `specs/feature-spec-format.md:107-109`; `tasks/current/phase-2.md:29,55,74,101,124`
**Required action:** Update `task-format.md` §1, §2, §3 and §4 to match: `spec_task: HLT-1 through HLT-N` (range allowed), "maps to one feature's HLT range". Also correct §2's "One task → one plan. Tasks and plans are 1:1" only if it still holds under the per-feature rule (it does; state it explicitly).

---

### [BLOCKING] S-013 does not define trailing-newline handling for `readLastLine`

The protocol's §5 agent instruction says "nothing after, including trailing newlines," but its own reference pseudocode writes `artifact_content + "\n" + signal + "\n"`, producing a file whose literal last line is empty. Every conforming agent, every editor, and every `echo >>` produces a trailing `\n`. S-013 HLT-1 says only "reads the last line of a file". If an implementer returns the text after the final `\n` (the literal last line), every artifact in the system is `SIGNAL_ABSENT` and the pipeline can never advance. If they return the last non-empty line, blank lines after the signal are silently accepted, violating the placement rule. Neither AC nor MUST distinguishes these, and the spec's plan (`plan-T-2-1.md`) inherits the ambiguity. This is a single sentence to fix and a single test to add, but without it the two obvious implementations produce opposite results on 100% of inputs.

**Evidence:** `specs/S-013-signal-parser.md:49,85-89`; `specs/pipeline-signal-protocol.md:197-203`
**Required action:** Add to HLT-1 and a MUST: "The last line is the final line after stripping exactly one trailing line terminator (`\n` or `\r\n`); no further trimming. A file ending in `-->\n` parses; a file ending in `-->\n\n` is SIGNAL_ABSENT."

---

### [WARNING] S-012/S-013 still assert the literal `TASK_FAILED` as a run status

The enum sentence "`TASK_FAILED` in signals maps to run status `failed`" was added, but S-012 AC-4 and the MUST "absent or malformed signal causes run status to become `TASK_FAILED`" still test for the literal. S-013's Visible Outcome says "`synapse status` shows `TASK_FAILED`" while its AC-3/AC-4 say run status `failed`. A test asserting `status == 'TASK_FAILED'` and a test asserting `status == 'failed'` cannot both pass. `tasks/current/phase-2.md` T-2-1 and T-2-3 use `TASK_FAILED` throughout.

**Evidence:** `specs/S-012-daemon-engine.md:82,102`; `specs/S-013-signal-parser.md:28-29,37,41`; `tasks/current/phase-2.md:40-41,83,92`
**Suggested action:** Use `failed` in every AC/MUST. Keep `TASK_FAILED` only where quoting the protocol's job-level term, and say so.

---

### [WARNING] S-014 Overview and Trigger still use pre-fix vocabulary

Overview line 15: "it writes a `WAITING` file to `.synapse/run/`". Trigger: "Daemon enters `GATE_WAITING` state". S-012's enum has `waiting`, not `GATE_WAITING`, and the file is `GATE-{run-id}.md`. `feature-registry.yaml` S-014 description still says "WAITING file"; `tasks/current/phase-2.md` T-2-4 AC-1 still says "GATE_WAITING items". Not blocking because every normative S-014 section is correct, but the residue is in the two sections a reader hits first.

**Evidence:** `specs/S-014-human-gate.md:15,25`; `feature-registry.yaml:107`; `tasks/current/phase-2.md:106`
**Suggested action:** "writes a `GATE-{run-id}.md` file"; "Daemon enters run status `waiting` and writes ...".

---

### [WARNING] S-012 `depends_on: [S-013, S-015]` inverts the task-file dependency order

S-012 now declares it depends on S-015 (HLT-3 calls the S-015 indexer). `tasks/current/phase-2.md` has T-2-5 (S-015) `depends_on: [T-2-3]` (S-012), the reverse. Implementing T-2-3 first means HLT-3 calls an indexer that does not exist. Either the task order flips (T-2-5 before T-2-3, or in parallel with T-2-1/T-2-2) or S-012 HLT-3 must specify a no-op when the indexer is absent. Separately, `depends_on` is not a field `feature-spec-format.md` §2 defines; §6 does not forbid extra fields, but a strict validator may.

**Evidence:** `specs/S-012-daemon-engine.md:9,91`; `tasks/current/phase-2.md:120-123`
**Suggested action:** Move T-2-5 to depend on `[T-2-1]` only and make T-2-3 depend on `[T-2-1, T-2-2, T-2-5]`; document `depends_on` as an optional frontmatter field in `feature-spec-format.md` §4.

---

### [WARNING] Restart sets `waiting` runs to `stopped`, orphaning their GATE files

The B-2 fix extended the restart rule to "runs that were `running` or `waiting` are set to `stopped`" (Visible Outcome, HLT-1), while AC-6 and the MUST still say only `running`. If `waiting` runs are stopped, the GATE file remains on disk, `synapse inbox` (which scans files) still lists it, and `synapse approve` has no defined behavior on a `stopped` run (S-014 AC-6 covers only "non-existent or already-resolved"). A `waiting` run has no live subprocess to lose; there is no reason to stop it on restart.

**Evidence:** `specs/S-012-daemon-engine.md:71-73,84,89,104`; `specs/S-014-human-gate.md:44,49`
**Suggested action:** Restart rule: `running → stopped`; `waiting` stays `waiting`. Remove `waiting` from Visible Outcome and HLT-1 so AC-6 and the MUST agree with them.

---

### [WARNING] S-014 inbox source of truth is ambiguous once a gate is rejected

AC-1 says inbox lists gates "by scanning `.synapse/run/GATE-*.md`". AC-3 says reject sets the run to `running`. MUST NOT says the GATE file is not deleted on reject. So after a reject the file exists but the run is not waiting: file-driven inbox shows it as pending, `--count` counts it, and a second `approve` must be refused per AC-6 but only if the CLI consults the DB rather than the file. "A new GATE file appears when the regenerated artifact is ready" is actually the same filename overwritten. The spec should say whether the GATE file or `pipeline_runs.status = 'waiting'` is authoritative for inbox, and what the file's content is (HLT-1 lists four fields but no format; the daemon writes it and inbox parses it, so both need the schema).

**Evidence:** `specs/S-014-human-gate.md:27-34,44,46,53,73`
**Suggested action:** Inbox lists GATE files whose run status is `waiting` (DB authoritative), or reject rewrites the GATE file with `status: rejected`. Add a GATE file frontmatter schema (run_id, product, gate_type, artifact_path, created_at) to HLT-1.

---

### [WARNING] S-013 DB Schema omits the columns S-013 itself writes; FK type mismatch

AC-3/AC-4 set `failure_reason` and run status; HLT-5 is "failure classification"; the DB Schema section lists neither `pipeline_runs.failure_reason` nor `pipeline_runs.status`. `pipeline_runs.last_signal TEXT` points at `signals.id INTEGER PRIMARY KEY`. `plan-T-2-1.md:105` already assumes `pipeline_runs.failure_reason` exists, so the schema is being inferred from the plan instead of the spec.

**Evidence:** `specs/S-013-signal-parser.md:37-41,53,78-79`
**Suggested action:** Add `pipeline_runs.status TEXT` and `pipeline_runs.failure_reason TEXT` to the schema block; make `last_signal INTEGER REFERENCES signals(id)`.

---

### [WARNING] S-013 regex accepts `STATUS=<any word>`; enum validation unspecified

`PIPELINE_SIGNAL_RE` uses `STATUS=(\w+)`. `STATUS=BANANA AUTO-FIX=0 ESCALATE=0` matches the regex. The protocol's field table says `STATUS` is an enum of `DONE | PARTIAL | FAILED`. S-013 MUST "parser regex matches exactly the format" is satisfied by accepting BANANA; nothing says whether it is then stored as-is, rejected as `SCHEMA_VIOLATION`, or treated as `FAILED`. Same for `TYPECHECK`, though there the regex itself enforces `green|red`.

**Evidence:** `specs/S-013-signal-parser.md:44-45,90`; `specs/pipeline-signal-protocol.md:43,83-84`
**Suggested action:** Add to AC-4/HLT-5: a regex match whose `STATUS` is outside `{DONE, PARTIAL, FAILED}` is `SCHEMA_VIOLATION`. Add a MUST NOT.

---

### [WARNING] S-011 "git repo" check will reject the self-hosting case

HLT-1 says "verify it's a git repo"; AC-7 rejects non-git paths. Synapse is a git submodule of the fox workspace, so its `.git` is a file (`gitdir: ...`), not a directory. An implementer who checks `existsSync(join(path, '.git')) && isDirectory()` rejects `synapse add ./` on synapse itself, which is Phase 2's stated goal. Worktrees have the same shape.

**Evidence:** `specs/S-011-product-registration.md:43,47`; `tasks/current/phase-2.md:4-5`
**Suggested action:** Define "git repo" as `git -C <path> rev-parse --show-toplevel` succeeding (with `GIT_TERMINAL_PROMPT=0`), and add a MUST covering a `.git`-file repo (submodule or worktree).

---

### [WARNING] S-011 AC-3 "defaults" is not enumerated

AC-3 and HLT-4 say the `repos.yaml` entry has "name, path, and defaults." S-012 expects `auto_resume` there; `feature-spec-format.md` expects `id_prefix` there. Neither is named in S-011, so a test for AC-3 has no key list to assert. The synapse repo currently has no `repos.yaml` at all, so S-011 is the spec that must define its shape.

**Evidence:** `specs/S-011-product-registration.md:35,50`; `specs/S-012-daemon-engine.md:72-73`; `specs/feature-spec-format.md:46`
**Suggested action:** Enumerate the entry keys in AC-3: `name`, `path` (absolute), `auto_resume: false`, `id_prefix`. Add a MUST asserting the keys.

---

### [WARNING] S-015 mismatch halt fires on the normal human approval workflow

The mismatch detector compares DB `status` against file frontmatter `status` for existing rows and halts on any difference. The only way a spec's frontmatter changes from `draft` to `approved` is an edit to the file (the format says `approved` means "human has reviewed and approved at spec gate", and S-014 approve does not say it edits the spec file or the `artifacts` row). So the ordinary sequence "human approves spec, daemon restarts" produces exactly the halt S-015 treats as corruption. The spec also does not say what happens for artifact types with no `status` frontmatter (reviews, triage reports, feedback notes, task phase files), which is most of the canonical set.

**Evidence:** `specs/S-015-artifact-index.md:19-21,34,47,55,63,69`; `specs/feature-spec-format.md:48-50`
**Suggested action:** Define who writes spec `status` at gate approval (S-014 approve updates both file and DB row atomically, or file is authoritative and the scanner updates DB). Define "no `status` in frontmatter" as `NULL`, never a mismatch. This may need a human call at the gate; flag as an Open Question in S-015 if not resolved in triage.

---

### [INFO] S-012 User precondition contradicts AC-1

User: "Developer whose repo is registered and has tasks in `tasks/current/`". AC-1: `synapse start` "begins step 1" (research-to-features, which consumes `docs/research/`, not tasks). A product that already has tasks would restart from research. There is no `--from-step` or auto-detection described. Worth a sentence on what `start` does when specs or tasks already exist.

**Evidence:** `specs/S-012-daemon-engine.md:66,79`

---

### [INFO] S-012 MUST "each step spawns exactly one specialist subprocess" is false for gate steps

Steps 4 and 11 spawn nothing. Reword to "each non-gate step".

**Evidence:** `specs/S-012-daemon-engine.md:33,40,101`

---

### [INFO] Role names in the S-012 step table are not defined anywhere

`Architect`, `Reviewer`, `Planner`, `Approver`, `Coder` appear only in S-012. `skills/tool-roles/SKILL.md` uses different labels. Either point at a definition or drop the column.

**Evidence:** `specs/S-012-daemon-engine.md:27-42`

---

### [INFO] Frontmatter `status: draft` now disagrees with `feature-registry.yaml` and with `plans/current/`

The fix commit correctly reverted all five specs to `draft`. `feature-registry.yaml` still lists S-011..S-015 as `approved`. `plans/current/*plan-T-2-{1..5}.md` were generated at 17:51 from the pre-review specs and reference `.synapse/run/WAITING`, `readLastLineUsesFileSeek`, and `synapse products`; `plan-format.md` §2 requires the spec to be `approved` before a plan executes. These are process-state facts, not spec defects, but the plans will need regeneration after this gate, not just re-approval.

**Evidence:** `feature-registry.yaml:86,93,100,107,114`; `plans/current/2026-09-28T17-52_plan-T-2-4.md:17,21,41`; `plans/current/2026-09-28T17-51_plan-T-2-1.md:132`; `plans/current/2026-09-28T17-51_plan-T-2-2.md:157`

---

### [INFO] S-013 `User` field still names an internal component

Carried from iter1. Unchanged, still acceptable to me, still a human call at gate.

**Evidence:** `specs/S-013-signal-parser.md:23`

---

### [INFO] Nobody creates `.synapse/run/`

S-011 creates 15 dirs; `.synapse/run/` is not among them. S-012 and S-014 write into it. Say which component creates it (daemon on first gate is fine) and whether S-011 adds it to `.gitignore`.

**Evidence:** `specs/S-011-product-registration.md:36-40`; `specs/S-012-daemon-engine.md:45`

---

## Missing Tests / Test Gaps

Mapped to the MUST/MUST NOT or AC that lacks coverage.

**S-011**
- AC-6 and AC-7 (non-existent path, non-git path) have no MUST. Add both, plus a `.git`-as-file case.
- AC-3 `repos.yaml` entry: no MUST asserting the key set (see WARNING on "defaults").
- AC-5 "identity check uses absolute resolved path": no MUST for relative vs absolute vs symlinked path resolving to the same product.
- MUST "product appears in `synapse products`": untestable as written (BLOCKING-3).

**S-012**
- No MUST for `auto_resume` default `false` or for `auto_resume: true` behavior on restart.
- No MUST for the gate transition `running → waiting` writing `.synapse/run/GATE-{run-id}.md`.
- No MUST for `STATUS=FAILED`, `ESCALATE>0`, `STATUS=PARTIAL`, or `TESTER FAIL>0` (BLOCKING-2).
- No MUST that the step executor invokes the S-015 indexer after each step (S-015 AC-4 tests it from the other side only).
- No MUST for `stopping` being honored when the stop request arrives mid-step (AC-7 is stated; the MUST says "halts after the current step" without a mid-step timing case).
- MUST "absent or malformed signal causes run status to become `TASK_FAILED`" asserts a value not in the enum (WARNING-1).

**S-013**
- No MUST for trailing-newline handling: `-->\n` parses; `-->\n\n` is SIGNAL_ABSENT (BLOCKING-6).
- No MUST for CRLF line endings.
- No MUST NOT for `STATUS` outside the enum (WARNING on regex).
- No MUST that `signals.raw_line` equals the exact last line read, or that `pipeline_runs.last_signal` points at the newly inserted row.
- No MUST for the SCHEMA_VIOLATION boundary itself (a line matching `<!--\s*PIPELINE_SIGNAL` without colon → SCHEMA_VIOLATION; `<!-- PIPELINE_SIGNA` → SIGNAL_ABSENT). AC-4 states the rule; the Test Contract does not.
- No MUST for an empty file or a file with no newline at all.

**S-014**
- No MUST that the feedback file conforms to `review-format.md` §4 (header block, filename `reviews/feedback/YYYY-MM-DDTHH-MM_{type}-{id}.md`).
- No MUST for the run-status transition on reject, nor for which step is re-dispatched (BLOCKING-4).
- No MUST for `approve`/`reject` on a run whose status is `running` or `stopped` (AC-6 says "already-resolved"; define it).
- No MUST that inbox with two products each at a gate lists two entries (the multi-product case is the reason the GATE-{run-id} naming exists).
- No MUST for `inbox --count` returning `0` with no trailing newline noise when no gates exist.

**S-015**
- No MUST for artifacts with no `status` frontmatter (reviews, feedback, task files) being indexed with `NULL` and never flagged as mismatch.
- No MUST for the path → type classification (which dir yields `review` vs `triage` vs `feedback`).
- No MUST NOT for indexing non-`.md` files in the canonical dirs (`.gitkeep` is present in every one of them after S-011).
- No MUST for the incremental indexer being idempotent when called twice on the same path.

---

## Architectural & Compatibility Risk

1. **Two frozen Layer 0 documents now disagree.** `feature-spec-format.md` §3.4 (per-feature task blocks) versus `task-format.md` §1/§4 (per-HLT). Layer 0 documents are what every specialist loads first; a contradiction there propagates into every generated task file. Fix `task-format.md` in the same triage pass, not a later one.

2. **The state machine is the load-bearing artifact and it is still open on the failure side.** S-012 fixed the happy path (linear 15 steps, two gates). Every non-DONE protocol outcome (FAILED, PARTIAL, ESCALATE, TESTER FAIL) lands outside the enum. The daemon's whole value is deterministic handling of exactly those cases. This should be closed before the plan gate, because `plan-T-2-3.md` will otherwise invent the transitions.

3. **Reject semantics are split across S-012 and S-014 and neither owns them.** S-012 owns the state machine but collapses approve/reject into one arrow. S-014 owns the CLI but says "re-dispatches the same step," which is the gate. Assign ownership to S-012 and have S-014 reference it.

4. **`readLastLine` trailing-newline ambiguity is a pipeline-wide single point of failure.** Not an architectural concern in the usual sense, but the one line of code that gates every state transition has two natural implementations with opposite results on all inputs.

5. **Status authority for spec files is undefined.** S-015 halts on any DB/file status difference, but no spec says who writes `status: approved` into a spec file at gate approval. Until that is defined, the mismatch detector's correct behavior cannot be tested, and its likely real-world behavior is to halt after every human approval.

6. **Dependency inversion between spec frontmatter and task file.** S-012 `depends_on: [S-015]` versus T-2-5 `depends_on: [T-2-3]`. The pipeline's task-review step will read one or the other.

7. **Downstream artifacts are stale.** `feature-registry.yaml` (`approved`, "WAITING file"), all five `plans/current/*` (pre-review content), and `tasks/current/phase-2.md` (T-2-1 AC-3 short reason string, T-2-1 seek MUST, T-2-2 `synapse products`, T-2-4 `GATE_WAITING`) each carry text the fixes removed from the specs. None is in the review scope, all will need a pass once the specs settle.

The underlying design remains sound and the fixes that were applied were applied correctly where they were applied. The remaining problems are all incomplete propagation: a rule changed in one section and left standing in another section of the same or a sibling document.

## Verdict

REQUEST_CHANGES

<!-- PIPELINE_SIGNAL: STATUS=PARTIAL AUTO-FIX=0 ESCALATE=0 -->
