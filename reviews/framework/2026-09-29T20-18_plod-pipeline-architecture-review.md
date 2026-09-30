# Architecture Review — Synapse Pipeline Architecture (Double-Buffer Model)

> **Reviewer:** Plod (Claude Opus 5)
> **Date:** 2026-09-29T20-18
> **Target:** `docs/framework/pipeline-architecture.md` (working draft, 2026-09-29)
> **Review type:** Architecture / conceptual-design review (not a code review)
> **Read for context:** `docs/framework/definitions.md`, `docs/reviews/pipeline-batch-processing.md`,
> `specs/S-012-daemon-engine.md`, `specs/S-014-human-gate.md`, `specs/S-015-artifact-index.md`,
> `specs/pipeline-signal-protocol.md`, `tasks/current/phase-2.md`,
> `../tasks/done/phase-2a-2d.md`, `../tasks/done/phase-2e-2g.md`, `../tasks/README.md`,
> `../plans/done/2026-09-25T18-10_2g3-worktree-isolation.md`

---

## Summary Assessment

The core moves are right and well-argued: feature-scoped directories as the grouping primitive, frontmatter-as-edges with SQLite as a derived query layer, queue-as-query instead of a hand-edited schedule, and tasks demoted to gitignored agent scratch. Those four changes kill real classes of bug that the original handbook invited, and the external review's guidance has been faithfully absorbed.

However, the document is a conceptual foundation being presented as an operational model, and three things do not survive contact with the daemon: (1) the escalation backflow can mutate a spec that the execution stage is *currently executing against*, which is exactly the "tearing" the double-buffer property claims to prevent — and the version-pinning mechanism that prevented it in the old handbook (`spec_version`) was dropped; (2) `status` is simultaneously the lease, the human's decision record, and a markdown field with no declared single writer, which collides head-on with the already-approved S-015 mismatch-halt rule; (3) feature acceptance tests — the handbook's single strongest idea, and the only check that the *decomposition* was correct rather than that the code compiled — have silently disappeared from the completion predicate.

Separately, this document is not reconciled with `specs/S-011`–`S-015`, which are **already approved** and describe a materially different pipeline (flat canonical directories, 15 fixed steps, a PLAN GATE, product-scoped runs). That is a governance problem independent of the design's merits.

---

## Findings by Severity

### BLOCKING (must fix)

---

**B-1. Unreconciled conflict with already-approved specs S-011–S-015 and the in-flight Phase 2 task set.**

The document proposes a model that contradicts approved, frozen contracts, without declaring supersession, a migration path, or which document wins.

| This document | Approved spec | Conflict |
|---|---|---|
| `features/F-NNN/{specs,plans,reviews}/` | S-015 §Overview: canonical scan set is `specs/`, `plans/current/`, `plans/done/`, `reviews/spec/`, `reviews/plan/`, `reviews/code/`, `reviews/triage/`, `reviews/feedback/`, `tasks/current/`, `tasks/done/`, `tasks/deferred/` | Every path changes. S-015 MUST NOT indexes files outside those dirs — under the approved spec, `features/` would be **invisible to the indexer**. |
| Daemon claims a **feature** | S-012: daemon creates a `pipeline_run` per **product**, advances a fixed 15-step sequence | The unit of scheduling changes. `pipeline_runs.current_step` has no meaning when the unit is a feature with N plans. |
| One human gate (spec set) | S-012 steps 4 and 11: SPEC GATE **and** PLAN GATE; S-014 `gate_type` enum is `spec\|plan` | PLAN GATE is deleted. S-014 AC-1 and its GATE-file frontmatter enum become wrong. |
| Escalation = `status: escalated` + review file | S-012: `ESCALATE>0 → running → waiting` + `.synapse/run/GATE-{run-id}.md`; S-014 HLT-1 inbox authority is the DB | Two different escalation mechanisms, two different inboxes. |
| "Triage: auto-fix up to 3 iterations" | S-012 AC-9: tester-fail loops back to step 12, `iteration ≥ 3` → gate | Same number, different machinery; neither references the other. |

The signal protocol (`specs/pipeline-signal-protocol.md`, marked **Frozen**) is not mentioned once in this document, yet it is the mechanism by which the daemon learns that any of the described stages finished. `tasks/current/phase-2.md` (T-2-1 … T-2-5) is currently scheduled to build the *S-012 model*.

**Required:** an explicit reconciliation section stating, per spec, one of: superseded-by-this-model, amended-as-follows, or retained-unchanged. Under the handbook's own supersession invariant (`definitions.md` §Invariants #5) and synapse `AGENTS.md` §5, a conflicting design is a FAILED artifact, not a parallel opinion. If Phase 2 should now build a different thing, `tasks/current/phase-2.md` needs to say so before T-2-3 starts.

---

**B-2. The double-buffer analogy fails at the backflow, and "no tearing" (Key Property 2) is false as designed.**

In genuine double buffering the producer never reads from, and never mutates, the buffer the consumer holds. Here, escalation flows backward into the design stage, and the document is explicit about what the human does with it: *"Code review found a spec gap → human updates the spec."*

The spec being updated is inside the feature directory that the execution stage has claimed and is mid-flight on.

**Failure scenario.** F-042 has two approved specs, S-042 and S-043. The daemon claims it, generates P-042 (`implements: [S-042]`) and P-043 (`implements: [S-043]`), and starts both. P-043's code review finds a gap in S-043 → `status: escalated`. The human, in their normal design-stage flow, edits S-043. Meanwhile:

- P-043 was derived from S-043 *as it read at claim time*. After the edit, P-043 is a blueprint for a contract that no longer exists — but nothing marks it stale. Its frontmatter still says `implements: [S-043]`, which is still true and still resolves.
- P-042 may already be `done` with code committed and green tests, verified against ACs that the human's edit to the feature's in-scope items has just invalidated.
- The computed coverage matrix now reports coverage against the *new* S-043 text, using *old* plan edges. It will read as green.

The old handbook prevented precisely this with two mechanisms this document drops: `spec_version: N` pinned in plan frontmatter, and the conformance rule `REJECT plan IF spec_version != approved spec version`. That is a lost simplification, not a removed ceremony — it was the tearing guard.

**Recommended fix:**

```yaml
# features/F-042-dark-mode/plans/P-042.md
implements:
  - id: S-042
    version: 3        # pinned at plan creation
```

Specs carry a monotonic `version`. The indexer computes `stale = any(pin.version < spec.version)`. A stale plan cannot transition to `done` and cannot be resumed; it must be replanned. Then state the honest property: *the buffer is immutable while claimed; escalation releases the claim and returns the feature to the design stage, where mutation is safe.* Add the release-on-escalate step to the daemon loop — it is currently missing (see B-4).

---

**B-3. `status` is the lease, the human's decision, and a git-tracked document field at once, with no declared single writer — and this triggers the approved S-015 halt.**

The document asserts two things that cannot both hold:

- *"Markdown is the source of truth. SQLite is the query layer."*
- *"Claims one via SQLite lease (TTL, owner). Sets `status: in_progress`."*

The lease lives in the derived cache; the state it protects lives in the source of truth. Consequences:

1. **A human can silently un-claim live work.** `git checkout features/F-042/feature.md`, a revert, a bad merge resolution, or simply editing `status:` back to `approved` while the daemon holds a valid lease. The markdown now says "ready"; the lease says "mine." Which is true? Under the stated rule, markdown. The daemon is now working on a feature the queue will re-offer.

2. **It collides with S-015 AC-5 (approved).** That spec requires the daemon to **print a mismatch report and halt** when a DB row's status differs from the file's frontmatter. The claim sequence here *creates* that mismatch as a normal, expected transient: daemon writes `in_progress` to the file, then reindexes. Any pulse landing in that window halts the daemon. There is no "the daemon is allowed to disagree with itself for 40ms" carve-out.

3. **Crash recovery is undefined.** Daemon dies holding a lease. TTL expires. `feature.md` on disk says `in_progress`. The ready query is `status=approved AND blocked_by=[]`, so the feature is now in neither the ready set nor the done set — it is stranded, and nothing in the loop reaps it. No TTL value, no renewal cadence, and no expiry-recovery rule is given.

**Recommended fix.** Split the field by authority and make it explicit in the doc:

| Transition | Writer | Medium |
|---|---|---|
| `draft → review → approved` | Human (a decision) | markdown, authoritative |
| `approved → in_progress → done \| escalated` | Daemon (mechanical) | markdown, written by daemon only |
| lease `(feature_id, owner, expires_at)` | Daemon | SQLite **only**, never mirrored to markdown |

`in_progress` in markdown is then a *record* that work started, not a lock; the lock is the lease alone, and it is legitimately derived state because it is operational, not durable. Add explicit rules for: TTL value and renewal interval, lease-expiry reaping (`in_progress` + no live lease → revert to `approved`, or → `escalated` if the last N attempts also expired), and an amendment to S-015's mismatch rule scoping it to human-owned transitions.

---

**B-4. No failure taxonomy and no resume predicate — the "plan fails verification 10 times" and "one of three plans escalates" cases are undefined.**

The status enum is `draft | review | approved | in_progress | blocked | escalated | done`. There is no terminal failure state, no `superseded`, no `deferred`. The proven practice has all three: `../tasks/done/phase-2a-2d.md` marks 2D-4 `[~]` *deferred* and 2D-5 `[~]` *superseded by Phase 2E*, and `../tasks/README.md` builds an entire `deferred/` lifecycle with promote/defer git-mv operations. Those states occurred at the task level — the exact layer this model deletes — and they have not been rehomed.

Concretely undefined:

- **Repeated verification failure.** "auto-fix (up to 3 iterations) or escalate" covers three. What is the state after the human resolves the escalation, the daemon retries, and it fails three more times? There is no attempt counter in frontmatter, no cap, no `failed` terminal. A feature can ping-pong between `escalated` and `in_progress` indefinitely, consuming budget, with the queue showing it as healthy work-in-flight.
- **Partial feature failure.** F-042 has P-042 (done, code committed, green) and P-043 (escalated at iteration 3). `status` is per-*feature*. Setting `F-042: escalated` is correct for P-043 and wrong for P-042. Is the claim released (B-2 says it must be)? Is P-042's committed code reverted, kept, or left as a half-delivered feature on main? `AGENTS.md` §7 (fox) and §8 (synapse) both mandate that partial delivery be documented as partial with remaining scope scheduled — no mechanism here does that.
- **Resume.** The loop says *"Run the next missing stage: plan → implement → review."* This is the entire recovery contract and it is one clause. "Missing" is not defined. After a crash mid-implementation, how does the daemon know P-042 is done and P-043 is half-implemented? Plan frontmatter `status` would answer it — but per B-3 it is unclear who writes it, and per W-4 the actual progress record lives in gitignored `.work/`. The resume predicate must be computable from committed artifacts alone; right now it is not.
- **Escalation exit.** `escalated` appears in neither the ready query nor the done query. What status does the human set to re-enter the pipeline? If `approved`, the daemon re-runs "the next missing stage" — but if the escalation was caused by a spec change (B-2), the correct action is to *discard* the stale plans, not resume them. Nothing distinguishes these.

**Recommended fix:** add `failed` (terminal, requires human replan) and `superseded`; move per-plan lifecycle onto plan frontmatter with an explicit writer; add `attempts: N` with a configured cap; define the resume predicate as a table (`plan.status × artifacts present → next stage`); and state the release-and-quarantine rule for sibling plans when one escalates.

---

**B-5. Deleting the plan gate contradicts the empirical evidence this repo has already recorded, with no compensating control.**

The document's justification is a single sentence: *"Another agent reviews the plans — no human needed. The spec was already human-approved; the plan is the agent's implementation strategy."*

The handbook this replaces says the opposite, and says it from measurement: plans warrant **dual-blind** review because they are a *"contract artifact; expensive to fix post-implementation"*; dual-blind review surfaces *"2-3x more issues than single review"*; and *"Never let the reviewers decide when to stop. That's the human's job. Reviewers will always find something."*

The proven practice agrees. `../tasks/done/phase-2a-2d.md`, Phase 2B: *"Code review identified and resolved 4 plan-quality issues (2 omissions, 1 ambiguity, 1 insufficient granularity)."* The 2G-3 plan I read closes with an explicit refinement-pass record covering rename ripple, audit completeness, constraint specificity, and abstraction-boundary precision — a human-legible artifact of a human-supervised loop.

Removing the human from the plan gate is a defensible throughput decision. Presenting it as costless is not, and the document currently offers nothing in its place. The loop as drawn also permits the same model to author and review the plan, which synapse `AGENTS.md` §5 calls out by name: *"a model reviewing its own output produces confirmation bias."*

**Recommended fix:** keep the gate agent-owned, but make the compensating controls explicit in the document: (a) plan reviewer MUST be a different model from the plan author (already a workspace rule — cite it); (b) N BLOCKING findings on a single plan, or a second consecutive REQUEST_CHANGES, converts the agent gate into an ad-hoc human gate via the existing escalation path; (c) state the accepted risk plainly, so the decision is auditable when a plan defect reaches production.

---

### WARNING (should fix)

---

**W-1. Feature acceptance tests are gone, and the done predicate is now exactly the one the handbook warns against.**

`definitions.md` §Traceability makes the framework's sharpest argument:

> Spec tests are narrow: each tests one AC in isolation. **All spec tests can pass while the feature is broken (composition failure).** The pipeline says "done" based on exit codes, not based on understanding. Feature acceptance tests are the independent proof that the decomposition was correct.

This document's done predicate: *"Feature complete when all plans pass verification and review."* That is the exit-code done, with the independent audit removed. Under the new model, nothing verifies that the human's decomposition of a feature into specs was correct — and since the human now gates *only* at the spec set and never sees the result, there is no compensating human judgment downstream either. The two changes interact badly: the old model had a weak done predicate plus a human at three gates; the new model has a weak done predicate and a human at one.

This is the most significant thing lost in the simplification.

**Recommended fix:** restore feature-level acceptance tests as a precondition for `status: done`. They fit the new model cleanly — declared in `feature.md` frontmatter (metric → test command → pass criterion), written from the feature text by an agent that has not read the plans, run by the daemon after all plans are green. If the decision is instead to drop them, say so explicitly and record the accepted risk; do not let them vanish by omission.

---

**W-2. The traceability chain is broken at both ends.**

*Ingest:* "Index queries … the daemon walks frontmatter and writes SQLite" and "the coverage matrix is computed from the frontmatter graph." But the third edge the matrix needs — *"each spec's acceptance criteria cite feature in-scope items"* — is a body-table relation (`AC-1 → IS-2`), not frontmatter. The indexer must parse markdown bodies, or that edge must move into frontmatter. Either is fine; the document currently claims the first while requiring the second.

*Egress:* `@spec S-042` code markers survive in the handbook and are the reverse-trace mechanism (`grep @spec` → spec file → feature → stakeholder need). The new layout moves spec files into feature directories and then moves feature directories into `features/archive/`. After archival, every `@spec S-040` in the codebase reverse-traces to a path that moved. The index must keep archived features queryable and the resolver must be ID-based, not path-based — the external review already made this point about folder renames (*"`git mv features/F-042-dark-mode features/F-042-theme` should not break anything"*); archival is the same problem at larger scale and is not addressed.

---

**W-3. Parallelism is deferred to an open question, but three of the four Key Properties already assume the answer.**

Property 3 claims the system is *"throughput-limited by the slower stage"* and *"self-balances."* With the loop as written — *"Claim **one** feature"* — execution throughput is pinned at one feature at a time regardless of how much compute is available. The buffer then decouples *waiting* (the human is not blocked) but not *throughput* (the queue drains at a fixed rate). That is a real and worthwhile benefit; it is just not the one claimed.

The dependency runs the other way too: Q2's own suggested answer (git worktrees per feature) determines whether `.work/` is per-feature-directory or per-worktree, which determines whether W-4 is a problem. This cannot be deferred without leaving the filesystem design undetermined.

Worth noting: fox-code-cli **already solved this**, in `../plans/done/2026-09-25T18-10_2g3-worktree-isolation.md` — ephemeral worktrees with deterministic `PORT`/`TMPDIR`/`DATABASE_URL` allocation, cleanup handlers on SIGINT/SIGTERM, a documented port-stride scheme, and an enumerated edge-case list including "port already in use" and "TMPDIR cleanup fails." Do not re-derive this. Cite it.

---

**W-4. `.work/` being gitignored breaks the escalation handoff, worktree coordination, and crash recovery.**

The principle (agent scratch should not pollute feature git history) is right; the boundary is drawn in the wrong place. Three concrete failures:

1. **Escalation has no evidence trail.** The document routes escalation to the human as *"design stage work"* — but the single most useful diagnostic, the agent's todo state and tool traces showing where it got stuck, is precisely what is not committed. The human receives a review file asserting a conclusion, with the reasoning gitignored.
2. **Worktrees do not carry untracked files.** If Q2 resolves to worktrees-per-feature (as Q2 itself suggests), `.work/` inside a worktree is invisible from the main checkout and is destroyed with the ephemeral worktree. Any coordination state there is lost by construction.
3. **Crash recovery cannot use it.** B-4's resume predicate must be computable from committed artifacts. If progress lives in `.work/`, resume after a daemon restart re-derives from nothing.

**Recommended fix:** keep `.work/` for genuine scratch (tool traces, intermediate greps, model chatter), but define one small **committed** progress record — or, better, make plan frontmatter `status` the resume-authoritative field so resume needs nothing from `.work/` at all. Additionally, on escalation, copy the relevant `.work/` excerpt into the committed review file, so the human gets the evidence, not just the verdict.

---

**W-5. Filesystem scale: the reindex, the archive glob, and ID allocation.**

At 50 features the layout is comfortable. Three things bite before 200:

- **Reindex cost.** *"Reindex feature dirs (watch or on pulse)"* is O(all artifacts) per pulse. At 200 features × ~10 artifacts that is ~2000 frontmatter parses per tick, and the document leaves "watch **or** pulse" as an unresolved either/or. S-015 HLT-6 already specifies an *incremental* indexer invoked after each write — adopt it, and make the full scan a startup-only operation.
- **Archive glob ambiguity.** `features/archive/` sits inside `features/`. `features/*/feature.md` correctly excludes archived features; `features/**/feature.md` incorrectly includes them. The document never states the glob, so two implementers will disagree, and the failure mode (archived features re-entering the ready query) is silent. State it, and shard the archive by period (`archive/2026-Q3/F-040-auth/`) before it becomes a flat directory of hundreds.
- **ID allocation has no owner.** The handbook made `S-NNN`/`P-NNN` globally monotonic and never-reused. This document inherits the IDs but not the allocator. With a human drafting specs for F-044 while the daemon writes plans for F-042, two writers race for the same next number, and the collision surfaces as a frontmatter edge silently pointing at the wrong artifact. Needs an explicit allocator (SQLite sequence, or a git-serialized counter file).

---

**W-6. Plan-to-spec cardinality is stated three different ways.**

- The layout implies 1:1 by ID mirroring (`P-042` ↔ `S-042`, `P-043` ↔ `S-043`).
- The execution flow says *"create plans (one per spec **or deliverable**)"* — N:1.
- The source review's example carries `implements: [S-042, S-043]` — N:M.
- The handbook it replaces says flatly: *"One plan per spec."*

The choice is not cosmetic: it determines the "spec done" predicate. Under 1:1, spec-done = plan-done. Under N:M, a spec is done only when *every* plan implementing it is done, and a plan that implements two specs half-satisfies both while in flight — which needs a rule the document does not give. Pick one and state the completion predicate for it.

---

**W-7. Scheduling order is non-deterministic.**

`batch: 02` and `priority: 2` both appear, with no stated relationship, and the rule is hedged: *"The daemon **can** prefer lower batch numbers or higher priority."* When two features are both ready, selection must be a total order or runs are not reproducible and the same queue state yields different work on different days. Specify: `ORDER BY batch ASC, priority DESC, id ASC`, and say what a missing `batch` or `priority` defaults to.

---

**W-8. `blocked_by` pointing at an archived feature is a silent deadlock.**

`blocked_by: [F-041]`; F-041 completes and moves to `features/archive/F-041-onboarding/`. The ready query must evaluate "are all blockers done." If the resolver scans only `features/*/`, F-041 is not found. The safe-looking implementation — "unknown blocker is not done" — means F-042 is never ready, never errors, and never appears in any escalation. It simply stops existing.

Cheap to fix (resolve blockers from the index, which retains archived features per W-2), easy to miss, and worth an explicit line because the failure is silence rather than an error.

---

**W-9. "One handoff" undercounts the human's synchronous obligations.**

The comparison table claims *"One handoff: human approves in design stage."* In the body there are: the spec-set approval (step 4), a `gate: human` field on `feature.md` suggesting a per-feature gate, and escalations, which are unbounded ad-hoc gates that stop that feature entirely until answered. The honest framing is "one *planned* gate per feature, plus unplanned escalation gates" — which is still a large improvement over three gates per artifact, and does not need overstating.

---

### INFO (suggestions)

- **`features/` has no row in the repo layout contract.** synapse `AGENTS.md` §2 is a who-writes-this-directory table and `features/` is absent. Add a row (writer: human for `feature.md` + `specs/`; pipeline for `plans/`, `reviews/`) before agents start writing there.
- **`research/` is inconsistent.** The design stage says research lives in `features/F-NNN/research/`; the layout tree omits it. Minor, but agents will follow the tree.
- **Review filenames lose to same-day collisions.** The layout shows `2026-09-29_spec-review.md` (date only). `AGENTS.md` §2 path conventions mandate `YYYY-MM-DDTHH-MM_{id}-iter{N}.md`. Two review iterations on one day collide under the doc's scheme. Use the AGENTS.md form.
- **`gate:` enum lost a value.** The source review defines `none | human | guardian`; this document shows `human | guardian`. `none` is what makes full-auto mode expressible — restore it.
- **`review` status is never defined or reachable.** The enum includes it; no step in the flow sets it; it appears in no query row. Either wire it (specs drafted, awaiting human) or drop it.
- **Well-judged calls worth keeping as-is:** demoting tasks to scratch; killing the hand-maintained coverage matrix; killing `pipeline/current.md`; the containment-default/links-exception rule; and the five-clause design rule, which is genuinely good and compresses the whole model.

---

## Consistency With Proven Practice

Asked directly: does this match what fox-code-cli did, or idealize it?

**Faithful.** The plan as the substantive artifact is exactly right, and `2026-09-25T18-10_2g3-worktree-isolation.md` is the proof: §2 Key Code Locations with line numbers, §3 proposed changes with type signatures, §4 six enumerated edge cases with mitigations, §5 verification plan naming specific test files. That is what "plans are detailed: file locations, proposed changes, architecture decisions, edge cases, verification steps" means in practice, and the document describes it accurately. Todos-as-scratch, phase files as checkbox scheduling, and "green tests = done" (Q4) all match.

**Idealized — three gaps.**

1. **fox-code-cli had no specs.** Phases went task → plan → code. `feature-registry.yaml` ("54/54 features verified, 100.0% test coverage") is a *post-hoc* tag-and-coverage system, not a pre-approved contract. The document's framing — *"derived from analyzing how fox-code-cli was actually built"* — is true of the execution stage and **not true of the design stage**. Human-approves-spec-sets-then-agents-run has never been run here. Say that; it changes how much confidence the model has earned.

2. **The proven unit of scheduling was the phase, not the feature.** Phase 2E shipped 2E-1…2E-7 together; Phase 2G shipped 2G-1…2G-7. And the batch was *reshuffled mid-flight by agents and human together*: "2F-1 and 2F-4 were pulled forward into PR 1," "2F-2 pulled forward into PR 2," "2E-5 merged into 2E-3," "2D-5 superseded by Phase 2E." That mid-execution replanning is visible in three of the four phase records — it is the norm, not an exception. The new model fixes the plan set at claim time and offers no mechanism to merge, split, or pull forward a plan mid-feature. Either add a replan path (which reopens B-2's version pinning) or state that this flexibility is being traded away deliberately.

3. **Phase rotation is not as automatic as claimed.** *"Phase rotation maps to: archive completed features, let the daemon pick up the next approved ones. The 'buffer swap' is automatic."* In practice (`../tasks/README.md`) rotation is a deliberate human operation with `git mv` plus a portfolio-table update, and the portfolio itself encodes strategic sequencing ("Fox CLI deferred until Synapse pipeline is reliable") that no query over `blocked_by` can derive. Automating the mechanics is right; claiming the decision is automatic is not.

---

## Could You Build a Daemon From This Document?

No — and the gaps are operational rather than conceptual. Missing, in rough order of blocking-ness:

| Missing | Why it blocks |
|---|---|
| SQLite schema (tables, columns, indices) | "writes SQLite" is the entire specification of the query layer |
| Lease TTL value, renewal cadence, expiry recovery | B-3; without it, one crash strands a feature permanently |
| Resume predicate ("next missing stage" → a table) | B-4; this is the whole crash-recovery contract |
| Agent invocation contract | Which CLI, which skill, what prompt, where the output artifact lands. `AGENTS.md` §12 (fox) has the matrix; this doc does not reference it |
| Signal protocol integration | `specs/pipeline-signal-protocol.md` is **Frozen** and unmentioned. How does the daemon learn a stage finished? |
| Commit policy | Who commits implementation code, on what branch, with what message? Harness-owns-done says the harness commits — the document never says |
| Concurrency limit + worktree/branch policy | Q2, but required to know whether `.work/` works at all |
| Reindex trigger | "watch **or** pulse" is an unresolved either/or with different failure modes |
| Containment enforcement | *"writes artifacts only under it"* is stated as a principle with no mechanism. What happens when an agent writes outside its feature directory? |
| Timeouts per stage | `AGENTS.md` mandates `timeout` on every agent invocation; no stage budgets are given |

---

## Open Question Recommendations

**Q1 — Feature status: explicit or derived?**
**Hybrid, split by authority, with the derivation used as an assertion.** Human owns `draft → review → approved` — that is a decision and cannot be derived from child statuses. The daemon owns `approved → in_progress → done | escalated | failed` — mechanical, and should be written only by the daemon. Then compute the expected status from children on every reindex and **assert** it matches: a disagreement is the S-015 mismatch halt, which is exactly what that rule is for. You get explicit's simplicity, derived's accuracy as a consistency check, and B-3's single-writer discipline in one move.

**Q2 — Multi-feature parallelism?**
**Sequential in v1; design the lease for N now; reuse the worktree work that already exists.** Make the lease `(feature_id, owner, expires_at)` from day one with `max_concurrent: 1` in config — so raising it later is a config change, not a schema migration. When you do raise it, git worktrees per feature are the right isolation, and fox-code-cli already built and shipped exactly this (`2G-3`): ephemeral worktrees plus deterministic `PORT`/`TMPDIR`/`DATABASE_URL` allocation, cleanup on SIGINT/SIGTERM, documented port stride, enumerated failure modes. Port that design; do not redesign it. Gate the increase on writing a merge-conflict policy (two features touching one file), not on further architecture work — that policy is the actual blocker and it is small.

**Q3 — Archive trigger?**
**Explicit and batched. Never automatic on `done`.** Automatic archival on `done` creates three problems the moment it fires: it moves a directory out from under any in-flight reverse trace (W-2), it can break `blocked_by` resolution for dependents (W-8), and it makes the common "we shipped it, tests were green, it is still wrong" case require an un-archive. Instead: `done` features stay in `features/` and are excluded from the ready query by status alone; a `synapse archive` command (the daemon-native equivalent of the proven `rotate-phase` skill) sweeps everything `done` that is older than the current batch; the index retains archived features as queryable. This mirrors `tasks/done/` + `rotate-phase`, which works today, and keeps `ls features/` meaning "what the pipeline can touch" as the source review wanted.

**Q4 — Does the human need to accept a completed feature?**
**No human acceptance step — but green is only sufficient if the feature acceptance test exists (W-1).** The document's own observation is correct: fox-code-cli shipped on green tests with no formal acceptance. But it shipped with a human reading every walkthrough, which the new model removes. Make `done` require: all plans verified green **and** every feature success metric's acceptance test passing, where those tests are written from `feature.md` (not from the plans) by an agent other than the implementer. The acceptance test is then the human's delegated proxy: automatic, non-blocking, and it catches composition failure — the one class of defect that green spec tests are structurally incapable of catching. Without it, "green = done" is a strictly weaker guarantee than what fox-code-cli actually ran.

**Q5 — Spec reuse across features?**
**Do not share spec files. Promote the shared thing to its own feature and use `blocked_by`.** A persistence spec that F-042 and F-043 both depend on is owned by neither — hosting it in F-042's directory means archiving F-042 relocates F-043's contract, and it silently makes F-042's human the approver for F-043's dependencies. Instead create `F-044-persistence`, put the spec in it, and set `F-042.blocked_by: [F-044]`, `F-043.blocked_by: [F-044]`. This preserves single-writer ownership, keeps containment as the default and links as the exception (the stated design rule), makes archival safe, and gives the shared work its own gate and its own plans — which it needs anyway, because someone has to implement it. Reserve a genuinely shared top-level `specs/` tree for the OpenSpec-style living-baseline split, which the source review explicitly said you do not need on day one.

---

## Verdict: NEEDS_DISCUSSION

The grouping decision is correct and the four structural simplifications (feature directories, frontmatter edges, queue-as-query, tasks-as-scratch) should be kept. This is not REQUEST_CHANGES because the majority of findings are "underspecified for a daemon," which is the expected state of a conceptual foundation.

Three things should be resolved before this document becomes the basis for specs:

1. **B-2** — spec version pinning, or the no-tearing property is false and escalation can silently invalidate completed work.
2. **B-3** — declare the single writer for `status` and move the lease out of the source of truth, or the first daemon built from this will halt on its own claim under the already-approved S-015 rule.
3. **W-1** — restore feature acceptance tests to the done predicate, or explicitly record that the decomposition is no longer verified and accept that risk in writing.

And **B-1** is a governance blocker independent of design merit: S-011–S-015 are approved and Phase 2 is scheduled to build the model they describe. Either this document supersedes them explicitly, or Phase 2 builds something this document contradicts.

<!-- PIPELINE_SIGNAL: STATUS=DONE AUTO-FIX=0 ESCALATE=0 -->
