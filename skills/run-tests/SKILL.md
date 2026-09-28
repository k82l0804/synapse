---
name: run-tests
description: >-
  Use this skill for any command expected to take longer than ~10 seconds:
  test suites, typecheck, builds, git operations, agent delegation, benchmark
  runs. Push jobs to the Fox Job Scheduler, immediately continue with other
  parallelizable work, then come back to check results. Key capability: delegate
  complex subtasks to agy or grok agents via the scheduler while you work on
  other things in parallel. Dashboard at http://localhost:4040/.
---

# Run Long-Running Commands via Job Scheduler

**Core principle**: Push slow work to the scheduler, immediately continue doing
other independent work in parallel, then poll results when you need them.
This is how to work fast — never block waiting for a long command to finish.

## The Rule

**>10 seconds → scheduler. <10 seconds → direct.**

| Always push to scheduler | Run directly (fast) |
|---|---|
| `bun run typecheck` (~30s) | `bun test one-file.test.ts` |
| `bun run test:smoke` (~60s) | `git status`, `git add`, `git log` |
| `bun run test` / `bun run build` | `cat`, `ls`, file reads/edits |
| `git rm -r` or `git commit` on large trees | Short `python3` scripts (<5s) |
| Agent jobs (`agy`, `grok`) | `bun run jobs status` |
| Benchmark runs, `rsync` of large dirs | Quick `grep` / `find` |

---

## Preferred: Use fox-workflow MCP Tools

The `fox-workflow` MCP server exposes job scheduler tools directly. **Prefer
these over raw bash CLI commands** — they're safer, structured, and don't
require knowing the CLI path.

| MCP Tool | What It Does | Replaces |
|----------|-------------|----------|
| `push_jobs` | Push a preset to the queue (fire & forget) | `bun run tools/jobs/cli.ts push <preset>` |
| `run_jobs` | Push + wait + stream progress | No CLI equivalent |
| `job_status` | Queue counts (pending/running/passed/failed) | `bun run tools/jobs/cli.ts status` |
| `job_history` | Recent results with pass/fail/duration | `bun run tools/jobs/cli.ts history` |

Call via `call_mcp_tool` with `ServerName: fox-workflow`.

---

## Workflow: Fire, Monitor, Work, Wake

The most efficient pattern — push jobs, set up async notification, keep working,
get woken up automatically when results arrive:

```
1. FIRE    → push jobs to the scheduler (instant)
2. MONITOR → start monitor_jobs.sh as a background run_command
3. WORK    → do other independent tasks (edits, docs, other files)
4. WAKE    → monitor exits when batch completes → agent wakes with results
5. REACT   → process results, fix failures, push next wave
```

### Example — async notification with background monitor:

```
# 1. FIRE: push smoke tests
call_mcp_tool(fox-workflow, push_jobs, {preset: "smoke"})
# → returns batchId "abc123" instantly

# 2. MONITOR: background curl watcher (exits on completion → wakes agent)
run_command(background): "tools/jobs/monitor_jobs.sh abc123"
# → ~0 CPU, polls dashboard REST API every 3s

# 3. WORK: keep editing files, writing docs, updating registry
# ... (agent is free to do anything while tests run) ...

# 4. WAKE: monitor_jobs.sh exits → agent gets woken up with:
#    ## Batch abc123 — 5/5 passed (32.1s wait)
#    | Job | Status | Duration |
#    | typecheck | ✅ passed | 18.2s |
#    | test:patch | ✅ passed | 4.1s |
#    ...
#    ✅ All jobs passed (34s elapsed)

# 5. REACT: process results, push next wave if green
```

### Requirements for async notify:
- Dashboard daemon must be running on `localhost:4040`
- Check: `nc -w 2 -zv localhost 4040`
- Start: `bun run tools/jobs/cli.ts daemon > /tmp/jobs-daemon.log 2>&1 &`

### Fallback: manual polling (when daemon is down)

If the daemon isn't running, fall back to manual Fire → Work → Check:

```
1. FIRE  → push one or more jobs to the scheduler
2. WORK  → do other independent tasks
3. CHECK → call_mcp_tool(fox-workflow, job_history, {limit: 10})
4. LOOP  → repeat
```

### Parallel batches with multiple monitors:

```
# Push multiple independent batches
call_mcp_tool(fox-workflow, push_jobs, {preset: "smoke"})     # → batch "abc"
call_mcp_tool(fox-workflow, push_jobs, {preset: "packages"})  # → batch "def"

# Monitor both (separate background tasks)
run_command(background): "tools/jobs/monitor_jobs.sh abc"
run_command(background): "tools/jobs/monitor_jobs.sh def"

# Work on other things — wake up as each batch finishes
```

---

## Delegating Complex Tasks to agy or grok

The scheduler's most powerful use: offload a complex, long-running task to
another agent while you continue working on something else in parallel.

### Which agent for which task?

| Task type | Use |
|---|---|
| Code review of a diff or plan | `agy:review` (fast, Flash model) or `grok:review` |
| Creating implementation plans | `agy:plan` (Sonnet) or `grok:plan` |
| Implementing a plan (file edits, code) | `agy:implement` (Sonnet) or `grok:implement` |
| Architecture analysis, design questions | `agy:implement` with Opus or `grok:implement` |
| Bulk review / quick triage | `agy:review` with Flash (cheap, fast) |
| Deep reasoning, complex refactors | `grok:implement` (strong at multi-file reasoning) |

### Push a named agent preset

```
# Review the current diff before committing
call_mcp_tool(fox-workflow, push_jobs, {preset: "agy:review"})

# Have grok create plans for the next task batch
call_mcp_tool(fox-workflow, push_jobs, {preset: "grok:plan"})

# Have agy implement the next plan while you review the current one
call_mcp_tool(fox-workflow, push_jobs, {preset: "agy:implement"})
```

### Push a custom agent job with a specific prompt

Use `agent-job.sh` for targeted delegation:

```bash
bun run tools/jobs/cli.ts push \
  --cmd "tools/agent-job.sh agy implement-plan claude-sonnet-4-6 'Focus on Task 2H-4a only — prompt engineering iteration'" \
  --name "AGY: Implement 2H-4a" \
  --timeout 600000

bun run tools/jobs/cli.ts push \
  --cmd "tools/agent-job.sh grok code-review '' 'Review benchmarks/scoring.ts for correctness of the 5 scoring formulas'" \
  --name "Grok: Review Scoring Engine" \
  --timeout 300000
```

### Read agent output

Agent jobs write their output to the job log:

```
call_mcp_tool(fox-workflow, job_history, {limit: 5})    # see pass/fail
# For full logs:
tail -100 ~/.local/state/fox/job-logs/$(date +%Y-%m-%d)/<job-id>.log
```

### Parallel agent + test pattern

```
# Fire: have grok review while agy runs tests
call_mcp_tool(fox-workflow, push_jobs, {preset: "grok:review"})
call_mcp_tool(fox-workflow, push_jobs, {preset: "smoke"})

# Work: update docs, write commit message, edit other files
# ...

# Check both results
call_mcp_tool(fox-workflow, job_history, {limit: 10})
```

---



```bash
nc -w 2 -zv localhost 4040 2>&1 | grep -q "succeeded" && echo "UP" || echo "DOWN"
```

If DOWN, start it:

```bash
cd /path/to/fox && bun run tools/jobs/cli.ts daemon > /tmp/jobs-daemon.log 2>&1 &
sleep 2 && nc -w 2 -zv localhost 4040 2>&1
```

> **Note**: The daemon is only needed for the SSE transport and dashboard.
> The MCP stdio server (`mcp-server.ts`) runs independently — it's spawned
> by the IDE and talks directly to the SQLite database.

---

## Pushing Jobs (MCP Tools — Preferred)

Use `call_mcp_tool` with `ServerName: fox-workflow`:

```
# Named presets
call_mcp_tool(fox-workflow, push_jobs, {preset: "typecheck"})      # tsc --noEmit (~30s)
call_mcp_tool(fox-workflow, push_jobs, {preset: "smoke"})          # typecheck + test groups (~60s)
call_mcp_tool(fox-workflow, push_jobs, {preset: "full"})           # everything (~3 min)
call_mcp_tool(fox-workflow, push_jobs, {preset: "ladder"})         # capability ladder
call_mcp_tool(fox-workflow, push_jobs, {preset: "packages"})       # all internal packages
call_mcp_tool(fox-workflow, push_jobs, {preset: "bench:scoring"})  # benchmark scoring tests
call_mcp_tool(fox-workflow, push_jobs, {preset: "features"})       # feature matrix validator

# Agent workflow
call_mcp_tool(fox-workflow, push_jobs, {preset: "agy:review"})
call_mcp_tool(fox-workflow, push_jobs, {preset: "agy:plan"})
call_mcp_tool(fox-workflow, push_jobs, {preset: "agy:implement"})
call_mcp_tool(fox-workflow, push_jobs, {preset: "grok:review"})
call_mcp_tool(fox-workflow, push_jobs, {preset: "grok:plan"})
call_mcp_tool(fox-workflow, push_jobs, {preset: "grok:implement"})

# Custom command
call_mcp_tool(fox-workflow, push_jobs, {
  command: "bash -c 'cd /path/to/fox/fox-code-cli && bun test benchmarks/scoring.test.ts --timeout 20000'",
  name: "Scoring Tests",
  timeout: 30000
})
```

**Always `cd` into the right directory inside custom commands** — scheduler runs from workspace root.

---

## Checking Results (MCP Tools — Preferred)

```
call_mcp_tool(fox-workflow, job_status, {})                    # current queue
call_mcp_tool(fox-workflow, job_history, {limit: 10})          # recent results
call_mcp_tool(fox-workflow, job_history, {failsOnly: true})    # failures only
```

Read a failed job's log:
```bash
tail -80 ~/.local/state/fox/job-logs/$(date +%Y-%m-%d)/<job-id>.log
```

Dashboard: **http://localhost:4040/** — live progress, streaming logs, per-job status.

---

## Verification Workflow for Implementations

When completing a task per the `implement-plan` skill, verify in waves:

**Wave 1** (push immediately, work on other things while it runs):
```
call_mcp_tool(fox-workflow, push_jobs, {preset: "typecheck"})
# → meanwhile: write tests, update feature registry, update docs
```

**Wave 2** (push after writing tests, check Wave 1 result):
```
call_mcp_tool(fox-workflow, job_history, {limit: 5})    # is typecheck green?
call_mcp_tool(fox-workflow, push_jobs, {preset: "smoke"})
# → meanwhile: write commit message, update task status, do Wave 1 fixes if needed
```

**Wave 3** (final gate before marking complete):
```
call_mcp_tool(fox-workflow, job_history, {limit: 10})   # is smoke green?
call_mcp_tool(fox-workflow, push_jobs, {preset: "full"})
# → meanwhile: write implementation report, prep PR description
```

Single-file unit tests are the only ones run directly (fast, instant feedback):
```bash
# In fox-code-cli/:
timeout 30s bun test test/my-new-feature.test.ts
```

---

## All Named Presets

```
typecheck       tsc --noEmit
smoke           typecheck + patch + edit + config + compress + autonomous
ladder          R0–R7 capability ladder tests
packages        All internal package tests
tier            Model tier + profile tests
features        Feature matrix validator
scoreboard      Fox standard scoreboard
challenge       Challenge ladder
bench:validate  Benchmark reference solution validation
bench:scoring   Benchmark scoring engine tests
full            typecheck + packages + smoke + ladder + tier + features + bench:scoring
agy:review      AGY code review (Flash model)
agy:plan        AGY make-plans (Sonnet)
agy:implement   AGY implement-plan (Sonnet)
grok:review     Grok code review
grok:plan       Grok make-plans
grok:implement  Grok implement-plan
```
