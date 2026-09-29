# Framework Definitions Review — Reviewer 1 (BLIND)

> **Document Under Review:** `docs/framework/2026-09-29T09-49_definitions-draft.md`  
> **Review Date:** 2026-09-29  
> **Reviewer:** Claude Opus 4.5 (adversarial blind review)

---

## Executive Summary

The document proposes a three-tier artifact hierarchy (Feature → Spec → Plan) and claims to be domain-agnostic. While the structure is sensible, the definitions contain ambiguities that will cause inconsistent application, the "domain-agnostic" claim is undermined by implementation-specific language leaking into supposedly business-level artifacts, and the dismissal of the task layer creates a gap in execution tracking that the document hand-waves away.

**Verdict: REQUEST_CHANGES** — 5 BLOCKING findings must be addressed.

---

## Findings

### [BLOCKING] B-1: "Session" in Spec Definition is Undefined

> A spec is scoped to what a single specialist (human or agent) can implement in **one focused session**.

What is a "session"? An hour? A day? A sprint? This is the fundamental scoping primitive for specs, yet it is completely undefined. Different practitioners will interpret this differently, producing specs of wildly varying sizes. For an agentic pipeline, this is catastrophic — an 8B model's "session" is not the same as Opus's.

**Failure scenario:** Two planning agents produce specs where one's "session" is 2 hours and another's is 2 days. The pipeline has no way to detect the mismatch until implementation fails.

**Required fix:** Define session in concrete, measurable terms. Options:
- Time-boxed: "implementable in ≤4 hours of focused work"
- Token-bound (for agents): "implementable within a single context window"
- Deliverable-bound: "produces ≤N files or ≤M LOC delta"

---

### [BLOCKING] B-2: "Independently-Deliverable" Contradicts `depends_on`

The Spec definition states:

> One spec = one **independently-deliverable** unit

Yet the Spec template includes:

> `depends_on: []  # spec IDs that must be implemented first`

These are contradictory. A unit cannot be "independently deliverable" if it has hard dependencies. The document conflates two distinct concepts:
1. **Atomicity** — can be implemented as a unit without partial states
2. **Independence** — can be delivered without other specs existing

**Failure scenario:** A spec reviewer approves S-003 as "independently deliverable" because the definition says so. S-003 depends on S-001 and S-002. Pipeline schedules S-003 first. Implementation fails because dependencies don't exist.

**Required fix:** Replace "independently-deliverable" with "atomically-implementable" or similar. Clarify that `depends_on` creates a partial ordering, and "independent" refers to implementation atomicity, not deployment ordering.

---

### [BLOCKING] B-3: Task Layer Dismissal is Unjustified Hand-Waving

> **No task layer required** for serial agentic execution. Tasks emerge naturally if you need parallel assignment...

This is asserted without argument. The task layer provides critical functions the document ignores:

1. **Progress tracking** — A plan may have 7 deliverables. Mid-implementation, what is the state? The plan is "in progress" but that's a single bit of information.
2. **Retry isolation** — If deliverable 4 fails, can the agent retry just deliverable 4? Without tasks, the entire plan must restart.
3. **Checkpoint/resume** — Agent context windows overflow. How does a new agent pick up mid-plan?
4. **Audit trail** — When did deliverable 3 complete? Who/what did it? Plans don't record this.

The claim that tasks "emerge naturally" when needed provides zero guidance on HOW they emerge, WHAT schema they follow, or WHO creates them.

**Failure scenario:** An agent completes deliverables 1-5, context overflows, new agent spawns. New agent re-implements deliverables 1-5 because there's no task layer recording completion state.

**Required fix:** Either:
- (a) Define the task layer properly as an optional fourth tier with a template, OR
- (b) Explain concretely how plans track partial completion state without tasks (show the mechanism, don't just assert it exists)

---

### [BLOCKING] B-4: Gate Process is Undefined

The document references three gates (business, engineering, implementation) but never defines:

1. **Who can approve at each gate?** The document says "stakeholder level," "engineering level," "technical level" — these are not roles, they are vibes.
2. **What constitutes rejection?** Is there a revision process? Does rejection kill the artifact or send it back?
3. **How is approval recorded?** The `status` field goes from `draft` to `approved` but there's no `rejected`, `revision_requested`, or `superseded`.
4. **Timeouts?** If a gate doesn't respond, what happens?

Without these answers, "approved at SPEC GATE" is meaningless — it's a label, not a process.

**Failure scenario:** Spec S-042 sits at SPEC GATE for 3 weeks. The pipeline? Undefined behavior. Maybe it blocks forever. Maybe it times out. No one knows because the document doesn't say.

**Required fix:** Add a "Gate Protocol" section defining:
- Approver roles (not "levels")
- Valid gate transitions (draft → approved | revision_requested | rejected)
- Timeout behavior
- Rejection recovery path

---

### [BLOCKING] B-5: Magic Numbers Lack Justification

The document asserts:
- **Max 10 acceptance criteria** — "If you need more, split the spec"
- **Max 7 deliverables** — No rationale given

Why 10? Why 7? These appear to be arbitrary. Without justification, practitioners will either:
- Ignore them as arbitrary (defeating consistency)
- Follow them slavishly even when inappropriate (forcing artificial splits)

The 7±2 cognitive load argument would justify 7 deliverables but NOT 10 acceptance criteria (that's 10±0, a specific number with no variance).

**Failure scenario:** A reviewer rejects a spec with 11 ACs. Author splits into two specs of 6 ACs each, creating artificial dependency and overhead. The 11-AC spec was actually more coherent.

**Required fix:** Either:
- Justify these numbers with cited reasoning (cognitive load research, empirical data from prior runs)
- Convert them to guidelines ("prefer ≤10") rather than hard rules
- Define what "too large" actually means in terms of implementation complexity, not AC count

---

### [WARNING] W-1: Domain-Agnostic Claim is Undermined by Examples

The document claims:

> **Scope:** Domain-agnostic — applies equally to SW Dev, Nav Sim, or any knowledge work

But the Feature example for Nav Sim is:

> "Simulation engine supports 50k agent swarms with **< 2% divergence from reference**"

And the Spec MUST example:

> "MUST: tree construction produces **O(N log N) cell count** for N=10k"

These contain implementation-specific language:
- "divergence from reference" requires knowing what the reference is (implementation knowledge)
- "O(N log N)" is algorithmic complexity — pure implementation concern

A stakeholder success metric should be something like: "Simulations of 50k agents complete in under 60 seconds." The 2% divergence is a technical validation criterion, not a stakeholder-observable outcome.

**Impact:** Practitioners will follow the examples and write implementation language into features, defeating the purpose of the business/engineering separation.

**Suggested fix:** Rewrite examples to be genuinely stakeholder-observable:
- Nav Sim Feature: "Operators can simulate 50k-agent scenarios with results matching analyst expectations within published tolerances"
- Nav Sim Spec MUST: Reference a separately-defined tolerance spec, not inline the algorithm

---

### [WARNING] W-2: No Versioning or Supersession Mechanism

Artifacts have `created` and `updated` timestamps but no:
- Version numbers
- Supersession links ("this spec replaces S-041")
- Deprecation status
- Change history

In a living system, specs get revised. Without versioning:
- Which version of S-011 was the plan written against?
- If S-011 changes, are existing plans invalidated?
- How do you find the spec that was in effect when a bug was introduced?

**Suggested fix:** Add `version: N` to frontmatter. Define supersession: `supersedes: S-XXX-v2`. Add `deprecated` as a valid status.

---

### [WARNING] W-3: Circular and Cross-Feature Dependencies Unaddressed

`depends_on` in specs captures ordering but doesn't address:

1. **Circular dependencies** — What if S-001 depends on S-002 which depends on S-001? The template permits this.
2. **Cross-feature dependencies** — Can a spec in F-002 depend on a spec in F-001? If so, what happens when F-001 is deprioritized?
3. **Optional vs. hard dependencies** — Are all dependencies blocking, or can some be "nice to have"?

**Suggested fix:** Add a "Dependency Rules" section specifying:
- Circular dependencies are invalid (pipeline must detect and reject)
- Cross-feature dependencies must be explicit and create implicit feature ordering
- Introduce `soft_depends_on` for optional dependencies

---

### [WARNING] W-4: No Error States or Recovery Procedures

The document defines the happy path but not failure modes:

- What happens when implementation fails a plan's verification?
- What happens when a spec's ACs turn out to be untestable?
- What happens when a feature's success metrics are discovered to be unmeasurable?
- Can a plan be abandoned? What's the artifact state?

**Suggested fix:** Add a "Failure & Recovery" section defining states like `blocked`, `failed`, `abandoned` and the transitions that lead to/from them.

---

### [WARNING] W-5: Prioritization Mechanism Absent

Multiple specs may exist for a feature. Multiple features may exist for a product. The document provides no guidance on:

- Which spec to implement first (beyond `depends_on` ordering)
- How to handle resource contention
- How to express "this is P0" vs "this is nice-to-have"

The `depends_on` field handles technical ordering but not business prioritization.

**Suggested fix:** Add an optional `priority: P0 | P1 | P2` field to features and specs, with guidance on how priority interacts with dependency ordering.

---

### [INFO] I-1: Plan "Implementation Order" Redundant with HLD Ordering

The Plan template says:

> **High-Level Deliverables:** ... Ordered by dependency.

Then separately:

> **Implementation Order:** Dependencies and recommended sequencing.

If HLDs are already ordered by dependency, the "Implementation Order" section is redundant. If they can differ (e.g., HLDs in logical order, Implementation Order in practical order), that should be stated explicitly.

---

### [INFO] I-2: Feature `specs: []` Field Will Cause Sync Issues

The Feature template includes:

> `specs: []   # populated as specs are written`

This creates a dual-source-of-truth problem. The spec has `feature: F-XXX` (source of truth: spec points to feature). But the feature also lists `specs: [S-XXX]` (source of truth: feature lists specs). These can drift.

Consider: one direction only. Either specs point to features (current), OR features list specs, not both.

---

### [INFO] I-3: No Naming Convention Beyond ID Format

IDs are `F-XXX`, `S-XXX`, `P-XXX`. But what about the `name` field? The spec example shows:

> `name: <spec-name>`

Is `spec-name` kebab-case? Title Case? Free text? File naming isn't specified either — is the filename derived from the ID? The name? Both?

---

### [INFO] I-4: Legal Domain Examples are Sparse

The document claims three-domain coverage (SW Dev, Nav Sim, Legal Doc) but Legal appears only twice:
- One Feature example (one line)
- One Spec example (one line)

Nav Sim appears in all template sections. Legal does not appear in the Plan examples at all. This suggests the framework has not actually been validated against the Legal domain.

---

## Summary Table

| ID | Severity | Finding |
|----|----------|---------|
| B-1 | BLOCKING | "Session" undefined — fundamental scoping primitive is ambiguous |
| B-2 | BLOCKING | "Independently-deliverable" contradicts `depends_on` |
| B-3 | BLOCKING | Task layer dismissal is hand-waving without mechanism |
| B-4 | BLOCKING | Gate process undefined — no approvers, rejection path, or timeouts |
| B-5 | BLOCKING | Magic numbers (10 AC, 7 HLD) lack justification |
| W-1 | WARNING | Domain-agnostic claim undermined by implementation language in examples |
| W-2 | WARNING | No versioning or supersession mechanism |
| W-3 | WARNING | Circular and cross-feature dependencies unaddressed |
| W-4 | WARNING | No error states or recovery procedures |
| W-5 | WARNING | Prioritization mechanism absent |
| I-1 | INFO | Implementation Order section may be redundant |
| I-2 | INFO | Dual source of truth for feature↔spec links |
| I-3 | INFO | Naming conventions unspecified |
| I-4 | INFO | Legal domain examples sparse |

---

## Verdict

**REQUEST_CHANGES**

The five BLOCKING findings represent fundamental ambiguities and contradictions that will cause inconsistent application of the framework. The "no task layer" assertion is particularly concerning for agentic pipelines where context overflow and retry isolation are real operational concerns.

The framework has a sound structure but needs another pass to sharpen definitions, justify constraints, and address failure modes.

---

<!-- REVIEWER_SIGNAL: STATUS=COMPLETE BLOCKING=5 WARNING=5 INFO=4 VERDICT=REQUEST_CHANGES -->
