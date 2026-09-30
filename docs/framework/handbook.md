# Synapse Framework Handbook

**Synapse** is an agentic software pipeline orchestrator — it manages how AI agents and humans collaborate to move software work from idea to verified code.

> **Audience:** Human operators, onboarding contributors, and anyone who needs to understand how the process works and why. This handbook covers the concepts. Linked documents provide operational detail.
>
> **AI agents:** Read the [Agent Contract](agent-contract.md) for mechanical rules. Read the [Specification](specification.md) for artifact schemas and conformance. This handbook gives you the mental model; those documents give you the instructions.

---

## What Flows Through the Pipeline

The unit of work is a **change** — not a "feature." Features, bug fixes, refactors, chores, and spikes are all changes. They share the same four stages, the same three gates, and the same review cycle. A `kind` field in the change's brief selects which template fields and done-tests apply, but the pipeline itself doesn't branch.

This matters because it eliminates the "is this big enough to be a feature?" question. If you're changing something, it's a change. Pick the kind, write the brief, enter the pipeline.

→ *Kind templates and folder structure:* [Pipeline Architecture — Kind System](pipeline-architecture.md#the-change-kind-system)

---

## The Four Stages

A change moves through four directories, each representing a phase of increasing commitment:

```
design/  →  plan/  →  build/  →  done/
```

**Design** is the creative workspace — human and agent researching, discussing, defining scope. Multiple changes can bake here concurrently at whatever pace feels right. **Plan** is where the daemon takes over: generating specs, plans, and task lists autonomously, with one human gate for the spec set. **Build** is execution: the daemon implements each task, verifies it, and reviews it. **Done** is the archive — the change folder is a complete audit trail of everything that happened.

The folder *is* the record. No external database, no ticket system. Move the folder, and you've moved the change.

→ *Stage detail, done tests, and handoff rules:* [Pipeline Architecture — The Four Stages](pipeline-architecture.md#the-four-stages)

---

## The Three Gates

Three points in the pipeline freeze intent, and wrong intent is expensive to unwind.

| Gate | What it freezes | Human role |
|------|----------------|------------|
| **Brief Gate** | Scope, non-goals, what you refuse to build | Always required |
| **Spec Gate** | Architecture and seams (review the spec *set*, not individual files) | Always required |
| **Acceptance Gate** | The result — run it, use it, decide it's the thing you meant | Always required |

Auto-advance is illegal at all three. Green tests do not equal the product you wanted — acceptance is a product act, not a test result.

Between the gates, agents run autonomously. The human's scarce resource is judgment at freeze points, not eyeballs on every markdown file. Between gates, the human's job shifts from *writing* to *spotting invention*: a helper class, a new flag, a "while I was here" abstraction that wasn't in the brief.

→ *Gate mechanics, timeouts, and the human's role:* [Pipeline Architecture — The Three Gates](pipeline-architecture.md#the-three-gates)

---

## The Artifacts

Five artifact types carry work through the pipeline:

| Artifact | What it answers | Who creates it |
|----------|----------------|---------------|
| **Change** | What are we doing? | Human + agent |
| **Brief** (`BRIEF.md`) | Why, and what's out of scope? | Human authors; agent drafts |
| **Spec** | What must the system do? | Agent generates; human approves |
| **Plan** | How will we build it? | Agent generates |
| **Task** | What's the current assignment? | Agent generates from plans |

Each layer adds detail but never contradicts the layer above. The brief says "login." The spec says "create a JWT session with these acceptance criteria." The plan says "use jsonwebtoken with RS256 in these files." Each is a faithful refinement of the one above. If a plan contradicts a spec, the plan is wrong. If a spec contradicts the brief, the spec is wrong.

→ *Artifact schemas, required fields, and state machines:* [Specification](specification.md)

---

## The Review Cycle (RC)

Every artifact produced in the pipeline goes through dual independent review plus triage before advancing. The cycle works like this: the author generates the artifact, two reviewers from different vendors critique it blind, and a triage agent decides whether to advance, send back for fixes, or route to the human.

The key structural constraint is vendor diversity. Reviewers must be different vendors from the author, and triage must not be the author's vendor family. Two vendors disagreeing surfaces real issues — one vendor talking to itself surfaces style preferences. Our empirical experience is that dual-blind review catches 2-3× more issues than single review.

The human is always *available* at an RC but only *required* at the three gates. For everything else — plan reviews, code reviews, task reviews — the RC runs autonomously unless triage routes something to you. When the doc says "→ RC," it means this full cycle.

→ *RC structural rules, auto-fix limits, vendor constraints:* [Pipeline Architecture — The Review Cycle](pipeline-architecture.md#the-review-cycle-rc)

---

## The Layer Principle

Each artifact layer answers exactly one question and must not leak into another layer's domain.

- If it names an **algorithm, file, or function** → plan or lower
- If it names a **tolerance, benchmark, or verification method** → spec or lower
- If it names a **business outcome observable without running code** → feature level

This discipline makes layers composable. A spec can be re-planned without changing the brief. A plan can be re-implemented without changing the spec. When a layer leaks — an algorithm appears in a spec, or a business goal appears in a plan — it creates a coupling that makes the wrong thing expensive to change.

→ *Decision rules, negative examples, work types:* [Specification — Design Rules](specification.md)

---

## How It Actually Works

Imagine you want to add login to an app. Here's what happens.

**Design.** You work with an agent to define the change. The agent researches auth patterns, synthesizes options, challenges scope. You push back: "SSO is out of scope for now." When you agree it's ready, the agent writes `BRIEF.md` — kind is `feature`, intent is one sentence, non-goals are explicit, done-when is an executable test command. This goes into `design/auth-login/`. A different agent reviews it (RC). You approve it (**Brief Gate**).

**Specs.** The daemon reads the brief and generates specs — one per deliverable. S-042 covers login flow, S-043 covers session management. Each spec says *what the system must do* — acceptance criteria, MUSTs, MUST NOTs — without choosing algorithms or naming files. The specs go through RC. You review the spec *set* — not the individual files, but the set: do these specs *together* cover everything the brief promised? Do the seams between them make sense? You approve (**Spec Gate**). Architecture is now frozen.

**Plans.** The daemon generates plans from approved specs — one plan per spec. Each plan says *how*: specific files, functions, data structures, verification commands. Plans go through RC. You skim the plan if you want — low leverage if the spec was tight.

**Tasks.** Plans are consolidated into a task checklist. Each task is atomic — one agent, one deliverable. The task list is the execution manifest.

**Build.** The daemon processes each task: implement, verify, RC. If review finds issues, the triage agent auto-fixes (up to 3 iterations). If it can't resolve, the pipeline halts. When all tasks are done, the daemon runs the done-when tests from the brief.

**Acceptance.** You run it. You use it. You decide it's the thing you meant (**Acceptance Gate**). The change moves to `done/auth-login/` — a complete audit trail of brief, specs, plans, tasks, reviews, and logs.

**The result:** You made three decisions (brief, specs, acceptance). The agents did everything else. The folder in `done/` proves the chain from your intent to the shipped code.

---

## Sizing and Atomicity

A spec describes what can be implemented atomically — without requiring intermediate checkpoints or partial-state commits. That's the only sizing rule. "Session," "focus time," and other temporal measures are explicitly rejected because agent context windows vary by model, human focus blocks vary by person, and external blockers are unpredictable.

Sizing is *estimated* when writing specs and *validated* when writing plans. If a planner discovers a spec isn't atomic — an HLD requires checkpoint-saving, or the implementation has mandatory wait points — the split protocol fires. The spec splits into children, each child goes through the spec gate, and new plans are written. This is the framework working as intended, not a failure. The cost of splitting at plan time is lower than discovering mid-implementation that the work can't be completed in one pass.

→ *Sizing cascade, caps, split and replan protocols:* [Specification — Sizing Rules](specification.md)

---

## Traceability

Every piece of implemented code traces back to stakeholder value through a five-link chain:

```
Brief intent → Spec AC → MUST → Verification → Code @spec tag
```

Forward trace answers "does the code deliver the need." Reverse trace answers "why does this code exist." Given a code file with `@spec S-042`, you follow the chain back to the brief and know exactly which stakeholder intent justified that code.

Code marks the **spec**, not the plan or task. Plans are consumed during implementation — they may be rewritten or superseded without changing what the code does. Tasks are operational bookkeeping. The spec is the stable contract: when behavior changes, the spec changes.

→ *Coverage matrices, completion predicates, audit rules:* [Specification — Traceability](specification.md)

---

## Dependencies

A change can depend on other changes — `depends_on` in the brief means the dependency must reach `done/` before the dependent enters `plan/`. The pipeline processes one change at a time, so this is simple: finish the dependency first.

Within a change, specs can depend on other specs (interface or temporal), and tasks can depend on other tasks within the same plan. The dependency graph must be acyclic — cycles are rejected at the spec gate. When multiple ordering constraints conflict, explicit dependency edges win over HLD order, which wins over implementation sequence.

→ *Dependency types, declaration format, cycle rejection, cross-feature rules:* [Specification — Dependency System](specification.md)

---

## Error Handling

Error means halt. The change stays in whichever bin it's in with all evidence intact. The triage agent auto-fixes what it can — up to 3 iterations of fix-verify-review. If it can't resolve the problem, the pipeline stops and the human is notified with what failed, why, and what was tried.

Resumption is simple: check what artifacts exist, pick up from the first missing piece. No specs? Start spec generation. Specs but no plans? Generate plans. Tasks exist? Process the next unchecked one.

→ *Resumption checklist:* [Pipeline Architecture — Error Handling](pipeline-architecture.md#error-handling)

---

## Roles and Agents

The pipeline has seven roles — Author, Fixer, Reviewer A, Reviewer B, Triage, Implementer, and Impl Reviewer — mapped to three model tiers: Flagship (best reasoning), Mid (good cost-efficiency), and Fast (structured output, cheap). Roles are abstract; the vendor and model assignment is configuration, not architecture.

The key constraints: the author family stays consistent across a change (vocabulary drift across vendors looks like design drift), reviewers must be different vendors from the author, and triage must not be the author's family. Spend flagship tokens on authoring once and reviewing design artifacts. Spend fast tokens on triage and implementation. Spend your time on three gates.

→ *Full role table, tier definitions, current harness assignments:* [Pipeline Architecture — Roles & Tiers](pipeline-architecture.md#roles--tiers)

---

## For Agents

If you are an AI agent operating in this pipeline, this handbook gives you the concepts. Two other documents give you the instructions:

- **[Agent Contract](agent-contract.md)** — What to produce, in what format, with what signals, how to report results. Creation procedures, conformance checklists, signal protocol, review format.
- **[Specification](specification.md)** — What valid artifacts look like. Required fields, state machines, invariants, templates.

Read the Agent Contract for *what to do*. Read the Specification for *what things are*.

---

> **One change. Four stages. Three gates. Halt on error. Folder is the record.**
