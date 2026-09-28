#!/usr/bin/env bun
/**
 * tools/jobs/registry.ts — Job presets for the Fox workspace
 *
 * Runs from the workspace root (fox/). Fox CLI test commands cd into fox-code-cli/.
 * Dev workflow commands (agy:*, grok:*) invoke agent-job.sh for skill-based tasks.
 *
 * @fox-feature F-JOBS-1: Job Scheduler & Dashboard — Job presets
 */

import { execSync } from "node:child_process"
import { join } from "node:path"

/** Workspace root — fox/ (the monorepo, not the submodule) */
const ROOT = join(import.meta.dir, "../..")

/** Fox CLI submodule — fox/fox-code-cli/ */
const FOX_CLI = join(ROOT, "fox-code-cli")

/** Prefix to run a command inside the fox-code-cli submodule */
const IN_CLI = `bash -c 'cd ${FOX_CLI} &&`

export interface JobDef {
  /** Human-readable job name */
  name: string
  /** Shell command to run (from workspace root) */
  command: string
  /** Serial group — only one job per group runs at a time */
  group?: string
  /** Timeout in ms (default: 60000) */
  timeout?: number
  /** Max retries on failure (default: 1) */
  retries?: number
  /** Higher priority = runs first (default: 0) */
  priority?: number
}

// ---------------------------------------------------------------------------
// Helper: wrap a fox-code-cli bun command so it runs from the submodule dir
// ---------------------------------------------------------------------------

function cli(cmd: string): string {
  return `${IN_CLI} ${cmd}'`
}

// ---------------------------------------------------------------------------
// Presets — each maps to one or more JobDefs
// ---------------------------------------------------------------------------

export const PRESETS: Record<string, JobDef[]> = {
  // ─── fox-code-cli test suites ────────────────────────────────────────────

  typecheck: [
    { name: "Typecheck", command: cli("bun run typecheck"), group: "typecheck", timeout: 45000, priority: 10 },
  ],

  smoke: [
    { name: "Typecheck", command: cli("bun run typecheck"), group: "typecheck", timeout: 45000, priority: 10 },
    { name: "Patch Tests", command: cli("bun test test/patch.test.ts test/transaction.test.ts test/transaction-confidence.test.ts --timeout 30000"), timeout: 35000 },
    { name: "Edit Tests", command: cli("bun test test/edit-replacers.test.ts test/encoding.test.ts --timeout 30000"), timeout: 35000 },
    { name: "Config Tests", command: cli("bun test test/config-merge.test.ts --timeout 30000"), timeout: 35000 },
    { name: "Compress Tests", command: cli("bun test packages/core/test/compress.test.ts packages/core/test/compression-roi.test.ts --timeout 30000"), timeout: 35000 },
    { name: "Autonomous Tests", command: cli("bun test test/oscillation.test.ts test/verification.test.ts test/repair-budget.test.ts --timeout 30000"), timeout: 35000 },
  ],

  ladder: [
    { name: "R0: Harness Honesty", command: cli("bun test test/ladder/r0-ci/promote.test.ts --timeout 30000"), timeout: 35000 },
    { name: "R2: Add Feature", command: cli("bun test test/ladder/r2-scoped/add-feature.test.ts --timeout 30000"), timeout: 35000 },
    { name: "R2: Fix Bug", command: cli("bun test test/ladder/r2-scoped/fix-bug.test.ts --timeout 30000"), timeout: 35000 },
    { name: "R2: Refactor", command: cli("bun test test/ladder/r2-scoped/refactor.test.ts --timeout 30000"), timeout: 35000 },
    { name: "R3: Classification", command: cli("bun test test/ladder/r3-classification/classify.test.ts --timeout 30000"), timeout: 35000 },
    { name: "R5: Monorepo Read", command: cli("bun test test/ladder/r5-compaction/monorepo-read.test.ts --timeout 30000"), timeout: 35000 },
    { name: "R5: Verbose Tests", command: cli("bun test test/ladder/r5-compaction/verbose-tests.test.ts --timeout 30000"), timeout: 35000 },
    { name: "R7: Safe-Stop", command: cli("bun test test/ladder/r7-safestop/sigterm-resume.test.ts --timeout 30000"), timeout: 35000 },
  ],

  packages: [
    { name: "pkg: effect-drizzle-sqlite", command: cli("bash -c 'cd packages/effect-drizzle-sqlite && bun test --timeout 30000'"), timeout: 35000 },
    { name: "pkg: fox-memory", command: cli("bash -c 'cd packages/fox-memory && bun test --timeout 30000'"), timeout: 35000 },
    { name: "pkg: sandbox", command: cli("bash -c 'cd packages/sandbox && bun test --timeout 30000'"), timeout: 35000 },
    { name: "pkg: http-recorder", command: cli("bash -c 'cd packages/http-recorder && bun test --timeout 30000'"), timeout: 35000 },
    { name: "pkg: tui", command: cli("bash -c 'cd packages/tui && bun test --timeout 30000'"), timeout: 35000 },
    { name: "pkg: core", command: cli("bash -c 'cd packages/core && bun test --timeout 30000'"), timeout: 35000 },
  ],

  tier: [
    { name: "Tier Tests", command: cli("bun test test/model-tier.test.ts test/model-profile.test.ts --timeout 10000"), timeout: 15000 },
  ],

  features: [
    { name: "Feature Matrix", command: cli("bun run test:features"), timeout: 30000 },
  ],

  scoreboard: [
    { name: "Scoreboard", command: cli("bun run scoreboard"), timeout: 120000, group: "scoreboard" },
  ],

  challenge: [
    { name: "Challenge Ladder", command: cli("bun run test:challenge"), timeout: 90000 },
  ],

  "bench:validate": [
    { name: "Bench: Validate Solutions", command: cli("bun benchmarks/runner.ts validate"), timeout: 60000 },
  ],

  "bench:scoring": [
    { name: "Bench: Scoring Tests", command: cli("bun test benchmarks/scoring.test.ts --timeout 10000"), timeout: 15000 },
  ],

  // ─── Dev workflow: AGY (Antigravity) ─────────────────────────────────────
  // Model routing: flash=bulk review/search, sonnet=implementation, opus=architecture
  // agent-job.sh usage: tools/agent-job.sh <cli> <skill> [model] [extra-prompt]

  "agy:review": [
    {
      name: "AGY: Code Review",
      command: `source ~/.bashrc && tools/agent-job.sh agy code-review gemini-3.8-flash`,
      timeout: 300000,
      group: "agy",
    },
  ],

  "agy:plan": [
    {
      name: "AGY: Make Plans",
      command: `source ~/.bashrc && tools/agent-job.sh agy make-plans claude-sonnet-4-6`,
      timeout: 300000,
      group: "agy",
    },
  ],

  "agy:implement": [
    {
      name: "AGY: Implement Plan",
      command: `source ~/.bashrc && tools/agent-job.sh agy implement-plan claude-sonnet-4-6`,
      timeout: 600000,
      group: "agy",
    },
  ],

  // ─── Dev workflow: Grok ───────────────────────────────────────────────────

  "grok:review": [
    {
      name: "Grok: Code Review",
      command: `tools/agent-job.sh grok code-review`,
      timeout: 300000,
      group: "grok",
    },
  ],

  "grok:plan": [
    {
      name: "Grok: Make Plans",
      command: `tools/agent-job.sh grok make-plans`,
      timeout: 300000,
      group: "grok",
    },
  ],

  "grok:implement": [
    {
      name: "Grok: Implement Plan",
      command: `tools/agent-job.sh grok implement-plan`,
      timeout: 600000,
      group: "grok",
    },
  ],

  // ─── Grok: Official Reviewer & Refiner ───────────────────────────────────
  // Grok reviews/refines what AGY produces. Output goes to docs/reviews/.

  "grok:task-review": [
    {
      name: "Grok: Task Review",
      command: `tools/agent-job.sh grok code-review "" "TASK REVIEW MODE. Do NOT review code. Instead review tasks/current/ against the codebase. For each task check: (1) file paths exist, (2) tier claims match docs/specs/*tier-capability-spec.yaml, (3) no duplicates across phases, (4) acceptance criteria are falsifiable, (5) feature IDs don't collide with feature-registry.yaml. Output a review doc to docs/reviews/ with BLOCKING/WARNING/INFO findings. Use ISO timestamp naming: YYYY-MM-DDTHH-MM_task-review-phase-<X>.md"`,
      timeout: 600000,
      group: "grok",
    },
  ],

  "grok:plan-review": [
    {
      name: "Grok: Plan Review",
      command: `tools/agent-job.sh grok code-review "" "PLAN REVIEW MODE. Review all plans in plans/current/ against: (1) the task descriptions in tasks/current/, (2) the feature registry, (3) the actual codebase. For each plan check: file paths exist, API contracts match existing signatures, acceptance criteria are testable, feature IDs match registry, target_repo is set. Output a review doc to docs/reviews/ with BLOCKING/WARNING/INFO findings. Use ISO timestamp naming: YYYY-MM-DDTHH-MM_plan-review-phase-<X>.md"`,
      timeout: 600000,
      group: "grok",
    },
  ],

  "grok:plan-refine": [
    {
      name: "Grok: Plan Refine",
      command: `tools/agent-job.sh grok refine-plan`,
      timeout: 300000,
      group: "grok",
    },
  ],

  "grok:code-review": [
    {
      name: "Grok: Implementation Review",
      command: `tools/agent-job.sh grok code-review "" "IMPLEMENTATION REVIEW MODE. Review recent commits against their plans in plans/current/. For each plan check: (1) all deliverables implemented, (2) @fox-feature tags present, (3) tests match acceptance criteria, (4) no dead code or orphaned imports, (5) architectural rules followed. Output a review doc to docs/reviews/ with BLOCKING/WARNING/INFO findings. Use ISO timestamp naming: YYYY-MM-DDTHH-MM_code-review-phase-<X>.md"`,
      timeout: 600000,
      group: "grok",
    },
  ],
}

// Composite preset: full fox-code-cli test suite
PRESETS.full = [
  ...PRESETS.typecheck,
  ...PRESETS.packages,
  ...PRESETS.smoke.filter((j) => j.name !== "Typecheck"), // Don't duplicate typecheck
  ...PRESETS.ladder,
  ...PRESETS.tier,
  ...PRESETS.features,
  ...PRESETS["bench:scoring"],
]

// ---------------------------------------------------------------------------
// Git helpers — run against the workspace root
// ---------------------------------------------------------------------------

export function getGitSha(): string {
  try {
    return execSync("GIT_TERMINAL_PROMPT=0 git rev-parse --short HEAD", {
      cwd: ROOT,
      encoding: "utf-8",
      timeout: 5000,
    }).trim()
  } catch {
    return "unknown"
  }
}

export function getGitBranch(): string {
  try {
    return execSync("GIT_TERMINAL_PROMPT=0 git rev-parse --abbrev-ref HEAD", {
      cwd: ROOT,
      encoding: "utf-8",
      timeout: 5000,
    }).trim()
  } catch {
    return "unknown"
  }
}

export function getPresetNames(): string[] {
  return Object.keys(PRESETS)
}
