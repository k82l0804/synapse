# Synapse Framework Handbook

**Synapse** is an agentic software pipeline orchestrator — it manages how AI agents and humans collaborate to move software work from idea to verified code. It runs on the developer's machine, manages one developer's workflow, and processes one change at a time. Team coordination — ticket assignment, code merging, release management — uses your existing tools.

> **Audience:** Human operators, onboarding contributors, and anyone who needs to understand how the process works and why. This handbook covers the concepts. Linked documents provide operational detail.
>
> **AI agents:** Read the [Agent Contract](agent-contract.md) for mechanical rules. Read the [Specification](specification.md) for artifact schemas and conformance. This handbook gives you the mental model; those documents give you the instructions.

---

## What Flows Through the Pipeline

The unit of work is a **change**. Features, bug fixes, refactors, chores, and spikes are all changes. They share the same three bins, the same approval points, and the same review cycle. A `kind` field in `change.md` selects which template fields and done-tests apply, but the pipeline itself doesn't branch.

This matters because it eliminates the "is this big enough to be a feature?" question. If you're changing something, it's a change. Pick the kind, write the change, enter the pipeline.

→ *Kind templates and folder structure:* [Pipeline Architecture — Kind System](pipeline-architecture.md#the-change-kind-system)

---

## Three Bins

A change folder moves through three bins:

```
future/  →  current/  →  done/
```

**`future/`** is the queue — changes waiting their turn. Each is a folder containing `change.md`. **`current/`** holds at most one change — the one being actively worked. Stages (specs, plans, tasks, build) happen *inside* the folder, and each is marked complete by a `done.md` file. **`done/`** is the archive — the change folder with its full audit trail.

The folder *is* the record. No external database, no ticket system. `done.md` *is* the state machine — if it exists, the stage is complete.

→ *Bin detail, folder structure, pipeline loop:* [Pipeline Architecture — The Three Bins](pipeline-architecture.md#the-three-bins)

---

## Three Approval Points

Three points in the pipeline freeze intent, and wrong intent is expensive to unwind.

| Approval | What it freezes | How it works |
|----------|----------------|-------------|
| **Change approval** | Scope, non-goals, what you refuse to build | Human sets `status: approved` in change.md |
| **Spec approval** | Architecture and seams (review the spec *set*, not individual files) | Human creates `specs/done.md` |
| **Acceptance** | The result — run it, use it, decide it's the thing you meant | Human creates `done.md` |

Auto-advance is illegal at all three. Green tests do not equal the product you wanted — acceptance is a product act, not a test result.

Between the approvals, agents run autonomously. The human's scarce resource is judgment at freeze points, not eyeballs on every markdown file. Between approvals, the human's job shifts from *writing* to *spotting invention*: a helper class, a new flag, a "while I was here" abstraction that wasn't in the change.

→ *Approval mechanics, who creates done.md, rollback:* [Pipeline Architecture — Stage Completion](pipeline-architecture.md#stage-completion-donemd)

---

## The Artifacts

Four artifact types carry work through the pipeline:

| Artifact | What it answers | Who creates it |
|----------|----------------|---------------|
| **Change** (`change.md`) | What are we doing, and why? | Human + agent |
| **Spec** | What must the system do? | Agent generates; human approves |
| **Plan** | How will we build it? | Agent generates |
| **Task** | What's the current assignment? | Agent generates from plans |

Each layer adds detail but never contradicts the layer above. The change says "login." The spec says "create a JWT session with these acceptance criteria." The plan says "use jsonwebtoken with RS256 in these files." Each is a faithful refinement of the one above. If a plan contradicts a spec, the plan is wrong. If a spec contradicts the change, the spec is wrong.

→ *Artifact schemas, required fields, and conformance:* [Specification](specification.md)

---

## The Review Cycle (RC)

Every artifact produced in the pipeline goes through dual independent review plus triage before advancing. The cycle works like this: the author generates the artifact, two reviewers from different vendors critique it blind, and a triage agent decides whether to advance, send back for fixes, or route to the human.

The key structural constraint is vendor diversity. Reviewers must be different vendors from the author, and triage must not be the author's vendor family. Two vendors disagreeing surfaces real issues — one vendor talking to itself surfaces style preferences. Our empirical experience is that dual-blind review catches 2-3× more issues than single review.

The human is always *available* at an RC but only *required* at the three approval points. For everything else — plan reviews, code reviews, task reviews — the RC runs autonomously unless triage routes something to you. When the doc says "→ RC," it means this full cycle.

→ *RC structural rules, auto-fix limits, vendor constraints:* [Pipeline Architecture — The Review Cycle](pipeline-architecture.md#the-review-cycle-rc)

---

## The Layer Principle

Each artifact layer answers exactly one question and must not leak into another layer's domain.

- If it names an **algorithm, file, or function** → plan or lower
- If it names a **tolerance, benchmark, or verification method** → spec or lower
- If it names a **business outcome observable without running code** → change level

This discipline makes layers composable. A spec can be re-planned without changing the change. A plan can be re-implemented without changing the spec. When a layer leaks — an algorithm appears in a spec, or a business goal appears in a plan — it creates a coupling that makes the wrong thing expensive to change.

→ *Decision rules, negative examples, work types:* [Specification — Design Rules](specification.md)

---

## How It Actually Works

Imagine you want to add login to an app. Here's what happens.

**Design.** You work with an agent to define the change. The agent researches auth patterns, synthesizes options, challenges scope. You push back: "SSO is out of scope for now." When you agree it's ready, the agent writes `change.md` — kind is `feature`, intent is one sentence, non-goals are explicit, done-when is an executable test command. This goes into `future/C-042/`. A different agent reviews it (RC). You approve it (set `status: approved`).

**Queue.** The daemon sees an approved change in `future/` and `current/` is empty. It moves `C-042/` to `current/`.

**Specs.** The daemon reads the change and generates specs — one per deliverable. S-01 covers login flow, S-02 covers session management. Each spec says *what the system must do* — acceptance criteria, MUSTs, MUST NOTs — without choosing algorithms or naming files. The specs go through RC. You review the spec *set* — not the individual files, but the set: do these specs *together* cover everything the change promised? Do the seams between them make sense? You create `specs/done.md`. Architecture is now frozen.

**Plans.** The daemon generates plans from approved specs — one plan per spec. Each plan says *how*: specific files, functions, data structures, verification commands. Plans go through RC. You skim the plan if you want — low leverage if the spec was tight. `plans/done.md` is created.

**Tasks & Build.** Plans are consolidated into tasks. The daemon processes each task: implement, verify, RC. If review finds issues, the triage agent auto-fixes (up to 3 iterations). If it can't resolve, the pipeline halts. When all tasks are verified, `tasks/done.md` is created. The daemon runs the done-when tests from the change.

**Acceptance.** You run it. You use it. You decide it's the thing you meant. You create `done.md`. The daemon moves `C-042/` to `done/` — a complete audit trail of change, specs, plans, tasks, reviews, and logs.

**The result:** You made three decisions (change, specs, acceptance). The agents did everything else. The folder in `done/` proves the chain from your intent to the shipped code.

---

## Sizing and Atomicity

A spec describes what can be implemented atomically — without requiring intermediate checkpoints or partial-state commits. That's the only sizing rule. "Session," "focus time," and other temporal measures are explicitly rejected because agent context windows vary by model, human focus blocks vary by person, and external blockers are unpredictable.

Sizing is *estimated* when writing specs and *validated* when writing plans. If a planner discovers a spec isn't atomic — an HLD requires checkpoint-saving, or the implementation has mandatory wait points — the split protocol fires. The spec splits into children, each child goes through the spec approval, and new plans are written. This is the framework working as intended, not a failure.

→ *Sizing cascade, caps, split and replan protocols:* [Specification — Sizing Rules](specification.md)

---

## Traceability

Every piece of implemented code traces back to stakeholder value through a five-link chain:

```
Change intent → Spec AC → MUST → Verification → Code @spec tag
```

Forward trace answers "does the code deliver the need." Reverse trace answers "why does this code exist." Given a code file with `@spec S-01`, you follow the chain back to the change and know exactly which intent justified that code.

Code marks the **spec**, not the plan or task. Plans are consumed during implementation — they may be rewritten or superseded without changing what the code does. Tasks are operational bookkeeping. The spec is the stable contract: when behavior changes, the spec changes.

→ *Coverage matrices, completion predicates, audit rules:* [Specification — Traceability](specification.md)

---

## Dependencies

A change can depend on other changes — `depends_on` in change.md means the dependency must be in `done/` before the dependent moves to `current/`. The pipeline processes one change at a time, so this is simple: finish the dependency first.

Within a change, specs can depend on other specs (interface or temporal), and tasks can depend on other tasks within the same plan. The dependency graph must be acyclic — cycles are rejected at the spec approval. When multiple ordering constraints conflict, explicit dependency edges win over HLD order, which wins over implementation sequence.

→ *Dependency types, declaration format, cycle rejection:* [Specification — Dependency System](specification.md)

---

## Error Handling

Error means halt. The change stays in `current/` with all evidence intact. The triage agent auto-fixes what it can — up to 3 iterations of fix-verify-review. If it can't resolve the problem, the pipeline stops and the human is notified with what failed, why, and what was tried.

Resumption is simple: check what `done.md` files exist, pick up from the first missing piece. No `specs/done.md`? Wait for spec approval. No `plans/done.md`? Generate plans. `tasks/done.md` missing? Process the next task.

→ *Resumption, rollback, human options:* [Pipeline Architecture — Error Handling](pipeline-architecture.md#error-handling)

---

## Roles and Agents

The pipeline has seven roles — Author, Fixer, Reviewer A, Reviewer B, Triage, Implementer, and Impl Reviewer — mapped to three model tiers: Flagship (best reasoning), Mid (good cost-efficiency), and Fast (structured output, cheap). Roles are abstract; the vendor and model assignment is configuration, not architecture.

The key constraints: the author family stays consistent across a change (vocabulary drift across vendors looks like design drift), reviewers must be different vendors from the author, and triage must not be the author's family. Spend flagship tokens on authoring once and reviewing design artifacts. Spend fast tokens on triage and implementation. Spend your time on three approval points.

→ *Full role table, tier definitions, current harness assignments:* [Pipeline Architecture — Roles & Tiers](pipeline-architecture.md#roles--tiers)

---

## Teams

Synapse is a per-developer tool. Each developer runs their own pipeline on their own machine, on their own branch. Multiple developers can work on the same codebase — their pipelines are independent and don't know about each other.

The typical team flow:

```
Jira ticket assigned to you
  → create branch feature/JIRA-123-slug
  → create change.md with ticket: JIRA-123
  → approve change
  → pipeline runs (specs → plans → build)
  → approve result (Acceptance)
  → open MR on GitLab, link JIRA-123
  → merge, close ticket
  → next ticket
```

Synapse replaces the *process* (how you go from idea to code), not the *coordination* (who does what, when, in what order). Jira handles coordination. Git handles integration. GitLab handles code review and merge. Synapse handles everything between "I have a ticket" and "I'm opening an MR."

The `ticket` field in change.md links the change back to the coordination layer — it's a string, not an integration. Synapse doesn't talk to Jira. The developer is the integration layer.

→ *change.md template with ticket field:* [Pipeline Architecture — change.md Template](pipeline-architecture.md#the-changemd-template)

---

## For Agents

If you are an AI agent operating in this pipeline, this handbook gives you the concepts. Two other documents give you the instructions:

- **[Agent Contract](agent-contract.md)** — What to produce, in what format, with what signals, how to report results. Creation procedures, conformance checklists, signal protocol, review format.
- **[Specification](specification.md)** — What valid artifacts look like. Required fields, state machines, invariants, templates.

Read the Agent Contract for *what to do*. Read the Specification for *what things are*.

---

> **One change. Three bins. Three approval points. Halt on error. Folder is the record. `done.md` is the state machine.**
