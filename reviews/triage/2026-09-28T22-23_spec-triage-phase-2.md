# Spec Triage: Phase 2 — S-011..S-015

> **Triage role:** AGY (Architect — spec triage requires architectural judgment)
> **Review read:** reviews/spec/2026-09-28T22-22_spec-review-phase-2.md
> **Date:** 2026-09-28

---

## BLOCKING findings — must fix before implementation

### B-1: S-012 — Step sequence missing from spec

**Finding:** The ordered list of pipeline steps is not in the spec. AC-1 references "step 1"
without defining what step 1 is.

**Recommendation: FIX — add to S-012 spec.**

Add a "Pipeline Step Sequence" section to S-012 with the canonical ordered list:
```
1. research-to-features  (Architect)
2. spec-review           (Reviewer)
3. spec-triage           (Architect)
4. [SPEC GATE]           (Approver)
5. task-gen              (Planner)
6. task-review           (Reviewer)
7. task-triage           (Planner)
8. make-plans            (Planner)
9. plan-review           (Reviewer)
10. plan-triage          (Planner)
11. [PLAN GATE]          (Approver)
12. implement            (Coder)
13. test-cycle           (Coder)
14. code-review          (Reviewer)
15. code-triage          (Planner→Coder)
```
This is the spec. The plan derives from it. Also update AC-1 to say "begins step 1
(research-to-features or task-gen depending on pipeline type)."

---

### B-2: S-014 — Regeneration mechanism undefined

**Finding:** AC-3 says rejection "triggers regeneration" but doesn't define the mechanism.

**Recommendation: FIX — define the mechanism in S-014, note cross-spec boundary.**

Add to S-014: "After writing the feedback file, `synapse reject` sets the pipeline run
status back to `running` and signals the daemon to re-run the current gate step. The daemon
polls run status and detects the transition from `waiting` → `running`, then re-dispatches
the same step. The specialist reads `reviews/feedback/` before generating output."

Add a cross-reference note: "The daemon's polling behavior is specified in S-012."

This makes S-014 self-contained while correctly pointing to S-012 for the daemon side.

---

## WARNING findings — should fix, implementation risk if deferred

### W-1: S-011 AC-2 depends on `synapse products` (unspecified command)

**Recommendation: FIX — rewrite AC-2 to be self-contained.**

Change AC-2 from "Product appears in `synapse products` output" to
"Product row exists in `synapse.db` products table with `pipeline_status = 'idle'`."
This is directly testable without a separate command. Add a note: "`synapse products`
is a future feature; this spec does not require it."

---

### W-2: S-012 AC-5 — "in real time" is untestable

**Recommendation: FIX — trivial wording change.**

Change "reflects the current step name and status in real time" to
"reflects the most recently committed step name and pipeline_runs.status from synapse.db."

---

### W-3: S-012 missing S-013 dependency declaration

**Recommendation: FIX — add `depends_on: [S-013]` to S-012 frontmatter.**

This ensures task ordering is clear. The daemon cannot parse signals without S-013 being
implemented first.

---

### W-4: S-014 one-WAITING-file invariant not in spec

**Recommendation: FIX — add to S-014 as an explicit constraint.**

Add to Non-Goal or a new "Constraints" section: "At most one WAITING file exists per
product at any time. Serial pipeline mode ensures this. If a second gate is reached before
the first is resolved, the daemon must not overwrite the existing WAITING file — it must
block at the second gate until the first is resolved."

---

### W-5: S-014 AC-3 scope: feedback file vs. regeneration trigger

**Recommendation: DEFER — architectural boundary, resolve during S-012 implementation.**

The feedback file write (S-014 scope) and the regeneration trigger (S-012 scope) are
correctly split. The only issue is the spec implies S-014 triggers regeneration, which it
doesn't — it just writes a file and sets status. The wording fix in B-2 above resolves this.
No separate action needed.

---

### W-6: S-015 AC-1 scope too narrow (missing dirs)

**Recommendation: FIX — update AC-1 to match HLT-1.**

Change AC-1 to: "On daemon startup, all `.md` artifacts in `specs/`, `plans/current/`,
`plans/done/`, `reviews/` (all subdirs), `tasks/current/`, `tasks/done/`, `tasks/deferred/`
are indexed in `synapse.db`."

---

### W-7: S-015 first-run mismatch ambiguity

**Recommendation: FIX — add explicit first-run rule.**

Add to S-015: "On first run (empty DB), any file found by the scanner is indexed as new
(no mismatch). Mismatch detection only applies when a DB row exists with a different
`status` than the file's frontmatter. Missing DB row = index it, not an error."

---

## INFO findings — low risk, optional

| Finding | Recommendation |
|---------|---------------|
| S-011: `<path>` as subdirectory of git repo | DEFER — HLT-1 says "resolve to absolute path, verify `.git/`." Implementer can decide. Document the decision in the plan. |
| S-011: no AC for non-git directory | FIX — add AC-7: "Running `synapse add` on a valid path that is not a git repo exits non-zero." One-line addition. |
| S-012: HLT-4 duplicates S-013 | FIX — reword HLT-4 to "Call signal parser (S-013) on output artifact path, apply result to DB state." |
| S-013: signal format not in spec | DEFER — correct reference to `specs/pipeline-signal-protocol.md`. No change needed; the protocol spec is the source. |
| S-013: DB schema as prerequisite | FIX — add `depends_on: [synapse.db-schema]` note to frontmatter, or fold schema into S-013 spec explicitly. |
| S-013: SCHEMA_VIOLATION boundary | FIX — add to AC-4: "A line is SCHEMA_VIOLATION if it matches `<!--\s*(PIPELINE\|TESTER)_SIGNAL` but fails full parse. Otherwise SIGNAL_ABSENT." |
| S-014: gate type not in test contract | FIX — add MUST: "`synapse inbox` output includes the gate type for each waiting item." |
| S-015: `--type` valid values not listed | FIX — add to spec: "Valid `--type` values: `spec`, `plan`, `review`, `triage`, `feedback`, `task`." |
| S-015: AC-4 cross-spec dependency | DEFER — note in S-015 that AC-4 requires S-012 incremental indexing to be implemented. No spec change needed. |

---

## Summary of recommended actions

| Action | Count | Specs |
|--------|-------|-------|
| FIX (must do) | 10 | S-011, S-012, S-013, S-014, S-015 |
| DEFER | 4 | S-011, S-013, S-015 |

**10 fixes recommended. None require rethinking the features — all are precision and clarity gaps.**
No spec needs to be redesigned. No feature is wrong. These are the normal findings from
a first-pass spec review.

---

## Recommended fix sequence (respect dependencies)

1. S-012: add step sequence + fix AC-5 + add S-013 dependency + fix HLT-4
2. S-014: define regeneration mechanism (references S-012 step sequence)
3. S-011: fix AC-2, add AC-7
4. S-013: add SCHEMA_VIOLATION boundary + DB dependency note
5. S-015: fix AC-1 scope + first-run rule + type values list
