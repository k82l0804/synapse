# Spec Triage v2: Phase 2 — S-011..S-015

> **Triage role:** AGY (Architect)
> **Supersedes:** reviews/triage/2026-09-28T22-23_spec-triage-phase-2.md
> **Review used:** specs/grok-spec-review.md (Grok, independent reviewer)
> **Date:** 2026-09-28

---

## BLOCKING findings — must resolve before implementation

### B-1: S-0NN vs F-0NN naming schema conflict

**Grok finding:** `feature-spec-format.md` requires `F-\d{3}` IDs. All specs use `S-0NN`. Schema
failure means `approved` status is invalid.

**Recommendation: FIX the format spec, not the specs.**

The S-prefix was intentional — Synapse specs use S-NNN to distinguish from fox-code-cli's
F-NNN specs. The format spec was written generically and inherited the F-prefix assumption.
The correct fix is to update `specs/feature-spec-format.md` to allow `S-\d{3}` as a valid
ID pattern for Synapse repos, with a note that the prefix is repo-configurable.

Update `feature-spec-format.md`:
- Change `F-\d{3}` pattern to `[A-Z]-\d{3}` with a note that the prefix is repo-defined
- Change filename pattern from `F-XXX-name.md` to `{PREFIX}-XXX-name.md`
- Add to frontmatter: `id_prefix: S` (set in repos.yaml for this repo)

Do NOT rename the existing specs. The IDs are already referenced in plans, tasks, and registry.

---

### B-2: S-012 step sequence missing

**Grok finding:** AC-1 says "begins step 1" but no spec defines what step 1 is.

**Recommendation: FIX — add step sequence section to S-012.**

Add "Pipeline Step Sequence" section using the corrected sequence from AGENTS.md:
```
1.  research-to-features  (Architect)
2.  spec-review           (Reviewer)
3.  spec-triage           (Architect)
4.  [SPEC GATE]           (Approver)
5.  task-gen              (Planner)
6.  task-review           (Reviewer)
7.  task-triage           (Planner)
8.  make-plans            (Planner)
9.  plan-review           (Reviewer)
10. plan-triage           (Planner)
11. [PLAN GATE]           (Approver)
12. implement             (Coder)
13. test-cycle            (Coder)
14. code-review           (Reviewer)
15. code-triage           (Planner→Coder)
```

Also per Grok's additional findings for S-012:
- Define one status enum: `idle | running | waiting | stopping | stopped | done | failed`
- Map `TASK_FAILED` → run-level status `failed` (clarify in spec)
- Specify `auto_resume` default: `false`, stored in product config in `repos.yaml`
- Fix HLT-4 to say "invoke S-013 signal parser" not re-describe parsing
- Fix AC-5 "real time" → "last committed DB state"

---

### B-3: S-014 GATE file naming conflict + regeneration undefined

**Grok finding:** AGENTS.md says `.synapse/run/GATE-{run-id}.md`. S-014 says `.synapse/run/WAITING`.
These are contradictory. Also: regeneration mechanism undefined.

**Recommendation: FIX — resolve to one contract.**

Decision: **Use `GATE-{run-id}.md` per AGENTS.md.** The per-run naming is better — it supports
multiple concurrent gates (even in serial mode, they could accumulate if not resolved), and
gives `inbox` a consistent scan pattern without ambiguity.

Changes to S-014:
1. Replace "WAITING file" everywhere with "GATE-{run-id}.md file in `.synapse/run/`"
2. `synapse inbox`: scans `.synapse/run/GATE-*.md` across all registered products
3. `synapse approve`: deletes the GATE file, sets run status `waiting → running`
4. `synapse reject`: writes feedback file, keeps GATE file, sets run status
   `waiting → running` so daemon re-dispatches the same step (specialist reads feedback file first)
5. Add: regeneration mechanism = "daemon sets run status back to `running`; daemon's main loop
   detects `running` state and re-dispatches the same step index"
6. Add MUST: `--note` is non-empty after trimming whitespace
7. Add MUST: `synapse inbox` output includes gate type for each item
8. Clarify: one GATE file per pipeline run at a time (not per product — serial mode ensures one
   active run per product, so effectively one per product)

Also fix AGENTS.md to reflect the GATE file contract consistently.

---

## WARNING findings — fix before implementation

### W-4: S-011 — MUST NOT contradicts `.gitkeep` writes

**Recommendation: FIX wording.**

Change: "MUST NOT modify any file inside the registered repo except creating dirs"
To: "MUST NOT modify any existing files inside the registered repo. Creating empty `.gitkeep`
files in newly created dirs is permitted."

### W-5: S-011 — AC-2 depends on undefined `synapse products` command

**Recommendation: FIX — test against DB.**

Change AC-2 to: "Product row exists in `synapse.db` with `pipeline_status = 'idle'` and a
matching entry exists in `repos.yaml`."

Add note: "`synapse products` list command is a future feature not in scope for this spec."

### W-6: S-011 — missing ACs for non-git path and identity-on-re-add

**Recommendation: FIX — add two ACs.**

- AC-7: "Running `synapse add` on a valid path that is not a git repo exits non-zero."
- AC-8: "`synapse add` on a path already registered (same absolute path) is idempotent —
  exits 0, prints warning." (AC-5 covers same path. Clarify whether re-add check uses path,
  product name, or both. Grok noted this ambiguity — use absolute path as identity.)

Also: Enumerate the 15 required dirs explicitly in AC-4 to match the visible outcome list
(and verify `tasks/future/` inclusion — it's in S-011's list but missing from AGENTS.md).

### W-7: S-013 — failure reason strings don't match protocol spec

**Recommendation: FIX — make S-013 quote protocol verbatim.**

Update AC-3 and AC-4 to match `pipeline-signal-protocol.md` exactly:
- AC-3: `failure_reason = "SIGNAL_ABSENT: no valid signal on last line of artifact"`
- AC-4: `failure_reason = "SCHEMA_VIOLATION: signal present but malformed: <last_line>"`

Add boundary rule to AC-4: "A line is SCHEMA_VIOLATION if it matches
`<!--\s*(PIPELINE|TESTER)_SIGNAL` (with or without colon) but fails the full protocol
regex. Otherwise it is SIGNAL_ABSENT."

Remove "MUST NOT read entire file / must use seek" from test contract — not observable.
Replace with implementation note: "Implementations SHOULD use tail/seek for large files."

### W-8: S-013 — `signals` table schema undefined

**Recommendation: FIX — add schema section to S-013.**

Add "DB Schema" section with the columns this feature writes:
```
signals table:
  id, run_id, step_index, signal_type (PIPELINE|TESTER),
  status, auto_fix, escalate, pass, fail, skipped, typecheck,
  raw_line, created_at

pipeline_runs columns updated:
  last_signal (text, nullable)
```

### W-9: S-015 — scan scope inconsistent, `shipped` not in enum

**Recommendation: FIX — one authoritative dir list.**

Replace the three disagreeing dir lists with one canonical list used by AC-1, HLT-1, and
ghost-record removal:
```
specs/, plans/current/, plans/done/,
reviews/spec/, reviews/plan/, reviews/code/, reviews/triage/, reviews/feedback/,
tasks/current/, tasks/done/, tasks/deferred/
```

Fix mismatch example: replace `shipped` with `done` (valid status value).

Add first-run rule: "Missing DB row = insert (not a mismatch). A mismatch requires a DB row
with a different `status` field than the file's frontmatter. An empty artifacts table at
startup is normal."

List all valid `--type` values: `spec`, `plan`, `review`, `triage`, `feedback`, `task`.

### W-10: S-015 — S-012 must declare indexer call

**Recommendation: FIX — update S-012 to mention indexer.**

Add to S-012 HLT-3 (step executor): "After the specialist subprocess completes and the
artifact path is known, calls the S-015 incremental indexer to register the artifact."
Also add this as a cross-reference in S-015 AC-4: "Requires S-012 step executor to call
incremental indexer (see S-015 HLT-6)."

---

## DEFER (no action now)

| Finding | Why deferred |
|---------|-------------|
| S-013 "User is daemon" | Honest description of internal component. No format violation. |
| `tasks/future/` in S-011 dir list | Check against AGENTS.md — if it's intentional, add it to AGENTS.md. If not, remove from S-011. Implementer can decide. |
| `depends_on` in frontmatter | Nice to have. Covered by task dependency graph in phase-2.md. |

---

## Fix sequence (dependency order)

```
1. feature-spec-format.md  → allow S-\d{3} pattern (unblocks all spec status)
2. S-012                   → step sequence + status enum + auto_resume + HLT-4 + AC-5
3. S-014                   → GATE file contract + regeneration mechanism + whitespace note
4. AGENTS.md               → align GATE file naming with S-014 resolution
5. S-011                   → MUST NOT wording + AC-2 + AC-7 + AC-4 dir list
6. S-013                   → reason strings + SCHEMA_VIOLATION boundary + DB schema section
7. S-015                   → dir list + first-run rule + type values + S-012 cross-ref
```

---

## Summary

| | Count |
|---|---|
| FIX (blocking) | 3 |
| FIX (warning) | 7 |
| DEFER | 3 |
| Total changes to specs | 5 specs + feature-spec-format.md + AGENTS.md |

No features need redesigning. All findings are precision gaps, naming schema issues,
and cross-spec contract conflicts. The underlying design is sound.

**This triage supersedes the v1 triage.** The v1 missed the S-0NN/F-0NN schema violation
and the GATE file naming conflict — both of which require decisions before implementation.
