---
name: tool-roles
description: >-
  Defines the roles of AGY, Fox, and competitor agents. Read this skill before
  scheduling benchmark evaluations, pushing LLM jobs, or comparing agent
  performance. Prevents the critical mistake of benchmarking AGY (our IDE)
  instead of Fox (our product).
---

# Tool Roles — AGY vs Fox vs Competitors

## The Three Roles

### 1. AGY (Antigravity CLI) — Our IDE Tooling
AGY is the **development environment** we work inside. It is NOT a product we
are building and NOT a competitor we benchmark against.

**Use AGY for:**
- Pushing scheduled dev tasks to the job scheduler (`bun run jobs push --cmd "agy -p '...' --model ..."`)
- Code reviews, plan reviews, and LLM-assisted refactoring
- Any IDE-side work that benefits from model routing (Flash/Sonnet/Opus)

**AGY CLI patterns:**
```bash
# Push a code review to the scheduler (AGY doing work FOR us)
bun run jobs push --timeout 180000 \
  --cmd "source ~/.bashrc && export PATH=\$HOME/.local/bin:\$PATH && agy -p 'Review this plan...' --model gemini-3.8-flash --effort high --dangerously-skip-permissions" \
  --name "Flash: Review plan X"
```

**NEVER** include AGY as a competitor in benchmark evaluations.

### 2. Fox — The Product Under Test
Fox is the AI coding agent **we are building**. It is the primary subject of
all benchmarks and capability evaluations.

**Fox headless invocation:**
```bash
# Fox runs headlessly via `fox run` — NO server required
bun ./src/index.ts run --auto "Fix the off-by-one error in utils.ts"
bun ./src/index.ts run --auto --model openai/gpt-4o "Add input validation"

# In bench-eval.sh:
bash tools/bench-eval.sh fox a1-fix-off-by-one --timeout 90
```

**Key facts:**
- `fox run --auto` auto-approves tool permissions and runs non-interactively
- Does NOT require `fox serve` — runs standalone
- Supports `--model provider/model` for model selection

### 3. Competitors — Kilo, Aider, Goose
These are the agents Fox is benchmarked **against**:

| Agent | Binary | Headless Command | Notes |
|-------|--------|------------------|-------|
| **Kilo** | `kilodev` (ext-repo) | `kilodev run --auto "prompt"` | Fox's upstream fork. Same CLI interface. |
| **Aider** | `aider` (ext-repo) | `aider --yes --message "prompt"` | Python-based. Uses `.venv`. |
| **Goose** | `goose` (~/.local/bin) | `goose run --text "prompt"` | Block's agent framework. |

**Competitor binaries:**
```
Kilo:  /home/k82l0804/workarea/fox/ext-repo/agent-cli/kilocode/bin/kilodev
Aider: /home/k82l0804/workarea/fox/ext-repo/agent-cli/aider/.venv/bin/aider
Goose: ~/.local/bin/goose
```

## Decision Checklist

Before scheduling or running any agent task, ask:

1. **Am I doing dev work?** (code review, plan review, refactoring)
   → Use AGY via the job scheduler with `--model` routing.

2. **Am I benchmarking Fox's capabilities?**
   → Run `bash tools/bench-eval.sh fox <task-id>`.

3. **Am I comparing Fox to competitors?**
   → Run `bash tools/bench-eval.sh kilo|aider|goose <task-id>`.

4. **Am I running Fox's internal test suites?**
   → Use `bun run test:*` commands or push presets to the scheduler.

## Model Routing for AGY Jobs

When pushing AGY jobs to the scheduler, route models by task complexity:

| Task Type | Model | Timeout | Example |
|-----------|-------|---------|---------|
| Bulk review / search | `gemini-3.8-flash --effort high` | 180s | Plan scan, fixture gen |
| Implementation | `claude-sonnet-4-6` | 300s | Code fixes, test writing |
| Architecture / design | `claude-opus-4-6` | 300s | Design decisions, tradeoffs |

## Common Mistakes to Avoid

❌ `bench-eval.sh agy a1-fix-off-by-one` — AGY is not a competitor  
✅ `bench-eval.sh fox a1-fix-off-by-one` — Fox is the product  
✅ `bench-eval.sh kilo a1-fix-off-by-one` — Kilo is a competitor  

❌ Starting a Fox server to run benchmarks — `fox run` works standalone  
✅ `bun ./src/index.ts run --auto "prompt"` — headless, no server  

❌ Using AGY model flags (`--effort`) with Fox or Kilo — they don't have it  
✅ Fox/Kilo use `--model provider/model` only  

## Future: AGY as Aspirational Benchmark

AGY is significantly more powerful than the current peer group. Once Fox
consistently beats Kilo, Aider, and Goose, AGY becomes the **stretch-goal
benchmark target**. Until then, keep AGY in its IDE tooling role and
benchmark Fox against its actual peer group.
