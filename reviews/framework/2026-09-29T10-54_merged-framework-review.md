# Framework Definitions Review — Merged (Dual-Blind)

> **Document Under Review:** `docs/framework/2026-09-29T09-49_definitions-draft.md`
> **Reviewer 1:** Grok (blind) — 7 BLOCKING, 4 WARNING, 4 INFO → REQUEST_CHANGES
> **Reviewer 2:** Claude Opus 4.5 (blind) — 5 BLOCKING, 5 WARNING, 4 INFO → REQUEST_CHANGES
> **Merge Date:** 2026-09-29
> **Method:** Both reviewers ran independently with no access to each other's output.
>   Findings are grouped by topic. Where both found the same issue, both perspectives are preserved.

---

## BLOCKING Findings

### B-1: "Session" and spec sizing are undefined and contradictory

**Found by:** Both (Grok B-2, Plod B-1)

Three sizing rules are stated as properties of the same object:

1. A spec is "what a single specialist can implement in **one focused session**."
2. "One spec = one independently-deliverable unit."
3. A spec contains up to 7 High-Level Deliverables, each "a logical chunk one specialist can build independently."

**Grok:** (1) and (3) cannot both be true. If each HLD is independently buildable by a specialist, the spec is a bundle of units, and the session bound is fiction. "Focused session" and "implementable unit" are the split criteria, and neither is defined. Session capacity depends on the specialist, the domain, and whether the work is blocked on data, review, or a numerical experiment. Two conformant agents will split the same feature differently.

**Plod:** What is a "session"? An hour? A day? A sprint? For agentic pipelines, an 8B model's "session" is not the same as Opus's. Two planning agents produce specs where one's "session" is 2 hours and another's is 2 days. The pipeline has no way to detect the mismatch until implementation fails.

**Required action:** Pick one sizing rule and delete the others. Define "session" in concrete, measurable terms (time-boxed, token-bound, or deliverable-bound). If HLDs are independently assignable, they are tasks and need identity, status, owner, and dependency edges.

---

### B-2: "Independently-deliverable" contradicts `depends_on`

**Found by:** Both (Grok B-2, Plod B-2)

**Grok:** "Independently-deliverable" is undefined. Deliverable to a stakeholder, mergeable to a trunk, or verifiable in isolation? A Barnes-Hut tree constructor is verifiable in isolation and delivers no stakeholder capability. The feature definition and the spec definition use "delivers" for different recipients and never say so.

**Plod:** A unit cannot be "independently deliverable" if it has hard dependencies via `depends_on`. The document conflates atomicity (can be implemented as a unit without partial states) with independence (can be delivered without other specs existing).

**Required action:** Replace "independently-deliverable" with "atomically-implementable" or similar. Clarify that `depends_on` creates a partial ordering, and "independent" refers to implementation atomicity, not deployment ordering.

---

### B-3: Feature, spec, and plan boundaries are not operationally distinct

**Found by:** Grok B-1

The prose draws a clean line: feature is stakeholder value, spec is what the unit must do, plan is how. The examples erase that line.

- The Nav Sim spec example names "Barnes-Hut tree construction" (algorithm choice). The plan section assigns algorithm selection to the plan. The same decision is defined to live in two layers.
- The feature rule says success metrics are "observable without knowing implementation details." The Nav Sim feature metric "< 2% divergence from reference" is an engineering measurement requiring a reference, a norm, a timestep, and an ensemble. It sits in the feature layer but requires implementation knowledge to evaluate.
- The legal feature "flags non-standard indemnification clauses" uses a predicate ("non-standard") that has no stakeholder-observable meaning until a guideline or gold set exists.
- High-Level Deliverables in the spec are "what gets built, ordered by dependency" — a dependency-ordered decomposition into buildable chunks is a design, which the plan's Approach section also claims.

An agent that copies the examples will write plans into specs and engineering metrics into features, then pass its own template.

**Required action:** Write a decision rule an agent can apply to a single sentence: which layer may name an algorithm, a tolerance, a file, a schema, a gold set, and a business outcome. Rewrite every example so it satisfies that rule. Add one negative example per layer.

---

### B-4: Gates cannot be executed or audited

**Found by:** Both (Grok B-4, Plod B-4)

**Grok:**
- Approver is a level ("stakeholder," "engineering," "technical"), not an identity. A role cannot sign.
- Nothing says the approver must differ from the author. Default reading: self-approval. For an agentic pipeline, that is confirmation bias built into the gate.
- No decision record: who approved, against which revision, with what objections.
- No reject, revoke, block, supersede, or cancel transition. A rejected plan is indistinguishable from a draft.
- `done` is one state for three different events: spec verification green, plan executed, feature metric met.
- Date granularity (YYYY-MM-DD) cannot order "approved before plan written" inside a day.
- Full-auto execution has no delegated approver. If the stakeholder is absent, gate 1 never fires.
- An agent can set `approved` on an empty AC list. No reject condition is defined.

*"A gate that is a word in a file is not a gate."*

**Plod:**
- Who can approve at each gate? "Stakeholder level" is a vibe, not a role.
- What constitutes rejection? Is there a revision process?
- How is approval recorded? No `rejected`, `revision_requested`, or `superseded` status.
- Timeouts? If a gate doesn't respond, what happens? S-042 sits at SPEC GATE for 3 weeks — the pipeline's behavior is undefined.

**Required action:** Define the state machine: draft → approved | revision_requested | rejected | in_progress | done | blocked | superseded | cancelled. Require an approval record (approver identity distinct from author, artifact revision, timestamp with time and zone, decision, note). Define delegation for unattended runs. Define timeout behavior. Bind each transition to a checkable predicate.

---

### B-5: Removing the task layer drops functions the rest of the framework still needs

**Found by:** Both (Grok B-3, Plod B-3)

**Grok:**
- "Task" is never defined. No template, no id, no status, no owner, no acceptance rule, no trigger for when emergence is mandatory. An optional layer with no schema will be reinvented differently by every agent.
- "Serial" is undefined and load-bearing. Two specs with empty `depends_on` are both ready. A serial agent still needs a selection rule: priority, stakeholder value, risk, age, or cost. None is stated.
- The parallel escape hatch cannot work. The plan has no exclusive ownership boundaries. Deriving assignments from a blueprint that assumed one writer produces overlapping writes. No partition rule, no merge rule.
- Fix cycles are work (failed verification, rejected plan, flaky numerical comparison, triage pass). The feed-forward diagram (Feature → Spec → Plan → Implementation) has no edge back. The framework can start work and cannot represent rework.
- Non-feature work has no authorizing artifact. A defect fix, refactor, migration, incident, toolchain change, research spike — none are stakeholder-observable new capabilities. Forcing them through Feature either lies about value or blocks work at a gate that has nothing to approve.
- HLD is the task layer with the control fields removed. Independently buildable, dependency-ordered, capped chunks are tasks. Removing the name and keeping the chunks removes status, owner, and traceability.

**Plod:**
- Progress tracking: A plan may have 7 deliverables. Mid-implementation, what is the state? "In progress" is a single bit.
- Retry isolation: If deliverable 4 fails, can the agent retry just deliverable 4? Without tasks, the entire plan must restart.
- Checkpoint/resume: Agent context windows overflow. How does a new agent pick up mid-plan?
- Audit trail: When did deliverable 3 complete? Who/what did it? Plans don't record this.

*Grok: "Either restore an explicit work-assignment artifact, or specify the functions it carried."*
*Plod: "Explain concretely how plans track partial completion state without tasks — show the mechanism, don't just assert it exists."*

**Required action:** Either define the task layer properly as an optional fourth tier (post-plan) with a template, OR explain concretely how plans track partial completion. Address: non-feature work types, selection among ready specs, rework/fix cycles, and the predicate "implemented." State the seriality assumption as a formal constraint and state what must be added when that constraint is false.

---

### B-6: Feature success is unverifiable, and unit success does not compose

**Found by:** Grok B-5

Nothing requires the union of spec ACs to imply the feature metrics. Every spec can be `done` while the feature metric is unmet. No artifact owns that check. There is no integration or acceptance spec type whose job is composition.

The converse is also unspecified: metrics already met while a spec is still `draft`. Is the feature done? May the remaining spec be cancelled?

Metric template is "[condition] → [observable outcome]" with no unit, baseline, target, direction, window, data source, measurement procedure, or owner. The SW feature example ("register any git repo and start a pipeline run") ships with no metric at all — the canonical example fails the definition.

Three lists (ACs, MUSTs, verification methods) have no coverage join. A reviewer cannot compute "every obligation has a check." No minimums — a spec with one vague AC, zero MUST NOT, and verification of "human review" conforms.

**Required action:** Add a metric schema. Require a coverage matrix: every feature metric owned by at least one spec; every AC maps to at least one MUST/MUST NOT; every MUST maps to a verification method. Define the composition check for multi-spec features.

---

### B-7: No conformance schema — templates are not enforceable

**Found by:** Grok B-7, Plod B-5

An agent can produce a file with the same headings and violate every property in Part 1. Nothing states required vs optional, invariants, or "non-conforming if."

**Grok:**
- ID allocation, immutability, uniqueness scope, and prefix ownership are unspecified. Who assigns them, whether they are reused after cancellation, and whether two domains share a sequence are open.
- Plan identity `P-XXX` with the 1:1 rule collides with replan: editing in place destroys the rejected blueprint; writing `P-002` for the same spec violates 1:1.
- Caps (10 AC, 7 HLD) have no conservation rule. "If you need more, split" does not say how IDs relate, whether the parent is re-gated, or whether every original criterion must appear in exactly one child. An agent under a cap will delete criteria and still conform. That is silent scope loss.
- No path says where files live, who may write them, or whether an approved file is immutable.

**Plod:** Why 10? Why 7? These appear arbitrary. Without justification, practitioners will either ignore them or follow them slavishly even when inappropriate. The 7±2 cognitive load argument would justify 7 deliverables but NOT 10 acceptance criteria.

*"Until a second agent can reject a bad artifact by checklist, this is not a formal template."*

**Required action:** Add a schema checklist (required fields, enums, invariants, reject conditions). Add an ID and revision policy that makes replan a new identity without breaking traceability. Add a split protocol that conserves ACs and re-gates scope. Justify or soften the caps.

---

## WARNING Findings

### W-1: Domain-agnostic claim is undermined by examples and under-specification

**Found by:** Both (Grok B-6, Plod W-1)

**Grok:** "Domain-agnostic" is a claim that a third domain can instantiate the template without breaking a required section. The adaptation mechanism is a two-column prose table covering six labels. No invariant/overridable field split, no extension slot.

The required shape assumes request-response (User / Trigger / Outcome). Continuous simulation, batch sweeps, corpus-wide legal review, monitoring, and exploratory analysis do not have that shape.

The Nav Sim MUST example ("O(N log N) cell count for N=10k") is technically false: Barnes-Hut construction time is O(N log N); cell count is O(N). Agents will copy it.

Named domains need fields the template cannot store: numerical tolerance, reference artifact identity, seed/platform, gold set, hazard invariant, corpus version, environment. Stuffing them into free-text MUST lines means a gate cannot see them.

**Plod:** The Nav Sim feature metric "< 2% divergence from reference" requires implementation knowledge. A stakeholder metric should be: "Simulations of 50k agents complete in under 60 seconds." Examples teach by demonstration — these examples teach the wrong lesson.

**Required action:** Split the document into an invariant core and a domain profile schema. Fix or remove the Barnes-Hut cell-count example. Show one fully filled feature+spec+plan for each claimed domain. State which core sections a domain may replace.

---

### W-2: `depends_on` is a temporal hint, not a contract

**Found by:** Both (Grok W-1, Plod W-3)

**Grok:** A list of spec IDs does not record the interface the downstream unit relies on. If S-011's observable outcome changes, nothing invalidates S-014. No notion of semantic dependency, external dependency, soft dependency, or version pin.

Cycles are possible and undetected. Cross-feature edges are syntactically allowed and semantically undefined.

HLD order, `depends_on`, and the plan's Implementation Order are three total orders. The document never says which wins when they disagree.

**Plod:** Circular dependencies are permitted by the template. Cross-feature dependencies have undefined behavior when the upstream feature is deprioritized.

**Required action:** Define dependency as an edge with a type (temporal, interface, external), a satisfaction predicate, and an invalidation rule. Add cycle rejection. State precedence between the three orderings.

---

### W-3: No versioning or supersession mechanism

**Found by:** Plod W-2, Grok W-4 (accountability)

**Plod:** Artifacts have timestamps but no version numbers, supersession links, deprecation status, or change history. Which version of S-011 was the plan written against? If S-011 changes, are existing plans invalidated?

**Grok:** Feature and spec have no author. Plan has no feature id. `updated` is a date, so successive same-day edits are indistinguishable. Stakeholder entries mix names and roles. The relationship diagram has no review artifact, no dissent, and no link between a gate decision and the revision decided on.

**Required action:** Add `version: N`, `author`, and `feature` on all artifacts. Add `supersedes: S-XXX-vN`. Require the approval record to cite a specific revision. Add timestamps with time and zone.

---

### W-4: No error states or recovery procedures

**Found by:** Both (Grok B-3 partial, Plod W-4)

**Grok:** Fix cycles are work, and they are not specs or plans. A failed verification, a rejected plan, a flaky numerical comparison — each is a unit of work with its own done-condition. The feed-forward diagram has no back-edge. The framework can start work and cannot represent rework.

**Plod:** What happens when implementation fails verification? When ACs turn out to be untestable? When success metrics are discovered unmeasurable? Can a plan be abandoned? What's the artifact state?

**Required action:** Add a "Failure & Recovery" section. Define states: `blocked`, `failed`, `abandoned`. Define transitions back from failed verification to replan, from unsatisfiable AC to spec amendment, from unmeasurable metric to feature revision.

---

### W-5: Scope does not trace, and excluded work is dropped

**Found by:** Grok W-2

Nothing requires a spec's outcomes to be a subset of the parent feature's In Scope. A spec can build what the feature excluded and still carry `feature: F-XXX`. Out-of-scope bullets have no destination — they are not deferred work items with an owner and a revisit condition. Exclusions are wishes, not constraints.

No promotion path: an out-of-scope item that becomes necessary mid-run has no legal transition except a silent edit of an approved feature.

**Required action:** Require each spec AC to cite a feature in-scope bullet or metric. Require a recorded scope amendment before a spec may cover previously excluded work. Give excluded items an identity and a home.

---

### W-6: Prioritization mechanism absent

**Found by:** Plod W-5

Multiple specs and features may exist. The document provides no guidance on ordering beyond `depends_on`. No way to express "P0" vs "nice-to-have." Business prioritization is orthogonal to technical dependency ordering.

**Required action:** Add an optional `priority` field. Define how priority interacts with dependency ordering.

---

### W-7: Plan/spec drift during execution has no legal outcome

**Found by:** Grok W-3

The document does not say what happens when execution discovers the plan is wrong, the spec is unsatisfiable, or a safer approach contradicts the approved plan. If the plan is binding, every discovery stalls at undefined re-approval. If the plan is advisory, the plan gate does not gate implementation.

Known Risks sit only on the plan. A spec can be approved with an AC the planner later marks unsatisfiable. No feasibility note must be empty before spec approval, and no path sends an unsatisfiable AC back to the stakeholder metric that demanded it.

**Required action:** State whether the approved plan is binding. Define the replan transition. Add "open feasibility questions must be empty" check before spec approval.

---

## INFO Findings

### I-1: Implementation Order section redundant with HLD ordering (Plod I-1)

If HLDs are already ordered by dependency, the Implementation Order section is redundant. If they can differ (logical order vs practical order), that should be stated.

### I-2: Feature `specs: []` creates dual source of truth (Plod I-2)

The spec has `feature: F-XXX` (spec → feature). The feature also lists `specs: [S-XXX]` (feature → spec). These can drift. Pick one direction.

### I-3: No naming convention beyond ID format (Plod I-3)

Is `name` kebab-case? Title Case? Free text? Is the filename derived from the ID, the name, or both?

### I-4: Legal domain examples are sparse (Plod I-4)

Legal appears only twice (one Feature, one Spec). Nav Sim appears in all template sections. Legal does not appear in Plan examples. Framework not validated against this domain.

### I-5: Pipeline starts at Feature — research and non-capability findings have no type (Grok I-1)

How research, incident evidence, or an evaluation report becomes a feature is out of scope. Findings that must not become features (risks, negative results, deferred ideas) have no artifact. Agents given only this file will promote every note into a feature.

### I-6: "Observable without implementation knowledge" is epistemic, not testable (Grok I-2)

Some real stakeholder metrics are proxies (engagement, simulated casualty rate, clause-flag precision). They are measurable and still require an instrument. The definition states the strong form. The template cannot record the instrument.

### I-7: `done` has no sustainment meaning (Grok I-3)

A feature marked `done` when a metric is met can regress. No monitoring, warranty, or reopen transition.

### I-8: Plan verification steps are descriptions, not runs (Grok I-4)

Verification table allows "test name / benchmark / human review." It does not require a runnable command, a dataset identity, a tolerance, or a pass/fail predicate.

---

## Assumption-Breaks Table (from Grok)

| Assumption | When it breaks | Framework specifies |
|---|---|---|
| One worker, one in-flight spec, no interleaving | Two ready specs, gate waiting on human, fix cycle overlapping new work | "Tasks emerge." No schema. |
| All authorized work is new stakeholder capability | Defect, refactor, migration, incident, spike, audit | Parenthetical "(for feature work)," then nothing. |
| "One focused session" is stable/shared | Specialist, model, domain, or blocker changes capacity | Both splits conform. Decomposition unreproducible. |
| Stakeholder present and decisive | Absent, split board, unattended director-agent run | Gate 1 never fires. No delegation. |
| Metrics observable without implementation knowledge | Reference-relative error, proxy metric, delayed production outcome | Template accepts the bullet. Stakeholder approves unmeasurable number. |
| Independent units compose | All spec verifications pass, feature metric fails | No owner, no status, no composition spec. |
| Approved spec remains correct | Upstream observable changes, stakeholder revises metric, AC unsatisfiable | Status stays `approved`. Stale contracts execute. |
| First plan is executed plan | Gate rejects or build discovers deviation | 1:1 forbids second plan; in-place edit destroys rejected revision. |
| An oracle exists | Legal judgment, design quality, exploratory science | "Human review" fills the cell. AC cannot fail. |
| Dependency = "finish first" | Interface coupling, external data, soft dependency, cycle | Flat ID list. Deadlock or silent break. |
| Caps force clean splits | Safety case needs more negatives than cap; agent graded on conformance | Criteria disappear. Scope loss silent. |
| Status word is truth | Two agents write same file; author approves own plan | Last writer wins. Gates forgeable. |
| Feed-forward completes | Verification fails, agent crashes, external compute never arrives | No blocked state, no retry, no reopen. |

---

## Compatibility Notes (from Grok)

Adopting this draft collides with frozen contracts in S-011..S-015: task blocks as scheduling unit, plan-per-task identity, chore/bugfix/refactor types, review iteration files, approval as a review artifact. Migration required — not a drop-in vocabulary change.

The draft also removes `tasks/deferred/` without naming a replacement. Excluded and postponed work will be lost during migration.

---

## Consolidated Verdict

**REQUEST_CHANGES** — unanimous from both reviewers.

**7 BLOCKING** findings must be resolved before the framework can be used normatively:
1. Spec sizing undefined and contradictory
2. "Independently-deliverable" contradicts `depends_on`
3. Feature/spec/plan boundaries not operationally distinct
4. Gates undefined — no state machine, no approval record
5. Task layer dismissal drops needed functions without replacement
6. Feature success unverifiable — no composition check
7. No conformance schema — templates not enforceable by agents

**7 WARNING** findings should be addressed but are not blockers:
1. Domain-agnostic claim undermined by examples
2. `depends_on` is temporal hint, not contract
3. No versioning or supersession
4. No error states or recovery
5. Scope does not trace
6. No prioritization mechanism
7. Plan/spec drift has no legal outcome

**8 INFO** findings are improvements for a future pass.
