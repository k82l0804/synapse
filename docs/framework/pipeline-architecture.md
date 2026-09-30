# Synapse Pipeline Architecture — Conceptual Foundation

> **Date:** 2026-09-29  
> **Status:** Working draft — captures insights from workflow analysis  
> **Context:** Derived from analyzing how fox-code-cli was actually built (Phases 1–2H, 40+ completed plans) and identifying where the original handbook's model diverged from proven practice.

---

## The Double-Buffer Pipeline

Synapse is a single pipeline with two async stages connected by a queue — like a graphics rendering pipeline where the CPU prepares the next frame while the GPU renders the current one.

```
┌─────────────────────┐     ┌──────────────┐     ┌──────────────────────┐
│   DESIGN STAGE      │     │    QUEUE      │     │   EXECUTION STAGE    │
│   (human-driven)    │────▶│  (the swap    │────▶│   (agent-driven)     │
│                     │     │   buffer)     │     │                      │
│  Research           │     │              │     │  Create plans         │
│    → Features       │     │  Approved    │     │    → Generate todos   │
│      → Specs        │     │  feature     │     │      → Implement     │
│        → Approve    │     │  spec sets   │     │        → Test        │
│          → Next...  │     │              │     │          → Review    │
│                     │     │              │     │            → Done    │
│                     │◀────│──────────────│◀────│                      │
│  Handle escalations │     │  Escalation  │     │  Escalate failures   │
└─────────────────────┘     │  backflow    │     └──────────────────────┘
                            └──────────────┘
```

**Key properties:**

1. **Decoupled.** The human doesn't wait for agents to finish before designing the next feature. Agents don't wait for the human to approve before processing the next item in the queue. Both stages run at their own pace.

2. **No tearing.** The queue contains *complete, approved* feature spec sets — never half-done specs. The agents consume a coherent package that's ready for execution.

3. **Throughput-limited by the slower stage.** If the human designs faster than agents can build, the queue grows. If agents build faster than the human designs, the queue empties and agents idle. The system self-balances.

4. **Artifact-driven.** The queue IS the artifacts. An approved feature with approved specs sitting in the repo is a queue entry. No separate job queue needed — the filesystem is the buffer.

---

## Three Artifacts, Not Four

| Artifact | Purpose | Who creates | Who approves |
|----------|---------|-------------|-------------|
| **Feature** | "What to build" — scope, success metrics, in-scope items | Human (with agent research assistance) | Human |
| **Spec** | "The contract" — acceptance criteria, MUSTs, verification | Agent drafts, human reviews | Human (batch per feature) |
| **Plan** | "How to build it" — file changes, architecture, edge cases, tests | Agent creates from approved spec | Agent (peer review) |

**What happened to Tasks?**

In the proven fox-code-cli workflow, "tasks" were two things:
- **Scheduling entries** — checkboxes in phase files ("which plans are in this batch?")
- **Progress trackers** — todo lists agents create from plans ("where am I?")

Neither is a formal artifact. The plan contains all the substance (what to change, how to verify, edge cases). The todo list is a working memory aid for the agent — derived mechanically from the plan, updated as work progresses. It doesn't need its own template, status machine, or review.

---

## The Design Stage

**Owner:** Human  
**Pace:** Strategic, deliberate  
**Agent role:** Research assistant, drafter, reviewer — but the human decides

### Flow

```
Research  →  Feature definition  →  Spec drafting  →  Approval  →  Queue
```

1. **Research.** Human identifies a capability need. Agent assists with competitive analysis, codebase exploration, feasibility assessment.

2. **Feature definition.** Human defines what to build: scope, success metrics, in-scope items. Agent may draft, but human owns the "what."

3. **Spec drafting.** Agent drafts ALL specs for a feature as a batch. This is feature-scoped: a feature's full spec set is drafted together so composition and coverage are visible.

4. **Approval.** Human reviews the feature's complete spec set — all specs, coverage matrix, acceptance criteria — as one decision. Not individual specs. The batch is the unit of approval.

5. **Queue.** Approved feature spec set enters the queue. Human moves on to the next feature.

### The Human's Job

- Keep the queue full (design ahead of execution)
- Handle escalations (when agents get stuck)
- Set priorities (which features go next)

---

## The Execution Stage

**Owner:** Agents (fully autonomous)  
**Pace:** As fast as compute allows  
**Human role:** Handle escalations only

### Flow

```
Pick feature from queue
  → Create plans (one per spec or deliverable)
    → Agent peer review of plans
      → Generate todo list from plan
        → Implement (following plan, checking off todos)
          → Test (automated verification)
            → Code review (agent reviewer)
              → Triage (auto-fix or escalate)
                → Done → pick next
```

1. **Plan creation.** Agent reads the approved specs and creates implementation plans. Plans are detailed: file locations, proposed changes, architecture decisions, edge cases, verification steps.

2. **Plan review.** Another agent reviews the plans for quality — no human needed. The spec was already human-approved; the plan is the agent's implementation strategy.

3. **Todo generation.** Agent extracts a checklist from the plan. This is the working progress tracker — checkboxes the agent updates as it implements.

4. **Implementation.** Agent follows the plan, writes code, checks off todo items.

5. **Verification.** Automated: typecheck, tests, verification commands from the plan.

6. **Code review.** Agent reviewer checks the implementation against the spec's acceptance criteria.

7. **Triage.** If review finds issues: auto-fix (up to 3 iterations) or escalate to the human. Escalation is the **only point where the execution stage pushes back to the design stage**.

8. **Done.** Feature complete when all plans pass verification and review.

---

## The Queue

The queue is not a separate system — it's the artifacts themselves.

**An approved feature spec set in the repo IS a queue entry.** The execution stage scans for approved features that haven't been processed yet. This is currently represented by phase files (`tasks/current/phase-*.md`), but the underlying mechanism is: "find approved features, process them."

### Feature-Batched Processing

Features are the **unit of work** that flows through the execution stage, not individual specs or plans. A feature's specs are drafted together, approved together, planned together, and implemented together.

This matters because:
- **Composition is checked at approval time** — the coverage matrix is naturally reviewable when all specs are visible
- **Dependencies are resolved upfront** — cross-spec dependencies within a feature are visible during batch review
- **"Feature done" is a natural predicate** — all this feature's plans passed verification = done

### Phase Rotation

A **phase** is a batch of one or more features queued for execution. Phase rotation is the scheduling mechanism:

```
tasks/current/   → active phase (being processed)
tasks/future/    → next phases (waiting)
tasks/done/      → completed phases (archived)
tasks/deferred/  → parked (reprioritized out)
```

The human manages the phase queue (Pipeline A output). The agents process the current phase (Pipeline B input). When a phase completes, the next one promotes. This is the "buffer swap."

---

## Escalation: The Backpressure Mechanism

When the execution stage can't resolve something (3 failed auto-fix iterations, a fundamental design question, a test that can't pass), it **escalates** back to the human.

Escalation is backpressure: it signals that the queue contains work the agents can't complete without human input. The human handles escalations alongside their design stage work — they don't need to switch contexts to "pipeline operator mode."

```
Escalation types:
  - Code review found a spec gap     → human updates the spec (design stage work)
  - Implementation can't satisfy AC  → human revises the AC (design stage work)
  - Fundamental design question       → human makes the call (design stage work)
```

Notice: every escalation is **design stage work**. The human handles it in their normal design flow, not in a separate operational mode.

---

## What Changed from the Original Handbook

| Original handbook | This model |
|------------------|-----------|
| Single linear pipeline (Feature → Spec → Plan → Task → Done) | Two async stages with a queue |
| Four artifact types (Feature, Spec, Plan, Task) | Three artifacts (Feature, Spec, Plan) + runtime trackers |
| Gates between every stage (FEATURE_GATE, SPEC_GATE, PLAN_GATE) | One handoff point: the queue. Human approves in design stage, agents self-manage in execution stage |
| Per-artifact approval | Feature-batched approval (all specs for a feature reviewed together) |
| Tasks as formal artifacts with templates and status machines | Todos as agent working memory (checkboxes, no ceremony) |
| Human as pipeline operator (performing gates, handling approvals) | Human as designer (research, features, specs) who handles escalations |
| Synchronous gates (pipeline stops for human approval) | Async producer-consumer (human produces, agents consume, neither blocks) |

---

## Open Questions

1. **Can agents assist in the Design Stage more than they do now?** Currently agents draft specs but humans review/approve. Could agents do a "pre-review" pass (catch internal inconsistencies) before the human sees the spec set? This would make the human's review faster without removing their decision authority.

2. **What does the queue look like concretely?** Currently it's phase files. Should it be a directory of approved feature spec sets? A YAML manifest? The current phase-file model works but may not scale to multiple concurrent features.

3. **Multi-feature parallelism.** Can the execution stage process multiple features concurrently, or is sequential (one phase at a time) the right model? Sequential is simpler but slower. Parallel risks cross-feature conflicts (editing the same files).

4. **Feedback loops.** When agents complete a feature, does the human need to "accept" it, or is passing verification sufficient? In the fox-code-cli workflow, there was no formal acceptance step — green tests = done.
