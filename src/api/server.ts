#!/usr/bin/env bun
/**
 * tools/jobs/pipeline-api.ts — REST API backend for the pipeline dashboard
 *
 * Uses engine.getRunStatus(id) → { run, steps: StepResult[] }
 * Serves on port 4042. Vite dev proxy routes /api → here.
 */

import { join, resolve } from "node:path"
import { existsSync, readFileSync } from "node:fs"
import { execSync } from "node:child_process"
import { createPipelineEngine } from "./pipeline"

const ROOT = join(import.meta.dir, "../..")
const PORT = 4042
const ALLOWED_DIRS = [
  join(ROOT, "docs", "reviews"),
  join(ROOT, "plans"),
  join(ROOT, ".local", "pipelines", "logs"),
  join(ROOT, "tasks"),
]

function cors(headers: Headers): void {
  headers.set("Access-Control-Allow-Origin", "*")
  headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
  headers.set("Access-Control-Allow-Headers", "Content-Type")
}

function json(data: unknown, status = 200): Response {
  const h = new Headers({ "Content-Type": "application/json" })
  cors(h)
  return new Response(JSON.stringify(data, null, 2), { status, headers: h })
}

function text(data: string, status = 200): Response {
  const h = new Headers({ "Content-Type": "text/plain; charset=utf-8" })
  cors(h)
  return new Response(data, { status, headers: h })
}

function isAllowedPath(filePath: string): boolean {
  const resolved = resolve(filePath)
  return ALLOWED_DIRS.some(dir => resolved.startsWith(dir))
}

function currentPhase(): string {
  try {
    const files = execSync(`ls "${join(ROOT, "tasks", "current")}"`, { encoding: "utf-8" }).trim()
    const match = files.match(/phase-(\w+)/)
    return match ? match[1] : "unknown"
  } catch { return "unknown" }
}

/** Parse artifact paths from step output */
function parseArtifacts(output: unknown) {
  if (!output || typeof output !== "object") return []
  const o = output as Record<string, unknown>
  const arts: Array<{ label: string; path: string; type: "input" | "output" | "log" }> = []

  const add = (path: unknown, label: string, type: "input" | "output" | "log") => {
    if (typeof path === "string" && path.length > 0 && existsSync(path)) {
      if (!arts.some(a => a.path === path)) arts.push({ label, path, type })
    }
  }

  add(o.artifactPath,     "Output",       "output")
  add(o.reviewPath,       "Review Input", "input")
  add(o.logPath,          "Log",          "log")
  add(o.lastReviewPath,   "Last Review",  "output")
  add(o.lastTriagePath,   "Last Triage",  "output")

  if (Array.isArray(o.allArtifacts)) {
    for (const p of o.allArtifacts) {
      add(p, (p as string).split("/").at(-1) ?? p, "output")
    }
  }
  return arts
}

// ── Server ─────────────────────────────────────────────────────────────────

let engine: Awaited<ReturnType<typeof createPipelineEngine>> | null = null
async function getEngine() {
  if (!engine) engine = await createPipelineEngine()
  return engine
}

Bun.serve({
  port: PORT,
  async fetch(req: Request) {
    const url = new URL(req.url)

    if (req.method === "OPTIONS") {
      const h = new Headers()
      cors(h)
      return new Response(null, { status: 204, headers: h })
    }

    // GET /api/pipeline
    if (req.method === "GET" && url.pathname === "/api/pipeline") {
      try {
        const eng = await getEngine()
        const allRuns = await eng.listRuns({ limit: 20 })
        const phase = currentPhase()

        const runs = await Promise.all(
          allRuns.map(async run => {
            const info = await eng.getRunStatus(run.id).catch(() => null)
            const steps = (info?.steps ?? []).map((sr: any) => ({
              name: sr.name,
              status: sr.status,
              attempts: sr.attempts ?? 1,
              startedAt: sr.createdAt ? new Date(sr.createdAt).toISOString() : undefined,
              completedAt: sr.updatedAt ? new Date(sr.updatedAt).toISOString() : undefined,
              artifacts: parseArtifacts(sr.output),
              iterations: (sr.output as any)?.iterations,
              maxIterations: 3,
              error: sr.error ?? undefined,
            }))
            return { id: run.id, workflow: run.workflow, status: run.status,
              createdAt: new Date(run.createdAt).toISOString(), phase, steps }
          })
        )

        const active = allRuns.find(r =>
          ["running", "waiting", "pending", "sleeping"].includes(r.status)
        ) ?? allRuns[0]

        return json({ runs, activeRunId: active?.id ?? null })
      } catch (e) {
        return json({ error: String(e), runs: [], activeRunId: null }, 500)
      }
    }

    // GET /api/artifact?path=…
    if (req.method === "GET" && url.pathname === "/api/artifact") {
      const filePath = url.searchParams.get("path")
      if (!filePath) return text("Missing path", 400)
      if (!isAllowedPath(filePath)) return text("Path not allowed", 403)
      if (!existsSync(filePath)) return text(`Not found: ${filePath}`, 404)
      return text(readFileSync(filePath, "utf-8"))
    }

    // POST /api/approve
    if (req.method === "POST" && url.pathname === "/api/approve") {
      try {
        const body = await req.json() as { runId?: string }
        const eng = await getEngine()
        let targetId = body.runId
        if (!targetId) {
          const waiting = await eng.listRuns({ status: "waiting" })
          if (!waiting.length) return json({ error: "No pipeline waiting" }, 404)
          targetId = waiting[0].id
        }
        const sent = await eng.sendEvent(targetId, "approve-plans", { approved: true, at: new Date().toISOString() })
        return json({ success: sent, runId: targetId })
      } catch (e) { return json({ error: String(e) }, 500) }
    }

    if (url.pathname === "/health") return json({ ok: true })
    return text("Not Found", 404)
  },
})

console.log(`🦊 Pipeline API  http://localhost:${PORT}`)
