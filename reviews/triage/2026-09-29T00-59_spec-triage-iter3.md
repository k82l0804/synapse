# Spec Triage — Iter3

> **Triager:** AGY (reviewer of reviewers)
> **Sources:** `reviews/spec/2026-09-29T00-38_claude-spec-review-iter3.md` (Plod),
>              `reviews/spec/2026-09-29T00-46_grok-spec-review-iter3.md` (Grok)
> **Date:** 2026-09-29T01:00
> **Decision:** APPROVE with 7 must-fix patches + 10 deferred to implementation

---

## Decision Summary

**Human gate exercised.** The specs are good enough to implement. The boulder stops here.

17 distinct issues found across both reviewers. Categorized into three buckets:

| Bucket | Count | Action |
|--------|-------|--------|
| **Must fix now** | 7 | Unresolvable contradictions — implementer cannot make the call |
| **Fix in implementation PR** | 5 | Implementer can define concretely; document the decision |
| **Defer to spec amendment** | 5 | Known gaps, documented, won't block implementation |

---

## Bucket 1 — Must Fix Before Implement

These are contradictions the implementer **cannot resolve** from spec text alone.
Apply as targeted patches; no new review cycle.

### F1: Dual ownership of `pipeline_runs.status` [Plod B-9, Grok B-3]
**Decision:** S-012 HLT-5 is the **only** writer of `pipeline_runs.status`.
S-013 writes `signals` + `last_signal` + `failure_reason` only. Returns a parse
outcome (`ok | SIGNAL_ABSENT | SCHEMA_VIOLATION`) for S-012 to act on.
**Fix:** Remove `pipeline_runs.status` from S-013's DB schema block and visible outcome.

### F2: S-012 has 11 ACs — violates max-10 [Plod B-1]
**Decision:** Merge AC-8 + AC-9 ("signal X drives transition Y" — two rows of same table).
Merge AC-10 + AC-11 into one criterion.
**Fix:** Reduce to 10 ACs. Merges are lossless — content stays, just one assertion.

### F3: S-012 restart contradiction — `waiting` on restart [Grok BLOCKING-1]
**Decision:** AC-6 is authoritative. Restart sets `running` to `stopped`; `waiting` stays
`waiting`. Drop the "or `waiting`" from the visible outcome sentence.
**Fix:** One-line edit to visible outcome.

### F4: GATE file path collision on reject + re-dispatch [Grok BLOCKING-2]
**Decision:** On reject, S-014 **deletes** the GATE file (drop the MUST NOT). The daemon
re-creates it when re-dispatch reaches the gate step again. No stale file, no collision,
inbox stays clean.
**Fix:** Remove the MUST NOT from S-014; add "approve and reject both delete the GATE file."

### F5: `STATUS=PARTIAL` from review step silently reaches `done` [Plod B-3, Grok]
**Decision:** Add a deterministic rule to S-012: after step 15, run status becomes `done`
only if the last review/triage verdict was `STATUS=DONE`. If the last signal was `PARTIAL`,
the daemon halts as `failed` with `failure_reason = "unresolved BLOCKING findings"`.
**Fix:** Add one transition row + AC + MUST to S-012.

### F6: S-015 mismatch detector crashes on non-spec files [Plod B-11, Grok BLOCKING-6]
**Decision:** Scope mismatch check to **specs only** (`specs/` directory). All other artifact
types skip the frontmatter comparison. AC-5: "for specs, compare DB status to frontmatter
`status`; for all other types, skip."
**Fix:** Narrow AC-5 and the MUST in S-015.

### F7: `.gitignore` MUST NOT vs HLT-6 contradiction [Plod B-5, Grok W-4]
**Decision:** Extend MUST NOT carve-out: "creating `.gitkeep` markers and appending a
single `.synapse/run/` line to an existing `.gitignore` are permitted; all other
pre-existing file modifications are forbidden."
Add idempotency MUST: running `synapse add` twice does not duplicate the line.
**Fix:** Two-sentence edit to S-011 MUST NOT + one new MUST.

---

## Bucket 2 — Fix in Implementation PR

Implementer defines the concrete decision and documents it in the implementation PR.
No spec edit required before implementation begins.

| Issue | Implementation decision |
|-------|------------------------|
| **B-13** Artifact path resolution | Harness-computed: `{run-id}/{step-name}/artifact.md`. Daemon writes path before spawning. Convention in `agent-job.sh`. |
| **B-8** `current_step` TEXT vs integer | Store as integer index. Display as step name via S-012 step table. Column: `current_step_index INTEGER`. |
| **B-6** `synapse resume` unspecified | Accepts `stopped` runs only. Re-spawns `current_step`. `failed` and `waiting` are not resumed. |
| **Grok W-6** Feedback file format | Adopt review-format §4 filename and body. S-014 MUST references review-format §4. |
| **Grok W-1** Step 1 input contract | `synapse start` reads `docs/research/`. If empty, logs warning and no-ops. |

---

## Bucket 3 — Defer to Spec Amendment

Known gaps, documented here, will not block implementation. Schedule in next phase.

| Issue | Why deferred |
|-------|-------------|
| **B-2** Protocol says `TASK_FAILED` | Frozen doc needs phase task to amend. Follow S-012/S-013 for now. |
| **B-4** No TESTER happy-path row | Easy: `FAIL=0 AND TYPECHECK=green -> advance`. Add row in amendment. |
| **B-7** Ad-hoc `gate_type` undefined | Add `escalate` value. Rewind: ad-hoc gates rewind to the escalating step. |
| **B-10** No-newline edge case | Add MUST: whole file = last line when no `\n`. Protocol CAUTION fix bundled. |
| **W-3/W-4** Iteration counter + off-by-one | Scope per-loop. Boundary: `> 3` (protocol wins over S-012's `>= 3`). |

---

## Both Reviewers Confirmed (High Confidence)

Found independently by both Grok and Plod:

- PARTIAL reaches `done` with unresolved BLOCKINGs (F5) confirmed x2
- Dual status ownership (F1) confirmed x2
- S-015 mismatch crash (F6) confirmed x2
- Product name uniqueness: implement as DB UNIQUE constraint
- Inbox scope per-product: walk repos.yaml in implementation

---

## HUMAN GATE DECISION

**APPROVE.**

7 targeted patches. 5 implementation decisions documented. 5 gaps deferred with schedule.
Specs are coherent enough to implement. Remaining ambiguities are resolvable by the
implementer without another spec revision. The doom loop ends here.

**Next:** Apply the 7 patches, mark specs `status: approved`, generate phase-2 tasks.
