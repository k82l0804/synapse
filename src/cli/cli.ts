#!/usr/bin/env bun
/**
 * tools/jobs/cli.ts — CLI entry point for Fox Job Scheduler
 *
 * Usage:
 *   bun run jobs daemon                    Start daemon + web dashboard
 *   bun run jobs push smoke                Push a preset to the queue
 *   bun run jobs push ladder               Push ladder tests
 *   bun run jobs push full                 Push everything
 *   bun run jobs push --cmd "bun test ..." Push a custom command
 *   bun run jobs status                    Show current queue status
 *   bun run jobs history                   Show recent results
 *   bun run jobs history --fails           Show failures only
 *   bun run jobs clear                     Clear completed jobs
 * @fox-feature F-JOBS-1: Job Scheduler & Dashboard — CLI entry point
 */

import { join } from "node:path"
import { getDb, insertJob, getStatusCounts, type JobRow } from "./db"
import { PRESETS, getPresetNames, getGitSha, getGitBranch, type JobDef } from "./registry"
import { startDaemon } from "./daemon"
import {
  startPipeline, resumeLatestPipeline, showPipelineStatus, listPipelines,
  approvePipeline, describePipelines, getPipelineNames, PIPELINE_NAMES,
} from "./pipeline"

const args = process.argv.slice(2)
const command = args[0]

switch (command) {
  case "daemon":
    cmdDaemon()
    break
  case "push":
    cmdPush()
    break
  case "status":
    cmdStatus()
    break
  case "history":
    cmdHistory()
    break
  case "clear":
    cmdClear()
    break
  case "pipeline":
    cmdPipeline()
    break
  default:
    cmdHelp()
    break
}

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

function cmdDaemon(): void {
  const port = parseInt(getArg("--port") ?? "4040", 10)
  const maxConcurrent = parseInt(getArg("--max-concurrent") ?? "4", 10)
  startDaemon({ port, maxConcurrent })
}

function cmdPush(): void {
  const db = getDb()
  const batchId = Date.now().toString(36)
  const gitSha = getGitSha()
  const gitBranch = getGitBranch()
  const retries = parseInt(getArg("--retries") ?? "1", 10)
  const afterRaw = getArg("--after")
  const runAfter = afterRaw ? parseAfter(afterRaw) : null

  let jobs: JobDef[]
  const customCmd = getArg("--cmd")

  if (customCmd) {
    // Custom command — support --timeout (ms) and --name flags
    const customName = getArg("--name") ?? customCmd.slice(0, 60)
    const customTimeout = parseInt(getArg("--timeout") ?? "60000", 10)
    jobs = [{ name: customName, command: customCmd, timeout: customTimeout }]
  } else {
    const presetName = args[1]
    if (!presetName || !PRESETS[presetName]) {
      console.error(`Unknown preset: "${presetName ?? ""}"`)
      console.error(`Available presets: ${getPresetNames().join(", ")}`)
      process.exit(1)
    }
    jobs = PRESETS[presetName]
  }

  for (const job of jobs) {
    insertJob(db, {
      batch_id: batchId,
      name: job.name,
      command: job.command,
      group_name: job.group ?? null,
      timeout_ms: job.timeout ?? 60000,
      max_retries: retries,
      priority: job.priority ?? 0,
      git_sha: gitSha,
      git_branch: gitBranch,
      run_after: runAfter,
    })
  }

  console.log()
  console.log(`📥 Pushed ${jobs.length} job(s) to queue`)
  console.log(`   Batch:  ${batchId}`)
  console.log(`   SHA:    ${gitSha}`)
  console.log(`   Branch: ${gitBranch}`)
  if (runAfter) {
    console.log(`   🕐 Scheduled: ${new Date(runAfter).toLocaleString()}`)
  }
  console.log()
  for (const job of jobs) {
    const group = job.group ? ` [serial: ${job.group}]` : ""
    console.log(`   • ${job.name}${group}`)
  }
  console.log()
  console.log(`Start daemon to run: bun run jobs daemon`)
}

function cmdStatus(): void {
  const db = getDb()
  const counts = getStatusCounts(db)

  console.log()
  console.log("🦊 Fox Job Scheduler — Status")
  console.log("─".repeat(60))
  console.log(
    `   Pending: ${counts.pending}   Running: ${counts.running}   Passed: ${counts.passed}   Failed: ${counts.failed + counts.timeout}`,
  )

  const active = db
    .query("SELECT * FROM runs WHERE status = 'running' ORDER BY started_at ASC")
    .all() as JobRow[]

  if (active.length > 0) {
    console.log()
    console.log("▶ Active:")
    for (const job of active) {
      const elapsed = job.started_at
        ? `${((Date.now() - new Date(job.started_at).getTime()) / 1000).toFixed(1)}s`
        : "?"
      console.log(`   🔵 ${job.name} (${elapsed}, attempt ${job.attempt})`)
    }
  }

  const pending = db
    .query("SELECT * FROM runs WHERE status = 'pending' ORDER BY priority DESC, created_at ASC")
    .all() as JobRow[]

  if (pending.length > 0) {
    console.log()
    console.log("⏳ Queue:")
    for (const job of pending) {
      const group = job.group_name ? ` [serial: ${job.group_name}]` : ""
      console.log(`   ○ ${job.name}${group}`)
    }
  }

  if (counts.total === 0) {
    console.log()
    console.log("   Queue is empty. Push jobs with: bun run jobs push <preset>")
  }

  console.log()
}

function cmdHistory(): void {
  const db = getDb()
  const limit = parseInt(getArg("--limit") ?? "30", 10)
  const failsOnly = args.includes("--fails")

  const whereClause = failsOnly
    ? "WHERE status IN ('failed', 'timeout')"
    : "WHERE status IN ('passed', 'failed', 'timeout')"

  const rows = db
    .query(`SELECT * FROM runs ${whereClause} ORDER BY finished_at DESC LIMIT $limit`)
    .all({ $limit: limit }) as JobRow[]

  if (rows.length === 0) {
    console.log("\n   No results yet.\n")
    return
  }

  console.log()
  console.log(`📋 Recent Results${failsOnly ? " (failures only)" : ""} — last ${rows.length}`)
  console.log("─".repeat(90))
  console.log(
    "   " +
      "Status".padEnd(9) +
      "Name".padEnd(36) +
      "Duration".padStart(10) +
      "  SHA".padEnd(10) +
      "  Finished",
  )
  console.log("─".repeat(90))

  for (const row of rows) {
    const icon = row.status === "passed" ? "✅" : row.status === "timeout" ? "⏰" : "❌"
    const dur = row.duration_ms ? `${(row.duration_ms / 1000).toFixed(1)}s` : "—"
    const sha = row.git_sha?.slice(0, 7) ?? "?"
    const finished = row.finished_at
      ? new Date(row.finished_at).toLocaleString("en-US", {
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        })
      : "—"

    console.log(
      `   ${icon} ${row.status.padEnd(7)} ${row.name.padEnd(34)} ${dur.padStart(10)}  ${sha.padEnd(9)} ${finished}`,
    )
    if (row.error_summary) {
      console.log(`      ↳ ${row.error_summary.slice(0, 80)}`)
    }
  }
  console.log()
}

function cmdClear(): void {
  const db = getDb()
  const count = db
    .query("SELECT COUNT(*) as n FROM runs WHERE status IN ('passed', 'failed', 'timeout')")
    .get() as { n: number }
  db.query("DELETE FROM runs WHERE status IN ('passed', 'failed', 'timeout')").run()
  console.log(`\n   🗑 Cleared ${count.n} completed job(s)\n`)
}

function cmdHelp(): void {
  console.log(`
🦊 Fox Job Scheduler

Usage: bun run jobs <command> [options]

Commands:
  daemon              Start the daemon + web dashboard
  push <preset>       Push a preset to the job queue
  push --cmd "..."    Push a custom command
  status              Show current queue status
  history             Show recent results
  clear               Remove completed jobs from database

Presets:
  ${getPresetNames().join(", ")}

Options:
  --port <n>          Dashboard port (default: 4040)
  --max-concurrent <n> Max parallel jobs (default: 4)
  --retries <n>       Override max retries for pushed jobs (default: 1)
  --after <time>      Delay execution until a future time
  --limit <n>         Number of history rows (default: 30)
  --fails             Show failures only (history command)

Time formats for --after:
  +30m                30 minutes from now
  +6h                 6 hours from now
  +1d                 Tomorrow same time
  2:00AM              Next occurrence of 2:00 AM
  14:30               Next occurrence of 14:30
  2026-09-27T02:00    Exact ISO timestamp

Examples:
  bun run jobs daemon                        # Start daemon
  bun run jobs push smoke                    # Push smoke tests
  bun run jobs push full --retries 2         # Push all tests with 2 retries
  bun run jobs push challenge --after 2:00AM # Schedule challenge for 2 AM
  bun run jobs push showdown --after +6h     # Run showdown in 6 hours
  bun run jobs status                        # Check what's running
  bun run jobs history --fails --limit 10    # Recent failures

Pipelines (automated multi-step workflows):
  bun run jobs pipeline phase                # Full phase: review → plan → implement
  bun run jobs pipeline plan                 # Just: review → plan → refine
  bun run jobs pipeline implement            # Just: implement → test → review
  bun run jobs pipeline resume               # Resume a stopped/escalated pipeline
  bun run jobs pipeline status               # Show pipeline progress
  bun run jobs pipeline list                 # List all pipelines
`)
}

async function cmdPipeline(): Promise<void> {
  const subcommand = args[1]

  switch (subcommand) {
    case "phase":
    case "plan":
    case "implement": {
      try {
        const runId = await startPipeline(subcommand)
        console.log(`\nPipeline run: ${runId}`)
      } catch (err) {
        console.error(`Pipeline error: ${(err as Error).message}`)
        process.exit(1)
      }
      break
    }

    case "resume": {
      try {
        const runId = await resumeLatestPipeline()
        if (runId) {
          console.log(`\nResumed pipeline: ${runId}`)
        }
      } catch (err) {
        console.error(`Resume error: ${(err as Error).message}`)
        process.exit(1)
      }
      break
    }

    case "approve": {
      const runId = args[2] // optional — auto-finds the waiting run
      try {
        await approvePipeline(runId)
      } catch (err) {
        console.error(`Approve error: ${(err as Error).message}`)
        process.exit(1)
      }
      break
    }

    case "status": {
      await showPipelineStatus()
      break
    }

    case "list": {
      await listPipelines()
      break
    }

    case "dashboard": {
      const { spawn } = await import("node:child_process")
      const dir = join(import.meta.dir, "pipeline-dashboard")
      const port = args[2] ?? "4041"
      console.log()
      console.log("🦊 Fox Pipeline Dashboard")
      console.log(`   API server : http://localhost:4042`)
      console.log(`   Dashboard  : http://localhost:${port}`)
      console.log()
      // Start API server
      const api = spawn("bun", [join(import.meta.dir, "pipeline-api.ts")], {
        stdio: "inherit",
        env: { ...process.env },
      })
      // Start Vite dev server
      await new Promise<void>((resolve) => setTimeout(resolve, 800))
      const vite = spawn("npm", ["run", "dev"], {
        cwd: dir,
        stdio: "inherit",
        env: { ...process.env },
      })
      console.log(`   Open: http://localhost:${port}`)
      process.on("SIGINT", () => { api.kill(); vite.kill(); process.exit(0) })
      await new Promise(() => {}) // keep running
      break
    }

    default: {
      console.log("Pipeline commands:")
      console.log()
      console.log("  Start a pipeline:")
      console.log(describePipelines())
      console.log()
      console.log("  Manage pipelines:")
      console.log("    bun run jobs pipeline approve              # Approve waiting plans")
      console.log("    bun run jobs pipeline resume               # Resume a failed pipeline")
      console.log("    bun run jobs pipeline status               # Show active pipelines")
      console.log("    bun run jobs pipeline list                 # List all pipelines")
      console.log("    bun run jobs pipeline dashboard            # Visual graph dashboard (http://localhost:4041)")
      console.log()
      console.log("  Powered by reflow-ts (durable execution, crash recovery).")
      break
    }
  }
}

// ---------------------------------------------------------------------------
// Arg helpers
// ---------------------------------------------------------------------------

function getArg(flag: string): string | undefined {
  const idx = args.indexOf(flag)
  return idx >= 0 && idx + 1 < args.length ? args[idx + 1] : undefined
}

/**
 * Parse a time expression into an ISO timestamp.
 * Supports: +30m, +6h, +1d, 2:00AM, 14:30, ISO timestamps
 */
function parseAfter(value: string): string {
  // Relative: +30m, +6h, +1d, +90s
  const relMatch = value.match(/^\+(\d+)([smhd])$/i)
  if (relMatch) {
    const amount = parseInt(relMatch[1], 10)
    const unit = relMatch[2].toLowerCase()
    const multipliers: Record<string, number> = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 }
    return new Date(Date.now() + amount * multipliers[unit]).toISOString()
  }

  // Time of day: 2:00AM, 2:00am, 14:30, 2AM, 11pm
  const timeMatch = value.match(/^(\d{1,2}):?(\d{2})?\s*(am|pm)?$/i)
  if (timeMatch) {
    let hours = parseInt(timeMatch[1], 10)
    const minutes = parseInt(timeMatch[2] ?? "0", 10)
    const ampm = timeMatch[3]?.toLowerCase()

    if (ampm === "pm" && hours < 12) hours += 12
    if (ampm === "am" && hours === 12) hours = 0

    const target = new Date()
    target.setHours(hours, minutes, 0, 0)

    // If already past, schedule for tomorrow
    if (target.getTime() <= Date.now()) {
      target.setDate(target.getDate() + 1)
    }

    return target.toISOString()
  }

  // ISO timestamp or other parseable date string
  const date = new Date(value)
  if (!isNaN(date.getTime())) {
    return date.toISOString()
  }

  console.error(`Cannot parse time: "${value}"`)
  console.error(`Use: +6h, +30m, 2:00AM, 14:30, or an ISO timestamp`)
  process.exit(1)
}
