# Spec Review: S-011..S-015 iter3

> **Reviewer:** Claude (read-only, blind — no prior reviews read)
> **Artifact:** `specs/S-011-product-registration.md`, `specs/S-012-daemon-engine.md`, `specs/S-013-signal-parser.md`, `specs/S-014-human-gate.md`, `specs/S-015-artifact-index.md`
> **Date:** 2026-09-29T00:38
> **Iteration:** 3

---

## Findings

### [BLOCKING] B-1: S-012 has 11 acceptance criteria — hard schema violation (max 10)

`feature-spec-format.md` §3.3 states "Minimum 2 criteria, maximum 10", and §6 Schema
Checklist lists `❌ AC count > 10 | More than 10 acceptance criteria` as a
non-conformance that makes the job FAILED, not "close enough". S-012 declares AC-1
through AC-11.

This is not a judgment call — it is the one numeric check in the checklist that a
mechanical validator will reject, and it was introduced by the iter2 fix itself
(commit `7867848`: "AC-8..AC-11 added").

**Evidence:** `specs/S-012-daemon-engine.md:99-109` (11 `- [ ] AC-` lines; verified by count)
**Required action:** Reduce to ≤10 ACs. The natural merge targets are AC-8/AC-9
(both are "signal X drives transition Y") and AC-10/AC-11, or split S-012 into two
features per §3.4's "If more are needed, split into two features."

---

### [BLOCKING] B-2: `pipeline-signal-protocol.md` §4 still mandates `TASK_FAILED`, contradicting the `failed` enum in S-012/S-013

The protocol is a **Frozen Layer 0 document** and is normative. §4.1 and §4.2 state
verbatim:

```
job.status = "TASK_FAILED"
```

S-012 and S-013 now assert the opposite, and S-012's Test Contract makes the
disagreement explicit and testable: "MUST: absent or malformed signal causes run
status to become `failed` (**not `TASK_FAILED`**)".

The iter2 commit message claims this was resolved ("W-1: TASK_FAILED → 'failed' in
S-012/S-013 MUSTs"), but the fix was applied to the downstream specs only — the
upstream frozen protocol was left saying the opposite. Two Layer 0 documents now make
contradictory normative claims about the same DB column, with no precedence rule
anywhere in the repo. An implementer who reads the protocol (as §6 of AGENTS.md
instructs) writes `TASK_FAILED` and fails S-012's test.

**Evidence:** `specs/pipeline-signal-protocol.md:164`, `:177` vs
`specs/S-012-daemon-engine.md:129`, `specs/S-013-signal-parser.md:28`
**Required action:** Either amend the protocol under a phase task (it is frozen —
this requires an explicit task, not a triage auto-fix), or add a normative precedence
clause. Do not leave both readings live. The same defect applies to protocol §7's
`ESCALATED` job status, which does not exist in S-012's run status enum.

---

### [BLOCKING] B-3: A pipeline can reach `done` with unresolved BLOCKING findings

Chain the three documents:

1. Protocol §6: a review agent with "BLOCKING findings found, verdict
   REQUEST_CHANGES" emits `STATUS=PARTIAL ESCALATE=0`.
2. S-012 transition table: `STATUS=PARTIAL` → `running → running` (next step),
   "Daemon logs warnings to run log; advances".
3. S-012 transition table: `STATUS=DONE`/`PARTIAL` after step 15 → `running → done`.

So `code-review` (step 14) reporting BLOCKING findings advances to `code-triage`
(step 15); if `code-triage` cannot fix them it emits `PARTIAL` with `ESCALATE=0`
(nothing in the specs forbids this), and the run terminates as `done`. Code is
marked shipped with unresolved BLOCKING findings and **no gate** — steps 14/15 are
non-gate steps and `Code` has `Gate? No` per AGENTS.md §5.

The only escape is the triage agent voluntarily setting `ESCALATE>0`, which is a
model-owned completion decision — precisely what the harness-owns-done principle
forbids. Nothing in S-012 derives escalation from the review's own BLOCKING count.

**Evidence:** `specs/pipeline-signal-protocol.md:220` (REQUEST_CHANGES → `PARTIAL`),
`specs/S-012-daemon-engine.md:67` and `:66`
**Required action:** Add a deterministic rule: a `PARTIAL` from a review step must not
be allowed to reach `done` without an intervening `DONE` from the following triage
step, or the final step must gate when `escalate_count > 0` or the last review
verdict was REQUEST_CHANGES. Add an AC and MUST for it.

---

### [BLOCKING] B-4: S-012's transition table has no row for a passing `TESTER_SIGNAL`

The table added by the B-2 fix is presented as the normative state machine ("apply
the signal-to-status transition table above", HLT-4). Its only TESTER row is
`TESTER FAIL>0` or `TYPECHECK=red`. There is **no row** for `FAIL=0 AND
TYPECHECK=green` — the happy path of step 13, the most common transition in the whole
system.

The `STATUS=DONE` row cannot cover it: a `TESTER_SIGNAL` has no `STATUS` field
(protocol §3.1). So per S-012's own table, a green test run maps to nothing. Protocol
§3.1 says "advance pipeline", which re-creates B-2's two-documents-disagree pattern
in the other direction: the table is incomplete and the protocol is the only place the
behavior is stated.

**Evidence:** `specs/S-012-daemon-engine.md:64-72` (table rows), `:40` (step 13 signal
type is `TESTER_SIGNAL`)
**Required action:** Add the `FAIL=0 AND TYPECHECK=green → running → running (step 14)`
row, and a MUST asserting it. Relatedly, define what happens when a step emits the
wrong signal *type* (e.g. step 12 emits `TESTER_SIGNAL`) — S-013 HLT-4 "tries both
parsers" with no per-step expected-type validation, so a type-confused signal parses
successfully and then hits no transition row.

---

### [BLOCKING] B-5: S-011's `.gitignore` MUST and "MUST NOT modify pre-existing file" MUST NOT are mutually unsatisfiable

S-011 Test Contract:

- `MUST: .synapse/run/ is added to the repo's .gitignore`
- `MUST NOT: modify any pre-existing file inside the registered repo; creating empty .gitkeep markers in newly-created dirs is permitted`

The carve-out covers `.gitkeep` only. For any repo that already has a `.gitignore` —
i.e. essentially every real repo — HLT-6 must append to a pre-existing file, directly
violating the MUST NOT. A conforming implementation cannot satisfy both, and a test
suite that asserts both will always have one red test.

**Evidence:** `specs/S-011-product-registration.md:76` vs `:79`; HLT-6 at `:63`
**Required action:** Extend the MUST NOT carve-out to `.gitignore` explicitly ("append
a single `.synapse/run/` line to `.gitignore`"), and add the missing idempotency MUST:
running `synapse add` twice must not append a duplicate line.

---

### [BLOCKING] B-6: `synapse resume` is load-bearing in S-012 but has no HLT, no AC of its own, and no test

`synapse resume` appears twice — in the Visible Outcome ("user must explicitly
`synapse resume`") and inside AC-6. It is the *only* path out of the `stopped` state
after a daemon restart, which S-012 says is the normal outcome of every reboot.

Yet: it is not in HLT-1..HLT-7, it has no Test Contract entry, and the transition
table has no `stopped → running` row. The same gap applies to `stopping → stopped`:
AC-7 says stop sets `stopping` and "daemon finishes the current step then halts", but
no AC, MUST, or table row asserts the run ever lands in `stopped`. Two of the six
values in the run status enum have no specified entry or exit.

**Evidence:** `specs/S-012-daemon-engine.md:92`, `:104` (resume referenced);
`:111-122` (HLTs — absent); `:126-137` (Test Contract — absent); `:64-72` (table — no
`stopped → running` or `stopping → stopped` row)
**Required action:** Either add `synapse resume` as an HLT with an AC and MUST plus
the two missing table rows, or scope it out explicitly and state what the enum values
mean in its absence.

---

### [BLOCKING] B-7: Reject and `gate_type` are both undefined for ad-hoc ESCALATE gates

S-012 AC-9 creates gates at arbitrary non-gate steps: "`ESCALATE>0` signal on **any**
non-gate step triggers an ad-hoc gate (`running → waiting`)" and the daemon "writes
GATE file mid-sequence". Two things then break:

1. **`gate_type` has no legal value.** S-014 HLT-1 fixes the GATE frontmatter schema
   with `gate_type` (`spec|plan`). An ad-hoc gate raised at step 13 is neither.
2. **Reject has no rewind target.** S-012's reject rule enumerates exactly two cases
   (SPEC GATE → step 1, PLAN GATE → step 8). S-014 AC-3 nonetheless promises reject
   works at any gate and "sets run status `waiting → running` for re-dispatch". For an
   ad-hoc gate at step 13, `current_step` is rewound to nothing — undefined.

**Evidence:** `specs/S-012-daemon-engine.md:107`, `:69`, `:76-79`;
`specs/S-014-human-gate.md:55`
**Required action:** Add a third `gate_type` value (e.g. `escalate`) and a default
rewind rule for ad-hoc gates (rewind to the escalating step, or forbid reject on
ad-hoc gates and exit non-zero). Add an AC and MUST for whichever is chosen.

---

### [BLOCKING] B-8: `current_step` is typed `TEXT` by the protocol and used as an integer index by S-012

Protocol §7 (frozen, normative) declares:

```sql
current_step     TEXT     -- e.g. "triage"
```

S-012 uses it exclusively as a numeric step index: "rewinds `current_step` to step 1",
"rewind to step 8", "at PLAN GATE rewinds to 8". S-013 introduces a third
representation, `signals.step_index INTEGER`, with no stated relation to
`current_step`. AC-5 then asks `synapse status` to display "the most recently
committed step **name**".

Three encodings of one concept across three Layer 0 documents, with no mapping
defined. The reject rewind — the feature the iter2 cycle was specifically added to fix
— cannot be implemented unambiguously against this.

**Evidence:** `specs/pipeline-signal-protocol.md:235` vs
`specs/S-012-daemon-engine.md:77-78`, `:134`, `:103`; `specs/S-013-signal-parser.md:70`
**Required action:** Pick one representation, state the step-index↔step-name mapping
once (S-012's step table is the natural home), and reconcile the protocol's DDL.

---

### [BLOCKING] B-9: Dual ownership of `pipeline_runs.status` between S-012 and S-013

S-012 states the ownership rule: "The daemon's HLT-5 state machine owns `current_step`,
`auto_fix_count`, `escalate_count`, and `iteration` on `pipeline_runs`. **S-013 owns
`last_signal`.**" — `last_signal`, singular.

S-013 HLT-6 contradicts it directly: "updates `pipeline_runs.last_signal`,
**`pipeline_runs.status`**, and `pipeline_runs.failure_reason`". S-013's DB Schema
block repeats the claim, listing `pipeline_runs.status` among the columns "updated by
this feature".

Meanwhile S-012 HLT-4 has the daemon "apply the signal-to-status transition table
above to update DB run state" — i.e. also writing `status`. Two components write the
same column on the same event, with no stated ordering. Concretely: S-013 writes
`status='failed'` on SCHEMA_VIOLATION while S-012's HLT-5 is concurrently applying its
own transition; last-writer-wins determines whether the run halts.

**Evidence:** `specs/S-012-daemon-engine.md:81-82` vs
`specs/S-013-signal-parser.md:58-59` and `:85-86`
**Required action:** Assign `status` and `failure_reason` to exactly one owner. The
stated architecture (parser is a pure function of the last line; daemon owns state)
argues for S-013 returning a classification and writing only `signals` + `last_signal`.

---

### [BLOCKING] B-10: S-013's "file with no newline" MUST NOT contradicts its own trailing-newline rule and the protocol's authoring guidance

Three statements that cannot all hold:

- Protocol §5 CAUTION: "Write the signal as the absolute last line — nothing after,
  **including trailing newlines**".
- Protocol §5 pseudocode, four lines above: `write_file(path, artifact_content + "\n" + signal + "\n")` — which *does* emit a trailing newline.
- S-013 MUST NOT: "accept an empty file **or a file with no newline** as anything
  other than SIGNAL_ABSENT."

Taken literally, S-013's MUST NOT makes an artifact that follows the protocol's own
CAUTION (signal, no trailing newline) fail as SIGNAL_ABSENT. HLT-1's rule doesn't
disambiguate: it defines the last line as "the content after the final `\n` separator
after stripping exactly one trailing line terminator" — for a single-line file with no
`\n` at all there is no separator, so whether the whole file counts as the last line
is unstated.

This matters because it is exactly the failure mode the signal parser exists to
prevent, and because the CAUTION is what agent authors will follow.

**Evidence:** `specs/pipeline-signal-protocol.md:197` vs `:203`;
`specs/S-013-signal-parser.md:108` vs `:49-52`
**Required action:** State one rule for a file with no trailing terminator (recommend:
treat the whole file as the last line — it is the protocol-CAUTION-conforming output)
and fix the §5 CAUTION/pseudocode contradiction. Add a MUST for the
signal-with-no-trailing-newline case either way.

---

### [BLOCKING] B-11: S-015's mismatch detector is undefined for 10 of its 11 canonical directories

AC-5 and the MUST both key on one comparison: "existing DB row has different `status`
than **file frontmatter**". The canonical set is `specs/`, `plans/current/`,
`plans/done/`, `reviews/spec/`, `reviews/plan/`, `reviews/code/`, `reviews/triage/`,
`reviews/feedback/`, `tasks/current/`, `tasks/done/`, `tasks/deferred/`.

Only `specs/` has a `status` frontmatter field (`feature-spec-format.md` §2:
`draft|approved|done`). `review-format.md` §2.1 and §3 define no frontmatter at all —
reviews open with a blockquote header. Deferred files (§3.1) likewise. Task *blocks*
carry a status symbol in a phase-file table, not per-file frontmatter. Plan
frontmatter is not specified in the files under review.

So for ten of eleven directories, `status` is undefined, and the daemon's halt-on-
mismatch behavior — the feature's entire safety story, and an unconditional halt of
all pipelines — is untestable. Worse, a plausible implementation reads `status` as
`null`/`undefined`, and the first indexed review whose DB row was written with a
different null-ish encoding halts every product.

**Evidence:** `specs/S-015-artifact-index.md:34`, `:47`, `:55`, `:69` against
`specs/review-format.md:29-36` (no frontmatter)
**Required action:** Either scope mismatch detection to artifact types that actually
declare `status` (specs, and plans if plan-format defines one), or define the `status`
field for every artifact type in the canonical set. Also: no spec in this set defines
the `artifacts` table DDL — S-013 defines `signals`, S-011 references a `products`
table, and `pipeline_runs` is only partially declared. `artifacts.status` is assumed
to exist by AC-5 but is never declared anywhere.

---

### [BLOCKING] B-12: `repos.yaml` product `name` has no uniqueness constraint, but every command keys on it

S-011 AC-3 sets `name` to the "repo dir name" and AC-5 scopes the duplicate check to
"absolute resolved path". Registering `~/work/synapse` and `~/archive/synapse`
therefore both succeed and produce two entries named `synapse`.

Every downstream command addresses products by name: `synapse start <product>`,
`synapse status <product>`, `synapse artifacts <product>`, and S-014's inbox which
displays "product name" as the identifier the human acts on. With a duplicate name,
`synapse start synapse` is ambiguous and no spec says which entry wins or whether it
errors.

**Evidence:** `specs/S-011-product-registration.md:39-40`, `:46`;
`specs/S-012-daemon-engine.md:99`; `specs/S-015-artifact-index.md:31`
**Required action:** Add a uniqueness constraint on `name` with a defined collision
behavior (reject, or auto-suffix), plus an AC and a MUST.

---

### [BLOCKING] B-13: Artifact path resolution — the daemon's single most load-bearing integration point — is one unspecified clause

The entire system is "agent writes artifact → signal is last line → daemon parses".
S-013 takes `artifactPath` as an input. The only place it is produced is S-012 HLT-3:
"spawns `agent-job.sh` subprocess, **captures output artifact path**".

How? Nothing states the mechanism (last line of stdout? a convention derived from step
name + run id? a file the wrapper writes?). Nothing states what happens when a
specialist writes more than one artifact — which is the normal case: a triage step
writes `reviews/triage/...md` *and* edits specs and commits. Nothing states the
behavior when the path does not exist (a crashed specialist that wrote nothing);
S-013's failure taxonomy covers SIGNAL_ABSENT and SCHEMA_VIOLATION but not
ARTIFACT_MISSING, so a crashed subprocess has no defined run state at all.

**Evidence:** `specs/S-012-daemon-engine.md:116`; `specs/S-013-signal-parser.md:56`
(`parseSignal(artifactPath)` — input assumed)
**Required action:** Specify the artifact-path contract between `agent-job.sh` and the
daemon (recommend a deterministic harness-computed path, consistent with
harness-owns-done: the harness decides where output goes, not the model). Add the
missing "artifact file does not exist" failure classification and a MUST.

---

### [WARNING] W-1: `updated:` frontmatter is stale on S-011..S-014 — violates an explicit format MUST

`feature-spec-format.md` §2: "`updated`: **MUST** be updated to today's date on every
edit (human or agent)". All five specs carry `updated: 2026-09-28`, but commit
`7867848` (dated 2026-09-29) modified S-011, S-012, S-013, and S-014.

Not merely cosmetic: §2 is one of the few MUSTs in the format doc, and the pipeline's
own freshness heuristics depend on it. That the triage cycle which applied the fixes
did not bump the field suggests no validator enforces it.

**Evidence:** `specs/S-012-daemon-engine.md:6` (`updated: 2026-09-28`) vs
`git show --stat 7867848` (dated 2026-09-29, touches S-011..S-014)
**Suggested action:** Bump `updated` on all four, and add the check to the §6 schema
checklist so it is mechanically enforced rather than remembered.

---

### [WARNING] W-2: S-012 and S-013 violate the mandated section set and order

`feature-spec-format.md` §3: "Every spec MUST contain **exactly these sections in this
order**", and §4 permits optional sections only *after* the required ones, listing
`## Open Questions` and `## Notes` (amended in iter2 to document `depends_on`, but not
to permit extra sections).

- S-012 inserts `## Pipeline Step Sequence` and `## Run Status Enum` between
  `## Overview` and `## User, Trigger, Outcome`.
- S-013 inserts `## DB Schema` between `## High-Level Tasks` and `## Test Contract`.

The content is good and clearly belongs somewhere — that is the problem. The format
doc as frozen has no home for it, so either the specs are non-conforming or the format
is wrong. Per AGENTS.md §5 ("Spec not conforming to `specs/feature-spec-format.md`?
FAILED"), the current state is a failure. Note also that the iter2 cycle already
modified two frozen Layer 0 docs (`feature-spec-format.md`, `task-format.md`) without
a phase task, which their own headers forbid.

**Evidence:** `specs/S-012-daemon-engine.md:22`, `:48`;
`specs/S-013-signal-parser.md:61`; `specs/feature-spec-format.md:57`, `:138`
**Suggested action:** Amend §4 under a phase task to permit a `## Design Notes` /
`## DB Schema` optional section placed after Test Contract, and move the blocks — or
relocate them into `## Notes`.

---

### [WARNING] W-3: `iteration` is one counter incremented by three unrelated mechanisms, with no reset rule

S-012 HLT-5 owns a single `iteration` column on `pipeline_runs`. It is incremented by:
tester-fail loopback (transition table row 7), SPEC GATE reject, and PLAN GATE reject.
Escalation triggers at `iteration ≥ 3`.

Concrete failure: a run is rejected at the spec gate (iteration→2), rejected again at
the plan gate (iteration→3), then reaches step 13 and fails tests **once**. Because
`iteration` is already 3, the tester loop escalates to a human gate on the first test
failure instead of granting the three auto-fix attempts protocol §7 promises. Nothing
resets `iteration` on entering a new loop or advancing past a gate.

**Evidence:** `specs/S-012-daemon-engine.md:72`, `:77-79`, `:120`
**Suggested action:** Either scope `iteration` per-loop (separate `test_iteration` and
`gate_iteration`), or define an explicit reset point. Add a test for the interleaved
case.

---

### [WARNING] W-4: Off-by-one between S-012's `iteration ≥ 3` and protocol §7's "after iteration 3"

S-012 (AC-10, MUST, transition table): escalate "at iteration ≥ 3".
Protocol §7: "Max iterations: **3** auto-fix iterations before mandatory escalation.
**After iteration 3** with `FAIL>0`..." — i.e. escalate at iteration ≥ 4.
`review-format.md` §3.2 agrees with the protocol: iter1/iter2/iter3 all auto-fix;
"iter4+ | NO | REQUIRED".

S-012 grants two fix attempts where the protocol and review-format grant three. This
is a testable numeric boundary and S-012's MUST would encode the wrong one.

**Evidence:** `specs/S-012-daemon-engine.md:72`, `:108`, `:133` vs
`specs/pipeline-signal-protocol.md:240-243` and `specs/review-format.md:225-230`
**Suggested action:** Pick one boundary and state it identically in all three.

---

### [WARNING] W-5: `.synapse/run/` scope is ambiguous, and inbox cannot work without globally-unique run-ids

S-014 AC-1 promises `synapse inbox` lists gates "across **all products**" by "scanning
`.synapse/run/GATE-*.md`" — a single relative path. But `.synapse/run/` is per-repo:
S-011 HLT-6 gitignores it *inside the registered repo*, and AGENTS.md §2 lists it under
the repo layout contract.

If per-repo, inbox must iterate every registered repo (unstated), and the GATE
filename `GATE-{run-id}.md` requires run-ids to be unique across products — never
stated. If it is a single global directory, S-011's per-repo gitignore is pointless.

**Evidence:** `specs/S-014-human-gate.md:45`, `:54`;
`specs/S-011-product-registration.md:31`
**Suggested action:** State which it is, and state the run-id uniqueness scope.

---

### [WARNING] W-6: Orphaned GATE files have no cleanup path

S-014 MUST NOT: "delete GATE file on reject (gate stays open until daemon re-dispatches
and new GATE appears)". Only `approve` deletes. Consequences:

- Reject → run goes `running` → run later hits `STATUS=FAILED` → GATE file for a
  `failed` run sits on disk permanently.
- Daemon restart sets `running` runs to `stopped` (S-012 AC-6) → same leak.

HLT-1's DB-authority filter hides these from `inbox`, so they are invisible rather
than fixed. The "at most one GATE file at a time (serial mode invariant)" claim holds
only because the filename is keyed on run-id and gets overwritten — worth saying out
loud, since "a new GATE file appears" reads as creation, not overwrite.

**Evidence:** `specs/S-014-human-gate.md:78`, `:41`, `:56-57`
**Suggested action:** Add a startup sweep that removes GATE files for runs not in
`waiting`, with a MUST.

---

### [WARNING] W-7: S-011 has no transactionality between `repos.yaml` (HLT-4) and `synapse.db` (HLT-5)

Two separate writes, no ordering or rollback rule. A crash between them leaves a
`repos.yaml` entry with no DB row. On the next `synapse add`, HLT-2 "searches
`repos.yaml` **and** `synapse.db`" — with an OR reading it matches `repos.yaml`, warns,
and exits 0 (AC-5), leaving the product permanently half-registered and unable to
self-heal. With an AND reading, it re-registers and duplicates the YAML entry.

Neither reading is stated.

**Evidence:** `specs/S-011-product-registration.md:58`, `:60-62`
**Suggested action:** Define write order (DB last, or a repair path), and state whether
the registration check is AND or OR.

---

### [WARNING] W-8: `synapse.db` and "the Synapse root" are never located

S-011 AC-2 asserts "Product row exists in `synapse.db`" and AC-3 says `repos.yaml` is
"in the Synapse root". Neither path is defined in any of the five specs, and
`AGENTS.md` §2's layout contract does not list either file. A test asserting "the row
exists in synapse.db" cannot be written without knowing which file that is — and
`repos.yaml` is a global, cross-repo file while every other path in these specs is
repo-relative, which makes the ambiguity load-bearing rather than pedantic.

**Evidence:** `specs/S-011-product-registration.md:38-40`
**Suggested action:** Define both locations once (e.g. `~/.local/state/synapse/`) in
S-011, since it is the feature that creates them.

---

### [WARNING] W-9: S-015's canonical directory set omits `tasks/future/`

S-011 AC-4 requires `synapse add` to create `tasks/future/`. S-015's canonical set —
repeated four times across the spec — does not include it. Artifacts placed there are
silently invisible to `synapse artifacts --type task`, and AC-6's ghost-record removal
explicitly scopes to "all directories in the canonical set", so a file moved
`current/` → `future/` is deleted from the index and never re-indexed. It looks
finished rather than scheduled.

**Evidence:** `specs/S-015-artifact-index.md:16-17` vs
`specs/S-011-product-registration.md:42-43`
**Suggested action:** Add `tasks/future/`, or state why it is deliberately excluded.

---

### [WARNING] W-10: S-015 classifier: `reviews/triage/` is both `review` and `triage`

HLT-2 derives type "from path and content" over six values including both `review` and
`triage`. A file in `reviews/triage/` is a review (by location) and a triage (by
type). `--type review` either includes or excludes it; both are defensible and neither
is stated. AC-3's MUST ("`--type` filter returns only artifacts of that type") is
therefore not decidable for the largest artifact class.

Related: `synapse artifacts <product>` is per-product, but no `product` column is
specified for the `artifacts` table.

**Evidence:** `specs/S-015-artifact-index.md:32`, `:53`
**Suggested action:** Publish the path→type mapping as a table.

---

### [WARNING] W-11: Circular dependency between S-012 and S-015

S-012 declares `depends_on: [S-013, S-015]`. S-015 declares no dependencies, yet its
AC-4 ("After S-012 step executor calls the incremental indexer...") and HLT-6 ("called
by S-012 step executor") cannot be exercised without S-012. S-015's AC-4 is untestable
in isolation, and the declared dependency graph says S-015 ships first.

**Evidence:** `specs/S-012-daemon-engine.md:9`; `specs/S-015-artifact-index.md:46`, `:57`
**Suggested action:** Have S-015 expose the indexer as a callable unit testable with a
stub caller, and note the inversion.

---

### [WARNING] W-12: Compound acceptance criteria throughout

`feature-spec-format.md` §3.3: "Each criterion is independently verifiable — no
compound criteria ('and' is a red flag)". Several ACs bundle 2–3 independent
assertions, which makes partial pass/fail unreportable:

- S-012 AC-6 — three assertions (`running`→`stopped`; `waiting` stays; resume required)
- S-012 AC-10 — loopback **and** the iteration-≥3 escalation boundary
- S-011 AC-2 — DB row **and** `repos.yaml` entry
- S-014 AC-3 — feedback file written **and** status transition

**Evidence:** `specs/S-012-daemon-engine.md:104`, `:108`;
`specs/S-011-product-registration.md:38`; `specs/S-014-human-gate.md:47`
**Suggested action:** Split. Note this interacts with B-1 — S-012 is already over the
AC cap, so splitting requires the feature split §3.4 calls for.

---

### [INFO] I-1: `STATUS=FAILED` runs are unreachable from `synapse inbox`

Protocol §2 ("Mark job failed; **notify inbox**") and §4.1 ("The job appears in
`synapse inbox` as failed") both promise failed runs surface in the inbox. S-014
HLT-1/HLT-2 filter the inbox to `pipeline_runs.status = 'waiting'`, so `failed` runs
are structurally excluded. Only `synapse status <product>` — which requires knowing
which product to ask about — shows them. Folded into B-2/B-3 rather than raised
separately, but worth an explicit decision: if the inbox is the human's queue, failure
belongs in it.

---

### [INFO] I-2: CRLF handling is unspecified at the one place it can break

S-013 HLT-1 strips "exactly one trailing line terminator (`\n` or `\r\n`)" with "no
further trimming". A CRLF file whose final line is `-->\r` with no terminating `\n`
retains the `\r`; the reference regex is `$`-anchored and would reject it as
SCHEMA_VIOLATION. Low likelihood on Linux, but the failure is silent-ish and total
(run marked `failed`), and the spec is otherwise admirably precise here.

---

## Missing Tests / Test Gaps

Gaps are listed against the ACs or MUSTs they orphan. Several are newly-introduced by
the iter2 fixes — behavior was added without a corresponding assertion.

**S-011**
- AC-1 asserts the command "prints the product name **and status**"; the MUST covers
  the name only. No assertion on printed status.
- MUST NOT "require `AGENTS.md` to exist (warn only)" — no test asserts the warning is
  actually emitted; only that the command does not fail.
- No test for `.gitignore` idempotency: AC-8 allows "already present", but nothing
  forbids appending a duplicate line on re-run (see B-5).
- HLT-3's `.gitkeep` markers: no MUST asserts they are created, so the MUST NOT's
  carve-out covers behavior no test requires.
- HLT-7's next-step hint is untested.
- No test for the crash-between-HLT-4-and-HLT-5 half-registered state (W-7).

**S-012**
- **No AC or MUST covers the terminal `done` state.** The transition table mentions
  `running → done` "after step 15", but no criterion asserts a completed pipeline
  reaches `done`. The happy path of the entire feature is unasserted.
- No test for a passing `TESTER_SIGNAL` advancing step 13 → 14 (B-4).
- AC-5 (`synapse status` output) has no MUST.
- HLT-3's "calls S-015 incremental indexer after each step" has no test — this is the
  only enforcement of S-015's MUST NOT ("MUST NOT require the daemon to be restarted
  to see a newly written artifact"), so the two specs each assume the other tests it.
- No test for `auto_resume: true`; the MUST tests only the `false` default.
- No test for `stopping → stopped` (B-6), or for `synapse resume`.
- No test for `synapse start` on a product that already has an active run.
- No test for the wrong-signal-type-for-step case (B-4).

**S-013**
- AC-1/AC-2 say the signal is "stored in `synapse.db`", but **no MUST asserts a row is
  inserted into `signals`** or that `run_id`/`step_index`/`raw_line`/`created_at` are
  populated. Every MUST is about parsing or `failure_reason`. HLT-6 is untested.
- MUST NOT "accept a signal with fields in the wrong order" — no positive test case
  (e.g. `ESCALATE=0 AUTO-FIX=0`).
- No test for out-of-range or non-numeric counts (`AUTO-FIX=-1`, `AUTO-FIX=x`), which
  `\d+` rejects → should be SCHEMA_VIOLATION, unasserted.
- No test for `TYPECHECK` outside `{green,red}`, the TESTER analogue of the STATUS-enum
  MUST that iter2 added for PIPELINE.
- No test for a nonexistent or unreadable artifact path (B-13).
- No test for the field-name variants an LLM will actually emit (`AUTO_FIX`,
  `STATUS = DONE`) — the highest-frequency real-world malformation.

**S-014**
- **AC-6 (nonexistent / already-resolved run-id exits non-zero) has no MUST entry.**
- **HLT-1's "Inbox authority" rule — added by the iter2 B-4/W-5 fix — has no test.**
  Nothing asserts a GATE file whose run is `running`/`stopped` is hidden. The fix
  shipped as prose only.
- HLT-1's GATE frontmatter schema (`run_id`, `product`, `gate_type`, `artifact_path`,
  `created_at`) — also new in iter2 — has no MUST asserting the fields are written or
  valid.
- No test that `approve` on a rejected-but-not-yet-re-gated run is rejected (W-6, and
  the interaction with AC-6's "already-resolved" wording).
- MUST NOT "auto-approve any gate" is not mechanically testable as written.

**S-015**
- AC-2/AC-3 output columns (type, path, status, created date) have no MUST.
- AC-4 (incremental indexing visible without restart) is only covered obliquely by a
  MUST NOT; no positive test.
- No test for the classifier (HLT-2) — including the `reviews/triage/` ambiguity (W-10).
- MUST "all six type values must be supported" has no enumerated per-type case.
- No test for the mismatch detector against a non-spec artifact — the case B-11 shows
  is undefined.
- No test that `docs/` is excluded, despite the MUST NOT and AGENTS.md §2's
  "`docs/` is read-only to all pipeline agents" invariant.

---

## Architectural & Compatibility Risk

**1. The frozen Layer 0 protocol has drifted from the specs that implement it.**
Three independent contradictions (B-2 `TASK_FAILED`/`failed`, B-8 `current_step`
typing, W-4 the iteration boundary) plus `ESCALATED` as a status that exists only in
the protocol. The iter2 cycle resolved each by editing the *downstream* spec and
leaving the frozen upstream doc stating the opposite — and separately edited two frozen
docs (`feature-spec-format.md`, `task-format.md`) without a phase task, which their own
headers forbid. The repo now has no single authority on the signal contract. This is
the highest-order risk here: every subsequent triage cycle will re-derive the
disagreement.

**2. B-3 is a harness-owns-done violation.** AGENTS.md's guiding law is that the
harness decides completion. As specified, whether a run with unresolved BLOCKING
findings terminates as `done` depends on a triage *model* choosing to emit
`ESCALATE>0`. Completion is model-owned on the most consequential transition in the
pipeline. The fix is a deterministic rule in `resolveExitCondition`-equivalent
territory, not better triage prompting.

**3. The DB schema is specified in fragments.** S-013 declares `signals` and part of
`pipeline_runs`; `products`, `artifacts`, and the rest of `pipeline_runs`
(`current_step`, `auto_fix_count`, `escalate_count`, `iteration`, `product`) are
referenced across four specs but declared nowhere. B-9's dual-ownership bug and B-11's
undefined `artifacts.status` are both downstream of having no single schema document.
S-011, S-012, S-013 and S-015 cannot be implemented independently against the current
text without three teams inventing three incompatible schemas.

**4. Failure states are under-modelled relative to success states.** The specs are
precise about SIGNAL_ABSENT and SCHEMA_VIOLATION and near-silent on: crashed subprocess
with no artifact (B-13), half-completed registration (W-7), orphaned GATE files (W-6),
ad-hoc gate rejection (B-7), and the `stopping`/`stopped` lifecycle (B-6). For a daemon
whose value proposition is surviving restarts, the restart-adjacent paths are the
thinnest part of the specification.

**5. Positive note.** S-013's trailing-newline rule, the explicit
SIGNAL_ABSENT-vs-SCHEMA_VIOLATION discrimination, and S-015's halt-don't-guess stance
on mismatches are all genuinely well-specified and testable — precise about byte-level
behavior in a way most specs at this layer are not. The defects above are
predominantly *integration* defects between specs, not defects within them.

## Verdict

REQUEST_CHANGES

<!-- PIPELINE_SIGNAL: STATUS=PARTIAL AUTO-FIX=0 ESCALATE=0 -->
