The doc is already better than most “agent SDLC” writeups. The hierarchy is right, the two-source-of-truth split is right, and “tests verify the spec, not the plan” is the load-bearing idea. The risk is not confusion. It is building a control tower before the runway exists.

Industry has converged on the same shape you drew: specs as source of truth, humans at gates, agents in the data plane. Microsoft is saying it out loud. Spec Kit / Kiro / BMAD all landed on specify → plan → tasks → implement with a human checkpoint. Cursor’s long-running agents split planner vs worker. You are not inventing the category. You are building a local, multi-repo, file-native version of it that you can run on your own machines.

That is a good product if you keep the surface small.

---

## What is already strong

**1. Features before tasks.**  
Most agent pipelines start at tickets. Tickets rot the moment the agent rewrites the plan. A Feature ≈ user story, one spec per feature, tests bound to the spec — that survives task churn. Keep this rule sacred.

**2. Files are content, DB is state.**  
Markdown in git is what you and the agents can actually read six months later. SQLite for `pipeline_status`, run IDs, and pointers is correct. Do not ever let the DB become the spec.

**3. AGY writes, Grok reviews.**  
Two-model review is the only cheap way a solo dev gets a second pair of eyes. Grok read-only is the right constraint. If Grok can write, you lose the auditor.

**4. Signals as the last line of an artifact.**  
`PIPELINE_SIGNAL` / `TESTER_SIGNAL` is a real protocol. Parsable, git-visible, no extra RPC schema. Keep it dumb and strict.

**5. Work types.**  
`feature | refactor | chore | bugfix` is how real repos work. Forcing every task onto a Feature would have been a design bug. You already closed that.

**6. You are the approver, not the creator.**  
Correct posture. The product is not “an IDE that writes tickets.” It is a machine that turns research into a contract and then refuses to ship until the contract is green.

---

## Where the design will hurt you

### 1. The GUI is a Phase 2 product pretending to be Phase 1

Six tabs (Pipeline, Sprints, Sprint, Backlog, Features, Reviews) plus React Flow is a team product. You are one person. Your real UI is:

1. **Inbox** — what needs a human in the next 10 minutes  
2. **Artifact** — render the spec/plan/review in front of you  
3. **Approve / Reject + feedback**

Everything else is navigation candy. A convergence graph is useful after you have branching, parallel tasks, and failed loops to visualize. A 7-step linear pipeline is a stepper, not a graph library.

Build the daemon + CLI + markdown protocol first. Drive it from the IDE for a month. Then wrap a dashboard around the inbox.

### 2. Dual source of truth will drift

`repos.yaml` + `synapse.db` + `feature-registry.yaml` + `tasks/*.md` + `docs/specs/*`. That is five places a feature can disagree with itself.

You need one reconciliation rule, written down:

- Files win on content. Always.  
- DB wins on operational state (`running`, `waiting`, `pid`).  
- On daemon start: scan files → rebuild index. Never “DB says shipped, file says planned” without a loud mismatch report.  
- IDs are immutable. Renames are new IDs or an explicit alias field.  
- Agents must not edit status in two places. Planner writes the task markdown; daemon writes `jobs` / `pipeline_runs`.

If you skip a nightly (or on-start) consistency check, the dashboard will lie and you will stop trusting it.

### 3. Spec-tests written by the same agent that writes the code are not a gate

“Tests verify the spec” is only true if the test author cannot quietly shrink the spec. Two mitigations:

- Spec review includes the **test contract**, not just acceptance criteria.  
- Grok’s code review has an explicit checklist item: *does `dark-mode.test.ts` actually assert every MUST, and none of the MUST NOTs?*  
- Optionally: a separate “spec-to-test auditor” pass that never sees the implementation, only spec + test file. Cheap, high leverage.

Without that, the loop converges on “agent agrees with itself.”

### 4. You will become the queue

Solo + two approval gates + optional escalate = the daemon spends most of its life waiting on you. That is fine if the inbox is loud. It is fatal if the only signal is “check the GUI.”

Gates need:

- a file: `{repo}/.local/pipeline/WAITING` or a row with `status=waiting`  
- a CLI: `synapse inbox`  
- a notify path: terminal bell, tmux hook, desktop notify, whatever you already look at  
- reject that writes `docs/reviews/..._feedback.md` the next specialist is required to read

Do not invent a notification product. Hook whatever you already use.

### 5. Two orchestrators

Federation already has Pulse, personas, shared memory, Commander. Synapse has a daemon, specialists, signals, a dashboard. If those stay separate you will maintain two control planes.

Pick one:

- **Synapse is a Federation workflow** — specialists are Federation personas, Pulse carries inbox/approvals, Commander is the GUI.  
- **Synapse is the SDLC engine; Federation is the agent runtime** — daemon only schedules, Federation/agy/grok only execute.

Write that sentence in the doc. Right now it is implied and will fork.

### 6. `research-to-features` is the actual product

If extraction is sloppy, every downstream artifact is waste. The skill needs harder rules than “identify user-visible capabilities”:

- Cap features per research doc (default 3–5). Extra goes to `deferred`.  
- Every feature must have a user, a trigger, a visible outcome, and a non-goal.  
- Ordering principles you listed (infra → data → API → UI) should be a scored sort the skill prints and you can override.  
- Spec stubs that fail a schema (missing MUST/MUST NOT, missing test contract, tasks that are code-level) do not enter the registry.

Treat the skill like a compiler front-end, not a summarizer.

---

## Flush the open questions

**1. Spec approval UX**  
Both, CLI-first. Pipeline writes `waiting` + a one-line summary. You run `synapse inbox` or see a badge. GUI later mirrors that. Do not make “open the dashboard” a prerequisite for unblocking work.

**2. Reject feedback**  
Free-text in the approve/reject action, written to a sibling file:

`docs/reviews/2026-09-28T10-00_spec-feedback-F-041.md`

Agent must read it before regenerating. Editing the spec in the IDE is also valid — the next reviewer diffs git. Do not build inline commenting in the GUI in Phase 1.

**3. Watchdog on `docs/intake/`**  
No. Manual invoke only until the skill is boringly reliable. Auto-ingest will start pipelines from a half-written note and burn a day.

**4. Dashboard tech**  
Extend the existing Vite + React dashboard. Do not start fresh. Keep `react-markdown` + `shiki`. No component library until the inbox and artifact pane exist. React Flow can wait; use a vertical step list.

**5. CLI parity**  
Yes — and invert it. **CLI is the API. GUI is a client.** Every button is one command:

```text
synapse products
synapse add <path>
synapse start <product>
synapse stop <product>
synapse resume <product>
synapse inbox
synapse approve <run-id> [--note "..."]
synapse reject <run-id> --note "..."
synapse status [<product>]
synapse artifacts <product> [--type spec|plan|review]
```

If a GUI action has no CLI verb, it is not done.

---

## GUI — what I would actually ship

Think “air-traffic for 2–3 repos,” not Linear.

```text
┌─ INBOX (default) ─────────────────────────────────────────┐
│ 2 gates · 1 escalate · 0 failed tests                     │
│                                                           │
│ FOX-CLI   PLAN GATE    T-014 persistence     [Open] [✓][✗]│
│ SYNAPSE   SPEC GATE    S-015 research-to-feat [Open] [✓][✗]│
│ SHIELD    ESCALATE     triage iter 3         [Open]       │
└───────────────────────────────────────────────────────────┘
┌─ PRODUCTS ──┐  ┌─ ARTIFACT ──────────────────────────────┐
│ ● synapse    │  │ F-041 Dark Mode          IN PROGRESS    │
│ ○ fox-cli    │  │ spec.md rendered                         │
│ ○ shield     │  │ tasks / tests / last review              │
│              │  │ [Approve] [Reject] [Open in editor]      │
└──────────────┘  └─────────────────────────────────────────┘
```

Tabs I would keep, in order of value:

| Surface | Why |
|---|---|
| Inbox | The only screen that pays rent daily |
| Product / Pipeline | Stepper + current job + last signal |
| Feature dossier | Spec + tasks + tests in one pane |
| Reviews | Read-only audit trail |
| Sprints | Later. Kanban is optional when you have 7 tasks |

Drop or postpone: drag-reorder future sprints, React Flow playground, fancy grouping animations, “Stop All” theater. `synapse stop --all` is enough.

`file://` links that open the editor: keep. That single decision keeps the GUI from becoming a second IDE.

Approve gate UX:

- Amber only when `status=waiting`  
- Artifact already open in the pane  
- Reject requires a note (empty reject is how specs rot)  
- Both actions are idempotent and write an audit line to `pipeline_runs`

---

## How to implement (solo, dogfood-first)

Dogfood Synapse on Synapse. Do not point it at Shield or Fox until the file protocol is stable. Your own registry (S-001…S-016) is the test corpus.

### Layer 0 — Protocol (1–3 days)

Freeze these and put JSON schemas or markdown templates in `docs/specs/`:

- feature-registry.yaml schema  
- spec template (Acceptance / High-Level Tasks / Test Contract)  
- task block format  
- plan template  
- PIPELINE_SIGNAL / TESTER_SIGNAL grammar  
- review severity tags `[BLOCKING]|[WARNING]|[INFO]` + `APPROVE|REQUEST_CHANGES`

If an agent output fails the schema, the job is `failed`, not “close enough.” This is the whole game.

### Layer 1 — Daemon as a state machine (3–7 days)

One Bun process, SQLite, no scheduler framework.

```text
idle → start → step → (running | waiting | stopping)
                  ↘ fail / escalate
resume → last completed step + 1
```

Implementation notes that will save you pain:

- **Do not poll the DB every 5s as the primary trigger.** Job subprocess exits → daemon reads the artifact’s last line → transitions. Polling is a watchdog, not the event loop.  
- Persist `current_step`, `last_signal`, `output_path` before spawning the next job. Crash safety is “replay from last completed step.”  
- Specialist invocation is one function: `runJob({ product, step, specialist, prompt, workspace })`. `agent-job.sh` stays the process boundary.  
- Grok’s workspace is a read-only bind or a wrapper that rejects writes. Enforce in the dispatcher, not in the prompt.  
- `auto_resume` default **off**. After a reboot you want to look at the inbox, not discover three agents mid-rewrite.

API can stay as you wrote it. Just make the CLI the first client. curl the REST API from `synapse` commands; GUI becomes the second client later.

### Layer 2 — Front door skill (2–4 days)

`synapse/skills/research-to-features/SKILL.md` is Phase 1, correctly. Make it strict:

1. Read research doc.  
2. Propose ≤ N features with id/name/user/trigger/outcome/non-goals.  
3. Stop for a dry-run report if invoked with `--draft`.  
4. On confirm, write registry rows (`status: planned`) + spec stubs.  
5. Print paths and “waiting on spec-review.”

Do not auto-start `make-plans`. The spec gate is the product.

### Layer 3 — Planning + implement loop (the rest of Phase 1)

Wire the cycle you already listed, but with hard stops:

- `make-plans` may only create tasks that map 1:1 to a numbered High-Level Task in an **approved** spec, plus standalone refactor/chore/bugfix if you pass them in.  
- Plans are ephemeral. When the task moves to `done/`, move the plan with it.  
- Tester failure → fix-tests cycle, not a new feature.  
- Triage: max 3 iterations, then `ESCALATE`. No “just one more loop.”  
- `rotate-phase` only if **all** feature tasks in the phase are done **and** spec tests green.

### Layer 4 — GUI (Phase 2, after you have used the CLI for real work)

Minimal dashboard:

- Vite + React you already have  
- Inbox query: `SELECT … WHERE status IN ('waiting','escalated','failed')`  
- Artifact pane: `react-markdown` + `shiki` over `artifacts.file_path`  
- Pipeline stepper from `pipeline_runs.current_step`  
- Buttons POST the existing approve/reject endpoints

Add Sprints / kanban / React Flow only after Inbox is something you actually open.

### Consolidation (do this as chores, not a phase)

Moving `fox/tools/jobs/mcp-*.ts` → `synapse/src/mcp/` is real work but not a feature. One refactor task with a rationale doc, tests = “existing MCP tools still resolve the right repo.” Do it before multi-repo GUI, after the daemon runs one product cleanly.

---

## Suggested Phase 1 cut (what “done” means)

Ship this and stop:

| Must land | Can wait |
|---|---|
| File schemas + validators | React Flow graph |
| Daemon + SQLite + graceful stop/resume | Portfolio DB polish |
| CLI: start/stop/inbox/approve/reject | Full tab GUI |
| research-to-features + spec review + spec gate | Watchdog intake |
| make-plans + plan gate | Sprint reorder UX |
| implement → tester signal → Grok review → triage loop | Multi-repo MCP generalization |
| Grok write-block in dispatcher | systemd unit |
| Consistency check on daemon start | Notifications product |

Your own S-005, S-006, S-009, S-010, S-015 are the Phase 1 spine. S-011–S-014 and S-016 are Phase 2 except the spec gate itself, which you need now (the gate is a status + CLI command, not a GUI).

---

## A few design additions worth writing into the doc

**Constitution file.** Spec Kit’s best idea: one `AGENTS.md` / `docs/constitution.md` that every specialist is required to read. You already have `synapse/AGENTS.md` on the create list. Make it the first context every job loads. Project rules do not belong in every spec.

**Evidence pack at each gate.** When a gate fires, the daemon writes a tiny index:

```text
GATE: plan
spec: docs/specs/F-041-dark-mode.md
plan: plans/current/...
review: docs/reviews/...
diffstat: 12 files, +400/-20
tests: pending
```

You review the pack, not a pile of tabs. This is the ACE idea (command environment gets a brief, not a chat log).

**Idempotent jobs.** Re-running `plan-review` must produce `...-iter{N+1}`, never overwrite iter 1. You have the filename pattern; enforce it in the dispatcher.

**Cost / token ledger per run.** Solo + two models + loops will surprise you. One `jobs.tokens_in/out` column now is cheaper than reconstructing it later.

**Human-written research stays human.** Do not let the pipeline “improve” `docs/research/` in place. Extraction reads it; it does not rewrite the source of intent.

**Branch policy.** Decide now: does `implement-plan` commit to `synapse/work/<run-id>` and open a PR, or commit to current? For dogfood, feature branches per pipeline run. Makes reject/rollback a checkout, not archaeology.

---

## Verdict

Do not broaden the vision. Narrow the first slice until it is a reliable compiler:

`research.md → features.yaml + specs → (you) → tasks + plans → (you) → code + spec-tests → green or escalate`

The daemon, the signal protocol, the two-model split, and the file layout are enough architecture. The dashboard is a viewer over that compiler. If you build the viewer first, you will debug UI state instead of whether F-041’s tests actually mean what the spec says.

If you want a next artifact I can write, the highest leverage one is a tight `docs/specs/feature-spec-format.md` plus the `research-to-features` SKILL.md — those two files are the front door. After that, a CLI command list with exact state transitions. Not more GUI mockups.