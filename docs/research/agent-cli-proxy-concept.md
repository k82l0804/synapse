The thing I want is a **job proxy**, not an ACP server. The GUI agent should fire a prompt at HTTP and get a result later without sitting in a terminal loop.

## Why the GUI path is cheaper

In a GUI IDE the model’s tools are usually `fetch` / MCP HTTP. Those are one request, one response. The model does not have to keep the CLI on screen.

Against a console binary the same agent typically does:

1. `run_terminal_cmd` to start `grok -p …` or `claude -p …`
2. later turns: `read` the log / `tail` / “are you done?”
3. each of those turns ships the growing transcript back into the GUI model

That is the token leak. The CLI may already be streaming cheaply; the GUI model is paying to *watch* it.

A proxy fixes that if the GUI agent can do one of:

- **block on HTTP** until the CLI exits (simplest)
- **POST and get a callback** when the CLI exits (what you described)
- **write a result file** the IDE already knows how to read (backup if callbacks are flaky)

ACP is only an implementation detail inside the proxy. The GUI should never speak ACP.

## Shape of the product

One local process. GUI talks REST. Proxy talks to whatever CLI you named.

```
GUI IDE  --HTTP-->  proxy:8788  --spawn-->  claude | grok | agy | kilo
                       │
                       ├── POST callback_url when done
                       └── optional GET /jobs/:id  (debug only; GUI should not poll)
```

Minimum request:

```http
POST /v1/runs
{
  "cli": "claude",          // claude | grok | agy | kilo
  "model": "sonnet",
  "prompt": "Add a /health route and tests",
  "cwd": "/path/to/repo",
  "callback_url": "http://127.0.0.1:9xxx/job-done"
}
```

Immediate response:

```json
{ "id": "run_01", "status": "queued" }
```

Callback later (this is the payload the GUI model should see *once*):

```json
{
  "id": "run_01",
  "status": "succeeded",
  "cli": "claude",
  "model": "sonnet",
  "cwd": "/path/to/repo",
  "result_text": "Added /health and two tests. …",
  "exit_code": 0,
  "session_id": "vendor-session-…",
  "usage": { "input_tokens": 0, "output_tokens": 0 },
  "duration_ms": 184000,
  "log_path": "/tmp/cli-proxy/run_01.log"
}
```

The GUI agent’s tool description should be: *“Start a coding-CLI job. Do not poll. Wait for the callback or the HTTP response.”*

## Three ways the GUI can “wait” without polling

Pick one as v1. They are not equal.

**1. Synchronous HTTP (best first slice)**  
`POST /v1/runs` does not return until the CLI exits. The IDE HTTP tool holds the socket. No callback infra. Fails if the IDE tool timeout is 30–60s and the CLI runs 10 minutes.

Use this for short prompts. Add `?wait=true` so you can keep the same endpoint.

**2. Callback URL (what you want for long jobs)**  
Return `202` + `id`. Proxy POSTs `callback_url` on terminal states: `succeeded | failed | timeout | cancelled`.

Catch: the callback host must be reachable from the proxy. On the same machine that is `127.0.0.1`. Many GUI agents do **not** expose a stable inbound HTTP port. Then you need a tiny companion:

- a one-file webhook listener the IDE started, or
- an MCP server the IDE already loaded that owns `POST /job-done` and unblocks the tool.

If the IDE cannot receive HTTP, callbacks are fiction.

**3. Dropbox file (always works, ugly, reliable)**  
Proxy writes `~/.cli-proxy/runs/run_01.json` and optionally appends to a mailbox file. The GUI tool is “submit job” then, on a *later user turn* or a file watcher, “read mailbox.” That still costs a turn, but not a tight poll loop.

Practical v1: support **1 + 2 + file sidecar**. File is the fallback when the IDE has no callback listener.

## How to drive each CLI (keep this dumb)

Do **not** start with ACP. Use each vendor’s headless print mode. One process per run, kill on timeout.

| CLI | Command to wrap | Notes |
|---|---|---|
| Claude | `claude -p "$prompt" --model … --output-format json --permission-mode acceptEdits` | Cleanest. JSON has `result`, `session_id`, cost. `--resume` for follow-ups. |
| Grok | `grok --no-auto-update -p "$prompt" -m … --output-format json --always-approve` | Same idea. Avoid TUI. |
| Antigravity | `agy --print …` or whatever non-interactive flag exists | If print is empty, you are in PTY/DB-scraping land. Defer or mark `agy` experimental. |
| Kilo | `kilo run --auto "$prompt"` **or** HTTP to an already-running `kilo serve` | If Kilo serve is up, the proxy is just a router. |

Permissions: unattended runs must pass a yolo/accept-edits flag. Otherwise the child blocks on “allow this bash?” and your job hangs until timeout.

Working directory is part of the API, not implicit. The GUI must send `cwd`. Defaulting to the proxy’s cwd will edit the wrong tree.

## API worth implementing

```
POST   /v1/runs              body: cli, model, prompt, cwd, callback_url?,
                             timeout_s?, extra_args?, wait?
GET    /v1/runs/:id          status + result (for humans, not the model)
POST   /v1/runs/:id/cancel
GET    /v1/health            which binaries are on PATH
GET    /v1/clis              { claude: {ok, version}, grok: … }
```

Optional later, only if you need a second prompt on the same vendor session:

```
POST   /v1/runs/:id/followup   { prompt, callback_url? }
```

That maps to `claude -r $session_id -p …` / `grok -c` / etc. Still print-mode. Still no ACP.

Do **not** expose token streams to the GUI model. Streams are for your log file. The model should see the final summary only. Streaming into the GUI context is how you recreate the token problem.

## What the GUI tool looks like

One MCP or OpenAPI tool:

`run_cli_agent(cli, model, prompt, cwd, wait=true)`

Tool instructions (put this in the description, it matters):

- Call once per task.
- If `wait=true`, the response *is* the result. Do not call again.
- If `wait=false`, you get `{id}`. Stop. A callback or mailbox file will arrive. Do not poll `GET /v1/runs/:id` in a loop.
- Do not wrap this in `run_terminal_cmd`.

That last line is the whole product.

## Implementation plan

**Day 1 — process runner**  
Single binary or a small Python/Node service on `127.0.0.1:8788`.

- Registry of CLIs: binary name, version probe, argv template, how to parse stdout.
- Job store: sqlite (`id, status, pid, log_path, result_json, created_at`).
- Supervisor: spawn, cap stdout to a log file, timeout, SIGTERM then SIGKILL.
- `POST /v1/runs?wait=true` + `GET /health`.

Prove it with Claude only. If `claude -p --output-format json` works, the idea works.

**Day 2 — async + callback + file**  
- `202` path.
- On terminal state, POST callback (HMAC header, 3 retries with backoff).
- Always write `result.json` next to the log.
- `cancel`.

**Day 3 — Grok + Kilo templates**  
Same runner, different argv. Fail closed if the binary is missing (`GET /v1/clis`).

**Day 4 — GUI wiring**  
Expose the proxy as an MCP HTTP tool or a single `fetch` spec the IDE can import. Hard-code `wait=true` until you confirm the IDE can receive callbacks. Measure: one GUI turn to start, one GUI turn when done — not N turns of tail.

**Later, only if print-mode is insufficient**

- Persistent vendor sessions (follow-up prompts).
- ACP stdio *inside* the proxy for agents that have no good `-p`.
- Permission broker if you refuse yolo mode.
- Concurrent jobs per cwd (queue if two Claudes on one repo is unsafe).

## Design choices that will bite you

**IDE timeout vs CLI runtime.** If the HTTP tool dies at 60s, `wait=true` is unusable for real coding jobs. Discover that number first. If it is short, you must have callbacks or a mailbox; there is no third option.

**Callback reachability.** Proxy and IDE on the same box → `http://127.0.0.1:<ide-port>/…`. If the GUI cannot listen, do not pretend webhooks exist.

**Yolo vs hung child.** Unattended CLI without auto-approve is a deadlock.

**One job per repo unless you know the CLI is reentrant.** Two `claude -p` in one tree will fight over files.

**Do not proxy the TUI.** No PTY scraping in v1. If a CLI has no print mode, it is not supported yet. That is how `agy` becomes the last adapter, not the first.

**The proxy must not become another chat model.** It does not interpret the prompt. It only execs `argv + prompt` and ships the result back.

## A concrete v1 command line

```bash
cli-proxy serve --bind 127.0.0.1:8788 --jobs-dir ~/.cli-proxy
```

```bash
curl -sS http://127.0.0.1:8788/v1/runs?wait=true \
  -H 'content-type: application/json' \
  -d '{
    "cli": "claude",
    "model": "sonnet",
    "cwd": "/work/my-repo",
    "prompt": "Add a health endpoint and a test. Commit nothing."
  }'
```

If that JSON comes back with `result_text` and the GUI agent used a single HTTP tool to get it, the design is correct. ACP, daemons, and multi-client session stores are later optimizations, not the problem you described.
