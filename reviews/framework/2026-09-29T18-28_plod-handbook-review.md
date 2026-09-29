# Framework Review: Synapse Framework Handbook

> **Reviewer:** Claude Opus 5 (Plod) — read-only
> **Artifacts under review:**
> - `docs/framework/definitions.md` (primary, 1151 lines)
> - `docs/framework/templates.md` (349 lines)
> - `docs/framework/examples.md` (625 lines)
> - `docs/framework/domain-adaptation.md` (37 lines)
> **Date:** 2026-09-29T18:28
> **Review type:** Documentation review (not code review)
> **Prior art consulted:** `reviews/framework/2026-09-29T10-54_merged-framework-review.md` (dual-blind review of the v1 draft), `specs/feature-spec-format.md`, `specs/plan-format.md`, `specs/task-format.md`, `specs/review-format.md`, `specs/pipeline-signal-protocol.md`, `feature-registry.yaml`, `tasks/current/phase-1.md`, `AGENTS.md`

---

## Summary Assessment

This is a large, genuine improvement over the v1 draft — the seven BLOCKING findings from the dual-blind review are substantially addressed (atomicity replaces "session," the task layer is restored with a schema, gates have an approval record and an Author ≠ Approver invariant, conformance and split/replan protocols exist). The conceptual model is now coherent and the Getting Started section is the best part of the document: a new contributor would finish the walkthrough understanding the layer discipline. What the handbook does **not** yet do is (a) serve the operator half of its stated audience — it never says where an artifact file goes, how a human actually performs a gate, or how any of this reaches the daemon — and (b) agree with itself or with the repo's own frozen Layer-0 protocol documents, which define a materially different artifact model (plans 1:1 with *tasks*, `HLT` not `HLD`, `S-` as the *feature* prefix) that the pipeline currently obeys.

The single highest-cost defect is that the conformance rules exist in three places (Part 4, `templates.md`, Appendix C) that disagree on required fields, status vocabulary, and work-type enums — so three conforming implementations of "the validator" would reject each other's artifacts, including the canonical examples in `examples.md`.

---

## Findings by Severity

### BLOCKING (must fix)

---

#### [BLOCKING] B-1: The handbook silently contradicts the repo's frozen Layer-0 protocol documents, and Appendix B migrates from the wrong baseline

`specs/feature-spec-format.md`, `specs/plan-format.md`, and `specs/task-format.md` each carry the header *"Status: Frozen — Layer 0 protocol document. Do not modify without a phase task."* They are the contracts the daemon and every agent job currently obey (`tasks/current/phase-1.md`, tasks T-L0-1..T-L0-3). The handbook defines a different model and never acknowledges them.

Concrete conflicts:

| Dimension | Handbook (`definitions.md`) | Frozen Layer 0 | Consequence |
|---|---|---|---|
| Plan cardinality | "One plan per **spec**" (`definitions.md:771`, Part 3:364) | "One plan per **task**. Plans and tasks are 1:1." (`plan-format.md:22`) | Architectural fork. `plans/current/` naming is `plan-{TASK-ID}` — there is no filename form for a spec-bound plan. |
| Spec decomposition | High-Level **Deliverables**, max 7 (`definitions.md:494`) | High-Level **Tasks** (HLT-1..N), max 8 (`feature-spec-format.md:96-112`) | Live specs `S-011`..`S-015` all use HLT; `tasks/current/phase-2.md` references `spec_task: HLT-1 through HLT-6`. |
| ID prefixes | `F-` = feature, `S-` = spec (`definitions.md:829-834`) | `id_prefix` is repo-configurable; synapse uses `S-` for **features** (`feature-spec-format.md:44-46`, `feature-registry.yaml:82`) | Direct ID collision in this repo: `S-011` currently denotes a *feature*, and the handbook says `S-011` denotes a *spec*. Every `@spec S-NNN` marker is ambiguous until this is resolved. |
| Status values | `DRAFT \| APPROVED \| IN_PROGRESS \| BLOCKED \| DONE \| FAILED \| ABANDONED \| SUPERSEDED` (`definitions.md:108-117`) | `draft \| approved \| done` (`feature-spec-format.md:46-50`) | Existing specs are non-conforming to the handbook on day one. |
| Work types | `feature \| defect \| refactor \| infra \| spike` (`templates.md:19`) | `feature \| refactor \| chore \| bugfix` (`task-format.md`, `tasks/current/phase-1.md`) | The mismatch has already leaked into the handbook — see B-5. |
| Required spec sections | Trigger Model, Coverage Matrix, Validation Contract | "exactly these sections in this order" — 5 sections, no Trigger Model, no Coverage Matrix; "Test Contract" not "Validation Contract" (`feature-spec-format.md:57`, `:225-243`) | A handbook-conforming spec **fails** the frozen schema checklist and vice versa. |

Appendix B (`definitions.md:977-988`) offers migration "from Draft v1" — i.e. from `docs/framework/2026-09-29T09-49_definitions-draft.md`, an internal draft ten hours older than the handbook, which no artifact in the repo conforms to. The migration that is actually needed — Layer-0 frozen formats + `feature-registry.yaml` + `specs/S-011..S-015` + `tasks/current/phase-*.md` → the handbook model — is not addressed anywhere.

**Evidence:** `definitions.md:771`, `:364`, `:829-834`, `:977-988`; `specs/plan-format.md:22`; `specs/feature-spec-format.md:44-46,57,96-112,225-243`; `feature-registry.yaml:82`.

**Required action:** State the handbook's normative relationship to the frozen Layer-0 documents explicitly and up front — supersedes, extends, or coexists. If it supersedes, the Layer-0 docs need a task to unfreeze them and Appendix B must be rewritten as a real migration guide (ID re-prefixing plan for `feature-registry.yaml`, HLT→HLD, plan re-parenting from task to spec, status case conversion, work-type enum reconciliation). If it coexists, say which document wins on each conflicting dimension. Leaving both frozen and both authoritative is the one option that cannot work.

---

#### [BLOCKING] B-2: The stated primary audience — human operators making gate decisions — cannot act on this document

`definitions.md:5-6` names "human operators making gate decisions" first in the audience list. The handbook never tells such a person any of the following:

- **Where artifacts live.** No file paths or naming conventions for Feature, Spec, Plan, Task, or Approval Record. The only incidental mentions are `specs/S-042.md` and `features/F-042.md` (`definitions.md:682`) — the first contradicts the frozen naming rule `specs/{PREFIX}-XXX-kebab-case-name.md` (`feature-spec-format.md:252`), and the second names a `features/` directory that does not exist in this repo and is absent from the `AGENTS.md` repo-layout contract.
- **How to perform a gate.** "The human then decides: approve, or iterate again" (`definitions.md:88`) — with what command, reading what file, writing what artifact, where? `S-014` (human-gate) and the `.synapse/run/GATE-{run-id}.md` convention in `AGENTS.md` exist; the handbook mentions neither.
- **Where the Approval Record goes.** It has a template (`templates.md:317-346`) but no ID format, no filename convention, no directory, and no entry in the "Cast of Characters."
- **How review findings reach them.** Part 1 says reviewers "produce findings documents" and that the human sees triaged output; `specs/review-format.md` already specifies exactly that format and storage (`reviews/{type}/`). The handbook never links it.
- **What the artifacts have to do with the running system.** Zero references to the daemon, the signal protocol, `feature-registry.yaml`, the gate inbox, or any `synapse` subcommand except as prose inside an example AC.

A reader finishing this handbook understands the *model* and cannot produce or approve a single artifact in this repository.

**Evidence:** `definitions.md:5-6,88,188,682`; `specs/feature-spec-format.md:249-262`; `AGENTS.md` §2 (Repo Layout Contract), §10 (Pipeline Section).

**Required action:** Add a Part covering the operational surface: artifact file locations and naming for all six artifact types, the gate procedure end-to-end (where the request appears, what the operator reads, what they write, what happens next), and the handoff to the daemon (signal protocol reference). Alternatively, split this into a separate Operator Runbook (see Document Family Recommendation) and link it prominently from Getting Started — but the handbook cannot claim operators as its primary audience while omitting it.

---

#### [BLOCKING] B-3: The "session" sizing criterion that Part 2 explicitly rejects is still used in two places, one of them normative

Part 2 is unambiguous: *"'Session,' 'focus time,' and other temporal measures are explicitly rejected as sizing criteria"* (`definitions.md:255`), with three reasons given. This was BLOCKING finding B-1 in the prior dual-blind review.

It survives in two places:

- `definitions.md:92` (Getting Started walkthrough): *"each small enough for one agent to complete in one session."*
- `definitions.md:1138` (Appendix C — Sizing Check, the mechanical rule an agent executes): *"ASK: Can one agent complete this task in one session?"*

Appendix C is the worse of the two: it is the operative rule for agents, and it disagrees with Part 2's own cascade table, which states the Plan→Tasks check as *"Can one agent complete each HLD without context overflow?"* (`definitions.md:270`). An agent following Appendix C applies a criterion the handbook has formally rejected; a human reading Getting Started learns the rejected criterion first and the correct one 160 lines later.

**Evidence:** `definitions.md:92`, `:255`, `:270`, `:1138`.

**Required action:** Replace both occurrences with the atomicity/context-overflow formulation from `definitions.md:270`. Consider a one-line callout in Part 2 noting that "session" is a known anti-pattern, since it keeps reappearing.

---

#### [BLOCKING] B-4: The Feature Coverage Matrix is mandatory but does not exist in the Feature template or the conformance schema

Part 5 makes it a gate condition: *"Every feature must have a coverage matrix before SPEC GATE approval of its final spec"* (`definitions.md:581`), with validation rules an approver must apply (`:597-600`), and `examples.md` shows it filled in for F-042 (`:79-90`) and F-101 (`:336-347`).

But:
- The Feature template in `templates.md:12-84` has no Feature Coverage Matrix section.
- Part 4's Feature Required Fields table (`definitions.md:462-478`) does not list it.
- Appendix C's `CREATE Feature` procedure (`definitions.md:1039-1044`) does not produce it.
- In `examples.md` it appears *outside* the YAML/markdown artifact body, as commentary — so even the examples do not show where in the file it belongs.

Anyone (human or agent) following the template produces a feature that cannot pass SPEC GATE, and has no way to discover why.

Two further unresolved questions that fall out of this:
- **"Final spec" is not a knowable predicate.** How does an operator know which spec is the last one a feature will ever need? The gate condition is unevaluable as written.
- **The matrix must be added to an already-APPROVED artifact.** Features are approved at FEATURE_GATE before specs exist. Adding the matrix later mutates an approved artifact, which requires a version bump and (per Part 1) presumably re-approval. That loop is not defined.

**Evidence:** `definitions.md:579-600`, `:462-478`, `:1039-1044`; `templates.md:12-84`; `examples.md:79-90,336-347`.

**Required action:** Add the Feature Coverage Matrix as a required section in the Feature template and in Part 4's required-fields table, and to Appendix C's creation procedure. Replace "final spec" with a checkable condition (e.g. "at SPEC GATE for any spec of this feature, the matrix must account for every spec approved so far; the feature cannot transition to IN_PROGRESS with unmatched IS-N/M-N"). State the version/re-approval rule for post-FEATURE_GATE matrix updates.

---

#### [BLOCKING] B-5: The conformance schema is specified three times and the three copies disagree

Part 4 (`definitions.md:456-531`), `templates.md`, and Appendix C (`definitions.md:1090-1113`) each define required fields and reject conditions. A validator built from any one of them rejects artifacts the other two accept — including the handbook's own examples.

| Field / rule | Part 4 | `templates.md` | Appendix C |
|---|---|---|---|
| Plan `name` | not required | **field does not exist** in the plan frontmatter (`:189-210`) | **reject if missing** (`:1104`) |
| Plan `version` | not required (`:497-507`) | present, "REQUIRED" | reject if missing |
| Spec Trigger Model / `visible_outcome` | not required (`:480-495`) | required section (`:124-134`) | **reject if missing** (`:1097`) |
| Spec Validation Contract (MUST/MUST NOT) | **not required** | required sections | required implicitly via coverage |
| Feature Acceptance Tests | **not required** (`:462-478`) | required section (`:75-83`) | not in `CREATE Feature` (`:1039-1044`) |
| Feature `work_type` | enum constrained to `feature` (`:469`) | `feature \| defect \| refactor \| infra \| spike` (`:19`) | — |
| Spec `updated` / `status_changed` | not required (`:480-495`) | present | — |
| Non-feature exemption enum | `feature: NONE` allowed (`:492`) | "NONE for non-feature work" (`:109`) | `unless work_type in [chore, bugfix, refactor]` (`:1100`) — **`chore` and `bugfix` are not in the work_type enum anywhere else; `defect`, `infra`, `spike` are missing from the exemption** |
| `spec_version` rule | "must match an existing spec version" (`:501`) | — | "reject if `spec_version != approved spec version`" (`:1107`) |

The `chore`/`bugfix` leak is direct evidence of B-1: those are the frozen `task-format.md` work types, not the handbook's. And Invariant 3 (`definitions.md:513`, `status_changed ≥ updated ≥ created`) is unenforceable because Part 4 does not require `updated` or `status_changed` on specs or plans.

**Evidence:** `definitions.md:456-531`, `:1090-1113`; `templates.md:12-84,91-182,189-210`.

**Required action:** Designate exactly one normative source for the schema. My recommendation: Part 4 becomes the single source and is expressed as a machine-readable schema file that `templates.md` and Appendix C are both *generated from* or explicitly reference. At minimum, reconcile every row above and fix the `chore`/`bugfix` enum.

---

#### [BLOCKING] B-6: The status model does not cover states the protocols require, and one protocol contradicts the state diagram

1. **`NOT_STARTED` is undefined.** It is the initial task status in `templates.md:271` and Appendix C (`definitions.md:1067`), but it is absent from the Part 1 status table (`:108-117`), the transition diagram (`:121-130`), and Appendix A's cheat sheet (`:934-945`). Part 1 instead claims `DRAFT` applies to Task. Part 7 compounds this by listing task statuses in lowercase — `(not_started, in_progress, blocked, done, failed, abandoned)` (`:808`) — while every other statement in the document uses uppercase.

2. **The Replan Protocol requires an edge the state machine forbids.** `definitions.md:543-550`: *"When a plan is rejected or fails... Old plan transitions to SUPERSEDED."* But the only SUPERSEDED edge defined is `DONE → SUPERSEDED` (diagram `:125`, cheat sheet `:945`, and Appendix C's rule `IF artifact.status == DONE AND newer_version_approved THEN → SUPERSEDED` at `:1031-1033`). A FAILED or DRAFT plan cannot legally reach SUPERSEDED. An agent executing Appendix C literally cannot perform a replan.

3. **There is no exit from BLOCKED.** The diagram routes `BLOCKED → DRAFT | FAILED | ABANDONED` (`:127-129`) — there is no path back to IN_PROGRESS. An artifact blocked on an external dependency that later clears has no legal transition to resume. `definitions.md:224` says "BLOCKED artifacts require manual intervention" without saying what the intervention produces.

4. **A REJECTED artifact has no status.** The Approval Record decision enum includes `REVISION_REQUESTED` and `REJECTED` (`:229`), but no status corresponds to either. Presumably the artifact stays DRAFT — but then, as the prior review put it, a rejected plan is indistinguishable from a draft, and the "after 3 revision cycles → BLOCKED" rule (`:232`) has no counter to read.

5. **Specs cannot reach DONE via the diagram.** Part 1 states specs have no IN_PROGRESS (`:132`), but the only path to DONE runs through it. The spec's actual path (APPROVED → DONE when its plan's verification passes) is unrepresented, and it is not stated who flips a spec to DONE.

**Evidence:** `definitions.md:108-132`, `:121-130`, `:224`, `:229-232`, `:543-550`, `:808`, `:934-945`, `:1031-1033`, `:1067`; `templates.md:271`.

**Required action:** Publish one state machine that covers all artifact types (per-type tables or per-type diagrams), including `NOT_STARTED`, the resume-from-BLOCKED edge, the post-rejection state, the spec's APPROVED→DONE path, and a `* → SUPERSEDED` edge that admits replan. Regenerate the Appendix A cheat sheet and Appendix C decision rules from it.

---

#### [BLOCKING] B-7: Invariant 7 makes all non-feature work non-conforming, and the handbook's own defect example violates it

Invariant 7 (`definitions.md:517`): *"Scope traceability: Every spec AC cites a feature in-scope item or metric."* Reject condition 5 and Appendix C's `CREATE Spec` step 7 (`:1053`) restate it: *"Validate: every AC traces to feature IS-N or M-N."*

Part 2 establishes four non-feature work types whose specs carry `feature: NONE` and therefore have no IS-N or M-N to cite (`:334-346`). `examples.md` Example 3 (S-200, `work_type: defect`) cites `BUG-1234` in the "Traces To" column of all three ACs (`examples.md:541-543`) — which the handbook's own invariant forbids, and which the examples then certify as conformant.

Related: Part 2's table requires an "Authorizing Artifact" for each non-feature work type (defect ticket, refactor proposal, infra ticket, research question), but no template has a field to record it. `examples.md` invents `defect_ref: BUG-1234` (`:517`) — a field that appears in no template, no required-fields table, and no conformance rule.

**Evidence:** `definitions.md:334-346`, `:517`, `:1053`; `examples.md:517,541-543`.

**Required action:** Amend Invariant 7 to read "every spec AC cites a feature in-scope item or metric, or — for `feature: NONE` specs — the spec's authorizing artifact reference." Add a required `authorizing_ref` (or work-type-specific) field to the Spec template and Part 4, and update Appendix C's validation step.

---

### WARNING (should fix)

---

#### [WARNING] W-1: "Approval is a human decision" and the Delegation section contradict each other

Part 1 states the principle twice and emphatically: *"Agent reviewers produce findings. They do NOT approve. Approval is a human decision"* (`:158`), and in the walkthrough, *"Agents find problems; humans make decisions"* (`:88`). Eighty lines later, Delegation permits SPEC_GATE and PLAN_GATE to be delegated to review agents, "Automatic if configured in pipeline" (`:237-245`).

Both may be intended (human by default, agent in full-auto runs — which is how `AGENTS.md` §5 frames it), but the document never reconciles them, so the reader cannot tell whether delegation is a sanctioned mode or a violation of the principle.

**Suggested action:** State the rule once as conditional: approval is a human decision in attended mode; in full-auto mode it may be delegated to a director/review agent with the named permission, and the delegation is recorded in the approval record. Cross-reference `AGENTS.md` §5 (Gate approvers).

---

#### [WARNING] W-2: Quantitative empirical claims are unsupported, and one is contradicted by this repo's own data

Three numbers are asserted as findings in a normative document describing a system the prompt itself describes as new:

- *"dual-blind review (Grok + Claude) surfaces 2-3x more issues than single review"* (`:159`). The repo's only dual-blind data point is `reviews/framework/2026-09-29T10-54_merged-framework-review.md`: Grok 7B/4W/4I = 15 findings, Claude 5B/5W/4I = 14 findings, merged 7B/7W/8I = 22 findings. That is ~1.5x the better single reviewer, not 2-3x — and the merged BLOCKING count equals Grok's alone.
- *"specs over 10 AC have > 30% defect escape rate in agentic pipelines"* (`:749`), offered as the rationale for the AC cap. No source, no sample, no measurement definition.
- *"Spec bugs amplify 4-5x downstream"* (`:197`).

A handbook that requires every metric to have a "measurement procedure" (`templates.md:53`) should hold its own claims to the same standard. These also make the doc brittle: the first reader who checks the merged review will discount the rest.

**Suggested action:** Either cite the measurement, or restate as design rationale ("we cap at 10 because review quality degrades with list length; we have not yet measured the escape rate"). Replace the 2-3x claim with the actual observation from the merged review.

---

#### [WARNING] W-3: Standards citations are imprecise and one attributes a convention to standards that do not define it

`definitions.md:825`: *"Industry standards (ISO 26262, DO-178C) require traceability but do not mandate a specific format"* — accurate and useful. `definitions.md:885` goes further: *"This is equivalent to the industry `@trace` convention (see ISO 26262 §8.4.4, DO-178C §5.5)."*

Two problems. (1) ISO 26262 is a multi-part standard; a bare "§8.4.4" without the part number (e.g. ISO 26262-6:2018, 8.4.4) does not resolve to anything. (2) Neither standard defines a source-annotation convention called `@trace`; they require bidirectional traceability between requirements, design, code and tests, typically satisfied by a tool-maintained RTM rather than in-source tags. Presenting `@trace` as an "industry convention" with clause citations overstates the provenance of what is really a reasonable local choice.

**Suggested action:** Give the full part/clause references or drop them, and reword to "this follows the common practice of in-source traceability tags; the standards require the traceability, not this notation."

---

#### [WARNING] W-4: `spec_version` pins plans to spec versions, but no rule says what happens when a spec is revised

The plan carries `spec_version` (`:501`, `templates.md:194`) and Invariant 2 requires monotonic versions. Nothing defines:

- **When a version bumps.** `templates.md:16` says "Increments on each approved revision" — so does editing an APPROVED spec return it to DRAFT for re-gating, or is v2 created directly? Part 1's review cycle only describes the DRAFT→APPROVED path for new artifacts.
- **What happens to in-flight work.** If S-042 goes to v2 while P-042 (`spec_version: 1`) is IN_PROGRESS, is the plan invalidated, or does it continue against a stale contract? Appendix C's reject rule (`spec_version != approved spec version`) implies the plan becomes non-conforming retroactively, with no defined recovery.
- **What happens to completed work.** A DONE spec at v2 with code tagged against v1 behaviour has no re-verification trigger.

This is the unresolved remainder of prior finding W-3: the version *fields* were added, the version *semantics* were not.

**Suggested action:** Add a "Versioning and Amendment" subsection: what triggers a bump, what status the amended artifact takes, which downstream artifacts are invalidated (and to what status), and the re-verification obligation.

---

#### [WARNING] W-5: `@spec` markers go stale under the Split and Replan protocols, undercutting the stated reason for marking specs

Part 5 argues for marking specs rather than plans/tasks precisely because specs are stable: *"Plans get superseded; the code would reference a dead document"* (`:698-700`), *"The spec is the Goldilocks artifact: stable enough to survive"* (`:702`).

But the Split Protocol transitions the parent spec to SUPERSEDED (`:538`) and the handbook's own audit rule flags *"code markers referencing non-existent specs (stale)"* (`:1127`). After S-042 splits into S-043 and S-044, every `// @spec S-042` marker in the codebase points at a superseded contract, and there is no re-tagging obligation in the Split Protocol, in Part 5, or in Appendix C.

**Suggested action:** Add a step to the Split Protocol: "each child spec inherits the code markers for the ACs it received; the split author re-tags affected code sites." Extend the traceability audit to distinguish "marker → SUPERSEDED spec" (must re-tag) from "marker → nonexistent spec" (error).

---

#### [WARNING] W-6: Nothing maps HLDs to ACs, so the Task template's Acceptance section is not computable

Tasks are keyed to a deliverable (`hld: HLD-1`, required, `templates.md:269`) and their Acceptance section is *"Subset of plan verification that applies to this task"* (`templates.md:292-298`), expressed as AC rows.

But no artifact records which ACs a given HLD satisfies. The spec's Coverage Matrix maps AC → MUST → verification (`templates.md:174-181`); the HLD table maps HLD → description → HLD dependencies (`:146-154`); the plan's Deliverables table maps HLD → files (`:225-229`) and its Verification Plan maps AC → method (`:238-246`). The AC↔HLD edge is missing from all four.

Consequence: a task author cannot mechanically determine their acceptance subset, and the sizing rule "each HLD should become 1-2 tasks" (`:284`) cannot be checked against verification coverage. It also means an HLD can exist that satisfies no AC (dead deliverable) with no reject condition catching it.

**Suggested action:** Add a "Covers ACs" column to the spec's High-Level Deliverables table (mirroring the MUST table's existing "Covers ACs" column), and add a reject condition for HLDs covering zero ACs.

---

#### [WARNING] W-7: The Feature-done predicate deadlocks on ABANDONED or SUPERSEDED child specs

`definitions.md:667-673`: *"Feature done: 1. All specs with `feature: F-XXX` have status = DONE... A feature cannot be marked DONE if any spec is still IN_PROGRESS, BLOCKED, or FAILED."*

The exclusion list omits ABANDONED and SUPERSEDED, but condition 1 requires *all* specs to be DONE. A feature that legitimately abandoned one spec, or split one (parent → SUPERSEDED, `:538`), can never be marked DONE. The Split Protocol's "Feature's spec list is updated atomically" (`:541`) may be intended to handle the split case, but it does not say the parent is removed, and nothing addresses abandonment.

**Suggested action:** Restate as "every spec with `feature: F-XXX` is DONE, ABANDONED, or SUPERSEDED, and the Feature Coverage Matrix has no unmatched rows" — the matrix is the real scope-loss check, and it already catches an abandonment that dropped coverage.

---

#### [WARNING] W-8: `domain` is a required field whose value space does not exist

Every Feature and Spec requires `domain: <Valid domain profile ID>` (`:471`, `:491`; `templates.md:31,106`). `domain-adaptation.md:5` states the mechanism is *"Design intent only — not implemented with a second domain"* and describes domain profiles in the conditional (*"would be captured in a domain profile"*).

So a required, gate-enforced field points at an unimplemented concept with no registry, no enumeration of valid values, and no schema for what a profile contains. The examples use `sw-dev` and `nav-sim` without either being defined anywhere. A validator cannot check this field; an author cannot know what to put in it.

**Suggested action:** Either (a) make `domain` optional with a documented default until profiles exist, or (b) define the minimal profile registry now (a YAML file listing valid IDs and their overridden caps/timeouts/verification types). Mark `domain-adaptation.md` as non-normative in the handbook's Related Files table so readers know the referenced mechanism is aspirational.

---

#### [WARNING] W-9: `examples.md` contains defects that will be copied

The examples are the most-copied part of any framework doc. Four problems:

1. **Malformed Risk tables.** `examples.md:258` — `| R-1 | Path resolution differs across OS | M | M | Use Node's path.resolve... |` — five cells under a four-column header (`Risk | Likelihood | Impact | Mitigation`). The risk ID and description occupy two cells. Same defect at `:488` in P-101. This renders wrong and teaches the wrong shape.
2. **S-101's Trigger Model does not use the template's fields.** It has `Timestep Event / State Observable / Termination` (`:381-387`) instead of the required `Actor / Trigger / Visible Outcome / Non-Goal` (`templates.md:130-134`). Appendix C rejects a spec `missing: trigger | visible_outcome` (`definitions.md:1097`). The canonical non-software example would be rejected by the handbook's own agent rules — and `domain-adaptation.md:28-33` lists "required template fields" as part of the invariant core that domains may not relax.
3. **Dangling reference.** The F-101 coverage matrix cites `S-102 AC-1, AC-2` (`:341`), but S-102 is never shown, while Part 5's validation rule 2 requires "every cited AC actually exists in the referenced spec" (`:599`).
4. **`defect_ref`** (`:517`) is an undocumented field — see B-7.

**Suggested action:** Fix the two Risk tables; either add the Actor/Trigger/Visible Outcome/Non-Goal rows to S-101 or explicitly document a continuous-model Trigger variant in `templates.md` and exempt it in Appendix C; stub S-102 or re-point the matrix.

---

#### [WARNING] W-10: `templates.md` sanctions manual verification; `examples.md` marks it as a negative example

`templates.md:246` offers as a model row: `| AC-3 | manual-review | checklist item 3 in PR template | reviewer signs |`. Part 7 likewise permits "test name, benchmark command, **or review checklist item**" (`:773`).

`examples.md:603-610` labels manual verification a Bad Plan: `| AC-1 | manual | "looks correct" | reviewer approves |` → *"WRONG: Not runnable, no concrete pass criterion."*

The intended distinction is presumably *vague* manual criteria vs. *specific* ones, but as written the two documents disagree about whether the `manual` verification type is legitimate at all. This is also the unresolved half of prior finding I-8 (verification steps are descriptions, not runs).

**Suggested action:** State the rule explicitly in Part 5 or the plan definition: manual verification is permitted only when it names a specific artifact and a binary criterion; "looks correct"/"reviewer approves" is non-conforming. Annotate the negative example to say which part is wrong.

---

#### [WARNING] W-11: Appendix C is not sufficient for an agent operating inside this pipeline

Answering review question 6 directly. Appendix C covers status rules, creation procedures, review protocol, reject conditions, code markers, sizing, and audit. For mechanical artifact creation it is close — but an agent running as a synapse pipeline job would fail on all of the following:

- **No signal emission.** `AGENTS.md` §6 and `specs/pipeline-signal-protocol.md` require every agent job to end with a conforming `PIPELINE_SIGNAL` as the last line; absence = TASK_FAILED. Appendix C's review protocol ends with "Return findings to author" (`:1087`) and never mentions signals.
- **No file paths or naming.** The agent does not know where to write the artifact (see B-2). It cannot complete step 5 of any CREATE procedure.
- **No findings-document format.** `specs/review-format.md` specifies structure, filename pattern, iteration numbering, and the three-value verdict line. Appendix C specifies three severity levels and nothing else — no verdict, no iteration rule, no storage.
- **No triage procedure.** Triage is a named pipeline step (AGY) and a load-bearing concept in Part 1 (`:182-189`), but Appendix C has no triage rules at all.
- **No deferred-item rule.** `AGENTS.md` §8 requires a new timestamped file per deferred item in `tasks/deferred/`; Part 1 says `tasks/deferred.md` (singular file, `:188`) — these contradict each other — and Appendix C mentions neither, so an agent deferring a finding loses it.
- **Vocabulary bugs.** `NOT_STARTED` (B-6), `chore`/`bugfix` (B-5), "one session" (B-3).
- **Omissions in creation procedures.** `CREATE Feature` omits acceptance tests and the coverage matrix; no procedure creates an Approval Record; no rule covers version bumps or leaving BLOCKED.
- **Self-sufficiency is overstated.** `:998` tells humans to read the main handbook instead, implying Appendix C is standalone for agents, but it contains no frontmatter example — an agent must also read `templates.md` (which `:7` does say). Make the dependency explicit inside the appendix.

**Suggested action:** Add to Appendix C: artifact path/naming table, required signal line with a link to `specs/pipeline-signal-protocol.md`, a link to `specs/review-format.md` for findings output, a triage procedure, the deferred-item rule, and the missing creation steps. Fix the vocabulary bugs. State at the top that Appendix C must be used together with `templates.md`.

---

#### [WARNING] W-12: The artifact inventory is inconsistent — one item in the cast has no template, one template is not in the cast

The Cast of Characters lists five artifacts including **Acceptance Test** ("Who creates it: Tester") (`:52-58`). An Acceptance Test has no ID, no status, no lifecycle, no template — it is a row in the Feature's Acceptance Tests table (`templates.md:75-83`). Presenting it as a peer of Feature/Spec/Plan/Task misleads the reader about what they will be filing.

Conversely, **Approval Record** is a full template (`templates.md:317-346`) and the output of every gate — the artifact the primary audience actually produces — and appears nowhere in the cast, the workflow diagram, the Part 8 summary is its only mention, and it has no ID scheme or storage location.

**Suggested action:** Make the cast six rows: Feature, Spec, Plan, Task, Approval Record, and either drop Acceptance Test or relabel the row as a Feature *section* rather than an artifact. Give the Approval Record an ID format and a home.

---

### INFO (suggestions)

**I-1 — Stale cross-references throughout the doc family.** Every companion file points at the wrong Part: `templates.md:3` says "definitions.md Part 4" and titles itself "## Part 4 — Templates" (templates are Part 8; Part 4 is Conformance Schema); `examples.md:3,8` says "Part 9" (examples are Part 6); `domain-adaptation.md:3` says "Part 1 (Design Principles)" (domain agnosticism is in Part 2; Part 1 is Lifecycle & Review). Inside the handbook, `:885` says "see Part 9: Traceability" — Traceability is Part 5 and there is no Part 9. These are all leftovers from the v2 numbering. Consider linking by anchor rather than Part number so renumbering cannot break them again.

**I-2 — Document assembly artifacts.** `:992` prints *"End of document."* before Appendix C begins at `:996`. `:555-556` has a doubled `---` rule. `:5-7` opens a blockquote (`> **Audience:**`) and then continues with unindented bullets, so the bullets render outside the quote.

**I-3 — Gate names are written two ways.** `FEATURE_GATE`/`SPEC_GATE`/`PLAN_GATE` in the gate, timeout, and delegation tables; `FEATURE GATE`/`SPEC GATE`/`PLAN GATE` in Part 2's layer table (`:312-317`), Part 5 (`:581`), and the sizing flow (`:298,302`). Pick the underscore form (it is the one in the Approval Record enum, `templates.md:323`) and use it everywhere.

**I-4 — No glossary; several terms are used before they are defined.** `HLD` appears at `:90` and is load-bearing by `:268`, but "High-Level Deliverables" is not spelled out until Part 4 (`:494`). `IS-N` / `M-N` first appear in the traceability chain at `:565` and are only defined implicitly by `templates.md`. "Blind review" is never defined (blind to what — the author, the other reviewer, or the prior findings?). A one-page glossary would also help the agent audience.

**I-5 — The dual-blind protocol is hedged into ambiguity.** `:145`: *"Reviewer 2 (blind or sees Reviewer 1)"* — this is the mechanism the handbook credits for its quality claim (W-2), stated as an either/or with no guidance on when to choose which.

**I-6 — Parts 6 and 8 are pointer stubs.** Seven and twelve lines respectively, each a table pointing at a companion file. They occupy numbered slots in the "Handbook" sequence, which inflates the structure and is the proximate cause of the renumbering breakage in I-1. Consider demoting both to the Related Files table and renumbering Detailed Definitions as Part 6.

**I-7 — Part 7 partially duplicates Part 5.** Answering review question 1: Part 7 is *mostly* useful as reference and does not merely repeat Getting Started — the Identification System (`:824-912`) is the document's best reference material and appears nowhere else. But its "Code Markers" subsection (`:876-894`) restates Part 5's `:602-624` with the same TypeScript example, and its RTM diagram (`:896-912`) restates Part 5's chain (`:562-574`). Two suggestions: (a) cut the duplicated marker/RTM material from Part 7 and leave a pointer to Part 5; (b) consider moving the ID system *forward* — IDs are used from the Cast of Characters onward, so a reader hits `F-042`, `S-042`, `HLD-2`, `IS-1` hundreds of lines before the system that generates them is explained.

**I-8 — Task-per-HLD guidance has a hole.** `:284`: "each HLD should become 1-2 tasks. If a single HLD becomes > 3 tasks, the HLD was too coarse." Three tasks is neither endorsed nor flagged.

**I-9 — External dependency IDs violate the ID-format reject rule.** `depends_on: - id: external:gitlab-api` (`:411`) versus Appendix C's *"reject if id format invalid (not F-NNN | S-NNN | P-NNN | T-NNN)"* (`:1110`). Add an explicit `external:*` exemption.

**I-10 — Two different counters both called "3".** Part 1's iteration heuristic ("after iteration 3, exercise the gate", `:179`) and the Approval Records rule ("after 3 revision cycles without approval → BLOCKED", `:232`) count different things and will be conflated. Name them (review iterations vs. gate revision cycles) and say whether either is tracked in an artifact field.

**I-11 — SPIKE_GATE is underspecified.** It appears in the gate table (`:212`) but has no row in Gate Timeouts (`:218-222`), and Part 2 describes spikes as "time-boxed" (`:344`) with no `timebox` field in any template.

**I-12 — No worked example of a Task or an Approval Record.** `examples.md` covers Feature/Spec/Plan only. The Approval Record is the artifact the handbook's primary audience produces, and the Task is the one an implementer works from. Both would benefit from a filled example more than a fourth feature example would.

**I-13 — Minimums are weak.** Part 4 allows a spec with a single AC (`:493`) where the frozen `feature-spec-format.md:237` requires at least 2, and nothing requires any MUST NOT, though `feature-spec-format.md:129` requires at least one. A one-AC, zero-MUST-NOT spec conforms — this was prior finding B-6's tail and is still open.

**I-14 — Getting Started is genuinely good.** Answering review question 1 positively: the Cast of Characters → 30-second workflow → narrative walkthrough → "key insight" progression works, and the F-042 example thread running through Getting Started and into `examples.md` is the right choice. A new contributor would come away understanding layer discipline. The gap is not comprehension, it is action (B-2).

---

## Document Family Recommendation

Answering review question 4. The current family is four documents; three of them are appendices to the first and one is a 37-line stub. The handbook is trying to be five documents at once: a conceptual introduction, a normative schema, a rationale essay, a migration guide, and an agent contract. Those have different audiences and, critically, different change rates — the schema must be versioned in lockstep with a validator, while the introduction should almost never change.

**Split out of the current handbook:**

| New document | Content to move | Why separate |
|---|---|---|
| **Conformance Schema** (machine-readable + prose) | Part 4, Appendix A's checklist, Appendix C's reject conditions | One normative source instead of three (B-5). Should be generated into a JSON Schema / YAML the daemon can execute, with the prose rendered from it. |
| **Agent Contract** (replaces Appendix C) | Appendix C + signal protocol reference + path conventions + findings format | Must version with the validator and the daemon, not with the handbook narrative (W-11). |
| **Migration Guide: Layer 0 → Framework** (replaces Appendix B) | New content; Appendix B's current content is obsolete | B-1. This is the document that unblocks adoption in this repo. |
| **Design Rationale / ADRs** | "The Iteration Problem" (`:162-189`), Flat vs Hierarchical IDs (`:842-851`), why-mark-specs (`:689-702`), cap justifications | These are excellent and they are *why* documents. They dilute a reference doc and make it 1151 lines. |

**Add to the family:**

| New document | Why it is needed |
|---|---|
| **Operator Runbook** | B-2. Gate procedure, where artifacts live, what a gate request looks like, how to approve/reject/delegate, escalation, what to do with a BLOCKED artifact. The highest-value missing document. |
| **Glossary** | I-4. AC, HLD, IS-N, M-N, blind review, atomicity, gate, triage, conformance — used across five documents with no single definition point. |
| **Artifact Layout & Naming Spec** | Currently split between `AGENTS.md` §2 and the frozen `feature-spec-format.md` §7, with the handbook contradicting both (`:682`). |
| **Review, Triage & Findings Guide** | `specs/review-format.md` already exists and is frozen; it should be a first-class member of this family and referenced from Part 1, not discovered separately. |
| **Domain Profile Schema** | W-8. `domain-adaptation.md` should either become this or be explicitly marked non-normative. |
| **Onboarding Quickstart** | "Ship your first feature": one real end-to-end pass with real commands and real paths in this repo. Getting Started is the conceptual version; this is the executable one. |

**Already in the repo and should be linked from the handbook rather than re-invented:** `specs/pipeline-signal-protocol.md`, `specs/review-format.md`, `feature-registry.yaml`, `AGENTS.md`.

**Keep in the handbook:** Getting Started, Part 1 (lifecycle/review/gates, minus the Iteration essay), Part 2 (design rules), Part 3 (dependencies), Part 5 (traceability), and the Identification System from Part 7. That is a tight ~500-line document that serves human operators and onboarding contributors, with the schema, agent rules, migration, and rationale each living where they can be maintained independently.

---

## Missing Tests / Test Gaps

Not applicable in the usual sense (documentation review), but the conformance rules are the executable part of this framework and nothing verifies them:

- No validator exists for Part 4. The three copies of the schema disagree (B-5) precisely because nothing executes any of them.
- `examples.md` is the de facto test suite for the schema and is not run against it — which is why S-101 would be rejected by Appendix C (W-9.2) and S-200 violates Invariant 7 (B-7) without anyone noticing.
- Suggested: a conformance test that parses every YAML block in `examples.md` and asserts it passes the Part 4 schema. That single test would have caught B-4, B-5, B-7, and W-9.

## Architectural & Compatibility Risk

The material risk is B-1. Adopting this handbook as normative without a migration decision creates two live, mutually inconsistent artifact models in one repo: the frozen Layer-0 formats that the daemon, the existing `specs/S-011..S-015`, `feature-registry.yaml`, and `tasks/current/phase-*.md` all obey, and the handbook model that nothing yet obeys. The `S-` prefix collision (feature IDs in the registry vs. spec IDs in the handbook) is the sharpest edge: `@spec S-011` is ambiguous *today*, and the traceability chain — the framework's core claim — is unsound until it is resolved.

Secondary risk: Appendix C is the interface between this handbook and the running pipeline, and it currently omits the signal protocol that the daemon requires (W-11). An agent that follows Appendix C faithfully produces a job the daemon marks TASK_FAILED.

---

## Verdict

REQUEST_CHANGES

<!-- PIPELINE_SIGNAL: STATUS=DONE AUTO-FIX=0 ESCALATE=0 -->
