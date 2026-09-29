# Framework Review: definitions-draft iter1

> **Reviewer:** Grok (read-only), Reviewer 2, blind  
> **Artifact:** `docs/framework/2026-09-29T09-49_definitions-draft.md`  
> **Date:** 2026-09-29T09:52  
> **Iteration:** 1

Reviewed against the draft's own claims: crisp definitions, domain-agnostic templates, and a sound removal of the task layer. Findings stand on internal contradictions and on functions the draft invokes but does not specify. Frozen Layer 0 formats were used only to identify work classes the proposal drops (chore, bugfix, refactor, gate records, iteration identity), not as a style baseline.

---

## Findings

### [BLOCKING] Feature, spec, and plan are not operationally distinct

The taxonomy is the framework. If an agent cannot classify a sentence as feature, spec, or plan, every downstream gate is arbitrary.

The prose draws a clean line: feature is stakeholder value, spec is what the unit must do, plan is how. The examples and the High-Level Deliverables section erase that line.

- The Nav Sim spec example is "Barnes-Hut tree construction for N agents in O(N log N) with configurable θ". Barnes-Hut versus brute force, and the value of θ, are algorithm choices. The plan section assigns those exact choices to the plan ("algorithm selection (Barnes-Hut vs. brute-force)"). The same decision is defined to live in two layers.
- The spec rule says the spec "does not say HOW to build anything — that belongs in the plan." High-Level Deliverables are then "what gets built," capped at 7, "ordered by dependency." For software and numerical work, a dependency-ordered decomposition into buildable chunks is a design, which the plan's Approach section also claims.
- The feature rule says success metrics are "observable without knowing implementation details." The Nav Sim feature example is "50k agent swarms with < 2% divergence from reference." Divergence from a reference is not observable unless someone has already chosen the reference, the norm, the timestep, and the ensemble. That is an engineering measurement, and it sits in the feature layer.
- The legal feature "flags non-standard indemnification clauses" uses a predicate, "non-standard," that has no stakeholder-observable meaning until a guideline or gold set exists. The definition requires a stakeholder who can say "yes, this delivers value" without an engineering contract. This example cannot be approved under that rule.

An agent that copies the examples will write plans into specs and engineering metrics into features, then pass its own template. The definitions are slogans plus contradictory exemplars. They are not crisp.

**Evidence:** `docs/framework/2026-09-29T09-49_definitions-draft.md:14-16`, `:28`, `:35-39`, `:54`, `:152-156`, `:192-198`  
**Required action:** Write a decision rule an agent can apply to a single sentence: which layer may name an algorithm, a tolerance, a file, a schema, a gold set, and a business outcome. Rewrite every example so it satisfies that rule. Add one negative example per layer (a sentence that must be rejected, and which layer it belongs in instead).

---

### [BLOCKING] Spec sizing contradicts itself: one session, one unit, and seven independent deliverables

Three sizing rules are stated as properties of the same object:

1. A spec is "what a single specialist (human or agent) can implement in one focused session."
2. "One spec = one independently-deliverable unit."
3. A spec contains up to 7 High-Level Deliverables, each "a logical chunk one specialist can build independently," ordered by dependency.

(1) and (3) cannot both be true. If each HLD is independently buildable by a specialist, the spec is a bundle of units, and the session bound is fiction. If the spec is one session for one specialist, the HLDs are not independent assignment units and must not be described as such.

"Focused session" and "implementable unit" are the split criteria, and neither is defined. Session capacity depends on the specialist, the domain, and whether the work is blocked on data, review, or a numerical experiment. Two conformant agents will split the same feature differently. A definition document whose primary decomposition rule is unreproducible does not constrain anything.

"Independently-deliverable" is also undefined. Deliverable to a stakeholder, mergeable to a trunk, or verifiable in isolation? A Barnes-Hut tree constructor is verifiable in isolation and delivers no stakeholder capability. The feature definition and the spec definition use "delivers" for different recipients and never say so.

**Evidence:** `docs/framework/2026-09-29T09-49_definitions-draft.md:35-42`, `:48`, `:152-159`  
**Required action:** Pick one sizing rule and delete the others. If the unit is one specialist-session, HLDs cannot be independently assignable. If HLDs are assignable, they are tasks and need identity, status, owner, and dependency edges — which is the layer this draft claims to remove. Define "done for this unit" in terms of who can accept it.

---

### [BLOCKING] Removing the task layer drops functions the rest of the draft still needs

The draft's entire scheduling theory is four sentences: no task layer for serial agentic execution; tasks "emerge naturally" for parallel assignment or Kanban; when needed, tasks are derived from the plan, not inserted between spec and plan.

That proposal is unsound on its own terms.

**The replacement is undefined.** "Task" is never defined. There is no template, no id, no status, no owner, no acceptance rule, and no trigger for when emergence is mandatory. An optional layer with no schema will be reinvented differently by every agent. That is worse than a required layer.

**"Serial" is undefined and load-bearing.** The document never says what serial excludes. A dependency list is not a serial order. Two specs with empty `depends_on` are both ready. A serial agent still needs a selection rule: priority, stakeholder value, risk, age, or cost. None is stated. `depends_on` also does not say what "implemented first" means — spec approved, plan approved, verification green, or feature metric met. Those are different graphs.

**The parallel escape hatch cannot work.** The plan is written for "the implementer," approved as one blueprint, and only then may be split into tasks for multiple agents. The plan template has no exclusive ownership boundaries (files, symbols, datasets, parameter ranges). Deriving assignments from a blueprint that assumed one writer produces overlapping writes. The draft provides no partition rule and no merge rule.

**Fix cycles are work, and they are not specs or plans.** A failed verification, a rejected plan, a flaky numerical comparison, or a triage pass is a unit of work with its own done-condition. The feed-forward diagram (Feature → Spec → Plan → Implementation) has no edge back. The framework can start work and cannot represent rework.

**Non-feature work has no authorizing artifact.** The spec definition says nothing is implemented without an approved spec "(for feature work)." The parenthetical admits other work exists. The rest of the document has no type for it. A defect fix, a refactor, a migration, an incident, a toolchain change, a research spike, and a compliance audit are not stakeholder-observable new capabilities. Forcing them through Feature either lies about stakeholder value or blocks the work at a stakeholder gate that has nothing to approve. The current pipeline's chore / bugfix / refactor classes exist because this case is normal. Dropping the task layer drops those classes and offers no substitute.

**HLD is the task layer with the control fields removed.** Independently buildable, dependency-ordered, capped chunks are tasks. Removing the name and keeping the chunks removes status, owner, and traceability, which is the opposite of a simplification.

**Evidence:** `docs/framework/2026-09-29T09-49_definitions-draft.md:39`, `:45-46`, `:65-68`, `:152-159`, `:208-211`, `:232-249`  
**Required action:** Either restore an explicit work-assignment artifact, or specify the functions it carried: selection among ready specs, non-feature work types, exclusive partitions, rework/fix cycles, and the predicate "implemented." State the seriality assumption as a formal constraint (single worker, one in-flight spec, no interleaving) and state what the framework must add the moment that constraint is false. Do not leave "tasks emerge" as prose.

---

### [BLOCKING] The three gates cannot be executed or audited

The control policy is: stakeholder approves the feature before any spec is written; engineering approves the spec before any plan is written; technical approval of the plan precedes implementation. Status is `draft | approved | done`. Dates are `YYYY-MM-DD`.

That policy cannot be enforced with the fields given.

- Approver is a level ("stakeholder," "engineering," "technical"), not an identity. Feature stakeholders may be an unbound role. A role cannot sign. Plan `author` is "planner name or agent," and nothing says the approver must differ from the author. The default reading is self-approval. For an agentic pipeline that is confirmation bias built into the gate.
- There is no decision record: who approved, against which revision, with what objections, under what delegation. A status flip in markdown is forgeable. Two agents can both set `approved`. No single-writer rule is stated.
- There is no reject, revoke, block, supersede, or cancel transition. A rejected plan is indistinguishable from a draft. An invalidated spec stays `approved`.
- `done` is one state for three different events: spec verification green, plan executed, feature metric met. Those events diverge (see the next finding). There is no `in-progress`, so "approved and currently executing" is invisible. A crashed agent leaves the same status as an agent that has not started.
- Date granularity cannot order "approved before plan written" inside a day. Agent runs are intra-day.
- Full-auto execution has no delegated approver. If the stakeholder is absent, gate 1 never fires and the pipeline cannot start. The draft does not allow a director agent, a timeout, or a recorded waiver.
- Nothing defines the evidence required to transition. An agent can set `approved` on an empty Acceptance Criteria list. The template shows shape, not a reject condition.

A gate that is a word in a file is not a gate.

**Evidence:** `docs/framework/2026-09-29T09-49_definitions-draft.md:23`, `:44`, `:65`, `:72`, `:84-86`, `:123-125`, `:183-187`, `:241-244`  
**Required action:** Specify the state machine, including rejected, in-progress, blocked, superseded, and cancelled. Require an approval record (approver identity distinct from author, artifact revision, timestamp with time and zone, decision, note). Define delegation for unattended runs. Define who may write status. Bind each transition to a checkable predicate, not a free-text status edit.

---

### [BLOCKING] Feature success is unverifiable, and unit success does not compose

A feature "may be implemented by one spec or several." Each spec is an "independently-deliverable unit." Feature done-ness is a list of success metrics. Spec done-ness is acceptance criteria plus a validation contract. Plan done-ness is a verification table over ACs.

No rule joins these three.

- Nothing requires the union of spec ACs to imply the feature metrics. Every spec can be `done` while the feature metric is unmet. No artifact owns that check. There is no integration or acceptance spec type whose job is composition.
- The converse is also unspecified: metrics already met while a spec is still `draft`. Is the feature done? May the remaining spec be cancelled? The status enum cannot say.
- Metric template is "[condition] → [observable outcome]" with no unit, baseline, target, direction, window, data source, measurement procedure, or owner. "Measurable" is a requirement the template cannot store. The SW feature example ("register any git repo and start a pipeline run") ships with no metric at all, so the canonical example fails the definition.
- Mapping is one-directional and incomplete. "Each MUST maps to one or more ACs" does not require each AC to have a MUST, nor each MUST NOT to have an AC. The plan maps AC → verification method, not MUST → method. Three lists, no coverage join. A reviewer cannot compute "every obligation has a check" or "every check traces to an obligation."
- No minimums. A spec with one vague AC, zero MUST NOT, and a verification cell of "human review" conforms to the template as written. The 10-AC cap does not apply to MUSTs, so the unbounded list and the capped list can drift apart.
- "Human review" is an allowed verification method with no reviewer, rubric, sample size, or disagreement rule. That cell makes an AC unfalsifiable while still looking filled in.

Shipping a multi-spec feature under this template can produce all-green units and a failed capability, with no artifact whose job it was to notice.

**Evidence:** `docs/framework/2026-09-29T09-49_definitions-draft.md:16`, `:27-29`, `:90`, `:98-104`, `:143-173`, `:213-219`, `:235-238`  
**Required action:** Add a metric schema (unit, target, baseline, window, procedure, owner, oracle). Require a coverage matrix: every in-scope bullet and every feature metric is owned by at least one spec; every AC maps to a metric or an explicit in-scope bullet; every AC maps to at least one MUST or MUST NOT; every MUST/MUST NOT maps to a verification method that names an oracle. Define the composition check for multi-spec features, including who runs it and what status it sets when units pass and the metric fails. Define minimum counts or explicitly allow the empty cases and state why they are safe.

---

### [BLOCKING] The templates are domain-neutral only by being under-specified, and they do not fit the named domains

"Domain-agnostic" is a claim that a third domain can instantiate the template without breaking a required section. The adaptation mechanism is a two-column prose table for SW Dev and Nav Sim, covering six labels. `domain:` is an open string. There is no list of invariant fields versus overridable fields, and no extension slot with a schema.

The required shape assumes a request-response construction unit:

- User / Trigger / Outcome assumes a single initiator and a single firing event. Continuous simulation, batch parameter sweeps, corpus-wide legal review, monitoring, and exploratory analysis do not have that shape. The table renames User to "simulation operator" and Trigger to "timestep event" without saying what the spec is asserting at a timestep — an invariant, a transition, or a batch post-condition. Those are different contracts.
- Named domains need concepts the template cannot store as fields: numerical tolerance, reference artifact identity, seed and platform, gold set and adjudication rule, hazard or safety invariant, corpus version, environment. Stuffing them into free-text MUST lines means a gate cannot see them. The Nav Sim MUST example ("O(N log N) cell count for N=10k") is also the wrong observable: Barnes-Hut construction time is the O(N log N) quantity; cell count is O(N). The cross-domain exemplar is technically false. Agents will copy it.
- Judgment work (legal, design, research synthesis) often has no oracle, only agreement under a guideline. The framework's verification story is "test, benchmark, or human review." Without a required oracle/agreement field, "domain-agnostic" means "any sentence is a validation contract."
- The plan Approach examples are domain-specific implementation vocabularies. That is appropriate for a plan. It does not make the feature and spec templates agnostic; it shows that all domain content has been pushed into unbounded prose because the schema has nowhere to put it.

Under-specification is not neutrality. A formal template distinguishes what every domain must fill from what a domain profile may add. This draft does not.

**Evidence:** `docs/framework/2026-09-29T09-49_definitions-draft.md:3`, `:24-29`, `:50-55`, `:136-141`, `:163-173`, `:192-198`, `:253-265`  
**Required action:** Split the document into an invariant core and a domain profile schema. For each claimed domain, show one fully filled feature, spec, and plan that a reviewer could accept or reject against the core. Add required fields for oracle, tolerance-or-equivalent, and reproducibility where the domain has them. State which core sections a domain may replace, and which replacements are forbidden. Correct or remove the Barnes-Hut cell-count example.

---

### [BLOCKING] No conformance schema, so "follow the template" is not decidable

The draft calls itself formal definitions and templates. An agent can produce a file with the same headings and violate every property in Part 1. Nothing states required versus optional, invariants, or "non-conforming if."

Concrete holes that make interoperability impossible:

- ID allocation, immutability, uniqueness scope, and prefix ownership are unspecified. Feature uses `F-XXX`, spec `S-XXX`, plan `P-XXX`. Who assigns them, whether they are reused after cancellation, and whether two domains share a sequence are open. Plan identity is `P-XXX` with no filename, no storage location, and no iteration. The 1:1 rule ("one plan per spec") then collides with replan: editing in place destroys the rejected blueprint a gate reviewer must see; writing `P-002` for the same spec violates 1:1. Neither choice is legal under the text.
- Caps (10 acceptance criteria, 7 deliverables) have no conservation rule. "If you need more, split" does not say how IDs relate, whether the parent is re-gated, or whether every original criterion must appear in exactly one child. An agent under a cap will delete criteria and still conform. That is silent scope loss in a contract framework.
- `name` has no format. `depends_on: []` has no cycle check, no cross-feature rule, and no "what counts as satisfied."
- Open questions have no section and no "empty before approval" rule. A spec can be approved with an unresolved feasibility question buried in Overview.
- No path says where these files live, who may write them, or whether an approved file is immutable. A methodology that agents execute needs those constraints in the same document as the template, or in a normative reference this document does not have.

**Evidence:** `docs/framework/2026-09-29T09-49_definitions-draft.md:48`, `:80-91`, `:119-129`, `:146-159`, `:178-188`, `:246-249`  
**Required action:** Add a schema checklist (required fields, enums, invariants, reject conditions), an ID and revision policy that makes replan a new identity without breaking traceability to the spec, a split protocol that conserves ACs and re-gates scope, and a normative statement of storage and immutability. Until a second agent can reject a bad artifact by checklist, this is not a formal template.

---

### [WARNING] `depends_on` is a temporal hint, not a contract between units

`depends_on` "captures ordering between specs — no separate scheduling artifact needed." A list of spec IDs does not record the interface the downstream unit relies on. If S-011's observable outcome changes, nothing invalidates S-014. There is no notion of semantic dependency, external dependency (reference data, credentials, hardware, legal sign-off), soft dependency, or version pin ("as approved at revision R").

Cycles are possible and undetected. Cross-feature edges are syntactically allowed and semantically undefined: a spec in feature A can block on a spec in feature B whose stakeholder has not approved B.

HLD order and the plan's Implementation Order are two further total orders. The document never says which order wins when they disagree. Forcing a total order also destroys the partial order that parallel assignment would need — the same parallelism the task-emergence clause appeals to.

**Evidence:** `docs/framework/2026-09-29T09-49_definitions-draft.md:45-46`, `:128`, `:156`, `:208-211`  
**Suggested action:** Define dependency as an edge with a type (temporal, interface, external), a satisfaction predicate, and an invalidation rule when the upstream observable changes. State the precedence between `depends_on`, HLD order, and Implementation Order. Add a cycle rejection check.

---

### [WARNING] Scope does not trace, and excluded work is dropped

Feature Out of Scope and spec Non-Goal are independent prose lists. Nothing requires a spec's outcomes to be a subset of the parent feature's In Scope, or a spec Non-Goal to respect feature Out of Scope. A spec can build what the feature excluded and still carry `feature: F-XXX`.

Out-of-scope bullets have no destination. They are not deferred work items with an owner and a revisit condition. The next agent does not inherit them. Exclusions in a contract framework are how scope creep is prevented; if they are not machine-linked, they are wishes.

There is also no promotion path: an out-of-scope item that becomes necessary mid-run has no legal transition except a silent edit of an approved feature.

**Evidence:** `docs/framework/2026-09-29T09-49_definitions-draft.md:21`, `:106-113`, `:141`, `:90`  
**Suggested action:** Require each spec AC to cite a feature in-scope bullet or metric. Require a recorded scope amendment (new revision, re-approval) before a spec may cover previously excluded work. Give excluded items an identity and a home so they are not lost.

---

### [WARNING] Plan/spec drift during execution has no legal outcome

The plan is the second gate, then "Implementation → DO it." The document does not say what happens when execution discovers the plan is wrong, the spec is unsatisfiable, or a safer approach contradicts the approved plan.

Tests-or-benchmarks are described as checking the plan's verification table, which maps to ACs. It is unspecified whether a green verification table authorizes a deviation from the plan's files, algorithms, and data structures. If the plan is binding, every discovery stalls at an undefined re-approval. If the plan is advisory, the plan gate does not gate implementation. The draft needs one of those, stated as a rule.

Known Risks sit only on the plan. A spec can be approved with an AC the planner later marks unsatisfiable. There is no feasibility note that must be empty before spec approval, and no path that sends an unsatisfiable AC back to the stakeholder metric that demanded it.

**Evidence:** `docs/framework/2026-09-29T09-49_definitions-draft.md:61-72`, `:190-198`, `:213-228`, `:241-244`  
**Suggested action:** State whether the approved plan is binding. Define the replan transition (new plan identity, previous plan retained, spec re-opened if an AC is unsatisfiable, feature re-opened if a metric is unsatisfiable). Add a required "open feasibility questions must be empty" check before spec approval.

---

### [WARNING] Accountability and audit fields are too weak for multi-agent use

Feature and spec have no author. Plan has no feature id, so a plan whose spec is re-parented loses stakeholder traceability. `updated` is a date, so successive same-day edits are indistinguishable and gate ordering cannot be audited. Stakeholder entries mix names and roles with no rule that at least one entry is a resolvable approver.

The relationship diagram has no review artifact, no dissent, and no link between a gate decision and the revision decided on. "Approved at the technical level before implementation begins" is unauditable after the fact.

**Evidence:** `docs/framework/2026-09-29T09-49_definitions-draft.md:80-91`, `:119-129`, `:178-188`, `:232-244`  
**Suggested action:** Add author on every artifact, feature id on the plan, a revision id that changes on every edit, and timestamps with time and zone. Require the approval record from the gate finding to cite that revision id.

---

### [WARNING] Caps and section duplication will be gamed

Maximum 10 ACs and maximum 7 HLDs are unjustified, and they interact badly with an uncapped MUST/MUST NOT list. A safety-relevant Nav Sim unit can need more forbidden behaviors than the AC cap allows if agents feel pressure to mirror MUSTs as ACs. The escape is either to drop negatives or to hide them in MUST NOT lines that no AC points at. Both defeat the cap's stated purpose (force a split).

Approach and Known Risks & Decisions both ask for the choice and the rationale. Agents will fill one and paste it into the other. Duplication without a single normative home produces drift inside the plan itself.

**Evidence:** `docs/framework/2026-09-29T09-49_definitions-draft.md:48`, `:146-159`, `:190-198`, `:221-228`  
**Suggested action:** Justify caps in terms of reviewability, apply a conservation rule on split, and require every MUST NOT either to map to an AC or to a named safety invariant that is exempt from the cap and still verified. Pick one section as the normative home for design rationale.

---

### [INFO] The pipeline starts at Feature, so research and non-capability findings have no type

The relationship summary begins at an approved feature. How research, incident evidence, or an evaluation report becomes a feature is out of scope for this draft. Findings that must not become features (risks, negative results, deferred ideas) have no artifact. That is consistent only if another normative document owns ingestion. This draft does not cite one. Agents given only this file will promote every note into a feature to have somewhere to put it.

**Evidence:** `docs/framework/2026-09-29T09-49_definitions-draft.md:232-244`  
**Suggested action:** Add a one-paragraph boundary: which upstream document produces features, and where non-feature findings are required to go.

---

### [INFO] "Observable without implementation knowledge" is an epistemic assumption, not a test

Some real stakeholder metrics are proxies (engagement, simulated casualty rate, clause-flag precision against a hidden gold set). They are measurable and still require an instrument. The definition states the strong form. The template cannot record the instrument. Even after a metric schema exists, the document should say whether proxy metrics are permitted and, if so, what must be disclosed so a stakeholder is not approving a number they cannot interpret.

**Evidence:** `docs/framework/2026-09-29T09-49_definitions-draft.md:16`, `:20`, `:98-104`

---

### [INFO] `done` has no sustainment meaning

A feature marked `done` when a metric is met can regress (divergence drifts, a clause classifier rots, a registration path breaks). The status enum has no monitoring, warranty, or reopen transition. For Nav Sim and any deployed capability this will matter immediately. It does not block approval of a definitions draft if the state machine in the gate finding includes an explicit "done is terminal" choice. Right now the choice is implicit.

**Evidence:** `docs/framework/2026-09-29T09-49_definitions-draft.md:84`, `:123`, `:184`

---

### [INFO] Plan verification steps are descriptions, not runs

The verification table allows "test name / benchmark / comparison to reference / human review." It does not require a runnable command, a dataset identity, a tolerance, or a pass/fail predicate. Domain-agnostic verification cannot all be shell commands. It can all name an oracle and a pass rule. The template stops at a column header.

**Evidence:** `docs/framework/2026-09-29T09-49_definitions-draft.md:213-219`

---

## Missing Tests / Test Gaps

This artifact is a definitions draft, not an implementation with a test contract. The gaps below are the conformance checks the framework would need before an agent could be gated on it. None exist in the draft.

- Given a sentence that names an algorithm and a tolerance, a classifier rejects it as a feature metric and as a spec AC, and accepts it only inside a plan (or inside a domain-profile field the core explicitly allows).
- A spec with 11 ACs is rejected unless a split record shows every original AC in exactly one child and the parent feature was re-gated.
- A spec whose AC traces to no feature metric and no in-scope bullet is rejected.
- A multi-spec feature with all specs `done` and no composition result is not feature-`done`.
- `depends_on` cycles are rejected. An upstream observable change marks downstream specs stale rather than leaving them `approved`.
- A plan whose author is also the only approver is rejected. A status of `approved` with no approval record is rejected.
- A second plan for one spec is rejected unless the previous plan is `superseded` and retained. In-place edit of an approved plan is rejected.
- A bugfix/refactor/chore submitted as a feature is rejected, and a legal non-feature path exists for it.
- The Barnes-Hut example, as currently written, fails the spec layer rule (algorithm and complexity class in the what-layer; wrong cell-count claim).
- Domain profile for Nav Sim is incomplete unless tolerance, reference artifact, seed/platform, and at least one safety MUST NOT are present and machine-checkable. Legal profile is incomplete unless guideline version and adjudication rule are present.
- "Human review" with no rubric, sample size, and disagreement rule does not satisfy a verification cell.
- Two ready specs and one worker: the selection rule produces a unique next spec. The draft currently has no expected output for this case.

---

## Architectural & Compatibility Risk

**Assumption breaks.** The draft works only while every row below stays true. It does not say what the pipeline does when a row goes false.

| Assumption the draft relies on | When it breaks | Behavior the draft actually specifies |
|---|---|---|
| One worker, one in-flight spec, no interleaving | Two ready specs, a gate waiting on a human, or a fix cycle overlapping new work | "Tasks emerge." No schema, no selection rule, no partition. |
| All authorized work is a new stakeholder capability | Defect, refactor, migration, incident, spike, audit | Parenthetical "for feature work," then no artifact. Work is either smuggled into a feature or blocked. |
| "One focused session" is a stable, shared unit | Specialist, model, domain, or blocker changes capacity | Both splits conform. Decomposition is not reproducible. |
| A stakeholder is present and is a single decisive approver | Absent stakeholder, split board, or unattended director-agent run | Gate 1 never fires. No delegation, timeout, or waiver. |
| Metrics are observable without implementation knowledge | Reference-relative error, proxy metric, delayed production outcome | Template accepts the bullet. Stakeholder approves a number they cannot measure. |
| Independently delivered units compose | All spec verifications pass, feature metric fails | No owner, no status, no required composition spec. |
| An approved spec remains the right contract | Upstream observable changes, stakeholder revises a metric, execution proves an AC unsatisfiable | Status stays `approved`. Stale contracts keep executing. |
| The first plan is the plan that will be executed | Plan gate rejects, or build discovers a better or necessary deviation | 1:1 forbids a second plan; in-place edit destroys the rejected revision. |
| An oracle exists | Legal judgment, design quality, exploratory science | "Human review" fills the cell. The AC cannot fail. |
| Dependency means "finish that spec first" | Interface coupling, external data, soft dependency, cycle | A flat ID list. Deadlock or silent semantic break. |
| Caps force clean splits | Safety case needs more negatives than the cap; agent is graded on conformance | Criteria disappear instead of moving. Scope loss is silent. |
| The status word is the truth | Two agents write the same file; author approves their own plan | Last writer wins. Gates are forgeable. |
| Feed-forward execution completes | Verification fails, agent crashes, external compute or reference data never arrives | No blocked state, no retry identity, no reopen. |

**Compatibility with the running pipeline.** Adopting this draft as written collides with the frozen contracts the daemon already gates on: task blocks as the unit of scheduling, plan-per-task identity, chore/bugfix/refactor, review iteration files, approval as a review artifact rather than a status word, and tests that verify a spec MUST list with a coverage join. That collision is survivable only with an explicit migration. It is not survivable by treating this draft as a drop-in vocabulary change. The draft also removes the deferred-item home (`tasks/deferred/` in the current constitution) without naming a replacement, so excluded and postponed work will be lost during a migration.

**What this framework still does not handle, and should if it claims an agentic knowledge-work pipeline:**

- Generator/reviewer separation. The plan may be written by the implementer and approved at "the technical level" with no independence requirement.
- Conflicting specs (two MUSTs that cannot both hold; two specs claiming the same deliverable).
- Priority, preemption, and cost when more than one spec is ready.
- External blockers and partial evidence (reference dataset not yet built, gold set in adjudication).
- Amendment, waiver, and emergency fix when the stakeholder gate is the wrong latency for the work.
- Sustainment after `done`.
- Confidentiality, safety, and other invariants that are not optional prose in MUST NOT.

None of these require a heavyweight process. They require named fields and reject conditions. The draft's failure mode is that every hard case is answerable only by an agent improvising in prose, which means the framework does not govern the cases where a framework is needed.

---

## Verdict

REQUEST_CHANGES

<!-- PIPELINE_SIGNAL: STATUS=DONE AUTO-FIX=0 ESCALATE=0 -->
