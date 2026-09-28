#!/usr/bin/env bun
/**
 * tools/jobs/daemon.ts — Fox Job Scheduler Daemon
 *
 * Polls the job queue, spawns test processes with concurrency control,
 * handles retries and timeouts, and starts the web dashboard.
 * @fox-feature F-JOBS-1: Job Scheduler & Dashboard — Queue processor
 */

import { getDb, LOG_DIR, type JobRow } from "./db"
import { readFileSync, mkdirSync } from "node:fs"
import { join } from "node:path"
import { startDashboard } from "./dashboard"

const ROOT = join(import.meta.dir, "../..")
const POLL_INTERVAL_MS = 2000

interface RunningJob {
  proc: ReturnType<typeof Bun.spawn>
  timeout: Timer
  startedAt: number
}

const running = new Map<number, RunningJob>()

function iso(): string {
  return new Date().toISOString()
}

/** On startup, reset any jobs left in 'running' state from a previous crash */
function resetStaleJobs(): void {
  const db = getDb()
  const stale = db.query("SELECT COUNT(*) as n FROM runs WHERE status = 'running'").get() as { n: number }
  if (stale.n > 0) {
    db.query("UPDATE runs SET status = 'pending' WHERE status = 'running'").run()
    console.log(`   ⚠ Reset ${stale.n} stale running job(s) to pending`)
  }
}

/** Main queue processor — find pending jobs and start them respecting constraints */
function processQueue(maxConcurrent: number): void {
  const db = getDb()

  if (running.size >= maxConcurrent) return

  const pending = db
    .query(
      `SELECT * FROM runs
       WHERE status = 'pending'
         AND (run_after IS NULL OR run_after <= strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
       ORDER BY priority DESC, created_at ASC`,
    )
    .all() as JobRow[]

  if (pending.length === 0) return

  // Collect serial groups that already have a running job
  const runningGroups = new Set<string>()
  for (const [id] of running) {
    const row = db.query("SELECT group_name FROM runs WHERE id = $id").get({ $id: id }) as {
      group_name: string | null
    } | null
    if (row?.group_name) runningGroups.add(row.group_name)
  }

  for (const job of pending) {
    if (running.size >= maxConcurrent) break
    if (job.group_name && runningGroups.has(job.group_name)) continue

    startJob(job)
    if (job.group_name) runningGroups.add(job.group_name)
  }
}

/** Spawn a child process for a job */
function startJob(job: JobRow): void {
  const db = getDb()

  // Prepare log directory and path
  const dateStr = new Date().toISOString().split("T")[0]
  const logDir = join(LOG_DIR, dateStr)
  mkdirSync(logDir, { recursive: true })

  const safeName = job.name.replace(/[^a-zA-Z0-9_-]/g, "_").toLowerCase()
  const logPath = join(logDir, `${job.id}_${safeName}.log`)

  const attempt = job.attempt + 1
  console.log(`   ▶ ${job.name} (attempt ${attempt}/${job.max_retries + 1})`)

  // Mark as running in DB
  db.query(
    "UPDATE runs SET status = 'running', started_at = $started, attempt = $attempt, log_path = $log WHERE id = $id",
  ).run({
    $started: iso(),
    $attempt: attempt,
    $log: logPath,
    $id: job.id,
  })

  // Spawn the process — bash handles the output redirect
  const proc = Bun.spawn(["bash", "-c", `${job.command} > "${logPath}" 2>&1`], {
    cwd: ROOT,
    env: { ...process.env, CI: "true", GIT_TERMINAL_PROMPT: "0" },
  })

  // Enforce timeout — two modes:
  // 1. Hard timeout (timeout_ms > 0): kill after fixed duration
  // 2. Liveness timeout (timeout_ms = 0): kill if log file stops growing for 60s
  const LIVENESS_CHECK_INTERVAL = 15_000   // Check every 15s
  const LIVENESS_STALE_THRESHOLD = 120_000  // Kill if no output for 120s (LLMs can think for a while)
  let lastLogSize = 0
  let lastActivityAt = Date.now()

  let timeoutHandle: Timer
  if (job.timeout_ms > 0) {
    // Hard timeout
    timeoutHandle = setTimeout(() => {
      console.log(`   ⏰ Timeout: ${job.name} (${(job.timeout_ms / 1000).toFixed(0)}s limit)`)
      try { proc.kill() } catch { /* already dead */ }
      running.delete(job.id)
      finishJob(job.id, null, "timeout")
    }, job.timeout_ms)
  } else {
    // Liveness timeout — check log file growth periodically
    // For buffered processes (like agy -p), also check if process is alive
    timeoutHandle = setInterval(() => {
      try {
        const stat = Bun.file(logPath)
        const currentSize = stat.size
        if (currentSize > lastLogSize) {
          lastLogSize = currentSize
          lastActivityAt = Date.now()
        } else {
          // Check if process is still alive
          const isAlive = !proc.killed && proc.exitCode === null
          const idleMs = Date.now() - lastActivityAt
          if (isAlive && idleMs > LIVENESS_STALE_THRESHOLD) {
            const idleSec = (idleMs / 1000).toFixed(0)
            console.log(`   ⏰ Stale: ${job.name} (no output for ${idleSec}s, process alive but unresponsive)`)
            try { proc.kill() } catch { /* already dead */ }
            running.delete(job.id)
            clearInterval(timeoutHandle)
            finishJob(job.id, null, "timeout")
          }
          // If process is not alive, let the .exited handler deal with it
        }
      } catch { /* log file doesn't exist yet, keep waiting */ }
    }, LIVENESS_CHECK_INTERVAL) as unknown as Timer
  }

  running.set(job.id, { proc, timeout: timeoutHandle, startedAt: Date.now() })

  // Handle normal completion
  proc.exited
    .then((exitCode: number) => {
      const entry = running.get(job.id)
      if (!entry) return // Already handled by timeout
      if (job.timeout_ms > 0) clearTimeout(entry.timeout)
      else clearInterval(entry.timeout)
      running.delete(job.id)
      finishJob(job.id, exitCode, exitCode === 0 ? "passed" : "failed")
    })
    .catch(() => {
      const entry = running.get(job.id)
      if (!entry) return
      if (job.timeout_ms > 0) clearTimeout(entry.timeout)
      else clearInterval(entry.timeout)
      running.delete(job.id)
      finishJob(job.id, 1, "failed")
    })
}

/** Record job completion, handle retries */
function finishJob(id: number, exitCode: number | null, status: string): void {
  const db = getDb()
  const job = db.query("SELECT * FROM runs WHERE id = $id").get({ $id: id }) as JobRow | null
  if (!job) return

  const durationMs = job.started_at ? Math.round(Date.now() - new Date(job.started_at).getTime()) : null
  const errorSummary = status !== "passed" ? getErrorSummary(job.log_path) : null

  // Retry if eligible
  if (status === "failed" && job.attempt < job.max_retries) {
    console.log(`   ↻ Retry queued: ${job.name} (${job.attempt}/${job.max_retries})`)
    db.query(
      `UPDATE runs SET status = 'pending', finished_at = $finished, duration_ms = $dur,
       exit_code = $exit, error_summary = $err WHERE id = $id`,
    ).run({
      $finished: iso(),
      $dur: durationMs,
      $exit: exitCode,
      $err: errorSummary,
      $id: id,
    })
    return
  }

  // Final result
  const icon = status === "passed" ? "✅" : status === "timeout" ? "⏰" : "❌"
  const durStr = durationMs ? `${(durationMs / 1000).toFixed(1)}s` : "?"
  console.log(`   ${icon} ${job.name} — ${status} (${durStr})`)

  db.query(
    `UPDATE runs SET status = $status, finished_at = $finished, duration_ms = $dur,
     exit_code = $exit, error_summary = $err WHERE id = $id`,
  ).run({
    $status: status,
    $finished: iso(),
    $dur: durationMs,
    $exit: exitCode,
    $err: errorSummary,
    $id: id,
  })

  // Check if entire batch is complete
  const remaining = db
    .query("SELECT COUNT(*) as n FROM runs WHERE batch_id = $batch AND status IN ('pending', 'running')")
    .get({ $batch: job.batch_id }) as { n: number }

  if (remaining.n === 0) {
    const batchResults = db
      .query("SELECT status, COUNT(*) as n FROM runs WHERE batch_id = $batch GROUP BY status")
      .all({ $batch: job.batch_id }) as Array<{ status: string; n: number }>

    const summary = batchResults.map((r) => `${r.n} ${r.status}`).join(", ")
    console.log(`   📦 Batch ${job.batch_id} complete: ${summary}`)
    console.log()
  }
}

/** Extract a one-line error summary from the log file */
function getErrorSummary(logPath: string | null): string | null {
  if (!logPath) return null
  try {
    const content = readFileSync(logPath, "utf-8")
    const lines = content.split("\n")
    const errorLine = lines.find(
      (l) =>
        l.includes("error:") ||
        l.includes("FAIL") ||
        l.includes("AssertionError") ||
        l.includes("Expected") ||
        l.includes("expect("),
    )
    const result = errorLine?.trim() ?? lines.filter((l) => l.trim()).pop()?.trim() ?? null
    return result?.slice(0, 200) ?? null
  } catch {
    return null
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function startDaemon(options: { port?: number; maxConcurrent?: number } = {}): void {
  const maxConcurrent = options.maxConcurrent ?? 4
  const port = options.port ?? 4040

  console.log()
  console.log("🦊 Fox Job Scheduler Daemon")
  console.log(`   Max concurrent: ${maxConcurrent}`)

  resetStaleJobs()
  startDashboard(port)

  // Immediate first poll
  processQueue(maxConcurrent)

  // Continuous polling
  setInterval(() => processQueue(maxConcurrent), POLL_INTERVAL_MS)

  console.log("   Waiting for jobs... (Ctrl+C to stop)")
  console.log()
}

/** Current number of in-flight processes (for dashboard) */
export function getRunningCount(): number {
  return running.size
}
