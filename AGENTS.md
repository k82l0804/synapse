# Synapse — Agent Constitution

> **Version:** 1.0 — Layer 0  
> **Loaded by:** Every specialist agent as the first context document.  
> Rules here override any conflicting instruction in a skill or prompt.

---

## 1. What Synapse Is

Synapse is an AI development lifecycle orchestrator. It manages the pipeline:

```
Research → Features → Specs → Tasks → Plans → Code+Tests → Shipped
```

You are a specialist in this pipeline. You do one job, you do it correctly,
and you emit a conforming signal at the end. That is all.

---

## 2. Repo Layout Contract

**Single rule: who writes to this directory?**

| Directory | Writer | Rule |
|-----------|--------|------|
| `tasks/` | Pipeline (daemon, triage) | Work queue — drives execution |
| `plans/` | Pipeline (planner/AGY) | Blueprints — one per task |
| `reviews/` | Pipeline (Grok, AGY triage) | Review artifacts — type subdirs |
| `specs/` | Pipeline (research-to-features, Layer 0) | Feature contracts — stable filenames |
| `docs/` | **HUMAN ONLY** | Pipeline reads but NEVER writes |
| `feature-registry.yaml` | Pipeline (registry updates) | Authoritative feature list |
| `.synapse/run/` | Daemon ONLY | Operational state — never touch |

**`docs/` is read-only to all pipeline agents.** The pipeline reads `docs/research/`
as input. It never writes to `docs/`. Violation = architectural invariant broken.

**Path conventions (all relative to repo root):**
- Spec files: `specs/F-XXX-name.md` (stable, no timestamp)
- Task phases: `tasks/current/phase-N.md`
- Plans: `plans/current/YYYY-MM-DDTHH-MM_plan-{TASK-ID}.md`
- Reviews: `reviews/{type}/YYYY-MM-DDTHH-MM_{id}-iter{N}.md`
- Deferred items: `tasks/deferred/YYYY-MM-DDTHH-MM_{id}_{desc}.md`
- Feedback notes: `reviews/feedback/YYYY-MM-DDTHH-MM_{type}-{id}.md`

---

## 3. Anti-Hang Rules (CRITICAL)

### 3.1 Non-Interactive Execution Only

- **Never trigger interactive prompts.** Always use non-interactive/headless flags.
- **Git credentials:** Always prefix git commands with `GIT_TERMINAL_PROMPT=0`.
- **Tests:** Always run with `CI=true`. Never use `--watch` mode.
- **Network commands:** Always specify explicit timeouts (`curl -m 10`, `nc -w 2`).

### 3.2 Timeouts

Prefix all long-running commands with `timeout`:

```bash
timeout 30s CI=true bun test           # fast unit tests
timeout 45s bun run typecheck          # typecheck
timeout 60s CI=true bun run test:smoke # smoke suite
timeout 60s bun run build              # build
```

Never run a command that could hang indefinitely.

### 3.3 Tool-First Search

- Use file-reading tools to inspect files. Do not `cat` large files.
- Finding files: `git ls-files "pattern*"` — never raw `find .`
- Finding text: `git grep "search_term"` — never raw `grep -r`

---

## 4. Key Commands

```bash
# From the synapse repo root:
bun run synapse --help          # CLI entry point
bun run typecheck               # TypeScript type check
bun run test                    # Full test suite (typecheck + all tests)
bun run test:smoke              # Quick smoke test
bun run build                   # Build dist/synapse binary

# Git (always with GIT_TERMINAL_PROMPT=0):
GIT_TERMINAL_PROMPT=0 git add -A
GIT_TERMINAL_PROMPT=0 git commit -m "..."
GIT_TERMINAL_PROMPT=0 git status --short
```

---

## 5. Schema Enforcement Rule

**If your output fails the schema: the job is FAILED, not "close enough."**

- Spec not conforming to `specs/feature-spec-format.md`? FAILED.
- Plan not conforming to `specs/plan-format.md`? FAILED.
- Review not conforming to `specs/review-format.md`? FAILED.
- Signal absent or malformed per `specs/pipeline-signal-protocol.md`? FAILED.

Do not produce an output that "mostly" conforms. Read the format spec.
Produce output that fully conforms. Emit the signal. Done.

---

## 6. Signal Protocol

Every agent job MUST end with a conforming signal as the **last line** of the output.
See `specs/pipeline-signal-protocol.md` for the full grammar.

Quick reference:
```
<!-- PIPELINE_SIGNAL: STATUS=DONE AUTO-FIX=0 ESCALATE=0 -->
<!-- TESTER_SIGNAL: PASS=42 FAIL=0 SKIPPED=0 TYPECHECK=green -->
```

If you forget the signal: your job is treated as TASK_FAILED by the daemon.

---

## 7. Review Rubric (Grok Only)

When reviewing: **read-only, no file edits, no exceptions.**

Severity tags:
- `[BLOCKING]` — spec violated, test missing, invariant broken → MUST resolve before approve
- `[WARNING]` — quality issue, non-critical gap → may defer with justification
- `[INFO]` — observation, question → no action required

Verdict rules:
- Any BLOCKING present → verdict must be `REQUEST_CHANGES`
- No BLOCKING → verdict must be `APPROVE` or `NEEDS_DISCUSSION`
- Never leave verdict ambiguous

For code reviews: check every MUST/MUST NOT from the spec's Test Contract has a
corresponding test assertion. Missing test = automatic `[BLOCKING]`.

---

## 8. Deferred Items Rule

**Deferred items must never be lost.**

When a triage defers a finding:
1. Create a new file: `tasks/deferred/YYYY-MM-DDTHH-MM_{task-id}_{desc}.md`
2. Include: origin review path, finding text, suggested future action
3. Never append to an existing file — always create a new timestamped file

When a planning agent cuts scope:
1. Create a deferred file for each cut item
2. Do NOT just note "deferred" in the plan prose

---

## 9. Working Directory

Unless explicitly overridden: the working directory for all operations is the
**synapse repo root** (the directory containing this AGENTS.md file).

Paths in task files, plans, and specs are always relative to this root.

---

## 10. Pipeline Section (injected by daemon)

> This section is populated by `synapse start` when the pipeline is running.
> If you see [TODO] markers below, the pipeline has not been configured for this
> product yet. Do not proceed — run `synapse add ./` first.

**Product:** synapse  
**Current phase:** `tasks/current/phase-1.md`  
**Active task:** (set by daemon at job dispatch)  
**Run ID:** (set by daemon at job dispatch)  
**Gate path:** `.synapse/run/GATE-{run-id}.md` (daemon writes this)
