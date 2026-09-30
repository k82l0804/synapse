# Synapse Pipeline Architecture — Conceptual Foundation

> **Date:** 2026-09-29  
> **Status:** Working draft — captures insights from workflow analysis  
> **Context:** Derived from analyzing how fox-code-cli was actually built (Phases 1–2H, 40+ completed plans) and identifying where the original handbook's model diverged from proven practice. Refined with external review feedback on batch processing and filesystem design.

---

## The Double-Buffer Pipeline

Synapse is a single pipeline with two async stages connected by a queue — like a graphics rendering pipeline where the CPU prepares the next frame while the GPU renders the current one.

```
┌─────────────────────┐     ┌──────────────┐     ┌──────────────────────┐
│   DESIGN STAGE      │     │    QUEUE      │     │   EXECUTION STAGE    │
│   (human-driven)    │────▶│  (the swap    │────▶│   (agent-driven)     │
│                     │     │   buffer)     │     │                      │
│  Research           │     │              │     │  Create plans         │
│    → Features       │     │  Approved    │     │    → Implement        │
│      → Specs        │     │  feature     │     │      → Test           │
│        → Approve    │     │  spec sets   │     │        → Review       │
│          → Next...  │     │              │     │          → Done       │
│                     │     │              │     │                      │
│                     │◀────│──────────────│◀────│                      │
│  Handle escalations │     │  Escalation  │     │  Escalate failures   │
└─────────────────────┘     │  backflow    │     └──────────────────────┘
                            └──────────────┘
```

**Key properties:**

1. **Decoupled.** The human doesn't wait for agents to finish before designing the next feature. Agents don't wait for the human to approve before processing the next item in the queue. Both stages run at their own pace.

2. **No tearing.** The queue contains *complete, approved* feature spec sets — never half-done specs. The agents consume a coherent package that's ready for execution.

3. **Throughput-limited by the slower stage.** If the human designs faster than agents can build, the queue grows. If agents build faster than the human designs, the queue empties and agents idle. The system self-balances.

4. **Artifact-driven.** The queue IS the artifacts. An approved feature with approved specs sitting in the repo is a queue entry. No separate job queue, no hand-edited manifest — the filesystem is the buffer.

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

Neither is a formal artifact. The plan contains all the substance (what to change, how to verify, edge cases). The todo list is a working memory aid for the agent — derived mechanically from the plan, updated as work progresses. Agent scratch (todos, traces, session state) lives in `.work/` and is gitignored. It doesn't need its own template, status machine, or review.

---

## Feature-Scoped Directories

**The filesystem IS the grouping.** Every artifact for a feature lives in its feature directory. No naming conventions to enforce, no cross-referencing, no manifest sync.

```
features/
  F-042-dark-mode/
    feature.md                 # definition, scope, metrics, status (YAML frontmatter)
    specs/
      S-042-toggle.md          # frontmatter: feature: F-042, status: approved
      S-043-persistence.md     # frontmatter: feature: F-042, status: approved
    plans/
      P-042.md                 # frontmatter: implements: [S-042], status: done
      P-043.md                 # frontmatter: implements: [S-043], status: in_progress
    reviews/                   # committed, durable
      2026-09-29_spec-review.md
      2026-09-29_P-042-code-review-iter1.md
    .work/                     # gitignored: agent todos, scratch, tool traces
  F-043-settings/
    ...
  archive/                     # completed features (keeps working set small)
    F-040-auth/
    F-041-onboarding/
```

### Design Principles

**Filesystem groups.** The directory is the unit of work. An agent processing F-042 reads one directory, honors the gate, writes artifacts only under it.

**Frontmatter names.** Each artifact declares its own relationships in YAML frontmatter:

```yaml
# features/F-042-dark-mode/feature.md
---
id: F-042
slug: dark-mode
status: approved          # draft | review | approved | in_progress | blocked | escalated | done
gate: human               # who approved: human | guardian
batch: 02                 # scheduling hint (priority grouping), not a location
blocked_by: []
related: [F-041]
---
```

```yaml
# features/F-042-dark-mode/specs/S-042-toggle.md
---
id: S-042
feature: F-042
status: approved
---
```

```yaml
# features/F-042-dark-mode/plans/P-042.md
---
id: P-042
feature: F-042
implements: [S-042]
status: draft
---
```

**Index queries.** The coverage matrix, the queue, the feature status — all are computed views, not hand-maintained artifacts. Each child artifact declares its edges; the daemon walks frontmatter and writes SQLite. Markdown is the source of truth. SQLite is the query layer.

**Daemon claims.** The daemon scans feature dirs, selects `approved` features whose blockers are `done`, claims one (SQLite lease with TTL), runs the next missing stage. No hand-edited `pipeline/current.md`.

**Humans gate.** The human approves features and spec sets in the design stage. That's it. Everything else is the machine.

### The Queue Is a Query, Not a File

There is no `pipeline/current.md` that tracks what's active. Status lives on the feature's own frontmatter. The queue is derived:

| Query | Meaning |
|-------|---------|
| `status=approved AND blocked_by=[]` | Ready for execution (queue entries) |
| `status=in_progress` | Claimed by daemon, being processed |
| `status=escalated` | Pushed back to human attention |
| `status=done` | Complete, eligible for archival |

A generated dashboard view can render this for the human. But the live schedule is never a hand-edited file — it's a query over feature frontmatter.

### Coverage Matrix Is Computed

The coverage matrix (which specs cover which feature requirements) is not a maintained section in `feature.md`. It's computed from the frontmatter graph:

- Each spec says `feature: F-042`
- Each plan says `implements: [S-042, S-043]`
- Each spec's acceptance criteria cite feature in-scope items

The daemon (or a tool) walks these edges and renders the matrix. If it drifts, the frontmatter is wrong, not a separate manifest.

### Features Are a Graph

A persistence spec used by dark mode *and* settings, a shared infra change, "F-043 blocked on F-042 landing" — these cross-cutting concerns can't be expressed by directories alone.

**Containment is the default** (the directory). **Links are the exception** (`blocked_by`, `related`, `implements` in frontmatter, queried via index).

### Agent Scratch Is Gitignored

Agent checklists churn every session. Specs and approved plans are durable. Mixing them pollutes git history.

- `reviews/` — committed, durable, dated filenames
- `.work/` — gitignored: session todos, scratch files, tool traces

The agent reads the plan (committed), generates a todo in `.work/` (scratch), implements, and the results land as committed code + reviews.

---

## The Design Stage

**Owner:** Human  
**Pace:** Strategic, deliberate  
**Agent role:** Research assistant, drafter, reviewer — but the human decides

### Flow

```
Research  →  Feature definition  →  Spec drafting  →  Approval  →  Queue
```

1. **Research.** Human identifies a capability need. Agent assists with competitive analysis, codebase exploration, feasibility assessment. Research artifacts are optional and live in `features/F-NNN/research/`.

2. **Feature definition.** Human defines what to build: scope, success metrics, in-scope items. Agent may draft, but human owns the "what." Creates `features/F-NNN-slug/feature.md` with `status: draft`.

3. **Spec drafting.** Agent drafts ALL specs for a feature as a batch. This is feature-scoped: a feature's full spec set is drafted together so composition and coverage are visible. Specs land in `features/F-NNN/specs/`.

4. **Approval.** Human reviews the feature's complete spec set — all specs, computed coverage matrix, acceptance criteria — as one decision. Not individual specs. The batch is the unit of approval. Human sets `status: approved` on `feature.md`.

5. **Queue.** The approved feature is now visible to the daemon's query. Human moves on to the next feature.

### The Human's Job

- Keep the queue full (design ahead of execution)
- Handle escalations (when agents get stuck — these are design-stage problems: spec gaps, AC issues, fundamental questions)
- Set priorities (`batch` and `priority` fields in frontmatter)

---

## The Execution Stage

**Owner:** Agents (fully autonomous)  
**Pace:** As fast as compute allows  
**Human role:** Handle escalations only

### Flow

```
Daemon selects approved feature
  → Create plans (one per spec or deliverable)
    → Agent peer review of plans
      → Implement (generate todo in .work/, follow plan)
        → Test (automated verification)
          → Code review (agent reviewer)
            → Triage (auto-fix or escalate)
              → Done → archive feature → select next
```

1. **Claim.** Daemon scans for `approved` features with empty `blocked_by`. Claims one via SQLite lease (TTL, owner). Sets `status: in_progress`.

2. **Plan creation.** Agent reads the approved specs in `features/F-NNN/specs/` and creates implementation plans in `features/F-NNN/plans/`. Plans are detailed: file locations, proposed changes, architecture decisions, edge cases, verification steps. Each plan's frontmatter declares `implements: [S-NNN]`.

3. **Plan review.** Another agent reviews the plans — no human needed. The spec was already human-approved; the plan is the agent's implementation strategy.

4. **Implementation.** Agent generates a todo checklist in `.work/` from the plan, writes code, checks off items as it goes. The todo is scratch — gitignored, not a formal artifact.

5. **Verification.** Automated: typecheck, tests, verification commands from the plan.

6. **Code review.** Agent reviewer checks the implementation against the spec's acceptance criteria. Review artifacts land in `features/F-NNN/reviews/` (committed, durable).

7. **Triage.** If review finds issues: auto-fix (up to 3 iterations) or escalate. Escalation sets `status: escalated` on the feature and drops a review file explaining why. The human handles it in their design-stage flow.

8. **Done.** Feature complete when all plans pass verification and review. `status: done`. Feature directory moves to `features/archive/` to keep the working set small.

### Daemon Runtime Loop

```
1. Reindex feature dirs (watch or on pulse)
2. Select features where status=approved AND blocked_by are all done
3. Claim one feature (SQLite lease, TTL, owner)
4. Run the next missing stage: plan → implement → review
5. On failure: set status=escalated, drop review file
6. On success: set status=done
7. Repeat
```

No hand-edited schedule. No pipeline directory. The daemon reads frontmatter, queries SQLite, processes features.

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

Every escalation is **design stage work**. The human handles it in their normal design flow. Escalation sets `status: escalated` on the feature's frontmatter and drops a review file in `features/F-NNN/reviews/` explaining the issue. No separate `pipeline/escalations/` directory.

---

## Scheduling: Batches as Tags, Not Directories

Batches group features for priority ordering. They're a **planning tag** on feature frontmatter, not a directory the runtime consults:

```yaml
batch: 02
priority: 2
```

The daemon can prefer lower batch numbers or higher priority. But batching is advisory — the real scheduling decision is: "which approved features have their blockers resolved?" That's a query, not a folder.

Phase rotation (from fox-code-cli) maps to: archive completed features, let the daemon pick up the next approved ones. The "buffer swap" is automatic — the daemon always queries for the next ready feature.

---

## What Changed from the Original Handbook

| Original handbook | This model |
|------------------|-----------|
| Single linear pipeline (Feature → Spec → Plan → Task → Done) | Two async stages with a queue |
| Four artifact types (Feature, Spec, Plan, Task) | Three artifacts (Feature, Spec, Plan) + runtime trackers |
| Gates between every stage (FEATURE_GATE, SPEC_GATE, PLAN_GATE) | One handoff: human approves in design stage. Agents self-manage in execution stage |
| Per-artifact approval | Feature-batched approval (all specs for a feature reviewed together) |
| Tasks as formal artifacts with templates and status machines | Todos as agent scratch (`.work/`, gitignored) |
| Human as pipeline operator (performing gates) | Human as designer who handles escalations |
| Synchronous gates (pipeline stops for human) | Async producer-consumer (neither blocks the other) |
| Flat artifact directories with naming conventions | Feature-scoped directories (filesystem is the grouping) |
| Hand-maintained coverage matrix | Computed from frontmatter graph |
| Hand-edited `pipeline/current.md` schedule | Queue is a query over feature status |
| Separate escalation directory | Escalation is a feature status + review file |

---

## Design Rule

> **Filesystem groups. Frontmatter names. Index queries. Daemon claims. Humans gate.**

---

## Open Questions

1. **Feature status derivation.** Should feature status be set explicitly, or derived from child artifact statuses? Explicit is simpler and avoids sync issues. Derived is more accurate but needs computation.

2. **Multi-feature parallelism.** Can the daemon process multiple features concurrently? Sequential is simpler. Parallel risks cross-feature file conflicts. Could use git worktrees per feature for isolation.

3. **Archive trigger.** When does a feature move to `archive/`? Immediately on `status: done`? After a cooldown period? Manual?

4. **Feedback loops.** When agents complete a feature, does the human need to "accept" it, or is passing verification sufficient? In the fox-code-cli workflow, green tests = done, no formal acceptance.

5. **Spec reuse across features.** A shared persistence spec used by F-042 and F-043. Does it live in one feature's directory with a cross-reference, or in a shared `specs/` directory outside the feature tree? Frontmatter links handle the graph, but the file must live *somewhere*.
