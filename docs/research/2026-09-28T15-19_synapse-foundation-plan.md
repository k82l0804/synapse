# Synapse Foundation & Architecture

> **Status:** Living design doc — updated as decisions are made.
> Discusses before building. Clear mind makes for quicker work.

---

## 1. What Synapse Is

**Synapse is an AI development lifecycle platform.**

It manages the full development lifecycle for any registered product repo:

```
[Research doc] → Features → Specs → Tasks → Plans → Code + Tests → Shipped
      ↑                                                    |
      └──────────── converge until spec tests green ◄──────┘
```

**Core hierarchy:**
```
Feature (what the product can do — ≈ User Story)
  └── Spec (the formal contract — acceptance criteria + high-level tasks + test contract)
        └── Tasks (detailed implementation units — derived from spec by agent)
              └── Plan (how to implement — derived from task + spec by planner agent)
                    └── Code + Tests (tests verify the SPEC, not the plan)
```

**Core principle:** Agents do the work. Humans set direction and approve gates.

**Where you work:** AGY IDE / VSCode / TUI — this is where all work happens.
**GUI:** Deferred. CLI is the primary interface for all pipeline control.

---

## 2. User Workflow

```
1. IDE: explore a problem space with the agent
         research docs accumulate in docs/research/

2. IDE: "use research-to-features on docs/research/X.md"
         → spec stubs written to specs/
         → review cycle runs on specs (Grok → AGY → Gate)

3. [SPEC GATE] YOU approve specs
         "yes, this is what I want built"
         specs become the source of truth

4. Pipeline (automated):
         task-gen + task-review cycle (Grok → AGY → auto-resolve or escalate)
         make-plans + plan-review cycle (Grok → AGY → Gate)

5. [PLAN GATE] YOU approve plans
         last human checkpoint before code is written

6. Pipeline (automated):
         implement → test-cycle → code-review cycle → triage
         converge until spec tests green

7. IDE: watch progress, resolve escalations
         approve/reject gates via: synapse inbox / approve / reject
```

**You are the approver, not the creator.**
Agents generate. Grok reviews. AGY triages. You approve strategy.

**Primary interface: CLI** (`synapse inbox`, `synapse approve`, etc.)
GUI deferred until CLI is proven in real use.

---

## 2.5 Core Principle: Uniform Review Cycle

> **Every agent-generated artifact goes through the same review cycle.**
> The artifact type changes. The cycle does not.

```
Agent generates artifact
  ↓
Grok reviews            — quality check: complete? correct? non-contradictory?
  ↓                       produces: [BLOCKING] / [WARNING] / [INFO] findings
AGY triages             — reads Grok's review, produces RECOMMENDATIONS
  ↓                       (always runs — gate approver sees pre-digested input)
Gate                    — strategic decision: approve / reject / defer
  ├── interactive:        Human reads AGY's recommendations, decides
  └── full-auto:          Director agent reads AGY's recommendations, decides
  ↓
AGY acts                — implements approved decisions, commits
  ↓
Next artifact generated → repeat
```

**The artifacts, in pipeline order:**

| Artifact | Gate? | Who approves |
|----------|-------|-------------|
| Specs | YES | Human (direction) or director agent |
| Tasks | No (unless ESCALATE) | Auto-resolved by triage |
| Plans | YES | Human (last checkpoint before code) or director agent |
| Code | No (unless ESCALATE) | Auto-resolved by triage + tests |

**Key insight: humans never read raw Grok findings.**
Grok finds things. AGY decides what matters and produces recommendations.
The gate approver — human or director agent — reads the recommendations, not the raw review.
This makes the gate interface identical regardless of who sits at it.

**The ESCALATE signal converts any step into an ad-hoc gate.**
If AGY cannot auto-resolve a finding, it escalates — regardless of artifact type.
The pipeline pauses until the escalation is resolved.

**Interactive vs. full-auto mode:**
- Interactive: human sits at all gates. Escalations go to `synapse inbox`.
- Full-auto: a director agent sits at gates. Escalations halt the pipeline and alert the human.
- The gate *interface* is identical in both modes. Only the approver changes.

**Reviewer-Generator Separation (architectural invariant):**
The agent that generates an artifact must never review it.

- **AGY** generates: specs, tasks, plans, code, triage fixes — the creative/constructive role
- **Grok** reviews: all of the above — the adversarial/critical role
- These roles are structurally fixed. AGY does not review. Grok does not generate.

Why: a model reviewing its own output produces confirmation bias, not genuine review.
Different model, different architecture, different training, different failure modes —
structural independence is what makes the review meaningful.

This is why the read-only constraint is injected into every Grok invocation via `agent-job.sh`.
It is not a courtesy — it is a pipeline invariant. A Grok job that edits a file is a
constraint violation, not a helpful shortcut.

**Deferred idea: Recursive/Convergent Review (not implemented)**

> The current cycle is: Generate → Review → Triage → Gate → Act (once).
> A future variant could loop: Generate → Review → Triage → Auto-fix → Review → ... until the
> Reviewer finds nothing new. The human gate would only fire at convergence, not every iteration.
>
> Why not now: gates are cheap when changes are small. The human gate catches direction errors
> that the Reviewer+Triage loop cannot detect (the spec is technically correct but not what
> was intended). Removing the gate prematurely risks building the right thing wrong.
>
> Worth revisiting when: (a) Reviewer-Triage pairs demonstrate reliable convergence in practice,
> (b) we have confidence that "Reviewer finds nothing" reliably means "spec is correct as-intended."

---

## 2.6 Core Principle: Capability-Task Matching

> **Model capability must match cognitive demand.**
> The pipeline has four distinct cognitive modes. Over-provisioning wastes cost and latency.
> Under-provisioning produces output that passes schema validation but fails on judgment.

### Four cognitive modes

| Mode | Cognitive demand | Steps | Default model |
|------|-----------------|-------|---------------|
| **Synthesis** | Highest — interpret unstructured research, make judgment calls about what matters, formalize ambiguity into precise contracts | `research-to-features`, spec writing/refinement | **Opus** |
| **Critical analysis** | High — find what's wrong in something that looks correct, identify gaps, catch architectural violations | spec-review, task-review, plan-review, code-review | **Grok (frontier)** |
| **Structured reasoning** | Medium-high — derive tasks from specs, create plans, triage review findings, make recommendations | task-gen, make-plans, triage (AGY) | **Sonnet** |
| **Mechanical execution** | Low-medium — implement from a complete, detailed plan | implement, test-cycle | **Flash or Sonnet** |

### Why Synthesis is Opus

Research docs are unstructured, ambiguous, and dense. Extracting features means:
deciding what counts as a user-facing capability (not a task), ranking by infra dependency,
writing acceptance criteria that will drive all downstream work. This is the highest-leverage
step — a bad feature extraction propagates through everything. Frontier reasoning required.

### Why reviews are never downgraded

A Flash-executed code review will miss things that matter. Reviews have no schema that
catches failure — a review that finds nothing is indistinguishable from a review that
missed everything. You can only trust a review proportionally to the capability of the
reviewer. Review steps are always Grok frontier. This is not configurable.

### The implementation tier decision rule

Implementation model is not fixed — it is determined by plan quality:

```
plan is highly detailed + work is mechanical (bash, boilerplate, type stubs)
  → Flash is sufficient

plan requires judgment calls not fully captured in deliverables
  → Sonnet required
```

A Sonnet-quality plan detailed enough for Flash to execute is the optimal outcome:
Sonnet's reasoning cost paid once at planning time, Flash's speed/cost paid at execution.
This is why plan quality (from make-plans) determines execution cost downstream.

### Model assignment table (configurable in agent-job.sh)

```
Step                  Specialist   Model
────────────────────  ──────────   ─────────────────
research-to-features  agy          claude-opus-4
spec-write/refine     agy          claude-opus-4
spec-review           grok         grok-4 (frontier)
triage (specs)        agy          claude-sonnet-4-5
task-gen              agy          claude-sonnet-4-5
task-review           grok         grok-4 (frontier)
triage (tasks)        agy          claude-sonnet-4-5
make-plans            agy          claude-sonnet-4-5
plan-review           grok         grok-4 (frontier)
triage (plans)        agy          claude-sonnet-4-5
implement (complex)   agy          claude-sonnet-4-5
implement (simple)    agy          gemini-2.5-flash
test-cycle            agy          gemini-2.5-flash
code-review           grok         grok-4 (frontier)
triage (code)         agy          claude-sonnet-4-5
```

These defaults are overridable per product and per pipeline run.
The daemon reads model assignment from product config; `agent-job.sh` receives it as `$MODEL`.

---

## 2.7 Named Roles

Every pipeline step is executed by an agent in a named role. Roles define responsibilities,
constraints, and minimum capability requirements. An agent may play different roles in
different steps — but never the Generator and Reviewer role for the same artifact.

### The five roles

---

**Architect** — synthesis and design
- **Does:** research-to-features, spec drafting/refinement, spec triage (fixing specs after review)
- **Does not:** review, implement code
- **Default agent:** AGY | **Default model:** Opus
- **Why Opus:** highest cognitive demand in the pipeline — interprets unstructured research,
  makes judgment calls that propagate through everything downstream, formalizes ambiguity into
  precise contracts. A bad feature extraction corrupts the entire pipeline. No model downgrade.

---

**Reviewer** — adversarial analysis
- **Does:** spec-review, task-review, plan-review, code-review — *all* reviews, nothing else
- **Does not:** generate artifacts, edit files, commit, run commands
- **Default agent:** Grok | **Default model:** Grok frontier
- **Enforced:** read-only. The system injects a read-only constraint into every Grok invocation via `agent-job.sh`. A Reviewer job that edits a file is a system-level violation, not just a guideline.
- **Why Grok:** structural independence from the Generator. Different model, different
  architecture, different training, different failure modes. Grok reviews because it never
  generates. This is strongly recommended — not enforced by the system, but deviating defeats the purpose of the review cycle.

---

**Planner** — structured derivation and triage
- **Does:** task-gen, make-plans, task triage recommendations, plan triage recommendations,
  code triage recommendations (the *recommendation* phase — deciding what to fix, not fixing it)
- **Does not:** review, write production code
- **Default agent:** AGY | **Default model:** Sonnet
- **Why Sonnet:** structured reasoning from well-defined inputs. The inputs (specs, review
  findings) are already organized; the output (tasks, plans, recommendations) is structured.
  Creative synthesis is not required — careful derivation is.
- **Note:** Spec triage is Architect role, not Planner — fixing a spec requires architectural
  judgment equal to what wrote it.

---

**Coder** — execution
- **Does:** implement from plans, write tests, apply approved triage fixes (the *execution*
  phase — actually making the changes the Planner recommended)
- **Does not:** review, design, plan
- **Default agent:** AGY | **Default model:** Flash (mechanical) or Sonnet (judgment required)
- **Model decision rule:**
  - Plan is highly detailed + work is mechanical → Flash sufficient
  - Plan leaves judgment calls not fully specified → Sonnet required
- **Key insight:** The Planner's job is to write plans detailed enough that Flash can execute
  them. Plan quality determines execution cost downstream.

---

**Approver** — strategic gate
- **Does:** approve or reject at spec gates and plan gates; resolve escalations
- **Does not:** generate, review, implement
- **Default:** Human (interactive mode) | Director agent (full-auto mode)
- **Input:** Architect or Planner triage recommendations — never raw Reviewer findings
- **Gate interface is identical regardless of mode.** Only the approver changes.

---

### Role → pipeline step mapping

```
Pipeline Step         Role          Agent    Model
────────────────────  ────────────  ───────  ────────────────
research-to-features  Architect     AGY      Opus
spec-write/refine     Architect     AGY      Opus
spec-review           Reviewer      Grok     Grok frontier
spec-triage           Architect     AGY      Opus
[SPEC GATE]           Approver      Human / Director
task-gen              Planner       AGY      Sonnet
task-review           Reviewer      Grok     Grok frontier
task-triage           Planner       AGY      Sonnet
make-plans            Planner       AGY      Sonnet
plan-review           Reviewer      Grok     Grok frontier
plan-triage           Planner       AGY      Sonnet
[PLAN GATE]           Approver      Human / Director
implement             Coder         AGY      Flash / Sonnet
test-cycle            Coder         AGY      Flash
code-review           Reviewer      Grok     Grok frontier
code-triage (rec.)    Planner       AGY      Sonnet
code-triage (exec.)   Coder         AGY      Flash / Sonnet
```

---

## 2.8 Agent Tiers and LLM Tiers

Capability is two-dimensional: `Agent Tier × LLM Tier`.
A T3 agent with Opus is not the same as a T1 agent with Sonnet.
The scaffolding, context management, and tool reliability are independent of the model.

All assignments below are **recommended defaults**. Any step can be overridden per product or pipeline run in the daemon config. Deviating from recommendations is permitted — consequences are documented below.

### LLM Tiers

| Tier | Models | Cognitive Strength |
|------|--------|-------------------|
| **L1 — Frontier reasoning** | Claude Opus 4, Grok 4 | Deep synthesis, architectural judgment, ambiguity resolution |
| **L2 — Strong structured** | Claude Sonnet 4.5, Gemini 2.5 Pro | Structured derivation, planning, triage, complex code |
| **L3 — Fast execution** | Gemini 2.5 Flash, Claude Haiku | Mechanical execution from detailed specs, test running, boilerplate |

### Agent Tiers

| Tier | Agents | Strengths | Limits |
|------|--------|-----------|--------|
| **A1 — IDE/CLI** | AGY, Grok | Multi-step, full tool use, large coherent context, error recovery, git integration | Cost, latency |
| **A2 — Coding agents** | Aider, Goose | Solid file-level coding, git-aware, follows detailed plans reliably | Limited planning, weaker at abstraction, context drift on long tasks |
| **A3 — Capable** | Kilo/KiloCode, Cursor baseline | Mechanical tasks with explicit instructions, low setup cost, fast | Context drift on complex tasks, weaker tool use, poor error recovery |

### Recommended minimum agent tier per role

| Role | Min Agent Tier | Min LLM Tier | Notes |
|------|--------------|--------------|-------|
| Architect | A1 | L1 | Requires coherent large-context synthesis. A2/A3 drift on abstract work. |
| Reviewer | A1 (Grok only) | L1 | Strongly recommended — deviating defeats Reviewer-Generator Separation. The read-only constraint is enforced; the agent assignment is configurable. |
| Planner | A1 | L2 | A2 possible if plan templates are rigidly structured; A3 unreliable. |
| Coder (complex) | A1 or A2 | L2 | Aider/Goose viable when plan is detailed and task is well-bounded. |
| Coder (mechanical) | A1, A2, or A3 | L3 | **Kilo's natural home.** Template + explicit spec + clear test = reliable. |
| Test runner | A2 or A3 | L3 | Kilo can run tests and parse output. No reasoning required. |
| Approver (Director) | A1 | L1 | Strategic decisions require full context, coherent judgment, and tool access. |

### The Kilo principle

Kilo and similar T3 agents are not weak — they are appropriately matched to mechanical work.
The failure mode is not using Kilo; it is using Kilo for work that requires judgment.

A T3 agent on a mechanical task with a highly detailed plan will produce correct output.
A T3 agent on an underspecified task will produce output that *looks* correct and fails
on intent — and it will not detect the mismatch.

**This is why plan quality is a first-class concern:** plans are not just for T1 agents.
A Planner writing plans must write them to the capability of the intended Coder agent.
If the Coder is Kilo, the plan must leave zero judgment calls open.

### Capability degradation warning

```
Scenario: T1/L1 plan, T3/L3 coder
  Result: usually fine — plan is over-specified for the coder, nothing is lost

Scenario: T1/L2 plan (judgment required), T3/L3 coder
  Result: Kilo produces plausible-looking output; misses intent; tests may still pass
  Detection: only caught by code-review (Reviewer) or failing spec tests

Scenario: T3/L3 agent in Reviewer role
  Result: review misses subtle issues; looks like "all clear" — cannot be detected
  Mitigation: assign Grok as Reviewer (strongly recommended default). Configurable but not advisable.
```

---

## 2.9 Core Principle: Multi-Provider Review

> **Independent reviewers must come from different providers.**
> Same model called twice = same training = same blind spots. That is not review diversity; it is noise.
> True structural independence requires different companies, different training corpora, different architectures.

### Why two reviewers find different things

A review is only as good as the reviewer's reference frame. Different models have:
- Different training data cutoffs and corpora → different domain knowledge
- Different architectural choices → different reasoning patterns
- Different fine-tuning objectives → different things they look for

Two independent reviewers from different providers produce reviews that are *complementary*, not redundant.
The union of two independent reviews covers significantly more ground than either alone.

This was observed empirically: AGY performed *content analysis* (logical consistency of acceptance criteria),
Grok performed *contract analysis* (cross-referenced the format spec and protocol docs). Both found real issues
the other missed. Neither review alone was sufficient.

### Default dual-reviewer configuration

| Slot | Agent | Provider | Model family | Role |
|------|-------|----------|-------------|------|
| Reviewer 1 | Grok CLI | xAI | Grok | Contract/schema analysis |
| Reviewer 2 | Claude Code | Anthropic | Claude | Coherence/coverage analysis |

The generator (AGY) uses Gemini (Google). All three providers are independent.

**Reviewer-Generator Separation extended:**
- Reviewers must be independent of the generator (different provider)
- Reviewers must be independent of *each other* (different provider)
- Same model called twice with different prompts is NOT dual review

### When to use dual review

| Artifact | Dual review? | Rationale |
|----------|-------------|-----------|
| Specs | **Yes** | Highest stakes — schema violations and contract gaps propagate through everything |
| Plans | Recommended | Expensive to fix after implementation starts |
| Code | Single review + tests | Test suite provides the independent signal; one review is sufficient |
| Tasks | Single review | Derived directly from approved specs; single review is usually sufficient |

### The merge step

No separate merge step is needed. The Triage agent (AGY) reads *all* review documents and synthesizes them:
- Finding caught by both reviewers → high confidence, fix immediately
- Finding caught by one reviewer → standard confidence, fix or defer
- Conflicting findings → escalate to human gate

The triage output is a single unified recommendation set, regardless of how many reviews were produced.

### Invoking reviewers

```bash
# Reviewer 1: Grok (in the artifact directory)
grok
> Review specs S-011..S-015 plus feature-spec-format.md and pipeline-signal-protocol.md.
> Create grok-spec-review.md. Be adversarial. Read-only — do not edit any existing files.

# Reviewer 2: Claude Code (in the artifact directory)
claude -p --disallowedTools "Bash" \
  "Review specs S-011..S-015 plus feature-spec-format.md and pipeline-signal-protocol.md.
   Create claude-spec-review.md. Be adversarial. Read-only — create the review file only."

# Triage: AGY reads both reviews, produces unified recommendations
# Then: [SPEC GATE] human approves triage recommendations
```

---

## 3. The Front Door: `research-to-features` Skill


**Why features first (not tasks first):**
- Features ≈ User Stories — they describe WHAT the product can do, from the user's perspective
- Specs formalize features into contracts — precise, testable, stable
- Tasks are derived FROM specs — they describe HOW to implement
- Tests verify FEATURES (via spec), not tasks — they survive task restructuring
- "We don't derive features from tasks" — features come first

**The skill:**
```
skill: research-to-features
Input:  research/discovery doc (or folder of docs)
        optionally: "focus on X" or "keep scope to N features"

Step 1: Extract features (≈ user stories)
  → reads doc → identifies user-visible capabilities
  → writes to feature-registry.yaml (status: planned)
  → each feature: id, name, description (1-3 paragraphs, loose)

Step 2: Write spec for each feature (1 feature → 1 spec)
  → specs/F-XXX-{name}.md
  → acceptance criteria (MUST / MUST NOT)
  → high-level tasks (coarse decomposition, human-readable)
  → test contract (what tests must verify)

Step 3: Report
  → "Extracted 2 features: F-041 dark-mode, F-042 theme-persistence"
  → "Specs written to specs/. Review before proceeding."

Invocation (IDE):
  AGY: "use research-to-features on docs/research/dark-mode.md"
```

**After the skill runs — the SPEC REVIEW GATE:**
You read the specs and approve them: "yes, this is what I want built."
This is your primary approval point. After this, automation takes over.
Specs become the source of truth that everything else is derived from.

**Then the pipeline continues (automated):**
```
[specs approved] → make-plans:
    reads spec high-level tasks
    derives detailed tasks (1-N per spec high-level task)
    writes tasks to tasks/future/{product}-{phase}.md
    creates plans for each task
→ [plan review GATE] → implement → tests verify spec → code review → shipped
```

**Ordering principles the skill applies to features and high-level tasks:**
1. Infrastructure before features (can't build on sand)
2. Data model before API (API shape follows schema)
3. API before UI (UI calls API)
4. Core capability before optional variants
5. Dependencies before dependents

**Location:** `synapse/skills/research-to-features/SKILL.md` — Phase 1 task.

---

## 4. Runtime Architecture

### 4.0 CLI — The Primary Interface

**CLI IS the API. Every pipeline action has a CLI command. GUI (when built) is a client of the CLI/REST API.**

```bash
synapse products                           # list all products + pipeline status
synapse add <path>                         # register product
synapse start <product>                    # start pipeline run (serial mode)
synapse start <product> --accelerate       # start in parallel execution mode
synapse stop <product>                     # graceful stop (finish current step)
synapse stop --all                         # graceful stop all running pipelines
synapse resume <product>                   # resume from checkpoint (after escalation fix)
synapse accelerate <product>               # switch running pipeline to parallel mode
synapse decelerate <product>               # switch back to serial mode
synapse inbox                              # show ALL waiting notifications across all products
synapse inbox --count                      # just the number (for scripts/status bars)
synapse approve <run-id> [--note "..."]    # approve gate
synapse reject <run-id> --note "..."       # reject gate (--note REQUIRED, empty reject forbidden)
synapse retry <run-id> [--note "..."]      # retry a failed step (with optional feedback)
synapse skip <run-id> --note "..."         # skip a failed step and continue
synapse continue <run-id>                  # continue after manual fix (conflict, schema fix)
synapse acknowledge <run-id>              # dismiss informational notification (PIPELINE_COMPLETE)
synapse status [<product>]                 # current run state + step
synapse logs <run-id>                      # read crash/failure output for a run
synapse artifacts <product> [--type spec|plan|review|task|gate|triage]
synapse archive <product>                  # stop + hide product (preserves history)
synapse remove <product>                   # remove from registry (files stay in git)
```

**If a GUI action has no CLI verb, it is not done.**

### 4.1 One Daemon, Per-Product Pipeline Runs

**Decision: No central scheduler. One shared daemon.**

Each product's pipeline is independent — its own workflow run, own state,
own convergence loop. But there is ONE daemon process managing all of them.

**Why no central scheduler:**
- Scale is small: 2-3 products, 1-2 active at a time
- Real bottleneck is human attention at approval gates, not compute
- Pipelines spend most time waiting (gates, polling, LLM calls) — not competing
- One daemon is simpler to manage, restart, monitor

**Why not one process per product:**
- N daemons to restart after reboot
- More overhead for the same work
- The per-product independence is at the RUN level, not the PROCESS level

```
ONE Synapse Daemon (single process)
├── REST API (port 4042) — receives commands from GUI / CLI
│     POST   /products                   register product
│     DELETE /products/:id               archive/remove product
│     POST   /products/:id/pipeline/start  start pipeline run
│     POST   /products/:id/pipeline/stop   graceful stop
│     POST   /products/:id/pipeline/resume resume from checkpoint
│     POST   /products/:id/pipeline/approve  pass gate
│     POST   /products/:id/pipeline/reject   reject gate (with feedback)
│     GET    /products                   list all with pipeline status
│     GET    /products/:id/pipeline      current run state + step
│
├── Workflow executor — runs active pipeline steps
│     polls synapse.db every ~5s for pending steps
│     spawns agy/grok subprocesses per step
│     reads PIPELINE_SIGNAL / TESTER_SIGNAL from output artifacts
│     updates run state after each step
│
└── State manager — persists everything
      synapse.db: products, pipeline_runs, jobs, artifacts index
      syncs repos.yaml ↔ DB on startup and on product add/remove
```

### 4.2 Product Lifecycle

```
Add product (GUI or CLI):
  → POST /products { name, path, type, ... }
  → Daemon: registers in DB, reads repos.yaml from that repo
  → Indexes that repo's tasks, features, specs
  → GUI: product appears in sidebar ○ Stopped [Start]

Start pipeline:
  → POST /products/synapse/pipeline/start
  → Daemon: creates pipeline run record in DB
  → Daemon: begins step 1 (task-review)
  → GUI: ● Running  Step 1/7

Stop pipeline (graceful):
  → POST /products/synapse/pipeline/stop
  → Daemon: finish current step, don't start next
  → Daemon: checkpoint saved in DB
  → GUI: ○ Stopped [Resume]  (not [Start] — it was mid-run)

Archive product:
  → Daemon: graceful stop first (if running)
  → Daemon: marks product archived in DB
  → repos.yaml: product marked inactive
  → GUI: product disappears from sidebar
  → Historical data preserved (all runs, reviews, plans)

Remove product (destructive):
  → Separate confirmation dialog ("Really delete everything?")
  → Removes from DB and repos.yaml
  → Historical artifacts NOT deleted from filesystem (git history)
```

**Archive vs Remove:** Archive = stop + hide. Remove requires explicit confirmation.
Both actions available via CLI: `synapse archive <product>` / `synapse remove <product>`.

### 4.3 Graceful Stop

```
synapse stop <product>

1. Daemon sets pipeline run status: 'stopping'
2. Currently running specialist job (agy/grok) runs to completion
3. Daemon does NOT start the next pipeline step
4. When specialist job finishes → run status: 'stopped', checkpoint saved
5. CLI: synapse status shows ○ Stopped

synapse stop --all:
  → iterate over all running pipeline run IDs
  → send graceful stop to each
  → terminal: "Draining N pipelines..."
  → When all drained: "All stopped ✓"
```

### 4.4 Reboot / Restart Behavior

**State is DB-backed — the daemon is disposable.**

```
Machine reboots:
  → systemd starts synapse daemon (or manual: tmux + bun run synapse daemon)
  → Daemon reads products table from DB
  → Daemon reads pipeline_runs table
  → For each run where status was 'running':
      DEFAULT: stays 'stopped' — user must click [Resume]
      OPTIONAL: per-product "auto-resume" toggle in DB
  → Resumes from last COMPLETED step (no re-running done work)
```

**Dev mode (current):** tmux session, manual restart.
**Production:** systemd unit file:
```ini
[Unit]
Description=Synapse Pipeline Daemon
[Service]
ExecStart=bun run --cwd /home/k82l0804/workarea/fox synapse daemon
Restart=on-failure
[Install]
WantedBy=multi-user.target
```

### 4.5 Execution Mode: Serial (default) vs Accelerate

**Default: Serial.** One task at a time, topological dependency order.
Predictable, easy to debug, no branch conflicts.

**`--accelerate` mode.** All tasks whose `depends_on` are satisfied run simultaneously.
Faster. Requires feature branches (enforced by dispatcher).

```
Serial (default):
  T-001 done → T-002 starts → done → T-003 starts → done → T-004

Accelerate:
  T-001 done → T-002 + T-003 start simultaneously (both depend only on T-001)
               both done → T-004 starts
```

**Accelerate safety rules:**
- Only tasks where ALL `depends_on` are `done` can start
- If any parallel task hits `ESCALATE` → don’t start NEW tasks, let running ones finish, halt
- Branches mandatory in accelerate mode: `work/{run-id}-{task-id}`, enforced by dispatcher
- DB: `pipeline_runs.execution_mode TEXT DEFAULT 'serial'`

### 4.6 Branch Policy

**Feature branches from the start: `work/{run-id}-{task-id}`**

- No extra cost in serial mode (one branch active at a time)
- Required for accelerate mode (parallel agents can’t share a branch)
- Rollback = checkout, not archaeology
- Merge to main after triage passes + gate approved
- `rotate-phase` only after all tasks in phase merged + spec tests green on main

### 4.7 Data Reconciliation Rules

Five locations where feature state can exist:
`repos.yaml` | `synapse.db` | `feature-registry.yaml` | `tasks/*.md` | `specs/*`

**Conflict resolution (written down, enforced):**

```
1. Files win on CONTENT. Always. Markdown is the record.
2. DB wins on OPERATIONAL STATE (running, waiting, pid, current_step).
3. On daemon start: scan files → rebuild DB index.
   If DB says 'shipped' but file says 'planned' → loud mismatch report, halt.
4. IDs are immutable. Renames = new ID + explicit alias field.
5. Agents may NOT write status in two places:
   - Planner writes task markdown (content)
   - Daemon writes jobs/pipeline_runs (state). Never both.
6. Human-written research stays human:
   Pipeline reads docs/research/ but NEVER rewrites it.
```

### 4.8 LLM Rate Limits

No explicit rate limiting needed at small scale (2-3 products).
Provider handles 429 → retry with exponential backoff in each run.

### 4.9 Notification System

**Core principle:** You don't dismiss notifications — you resolve the underlying situation,
and the daemon clears the notification as a side effect of the state transition.
A blocking notification cannot be dismissed without resolving the underlying problem.

#### The primitive: WAITING file

```
{repo}/.local/pipeline/WAITING
```

Written when the daemon enters a waiting state. Deleted when it exits.
Content:
```
type: GATE_WAITING
run: run-123
task: T-001 dark-mode-css-variables
gate: plan-review
since: 2026-09-28T10:30:00Z
evidence: .local/pipeline/GATE-run-123.md
```

#### How you observe it

Choose one that fits your workflow (one-time setup):

```bash
# Option 1: Pull (zero setup)
synapse inbox                       # run whenever you want to check

# Option 2: tmux status bar (one-time)
# ~/.tmux.conf:
set -g status-right '#(synapse inbox --count 2>/dev/null)'
# Shows "2 GATES" in bar, refreshes every 15s

# Option 3: Desktop notification (one-time)
while inotifywait -q -e create ~/.synapse-work/*/WAITING; do
  notify-send "Synapse" "$(synapse inbox --count) gate(s) waiting"
done

# Option 4: Terminal bell
# Daemon writes \a to stdout when a gate fires.
# tmux bell-action other → flashes the window tab.
```

The daemon doesn't know or care which option you use. It writes the file.
Do not invent a notification product. Hook what you already watch.

#### Notification types and resolution

| Type | Urgency | Pipeline blocked? | Resolution command |
|------|---------|------------------|--------------------|
| `GATE_WAITING` | 🔴 HIGH | Yes | `synapse approve` or `synapse reject --note` |
| `ESCALATED` | 🔴 HIGH | Yes | Do work first → `synapse resume` |
| `MERGE_CONFLICT` | 🔴 HIGH | Yes | Resolve conflict → `synapse continue` |
| `TASK_FAILED` | 🟠 MEDIUM | Yes | `synapse retry` or `synapse skip --note` |
| `SCHEMA_VIOLATION` | 🟠 MEDIUM | Yes | `synapse retry --note` or fix + `synapse continue` |
| `PIPELINE_COMPLETE` | 🟢 LOW | No | Auto-expires 24h or `synapse acknowledge` |

#### Resolution scenarios

**GATE_WAITING (spec review, plan review):**
```
You read the evidence pack: synapse artifacts <product> --type gate

Case A: looks right
  synapse approve <run-id>
  → Daemon proceeds to next step, deletes WAITING

Case B: wrong — agent should regenerate
  synapse reject <run-id> --note "high-level tasks too code-level"
  → Daemon writes feedback.md, agent regenerates
  → New GATE notification appears when new artifact is ready

Case C: mostly right, you know the fix
  (edit the spec/plan file directly in IDE, commit)
  synapse approve <run-id> --note "manually amended before approval"
  → Daemon picks up corrected file, proceeds
```

**ESCALATED (triage hit 3 iterations):**
```
You read: synapse artifacts <product> --type triage

Understand what's stuck. Then do the work (may take hours):
  A. Code is wrong → fix it, commit
  B. Tests are wrong → fix expectations, commit
  C. Spec is ambiguous → clarify spec, commit
  D. Task too large → split task, update task file, commit

After fixing:
  synapse resume <product>
  → Daemon replays from last completed step
  → WAITING deleted — notification gone
  → If it fails again: new ESCALATED appears
```

**TASK_FAILED (subprocess crashed, no signal written):**
```
synapse logs <run-id>    # read crash output

  A. Transient (API timeout, etc.)
     synapse retry <run-id>

  B. Environment issue (missing key, wrong path)
     Fix environment → synapse retry <run-id>

  C. Persistent failure, skip this step
     synapse skip <run-id> --note "reason"
     → Daemon marks step skipped, moves to next step
```

**SCHEMA_VIOLATION (agent output failed schema check):**
```
  A. Agent can probably fix it if told what's wrong
     synapse retry <run-id> --note "spec stub F-041 missing MUST/MUST NOT section"

  B. Faster to fix it yourself
     (edit the artifact file in IDE)
     synapse continue <run-id>    # daemon re-validates, proceeds if clean
```

**MERGE_CONFLICT (accelerate mode only):**
```
  (manually resolve the conflict in the files)
  git add -A && git commit -m "resolve merge conflict: T-002/T-003 token overlap"
  synapse continue <run-id>
  → Daemon verifies merge is clean, proceeds with next tasks
```

**PIPELINE_COMPLETE (informational):**
```
  No action required. Pipeline is done.
  synapse acknowledge <run-id>    # optional: explicitly clear from inbox
  OR: auto-expires from inbox after 24h
```

#### Who clears the notification

The daemon clears the notification. You can't dismiss without resolving.

```
Blocking notification lifecycle:
  Daemon enters waiting state → writes WAITING → appears in inbox
  You do the work (seconds to hours)
  You run the resolution command
  Daemon transitions state → deletes WAITING → disappears from inbox

Informational notification lifecycle:
  Daemon writes WAITING (type: PIPELINE_COMPLETE)
  Appears in inbox
  synapse acknowledge <run-id>  OR  auto-expires 24h
  Daemon deletes WAITING → disappears from inbox
```


## 5. State / Storage

### Two sources of truth

| What | Where | Canonical for |
|------|-------|--------------|
| Content (what a task says, what a plan says) | Filesystem (markdown) | Task/plan/spec/review content |
| State (status, priority, relationships) | synapse.db (SQLite) | Pipeline runs, product status, pointers |
| Config (which repos are registered) | repos.yaml | Product registry |

**The DB is an index over the files, not a replacement.**
Files are human-readable, git-versioned, agent-readable.
The DB is the operational layer — status changes without file renames.

### synapse.db tables

```sql
products (
  id, name, path, type,
  portfolio_status,    -- 'active' | 'deferred' | 'archived'
  pipeline_enabled,    -- bool: daemon will run this product's pipeline
  pipeline_status,     -- 'idle' | 'running' | 'waiting' | 'stopping' | 'stopped'
  current_run_id,      -- FK → pipeline_runs
  priority,            -- portfolio ordering
  auto_resume          -- bool: resume on daemon restart?
)

pipeline_runs (
  id, product_id, workflow_type,  -- 'plan' | 'implement' | 'full'
  status, current_step, total_steps,
  started_at, stopped_at, completed_at,
  last_signal         -- most recent PIPELINE_SIGNAL value
)

jobs (
  id, run_id, step_name, specialist,  -- 'agy' | 'grok'
  status, pid, started_at, completed_at,
  output_path         -- path to the artifact doc this job produced
)

artifacts (
  id, product_id, run_id,
  type,               -- 'task' | 'plan' | 'review' | 'triage' | 'spec' | 'feature'
  file_path,          -- absolute path to the markdown file
  status,             -- 'pending' | 'active' | 'done' | 'archived'
  created_at
)

signals (
  id, run_id, job_id,
  signal_type,        -- 'PIPELINE_SIGNAL' | 'TESTER_SIGNAL'
  auto_fix, escalate, -- from PIPELINE_SIGNAL
  pass, fail, skipped, typecheck  -- from TESTER_SIGNAL
  received_at
)
```

### Per-repo file layout contract

**Core principle: Content belongs to the repo. Tooling machinery belongs to `.synapse/`.**

If you stop using Synapse, `rm -rf .synapse/` removes the engine.
All your tasks, plans, specs, reviews, and research remain untouched in git.
You can re-add to Synapse later (`synapse add ./`) and it recreates `.synapse/` from scratch.

**Guiding principle for placement:**
- `docs/` = **stable, referential** artifacts (specs are stable once approved; research never changes)
- Root-level dirs = **pipeline artifacts with a lifecycle** (tasks, plans, reviews are produced, actioned, then archived)

**Content directories — committed to git, survive tool removal:**

```
{repo}/
├── AGENTS.md                           ← constitution (IDE/git convention)
├── feature-registry.yaml               ← feature registry (config, like package.json)
│
├── tasks/                              ← work queue: drives what happens next
│   ├── current/phase-{N}.md            ← active sprint tasks
│   ├── future/phase-{N}.md             ← queued phases
│   ├── done/phase-{N}.md               ← completed phases (archived)
│   └── deferred/                       ← deferred items (one file per item, immutable)
│
├── plans/                              ← implementation blueprints: how to do it
│   ├── current/                        ← active plans
│   └── done/                           ← archived (moved when task done)
│
├── reviews/                            ← pipeline review artifacts: what was found
│   ├── spec/                           ← Grok spec reviews: YYYY-MM-DDTHH-MM_F-XXX-iter{N}.md
│   ├── plan/                           ← Grok plan reviews: YYYY-MM-DDTHH-MM_T-XXX-iter{N}.md
│   ├── code/                           ← Grok code reviews: YYYY-MM-DDTHH-MM_T-XXX-iter{N}.md
│   ├── triage/                         ← AGY triage reports: YYYY-MM-DDTHH-MM_T-XXX-iter{N}.md
│   └── feedback/                       ← human rejection notes (MUST be read before next iter)
│       └── YYYY-MM-DDTHH-MM_{type}-{id}.md
│
├── specs/                              ← pipeline writes: feature specs F-XXX-name.md (STABLE)
│
└── docs/                               ← HUMAN WRITES ONLY — Synapse reads but never writes
    ├── research/                       ← human-authored research (READ-ONLY to agents)
    └── refactor/                       ← rationale docs for refactor tasks (optional)
```

**The single rule:** Who writes to this directory as part of the pipeline?
- **Pipeline writes → root-level dir** (`tasks/`, `plans/`, `reviews/`, `specs/`)
- **Human writes → `docs/`** (Synapse reads `docs/` but never writes to it)

`feature-registry.yaml` is the index (like `package.json`) — pipeline manages it, lives at root.
`AGENTS.md` is the constitution — human writes it, lives at root (IDE convention).

**Why `specs/` is NOT in `docs/`:** `research-to-features` writes spec stubs there. Pipeline writes = root.
**Why `docs/research/` IS in `docs/`:** Human writes only, never modified by pipeline.
**Why `docs/refactor/` IS in `docs/`:** Human writes rationale, never generated by pipeline.

**At phase rotation:** optionally archive old reviews to `reviews/archive/phase-{N}/` — the daemon
does this automatically when rotating. All reviews remain in git; they're never deleted.

**`.synapse/` — operational ONLY, safe to delete:**

```
{repo}/
└── .synapse/
    └── run/                            ← GITIGNORED — entire directory
        ├── WAITING                     ← written when gate is waiting, deleted when resolved
        ├── GATE-{run-id}.md           ← evidence pack per gate
        ├── pipeline.pid               ← daemon PID for this product
        └── logs/                      ← per-step execution logs (rotated, last 30 days)
```

Nothing of value lives in `.synapse/`. It is recreated fresh by `synapse add ./`.

**Worktrees — OUTSIDE the repo, adjacent:**

```
{workspace}/
└── .synapse-work/
    └── {product-name}/
        └── {run-id}-{task-id}/        ← isolated git worktree per task run
```

Worktree root: `{product.path}/../.synapse-work/{product-name}/`
Never inside the repo (avoids `.gitignore` and submodule conflicts).

**`.gitignore` entry `synapse add` appends (one line):**

```gitignore
.synapse/run/
```

**Conflict handling:** If a repo already has a `tasks/` (e.g. build system tasks)
or `specs/` for something else, override the defaults in `repos.yaml`:

```yaml
products:
  my-repo:
    tasks_path: .sdlc/tasks/    # override if tasks/ conflicts
    reviews_path: .sdlc/reviews/ # override if reviews/ conflicts
    docs_path: .sdlc/docs/      # override if docs/ conflicts
    plans_path: .sdlc/plans/    # override if plans/ conflicts
```

The daemon resolves all paths from `repos.yaml` + these overrides. Rare in practice.


---

### `synapse add <path>` behavior

```
1. Validate <path> is a git repo
2. Create missing required directories (mkdir -p)
3. Create empty feature-registry.yaml if missing
4. Create AGENTS.md from synapse constitution template IF AND ONLY IF none exists
   (never overwrite existing AGENTS.md — repo may have its own constitution)
   If AGENTS.md exists: print "NOTE: add a Synapse section to your existing AGENTS.md"
5. Append .synapse/run/ to .gitignore (idempotent — check first)
6. Register product in repos.yaml at the synapse root
```

---

### `repos.yaml` format

```yaml
products:
  fox-cli:
    path: ../fox-code-cli               # ALWAYS relative to synapse root — portable across machines
    test_command: bun run test:smoke
    build_command: bun run build
  synapse:
    path: .                             # synapse manages itself
    test_command: bun run test
    build_command: bun run build
```

Paths are always relative to the synapse root. This makes `repos.yaml` portable —
clone the workspace on a different machine with the same layout and it works.
`feature_registry` and all other artifact paths are derived from the product root,
not configured in `repos.yaml` (they're always at the same relative location).

---

### Daemon path resolution

All artifact paths are computed from `repos.yaml` + product root. No hardcoded paths.
Path keys can be overridden per product in `repos.yaml` (see conflict handling above).

```
product_root   = resolve(synapse_root, repos.yaml[product].path)
tasks_root     = {product_root}/{tasks_path:-tasks}
plans_root     = {product_root}/{plans_path:-plans}
reviews_root   = {product_root}/{reviews_path:-reviews}
specs_root     = {product_root}/{specs_path:-specs}
docs_root      = {product_root}/{docs_path:-docs}

spec_path      = {specs_root}/{filename}                   # F-XXX-name.md (stable, pipeline writes)
research_path  = {docs_root}/research/{filename}           # human docs, pipeline reads only
task_path      = {tasks_root}/current/{phase}.md
plan_path      = {plans_root}/current/{filename}
deferred_path  = {tasks_root}/deferred/   # create new file per item, never append to existing

review_path    = {reviews_root}/{type}/{filename}          # type: spec|plan|code|triage
feedback_path  = {reviews_root}/feedback/{filename}        # human rejection notes

registry_path  = {product_root}/feature-registry.yaml
waiting_path   = {product_root}/.synapse/run/WAITING
gate_path      = {product_root}/.synapse/run/GATE-{run-id}.md
log_path       = {product_root}/.synapse/run/logs/{date}/{step}.log
worktree_path  = {product_root}/../.synapse-work/{product-name}/{run-id}-{task-id}
```

---

### Additional design rules (things that break if you don't decide)

**1. Spec filenames are STABLE — no timestamp prefix.**
Specs are referenced by path from plans and tasks. If the filename changed on edit,
all references would break. Exception to the AGENTS.md timestamp rule:

```
specs/F-041-dark-mode.md                            ← stable ID-based name, never changes
reviews/plan/2026-09-28T10-30_T-001-iter1.md             ← timestamp OK (not referenced by path)
reviews/feedback/2026-09-28T11-00_spec-F-041.md          ← feedback: read by next specialist
plans/current/2026-09-28T10-00_plan-F-041.md             ← timestamp OK (short-lived)
```

**2. `repos.yaml` is gitignored if paths would be machine-specific.**
Since paths are relative to synapse root and workspace layout is consistent,
`repos.yaml` IS committed. If you need machine-specific overrides: `repos.local.yaml`
(gitignored). Daemon loads `repos.local.yaml` over `repos.yaml` if it exists.

**3. `synapse.db` lives at the synapse root and is gitignored.**
It is the operational index — rebuilt from file system on daemon start.
Committing it would create noisy commits on every pipeline run.

```gitignore
# In synapse/.gitignore:
synapse.db
synapse.db-shm
synapse.db-wal
```

**4. Branch naming creates remote noise — clean up after merge.**
`work/{run-id}-{task-id}` branches accumulate in the remote if you push them.
Daemon deletes the local branch after merge. Policy for remote branches:
- Don't push `work/` branches to remote unless you need backup (solo use case: you don't)
- Add to `.gitignore` equivalent for push: `git config push.default current`
  then never `git push --all`

**5. Log rotation — prevent unbounded growth.**
`.synapse/run/logs/` rotated automatically: keep last 30 days.
Daemon cleans up on start: `find .synapse/run/logs/ -mtime +30 -delete`

**6. Synapse managing itself — the meta case.**
Synapse's own tasks/plans/specs live at `synapse/.synapse/` (not at `synapse/tasks/`).
The existing `synapse/tasks/`, `synapse/docs/`, `synapse/plans/` directories
need to be migrated to `synapse/.synapse/` when the convention is adopted.
This is T-L0-6 (repo initialization) — the first dogfood.

**7. AGENTS.md — the repo contract every specialist reads first.**

Every specialist agent reads `AGENTS.md` before touching any file. It is the
primary source of repo-specific knowledge. Without it, agents guess at conventions
and produce code that doesn't fit the codebase.

`AGENTS.md` has two parts:

- **Repo section** — authored by the repo owner. Describes source layout, conventions,
  commands, architectural rules. Must be written by a human who knows the codebase.
  Agents are good at reading specs and writing code, but they cannot infer
  unstated conventions (import aliases, which layer an API call belongs to,
  what the test harness expects). These must be written down.

- **Synapse pipeline section** — auto-injected by `synapse add`. Describes how this
  repo fits into the pipeline (where artifacts live, what specialists write where,
  what they must not touch). Updated if the Synapse layout changes.

**How `synapse add` handles AGENTS.md:**

```
Case A: No AGENTS.md exists
  → Create AGENTS.md from full template (repo section + Synapse section)
  → Print: "AGENTS.md created. Fill in the repo section TODOs before starting any pipeline."

Case B: AGENTS.md exists, no Synapse section
  → Append the Synapse pipeline section to the end
  → Print: "Synapse pipeline section appended to your existing AGENTS.md."

Case C: AGENTS.md exists, Synapse section already present
  → Do nothing. Already set up.
  → Print: "AGENTS.md already has a Synapse section. No changes made."
```

**`synapse add` auto-detects from the repo and pre-fills `repos.yaml`:**

| Detected | Pre-filled in repos.yaml |
|----------|--------------------------|
| `package.json` | language, runtime, reads `scripts` for build/test/lint |
| `bun.lockb` present | runtime: bun |
| `Cargo.toml` | language: rust, cargo commands |
| `pyproject.toml` | language: python, reads tool.scripts |
| `go.mod` | language: go |

Auto-detected values are annotated `# auto-detected` so you can verify them.

**The `repos.yaml` extended format:**

```yaml
products:
  fox-cli:
    path: ../fox-code-cli          # relative to synapse root — portable
    language: typescript           # auto-detected
    runtime: bun                   # auto-detected
    install_command: bun install
    build_command: bun run build
    test_command: bun run test:smoke
    typecheck_command: bun run typecheck
    lint_command: bun run lint
    entry_point: src/index.ts      # optional — helps agents orient
    src_dirs: [src, packages]      # optional — helps agents find code
    test_pattern: "**/*.test.ts"   # optional — helps tester agent
```

**The full AGENTS.md template `synapse add` generates:**

```markdown
# AGENTS.md — [repo-name]

<!-- ================================================================
  REPO SECTION — written by you, read by every specialist agent.
  Fill in all TODOs before starting any Synapse pipeline.
  Agents cannot infer conventions they haven't been told.
================================================================ -->

## Language & Runtime
Language: [TODO: typescript | python | rust | go | ...]
Runtime:  [TODO: bun | node | cargo | poetry | ...]

## Source Layout
<!-- TODO: Describe where code lives. Be specific — agents use this to
     find the right file before editing. Example: -->
src/:          main application code
packages/:     internal packages (if monorepo)
tests/:        test files
<!-- Add subdirectory descriptions as needed -->

## Commands
<!-- Auto-populated by synapse add. Verify before running. -->
install:    [auto-detected or TODO]
build:      [auto-detected or TODO]
test:       [auto-detected or TODO]
typecheck:  [auto-detected or TODO]
lint:       [auto-detected or TODO]

## Key Conventions
<!-- TODO: What must every agent know before touching this codebase?
     This is the most important section. Examples: -->
<!-- - All imports use @/* alias (maps to src/*) -->
<!-- - Tool registration goes through Tool.make() — never bypass -->
<!-- - Never call Layer.provide() inside request handlers -->
<!-- - Config files are in order of precedence: a.json > b.json -->

## Architectural Rules
<!-- TODO: Constraints that protect the system's integrity.
     If an agent violates these, the code review should catch it.
     Write them as MUST / MUST NOT statements. -->
<!-- MUST: ... -->
<!-- MUST NOT: ... -->

## Anti-Hang Rules (testing)
<!-- Tests must always be non-interactive. Add repo-specific rules. -->
- Run tests with: CI=true timeout 60s [test_command]
- Never run in watch mode
- [TODO: any other repo-specific test constraints]

<!-- ================================================================
  SYNAPSE PIPELINE SECTION — auto-injected by `synapse add`.
  Do not edit the paths below — they are managed by Synapse.
================================================================ -->

## Synapse Pipeline

This repo is managed by Synapse. Pipeline artifacts live in `.synapse/`.

**Artifact locations (all paths relative to repo root):**
- Feature registry:   `feature-registry.yaml`
- Tasks (current):    `tasks/current/`
- Tasks (future):     `tasks/future/`
- Tasks (deferred):   `tasks/deferred/`
- Plans (active):     `plans/current/`
- Specs:              `specs/`
- Research:           `docs/research/`
- Reviews (spec):     `reviews/spec/`
- Reviews (plan):     `reviews/plan/`
- Reviews (code):     `reviews/code/`
- Triage reports:     `reviews/triage/`
- Feedback notes:     `reviews/feedback/`
- Operational state:  `.synapse/run/`  ← NEVER MODIFY, GITIGNORED

**Specialist rules:**
- Planner (AGY): writes to `plans/current/` and `tasks/`
- Coder (AGY): writes to product source code only — NOT to `reviews/`, `docs/`, `plans/`
- Reviewer (Grok): writes to `reviews/{type}/` — READ-ONLY to product source and all other dirs
- Triage (AGY): writes auto-fixes to product source, appends to `tasks/deferred/`
- Human feedback: written to `reviews/feedback/` via `synapse reject` command
- NEVER modify `.synapse/run/` — daemon owns that directory

**Signal format (last line of your artifact output):**
- Pipeline signal: `<!-- PIPELINE_SIGNAL: AUTO-FIX=N ESCALATE=M -->`
- Tester signal:   `<!-- TESTER_SIGNAL: PASS=Y FAIL=N SKIPPED=M TYPECHECK=green|red -->`
- If your step produces neither, the job is treated as TASK_FAILED.

**For full pipeline rules, see the Synapse constitution:**
[synapse/AGENTS.md](../../synapse/AGENTS.md)
```

**Pipeline start guard:** `synapse start <product>` scans `AGENTS.md` for
`[TODO` markers. If any are found, it refuses to start and prints which lines
need to be filled in. You cannot accidentally run agents against an unconfigured repo.

---

## 6. GUI — Dashboard / Viewer / Controller

**The GUI is NOT for creating features, specs, tasks, or plans.** Those happen in the IDE.
**The GUI is for watching, navigating, and controlling.**

All content is markdown files rendered via `react-markdown` + `shiki` (dark theme).
`file://` links open in the editor, not the browser.

### Layout

```
LEFT SIDEBAR: product list with inline pipeline status + [Start]/[Stop] per product
MAIN AREA: tabs per selected product
BOTTOM BAR: status across all products at a glance
```

### Tabs (per product)

| Tab | Content | User action |
|-----|---------|------------|
| **Pipeline** | React Flow convergence graph | Watch + [Approve Gate] |
| **Sprints** | Ordered list of sprints (phases): current + future + done | Navigate, reorder future |
| **Sprint** | Current sprint kanban: features as groups, tasks nested, TODO/IN PROGRESS/DONE | Watch |
| **Backlog** | Deferred features/tasks, priority-ordered | Promote to future sprint |
| **Features** | Feature registry + dossier (spec + tasks + tests rendered inline) | Read + [Run Tests] |
| **Reviews** | All review + triage docs, rendered markdown | Read |

### Sprint tab detail

Features are group headers. Non-feature tasks group by work type.
Tasks always carry their type, optionally carry feature/spec context.

```
SPRINT: Phase 2 — Dashboard & Consolidation   2/7 tasks done

  F-041: Dark Mode                    [IN PROGRESS]   ← feature group
    ✓ T-001: CSS variable system
    ● T-002: Theme toggle              ← pipeline running here
    ○ T-003: Persistence

  REFACTORS                           [TODO]          ← type group (no feature)
    ○ T-010: Move MCP to synapse/src/mcp/
    ○ T-011: Generalize MCP registry

  CHORES                              [TODO]
    ○ T-012: Update AGENTS.md
```

### Sprints tab detail (plural — list of all sprints)

Three sections in order:
```
CURRENT SPRINT  Phase 1 — Self-Hosting Bootstrap  (summary card)

FUTURE SPRINTS  (planned order — the pipeline of upcoming work, draggable)
  ▶ Phase 2 — Dashboard & GUI
  ▶ Phase 3 — Multi-repo Support

DONE SPRINTS    (collapsed, expandable)
  ▶ Phase P0 — Pipeline Validation · completed 2026-09-28
```

### Features tab — dossier panel

Click a feature → right panel shows:
```
F-041: Dark Mode
Status: IN PROGRESS  Priority: HIGH

SPEC (rendered markdown)
  specs/F-041-dark-mode.md            [open]
  ┌─ Contract: MUST support dark/light...───┐
  └─────────────────────────────────────└

TASKS (derived from spec)
  ✓ T-001: CSS variables     → [view task + plan]
  ● T-002: Toggle component  → [view task + plan]
  ○ T-003: Persistence       → [view task + plan]

TESTS
  dark-mode.test.ts           ✓ passing [open]
  [Run Feature Tests] button
```

### The [Approve Gate] button

Appears in amber when pipeline is waiting at a human gate.
Gates fire at: spec review, plan review, (optionally) final.
You read the artifacts in the GUI, then Approve or Reject.
Reject optionally includes feedback text → written to feedback file → agent reads it.

---

## 7. Named Entities (Data Model) — FINALIZED

> Direction of derivation: Research → Features → Specs → Tasks → Plans → Code
> We do NOT derive features from tasks.

### 7.1 Repo
**Definition:** A tracked product codebase managed by Synapse.
**Storage:** `repos.yaml` (config) + `products` table in synapse.db (runtime)
**Lifecycle:** `registered → active → paused → archived`

### 7.2 Feature (≈ User Story)
**Definition:** A user-visible capability of the product. The primary semantic unit.
A Feature is a User Story that has been engineering-formalized with an ID, a spec,
code tags, test files, and a tracked status.
**Storage:** `{repo}/docs/feature-registry.yaml`
**Tag in code:** `// @{product}-feature {ID}`
**Lifecycle:** `planned → in-progress → shipped → deprecated`
**1 Feature → 1 Spec** (if something needs N specs, it should be N features)
**1 Feature → 1-N Tasks** (feature ships when ALL its tasks are done + spec tests green)
**Format:**
```yaml
- id: F-041
  name: dark-mode
  description: App supports dark/light mode with user preference  # ≈ the user story text
  status: in-progress
  spec: specs/F-041-dark-mode.md
  tasks: [T-001, T-002, T-003]   # derived from spec, updated by planner
  test_files: [test/dark-mode.test.ts]
```

### 7.3 Spec (1 per Feature)
**Definition:** The formal contract for a feature. The source of truth.
Everything downstream (tasks, plans, tests) is derived from the spec.
Written by the research-to-features skill, refined by agent + human.
**Storage:** `{repo}/specs/YYYY-MM-DDTHH-MM_{feature-name}.md`
**Lifecycle:** `draft → approved (GATE) → implemented → verified`
**Sections:**
```markdown
## Acceptance Criteria
- MUST: ...
- MUST NOT: ...

## High-Level Tasks
1. (coarse decomposition — human-readable, not code-level)
2. ...

## Test Contract
- MUST test: X
- MUST NOT test: internal implementation details
```

### 7.4 Task (derived from Spec, or standalone)
**Definition:** A detailed, implementable unit of work. The scheduling unit of a sprint.
Tasks are always added to a sprint. They optionally reference a Feature + Spec.
**Storage:** `{repo}/tasks/{current|future|deferred|done}/{phase}.md`
**Lifecycle:** `deferred → future → current → done`

**Work types:**

| Type | Driver doc | Feature? | Spec? | Pipeline lens |
|------|-----------|---------|-------|---------------|
| `feature` | Spec | required | required | verify code matches spec |
| `refactor` | Rationale doc | none | none | verify no regressions |
| `chore` | none | none | none | verify task acceptance criteria |
| `bugfix` | Bug report | optional | optional | verify bug is gone |

**Format:**
```markdown
### T-{id}: {name}
type: feature | refactor | chore | bugfix   ← REQUIRED
depends_on: [T-001, T-002]                   ← optional, empty = no deps = run in any order
feature: F-041                              ← optional (type=feature only)
spec: specs/F-041-dark-mode.md         ← optional (type=feature only)
spec_task: "1. CSS variable system"         ← optional (type=feature only)
rationale: docs/refactor/mcp-move.md        ← optional (type=refactor|bugfix)
**Acceptance criteria:** (always required)
  - specific, testable, code-level
**Test contract:**
  - MUST: ...
  - MUST NOT: ...
**Priority:** HIGH | MEDIUM | LOW
```

**`depends_on` and execution:**
- `depends_on: []` or absent = task is "ready" immediately, runs in any order
- `depends_on: [T-001]` = task can only start when T-001 is `done`
- Serial mode: topological sort determines order
- Accelerate mode: all tasks with satisfied deps run simultaneously
- Daemon queries: `SELECT * FROM tasks WHERE all depends_on are status='done'` → ready set

**Refactor example:**
```markdown
### T-010: Move MCP files to synapse/src/mcp/
type: refactor
depends_on: []                               ← no deps, can start anytime
rationale: docs/refactor/mcp-consolidation.md
**Acceptance criteria:**
  - MCP files live at synapse/src/mcp/
  - No hardcoded paths remain
**Test contract:**
  - MUST: all existing tests pass
  - MUST NOT: any external API change
**Priority:** HIGH
```

### 7.5 Plan (derived from Task + Spec)
**Definition:** How to implement a task. An implementation blueprint.
Ephemeral: created before implementation, archived when done.
NOTE: Plan is SUBORDINATE to Task. It is a task artifact, not a top-level entity.
**Storage:** `{repo}/plans/{current|done}/YYYY-MM-DDTHH-MM_{name}.md`
**Required sections:** Deliverables, files to change, code-level spec, test contract reference
**Lifecycle:** `draft → refined → approved (GATE) → implementing → done`

### 7.6 Review
**Definition:** Read-only audit produced by Grok specialist.
**Types:** task-review, plan-review, code-review
**Storage:** `{repo}/reviews/{type}/YYYY-MM-DDTHH-MM_{artifact-id}-iter{N}.md`
  where `{type}` is `spec`, `plan`, or `code`
**Format:** Findings by [BLOCKING]/[WARNING]/[INFO] + APPROVE or REQUEST_CHANGES
**Lifecycle:** `pending → produced → triaged`

### 7.7 Triage
**Definition:** Decisions and auto-fixes applied to a review's findings.
Produced by AGY Triage specialist. Emits PIPELINE_SIGNAL.
**Storage:** `{repo}/reviews/triage/YYYY-MM-DDTHH-MM_{task-id}-iter{N}.md`
**Lifecycle:** `pending → produced → applied`

### 7.8 Signal
**PIPELINE_SIGNAL** (from Triage):
```
<!-- PIPELINE_SIGNAL: AUTO-FIX=N ESCALATE=M -->
```
- `AUTO-FIX=0 ESCALATE=0` → loop (Grok re-reviews)
- `AUTO-FIX=N ESCALATE=0` → loop (N fixes committed, Grok re-reviews)
- `ESCALATE=M`             → halt (human intervention required)

**TESTER_SIGNAL** (from Tester):
```
<!-- TESTER_SIGNAL: PASS=Y FAIL=N SKIPPED=K TYPECHECK=green|red -->
```
- `FAIL=0 TYPECHECK=green` → continue
- `FAIL>0 OR TYPECHECK=red` → trigger fix-tests cycle

**Rule:** Always the last line of the specialist's output document.

### 7.9 Pipeline Run
**Definition:** One execution of the automation workflow for a product.
**Storage:** `pipeline_runs` table in synapse.db + logs in `{repo}/.local/pipeline/logs/`
**Lifecycle:** `pending → running → waiting (gate) → complete | failed | escalated`

### 7.10 Approval Gate
**Definition:** A human checkpoint embedded in the pipeline.
**When it fires:** After plan generation (before implementation), after escalated triage.
**How to pass:** GUI [Approve Gate] button OR `synapse approve {run-id}` CLI

---

## 8. Pipeline Steps (Full Cycle)

```
Phase A: FRONT DOOR (IDE, semi-automated)

research-to-features       reads research doc → extracts features (≈ user stories)
                           writes feature-registry.yaml + spec stubs
  ↓
[spec-review]              Grok audits specs for completeness + clarity
  ↓
══ SPEC APPROVAL GATE ════ human reads specs: "yes, this is what I want built"
  ↓

Phase B: PLANNING (automated)

make-plans                 AGY Planner reads specs → derives detailed tasks
                           tasks written to tasks/future/{phase}.md
                           plans created for each task
  ↓
[plan-review]              Grok audits plans against specs
  ↓
[triage if issues]         AGY fixes BLOCKING findings
  ↓
══ PLAN APPROVAL GATE ════ human reviews plans before implementation
  ↓

Phase C: IMPLEMENTATION (automated)

implement-plan             AGY Coder: plans + specs → code + tests
                           tests verify SPEC (not plan internals)
  ↓
agy-tester                 runs typecheck + tests → emits TESTER_SIGNAL
  ↓
code-review                Grok audits implementation against spec + plan
  ↓
[triage + auto-fix]        AGY Triage: fixes BLOCKING findings, emits PIPELINE_SIGNAL
  ↑______ loop until PIPELINE_SIGNAL: ESCALATE=0 (max 3 iterations)
  ↓
rotate-phase               feature marked shipped, phase archived, next phase promoted
```

---

## 9. Specialist Roles (Context Matrix Summary)

| Specialist | Invoked as | MCP scope | Can write |
|------------|-----------|-----------|-----------|
| **AGY Intake** | `agy` | git + features | Feature registry + spec stubs (research-to-features) |
| **Grok Spec Reviewer** | `grok` | None | One spec-review doc |
| **AGY Planner** | `agy` | git + features | Detailed tasks + plans (derived from specs) |
| **Grok Plan Reviewer** | `grok` | None | One plan-review doc |
| **AGY Coder** | `agy` | git + tasks | Source code + tests |
| **AGY Tester** | `agy` | telemetry | One tester signal doc |
| **Grok Code Reviewer** | `grok` | None | One code-review doc |
| **AGY Triage** | `agy` | git subset | Source fixes + triage doc + deferred.md |

---

## 10. Consolidation Inventory

### Already in synapse (from initial extraction)
- `src/engine/` — pipeline.ts, daemon.ts, db.ts, registry.ts
- `src/api/server.ts` — REST API
- `src/dashboard/` — React Flow graph UI
- `src/cli/cli.ts` — CLI commands
- `agent-job.sh` — specialist dispatcher
- `skills/` — 11 specialist skills
- `docs/feature-registry.yaml` — S-001..S-010

### Still in fox/tools/jobs/ — needs moving to synapse/src/mcp/
- `mcp-server.ts` → `src/mcp/server.ts` (generalize: multi-repo aware)
- `mcp-registry.ts` → `src/mcp/registry.ts` (reads repos.yaml, not hardcoded)
- `mcp-git.ts` → `src/mcp/git.ts`
- `mcp-tasks.ts` → `src/mcp/tasks.ts` (repo-aware)
- `mcp-telemetry.ts` → `src/mcp/telemetry.ts`
- `mcp.ts` → `src/mcp/index.ts`

### Needs to be created
- `synapse/package.json` + `bunfig.toml`
- `synapse/AGENTS.md`
- `synapse/repos.yaml` (synapse's own product registry)
- `synapse/.agents/rules/`
- `synapse/specs/pipeline-signal-protocol.md`
- `synapse/specs/feature-spec-format.md` ← defines Feature, Spec, Task, Plan format
- `synapse/skills/research-to-features/SKILL.md` ← front door skill (replaces research-to-tasks)
- Proper `synapse/tasks/current/phase-1.md` (formal task format, features as primary unit)

---

## 11. Feature Registry (Synapse's Own)

| ID | Name | Description | Status | Phase |
|----|------|-------------|--------|-------|
| S-001 | pipeline-engine | convergence loop engine | shipped | 1 |
| S-002 | pipeline-api | REST API for daemon | shipped | 1 |
| S-003 | pipeline-dashboard-graph | React Flow live graph | shipped | 1 |
| S-004 | agent-job-dispatcher | agy/grok subprocess launcher | shipped | 1 |
| S-005 | grok-read-only-enforcement | Grok cannot write files | planned | 1 |
| S-006 | grok-workspace-dirs | Grok gets correct read paths | planned | 1 |
| S-007 | triage-typecheck-gate | Triage emits typecheck signal | planned | 1 |
| S-008 | triage-deferred-items-mcp | Triage writes to deferred.md via MCP | planned | 1 |
| S-009 | planner-test-contracts | Plans include MUST/MUST NOT test contracts | planned | 1 |
| S-010 | tester-signal | Tester emits TESTER_SIGNAL | planned | 1 |
| S-015 | research-to-features | IDE skill: research doc → features + specs | planned | 1 |
| S-011 | dashboard-gui | Full tab GUI (Sprints/Sprint/Features/etc.) | planned | 2 |
| S-012 | pipeline-lifecycle-manager | Per-product daemon start/stop/resume | planned | 2 |
| S-013 | portfolio-db | SQLite DB for pipeline run state | planned | 2 |
| S-014 | mcp-server-multi-repo | Repo-aware MCP server | planned | 2 |
| S-016 | spec-review-gate | Pipeline gate: spec approval before planning | planned | 2 |

---

## 12. Open Questions

**All resolved:**

| # | Question | Decision |
|---|---------|----------|
| 1 | Spec approval UX | CLI-first: `synapse inbox` shows waiting gates. Never require opening GUI to unblock work. |
| 2 | Reject feedback | `synapse reject <run-id> --note "..."` required (empty reject forbidden). Written to `reviews/feedback/YYYY-MM-DDTHH-MM_{type}-{id}.md`. Agent MUST read before regenerating. |
| 3 | Watchdog on `docs/intake/` | **NO.** Manual invoke only until skill is boringly reliable. |
| 4 | Dashboard tech | **DEFERRED.** GUI deferred entirely. CLI only until daemon is proven. |
| 5 | CLI parity | **YES — CLI IS the API.** GUI (when built) is a client. |
| 6 | Sprint ↔ Feature assignment | Tasks are added to sprints. Tasks carry optional `feature`/`spec` context. |
| 7 | Branch policy | Feature branches: `work/{run-id}-{task-id}`. Required in accelerate mode. |
| 8 | Parallel execution | Default: serial (topological order). `--accelerate` enables parallel for deps-satisfied tasks. |

**DEFERRED:**
- Federation relationship — revisit when synapse daemon is stable
- GUI / dashboard — defer until CLI is proven in real dogfood use

## 13. Daemon Implementation Notes (Anti-Pain)

Things that will cause pain if done wrong:

```
1. Do NOT poll DB every 5s as primary event trigger.
   Job subprocess exits → daemon reads artifact's last line → transitions.
   Polling is a WATCHDOG (5s), not the event loop.

2. Persist current_step + last_signal + output_path BEFORE spawning next job.
   Crash safety = replay from last completed step.

3. Specialist invocation is ONE function:
   runJob({ product, step, specialist, prompt, workspace })
   agent-job.sh stays the process boundary. No special casing per step.

4. Grok's workspace enforced read-only in the DISPATCHER, not in the prompt.
   Prompt instruction alone is not enforcement.

5. auto_resume DEFAULT = OFF.
   After reboot: look at inbox first, don't discover three agents mid-rewrite.

6. Re-running any step produces ...-iter{N+1}. NEVER overwrite iter 1.
   Idempotent jobs. Enforced in dispatcher by filename generation.

7. Add jobs.tokens_in / jobs.tokens_out columns NOW.
   Cheaper than reconstructing token costs later.

8. Gate evidence pack written by daemon when gate fires:
   {repo}/.local/pipeline/GATE-{run-id}.md
   Contents: spec path, plan path, review path, diffstat, test status.
   synapse inbox renders this pack. You review the pack, not a pile of files.

9. Spec-test enforcement: Grok code-review MUST check:
   □ Does test file assert every MUST in spec test contract?
   □ Does test file avoid testing every MUST NOT (implementation details)?
   This checklist item is mandatory, not optional.

10. Constitution file (AGENTS.md / docs/constitution.md):
    Every specialist MUST read this as first context.
    Project-wide rules belong here, not scattered in every spec.
```
