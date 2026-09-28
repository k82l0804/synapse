# Agent Context Matrix — Control Plane + Specialists

## The Model

**The AGY IDE is the pipeline manager, not a developer.** It starts pipelines,
monitors state, approves human gates, reads dashboards. It never does specialist
work itself — no code, no reviews, no planning, no testing.

**Specialists are subprocesses** invoked via `tools/agent-job.sh`. Each has a
narrow job. Each gets only the context and permissions it needs for that job.

```
┌──────────────────────────────────────────────────────────────────┐
│  AGY IDE — CONTROL PLANE                                         │
│  Pipeline start / monitor / approve. Never does specialist work. │
└───────────────────────┬──────────────────────────────────────────┘
                        │
                        │  tools/agent-job.sh  ←── dispatches specialists
          ┌─────────────┼────────────────┬──────────────┬──────────┐
          ▼             ▼                ▼              ▼          ▼
      [grok]       [agy triage]   [agy planner]  [agy coder] [agy tester]
      Reviewer     Decision-      Task→Plan+spec  Implement   Verify
      Read-only    maker+fixer    +test contract  +tests      +signal
```

**The iterative review cycle** (inner loop, repeats until PASS or ESCALATE):
```
grok review → agy triage → [fixes? → grok re-review] → PASS or ESCALATE
```

---

## 1. AGY IDE — Control Plane

**What it does:** Manages pipeline lifecycle only.
Starts runs, reads status, approves gates, reads review docs to decide next move.
Never writes code, plans, or reviews itself.

| Category | Specifics |
|----------|-----------|
| **MCP** | fox-workflow: push_jobs, run_jobs, job_status, pipeline tools, git_log, get_current_tasks, list_plans, update_plan_status, telemetry_summary |
| **Skills** | rotate-phase (phase transitions only) |
| **File access** | tasks/, plans/, docs/reviews/ — read-only meta layer |
| **Does NOT need** | Feature registry writes, git commit, any specialist skills |

### Current gap
> ⚠️ During bootstrapping the IDE *does* write code (pipeline tooling, dashboard).
> That's acceptable while the system is self-building. Long-term it converges
> to pure control plane and dispatches all changes to specialists.

---

## 2. Grok — Reviewer (Read-Only Specialist)

**What it does:** Read-only auditing. Produces a single review doc.
Never commits, never edits source files.
Invoked as: `grok --always-approve --reasoning-effort high --output-format plain`

| Category | Specifics |
|----------|-----------|
| **MCP** | **None** — read-only, no state mutation |
| **Skills** | task-review, plan-review, code-review (passed via prompt) |
| **Rules** | Rule #10 read-only rubric (must be injected into prompt) |
| **Reads** | tasks/current/, plans/current/, fox-code-cli/src/, previous review docs |
| **Writes** | ONE doc: `docs/reviews/YYYY-MM-DDTHH-MM_<type>-iter{N}-phase-2i.md` |
| **Output format** | Findings by severity: [BLOCKING] / [WARNING] / [INFO] + APPROVE or REQUEST_CHANGES |
| **Model** | Grok default (Sonnet-class); Opus for architecture reviews |

### Current gap
> ❌ Rule #10 (read-only constraint) is NOT injected — Grok can edit files if prompted
> ❌ `--cwd fox-code-cli` only; Grok also needs to read `fox/tasks/` and `fox/plans/` but
>    has no `--add-dir fox/` passed — it navigates by path from the skill prompt only
> ⚠️ No hard enforcement — relies on model discipline

---

## 3. AGY Triage — Decision-Maker + Auto-Fixer

**What it does:** Reads a Grok review doc → categorizes every finding →
decides fix vs. defer vs. escalate → applies auto-fixes in code → commits.
This is the **inner loop**: its output tells the pipeline whether to loop again.

Invoked as: `agy --print --dangerously-skip-permissions --effort high --add-dir fox/ --add-dir fox-code-cli/`

| Category | Specifics |
|----------|-----------|
| **MCP** | fox-workflow SUBSET: git_add, git_commit, git_status, git_diff_staged, git_log, update_plan_status |
| **Skills** | review-triage (passed via prompt) |
| **Rules** | Rule #10 rubric, deferred-items-tracking rule |
| **Reads** | The Grok review doc, plans/current/, fox-code-cli/src/ |
| **Writes** | Auto-fixed source files, `tasks/deferred.md` (deferred items), triage decision doc |
| **Signal** | `<!-- PIPELINE_SIGNAL: AUTO-FIX=N ESCALATE=M -->` at end of triage doc |
| **Model** | Claude Sonnet 4.6 — needs judgment |

### Decision protocol
```
[BLOCKING] → attempt auto-fix, or mark ESCALATE if too complex
[WARNING]  → fix if trivial, else append to tasks/deferred.md
[INFO]     → note only

PIPELINE_SIGNAL: AUTO-FIX=0 ESCALATE=0 → Grok re-reviews (no changes)
PIPELINE_SIGNAL: AUTO-FIX=N ESCALATE=0 → Grok re-reviews (N fixes committed)
PIPELINE_SIGNAL: AUTO-FIX=N ESCALATE=M → pipeline halts, human required
```

### Current gap
> ✅ review-triage skill + PIPELINE_SIGNAL format exist
> ❌ No typecheck gate before committing auto-fixes — must run `bun run typecheck` first
> ❌ Deferred items not reliably appended to `tasks/deferred.md` (prose-only today)
> ⚠️ Gets ALL MCP tools including push_jobs, pipeline management (should be git-only)

---

## 4. AGY Planner — Architect

**What it does:** Reads tasks → produces implementation plans with:
spec contracts (acceptance criteria + edge cases) and test contracts
(what tests must exist and what they must assert). Registers feature IDs.

Invoked as: `agy --print --dangerously-skip-permissions --effort high --model claude-sonnet-4-6 --add-dir fox/ --add-dir fox-code-cli/`

| Category | Specifics |
|----------|-----------|
| **MCP** | fox-workflow SUBSET: get_current_tasks, list_plans, read_plan, list_features, get_feature, register_feature, update_feature_status, git_add, git_commit |
| **Skills** | make-plans, refine-plan (passed via prompt) |
| **Rules** | All AGENTS.md architectural rules (must plan within constraints) |
| **Reads** | tasks/current/, fox-code-cli/src/, fox-code-cli/packages/, existing plans |
| **Writes** | plans/current/*.md, fox-code-cli/docs/specs/*.md, feature-registry.yaml entries |
| **Model** | Claude Sonnet 4.6 (architecture reasoning required) |

### Plan output structure (per task)
```
plans/current/YYYY-MM-DDTHH-MM_<name>.md
  ├── Deliverables
  ├── Acceptance criteria  (spec contract — what it must do)
  ├── Test contract        (what tests must exist, file paths, assertion shape)
  ├── Feature IDs          (@fox-feature F-XXX)
  └── Dependencies + risks
```

### Test contract format (written by planner, implemented by coder)
```typescript
// @fox-feature F-123 — test contract
// MUST: test that X returns Y when given Z
// MUST: test that it rejects W with error E
// MUST NOT: test internal implementation details of V
```

### Current gap
> ⚠️ Gets ALL MCP tools including push_jobs, pipeline management (should be features+git only)
> ❌ No test contract format enforced — coders infer tests from prose acceptance criteria
> ⚠️ make-plans skill doesn't explicitly instruct using `register_feature` MCP tool

---

## 5. AGY Coder — Implementer

**What it does:** Reads a plan → writes code → writes tests matching the test
contract → runs typecheck → commits. Does NOT review or plan.

Invoked as: `agy --print --dangerously-skip-permissions --effort high --model claude-sonnet-4-6 --add-dir fox/ --add-dir fox-code-cli/`

| Category | Specifics |
|----------|-----------|
| **MCP** | fox-workflow SUBSET: git_add, git_commit, git_status, git_diff_staged, mark_task_done, update_feature_status, list_plans, read_plan |
| **Skills** | implement-plan (passed via prompt) |
| **Rules** | All AGENTS.md architectural rules (Tool architecture, HttpApi routes, Session LLM, etc.) |
| **Reads** | The plan file, fox-code-cli/src/, fox-code-cli/packages/ |
| **Writes** | fox-code-cli/src/, fox-code-cli/test/, commits |
| **Commands** | bun run typecheck, bun run test:smoke, bun run build |
| **Model** | Claude Sonnet 4.6 (general); Flash for bulk refactoring (with review after) |

### Current gap
> ⚠️ Gets ALL MCP tools including pipeline management (should be git+tasks only)
> ⚠️ implement-plan skill tells coder to use fox-workflow MCP for git, but MCP
>    config isn't passed when invoked via agent-job.sh (agy reads it from ~/.agy/)

---

## 6. AGY Tester — Verifier

**What it does:** Runs the test suite. Produces a pass/fail signal and a
log artifact. Does NOT edit code. Currently embedded in the coder step
(fix-tests pipeline stage) — should be a separate invocation.

Invoked as: `agy --print --dangerously-skip-permissions --effort high --add-dir fox-code-cli/`

| Category | Specifics |
|----------|-----------|
| **MCP** | fox-workflow SUBSET: telemetry_summary (to log results) |
| **Skills** | run-tests (doesn't exist yet as a specialist skill) |
| **Rules** | fox-cli-testing.md rules |
| **Reads** | Test output logs, fox-code-cli/test/ |
| **Commands** | bun run test:smoke, bun run test, bun run typecheck |
| **Signal** | `<!-- TESTER_SIGNAL: PASS=Y FAIL=N SKIPPED=M -->` (not yet defined) |
| **Model** | Any — this is mechanical, not creative |

### Current gap
> ❌ No separate tester role — testing is embedded inside the coder's implement-plan run
> ❌ No `TESTER_SIGNAL` format — pipeline can't distinguish test failure from code failure
> ❌ No run-tests specialist skill (skills/run-tests/ is about the job scheduler, not running)

---

## Summary Matrix

| Capability | IDE | Grok | Triage | Planner | Coder | Tester |
|------------|:---:|:----:|:------:|:-------:|:-----:|:------:|
| Pipeline start/stop/approve | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| fox-workflow: jobs/pipeline | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| fox-workflow: git | ✅ | ❌ | ✅ | ✅ | ✅ | ❌ |
| fox-workflow: tasks/plans | ✅ | ❌ | read | ✅ | read | ❌ |
| fox-workflow: features | ✅ | ❌ | ❌ | ✅ rw | read | ❌ |
| fox-workflow: telemetry | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ |
| Write application code | ❌ | ❌ | ✅ fixes | ❌ | ✅ | ❌ |
| Write tests | ❌ | ❌ | ❌ | contract | ✅ | ❌ |
| Write review docs | ❌ | ✅ | ✅ | ❌ | ❌ | ✅ |
| Write plans + specs | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ |
| Emit PIPELINE_SIGNAL | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ |
| Emit TESTER_SIGNAL | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| Run typecheck (gate) | ❌ | ❌ | ✅* | ❌ | ✅ | ✅ |
| Commit | ❌ | ❌ | ✅ | ✅ | ✅ | ❌ |
| Append to tasks/deferred.md | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ |

*Triage typecheck gate exists in skill but not enforced today

---

## Near-Term Gaps to Fix

1. **Inject read-only rule into every Grok call** — append rule #10 to prompt in `agent-job.sh`
2. **Add `--add-dir fox/` for Grok** — needs tasks/ and plans/ context
3. **Typecheck gate in review-triage skill** — before committing any auto-fix, run typecheck; if red → ESCALATE
4. **Deferred-items enforcement in triage** — must write to `tasks/deferred.md` via MCP, not just prose
5. **Test contract format in make-plans skill** — structured, not prose acceptance criteria
6. **Define TESTER_SIGNAL** — `<!-- TESTER_SIGNAL: PASS=Y FAIL=N -->` so pipeline can act on it

## Medium-Term (Synapse Architecture)

7. **Scoped MCP by role** — `agent-job-planner.sh`, `agent-job-coder.sh`, `agent-job-triage.sh`
   each with a minimal `--mcp-config` for only the tools that role legitimately needs
8. **Grok config** in `fox/.grok/` enforcing read-only file permissions
9. **Tester as separate pipeline step** — not embedded in coder
10. **Specialist skill library** standardized: one skill per role, clear input/output contracts
