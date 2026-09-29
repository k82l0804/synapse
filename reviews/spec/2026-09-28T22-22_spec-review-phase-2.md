# Spec Review: Phase 2 — S-011..S-015

> **Reviewer role:** Grok (simulated — pipeline not yet automated; AGY acting as adversarial reviewer)
> **Artifacts reviewed:** S-011, S-012, S-013, S-014, S-015
> **Date:** 2026-09-28
> **Output path:** reviews/spec/2026-09-28T22-22_spec-review-phase-2.md

---

## S-011 — product-registration

### [WARNING] AC-2: `synapse products` command is not in scope for this spec
AC-2 says "Product appears in `synapse products` output" — but `synapse products` is a
separate command not defined in this spec or any Phase 2 spec. The AC depends on an
unspecified feature. A test for AC-2 cannot be written without knowing the output format
of `synapse products`.

**Recommendation:** Either define the `synapse products` output format minimally in this
spec, or rewrite AC-2 to verify the DB row directly rather than through a CLI command
that doesn't exist yet.

### [INFO] HLT-1: "verify it's a git repo" is under-specified
HLT-1 says check for `.git/` directory. This passes for bare repos and git worktrees.
The spec doesn't say what to do if `<path>` is a subdirectory of a git repo (common).
Should `synapse add ./src/` work if `./` is a git repo?

### [INFO] AC-6 only covers path-not-exist; missing AC for non-git directory
There's an AC for path that doesn't exist (AC-6) but no AC for a path that exists but
is not a git repo. The HLT covers it but the test contract doesn't.

---

## S-012 — daemon-engine

### [BLOCKING] Missing: step sequence is not specified in the spec
The spec says "begins step 1 (task-review)" and lists HLTs for the state machine, but
the **ordered list of pipeline steps is nowhere in this spec**. The step sequence is
the most critical piece of information for an implementer. Without it, two implementers
will produce different step orderings.

AC-1 says "begins step 1" — but which step is step 1? The daemon plan (T-2-3) has the
sequence but it's not in the spec. The spec is the source of truth. The plan should
derive from the spec, not the other way around.

### [WARNING] AC-5: "reflects current step name and status in real time" is untestable
"In real time" is not a testable property for a CLI polling tool. `synapse status` reads
from DB, not from a live stream. The spec should say "reflects the most recently
committed step state" or similar. "Real time" implies streaming/push which is not the design.

### [WARNING] Dependency: S-013 (signal-parser) is not declared
The daemon reads PIPELINE_SIGNAL and TESTER_SIGNAL (referenced in Overview and HLT-4),
which is entirely implemented by S-013. This dependency should be explicit in the spec
frontmatter so task ordering is clear.

### [INFO] HLT-4 duplicates S-013's scope
HLT-4 says "Implement signal reader — reads last line of output artifact, parses signal."
But that's the entire S-013 spec. HLT-4 should say "Call S-013 signal parser" rather
than re-describing its implementation. Otherwise the implementer may duplicate the work.

---

## S-013 — signal-parser

### [INFO] Regex patterns are specified in the plan (T-2-1) but not in the spec
The spec says "per the grammar defined in `specs/pipeline-signal-protocol.md`" — which
is correct. But the spec doesn't include even the field names as a reference. An implementer
reading only this spec would need to read a second document to understand the signal format.
Consider adding a brief field summary to the spec itself.

### [INFO] HLT-6 creates an implicit dependency on synapse.db schema
HLT-6 writes to the `signals` table. But that table's schema is defined in T-2-1's plan,
not in any spec. The spec should reference that the DB schema (specifically the `signals`
table) is a prerequisite, or the DB schema should live in its own spec/artifact.

### [INFO] The "SCHEMA_VIOLATION" boundary condition needs clarification
AC-4 says "last line starts with `<!-- PIPELINE_SIGNAL` or `<!-- TESTER_SIGNAL` but
fails full regex parse." But what if the last line starts with `<!-- PIPELINE_SIGNAL:`
with a colon but has completely wrong fields? The boundary between SIGNAL_ABSENT and
SCHEMA_VIOLATION should be explicit. Recommended: if the line matches `<!--\s*(PIPELINE|TESTER)_SIGNAL`,
it's SCHEMA_VIOLATION. Otherwise it's SIGNAL_ABSENT.

---

## S-014 — human-gate

### [BLOCKING] AC-3: "triggers regeneration" is undefined behavior
AC-3 says rejection "triggers regeneration." How? The spec says "specialist regenerates"
but doesn't specify the mechanism. Does the daemon notice the feedback file and re-run
the step? Does it need a `synapse resume` command? If this is a daemon behavior, it should
be specified here or in S-012. As written, this is a gap that will produce implementation
ambiguity.

### [WARNING] One WAITING file per product is under-specified
The plan (T-2-4) says "one WAITING file per product at a time (overwritten on new gate)."
But the spec doesn't say this. What happens if two gates fire simultaneously (possible
in accelerate mode, less likely in serial)? The spec should state the invariant explicitly.

### [WARNING] AC-3 feedback file: regeneration trigger is outside this spec's scope
The feedback file is written by this spec. The regeneration itself (daemon detects feedback
file and re-runs the step) is daemon behavior — belongs in S-012. Cross-referencing which
spec owns which behavior would prevent duplication.

### [INFO] `synapse inbox` doesn't distinguish gate types in the test contract
The MUST contract says inbox "shows all waiting gates with run-id and artifact path" but
the User/Trigger/Outcome section says it also shows "product, gate type." The test contract
should explicitly verify gate type is shown, since different gate types may need different
actions from the user.

---

## S-015 — artifact-index

### [WARNING] AC-1 lists `plans/current/` and `reviews/` but not all pipeline dirs
AC-1 says "all artifacts in `specs/`, `plans/current/`, `reviews/`" — but the full set
from the spec layout includes `plans/done/`, `tasks/current/`, `tasks/done/`, `tasks/deferred/`,
and review subdirs. HLT-1 lists a broader set than AC-1. The AC should match HLT-1's scope.

### [WARNING] Mismatch detection is coupled to daemon startup — blocks startup on first run
On first run, the DB is empty. Any file on disk that the scanner finds will have no
corresponding DB row. Is this a mismatch (DB says nothing, file says "approved")? The
spec doesn't distinguish between "no DB record" and "DB record with different status."
First-run behavior should be explicitly stated: empty DB + file exists = index it (not a mismatch).

### [INFO] AC-4: "without requiring a restart" requires daemon-side incremental indexing
This is a cross-spec dependency on S-012 (daemon knows when a step completes and calls
the indexer). The spec doesn't make this dependency explicit. If S-015 is implemented
independently of S-012, AC-4 cannot be tested.

### [INFO] The `--type` filter values aren't listed in the spec
The User/Trigger/Outcome section references `--type spec` as an example, but the full
list of valid type values is not in the spec. An implementer needs to know all valid types
to implement the filter and write exhaustive tests.

---

## Summary

| Spec | BLOCKING | WARNING | INFO |
|------|----------|---------|------|
| S-011 | 0 | 1 | 2 |
| S-012 | 1 | 2 | 1 |
| S-013 | 0 | 0 | 3 |
| S-014 | 1 | 2 | 1 |
| S-015 | 0 | 2 | 2 |
| **Total** | **2** | **7** | **9** |

Two BLOCKING findings must be resolved before implementation:
- S-012: step sequence missing from spec
- S-014: "triggers regeneration" mechanism undefined

<!-- PIPELINE_SIGNAL: STATUS=PARTIAL AUTO-FIX=0 ESCALATE=2 -->
