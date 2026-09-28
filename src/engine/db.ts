#!/usr/bin/env bun
/**
 * tools/jobs/db.ts — SQLite database for Fox Job Scheduler
 *
 * Stores job runs with status tracking, timing, and log references.
 * Database: ~/.local/state/fox/jobs.sqlite
 * Logs: ~/.local/state/fox/job-logs/<date>/
 * @fox-feature F-JOBS-1: Job Scheduler & Dashboard — SQLite database
 */

import { Database } from "bun:sqlite"
import { mkdirSync } from "node:fs"
import { join } from "node:path"
import { homedir } from "node:os"

export const STATE_DIR = join(homedir(), ".local", "state", "fox")
export const LOG_DIR = join(STATE_DIR, "job-logs")
export const DB_PATH = join(STATE_DIR, "jobs.sqlite")

export interface JobRow {
  id: number
  batch_id: string
  name: string
  command: string
  group_name: string | null
  timeout_ms: number
  max_retries: number
  priority: number
  status: "pending" | "running" | "passed" | "failed" | "timeout"
  attempt: number
  git_sha: string | null
  git_branch: string | null
  created_at: string
  started_at: string | null
  finished_at: string | null
  duration_ms: number | null
  exit_code: number | null
  log_path: string | null
  error_summary: string | null
  run_after: string | null
}

let _db: Database | null = null

export function getDb(): Database {
  if (_db) return _db

  mkdirSync(STATE_DIR, { recursive: true })
  mkdirSync(LOG_DIR, { recursive: true })

  _db = new Database(DB_PATH)
  _db.exec("PRAGMA journal_mode = WAL")
  _db.exec("PRAGMA busy_timeout = 5000")

  _db.exec(`
    CREATE TABLE IF NOT EXISTS runs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      batch_id TEXT NOT NULL,
      name TEXT NOT NULL,
      command TEXT NOT NULL,
      group_name TEXT,
      timeout_ms INTEGER NOT NULL DEFAULT 60000,
      max_retries INTEGER NOT NULL DEFAULT 1,
      priority INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'pending',
      attempt INTEGER NOT NULL DEFAULT 0,
      git_sha TEXT,
      git_branch TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      started_at TEXT,
      finished_at TEXT,
      duration_ms INTEGER,
      exit_code INTEGER,
      log_path TEXT,
      error_summary TEXT,
      run_after TEXT
    )
  `)

  // Migration: add run_after for existing databases
  const hasRunAfter = _db.query(
    "SELECT COUNT(*) as n FROM pragma_table_info('runs') WHERE name = 'run_after'"
  ).get() as { n: number }
  if (hasRunAfter.n === 0) {
    _db.exec("ALTER TABLE runs ADD COLUMN run_after TEXT")
  }

  _db.exec("CREATE INDEX IF NOT EXISTS idx_runs_status ON runs(status)")
  _db.exec("CREATE INDEX IF NOT EXISTS idx_runs_batch ON runs(batch_id)")
  _db.exec("CREATE INDEX IF NOT EXISTS idx_runs_created ON runs(created_at DESC)")

  return _db
}

export function insertJob(db: Database, job: {
  batch_id: string
  name: string
  command: string
  group_name?: string | null
  timeout_ms?: number
  max_retries?: number
  priority?: number
  git_sha?: string | null
  git_branch?: string | null
  run_after?: string | null
}): number {
  const row = db
    .query(
      `INSERT INTO runs (batch_id, name, command, group_name, timeout_ms, max_retries, priority, git_sha, git_branch, run_after, created_at)
       VALUES ($batch_id, $name, $command, $group_name, $timeout_ms, $max_retries, $priority, $git_sha, $git_branch, $run_after, datetime('now'))
       RETURNING id`,
    )
    .get({
      $batch_id: job.batch_id,
      $name: job.name,
      $command: job.command,
      $group_name: job.group_name ?? null,
      $timeout_ms: job.timeout_ms ?? 60000,
      $max_retries: job.max_retries ?? 1,
      $priority: job.priority ?? 0,
      $git_sha: job.git_sha ?? null,
      $git_branch: job.git_branch ?? null,
      $run_after: job.run_after ?? null,
    }) as { id: number }

  return row.id
}

export function getStatusCounts(db: Database) {
  const count = (status: string) =>
    (db.query("SELECT COUNT(*) as n FROM runs WHERE status = $s").get({ $s: status }) as { n: number }).n

  return {
    total: (db.query("SELECT COUNT(*) as n FROM runs").get() as { n: number }).n,
    pending: count("pending"),
    running: count("running"),
    passed: count("passed"),
    failed: count("failed"),
    timeout: count("timeout"),
  }
}
