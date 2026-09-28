#!/usr/bin/env bun
/**
 * tools/jobs/pipeline.ts — Iterative, artifact-driven pipeline engine
 *
 * Review cycles loop until the reviewer produces a clean pass:
 *   implement → [code-review-cycle] → full-tests → walkthrough
 *
 * Each cycle:
 *   Grok review → AGY Opus triage → if AUTO-FIX=0: PASS
 *                                  → if ESCALATE>0: pause for human
 *                                  → else: fix → repeat (max 3 iterations)
 *
 * @fox-feature F-JOBS-1
 */

import { createWorkflow, createEngine } from "reflow-ts"
import { SQLiteStorage } from "reflow-ts/sqlite-bun"
import { z } from "zod"
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs"
import { join } from "node:path"
import { execSync } from "node:child_process"

const ROOT      = join((import.meta as any).dir, "../..")
const STATE_DIR = join(ROOT, ".local", "pipelines")
const DB_PATH   = join(STATE_DIR, "workflows.sqlite")
const REVIEW_DIR = join(ROOT, "docs", "reviews")
const PLANS_DIR  = join(ROOT, "plans", "current")
const LOG_DIR    = join(STATE_DIR, "logs")

mkdirSync(STATE_DIR,  { recursive: true })
mkdirSync(REVIEW_DIR, { recursive: true })
mkdirSync(PLANS_DIR,  { recursive: true })
mkdirSync(LOG_DIR,    { recursive: true })

// ── Helpers ────────────────────────────────────────────────────────────────

function timestamp(): string {
  return new Date().toISOString().slice(0, 16).replace(":", "-")
}

function currentPhase(): string {
  try {
    const files = execSync(`ls "${join(ROOT, "tasks", "current")}"`, { encoding: "utf-8" }).trim()
    const match = files.match(/phase-(\w+)/)
    return match ? match[1] : "unknown"
  } catch { return "unknown" }
}

function reviewArtifact(type: string, iter?: number): string {
  const suffix = iter !== undefined ? `-iter${iter}` : ""
  return join(REVIEW_DIR, `${timestamp()}_${type}${suffix}-phase-${currentPhase()}.md`)
}

function stepLog(type: string): string {
  const dir = join(LOG_DIR, new Date().toISOString().split("T")[0])
  mkdirSync(dir, { recursive: true })
  return join(dir, `${Date.now()}_${type}.log`)
}

function gitHead(): string {
  try {
    return execSync("GIT_TERMINAL_PROMPT=0 git rev-parse HEAD", {
      cwd: join(ROOT, "fox-code-cli"), encoding: "utf-8", timeout: 5000,
    }).trim()
  } catch { return "unknown" }
}

/** Parse the PIPELINE_SIGNAL from a triage doc */
function parseTriageSignal(triagePath: string): { autoFix: number; escalate: number } {
  try {
    const content = readFileSync(triagePath, "utf-8")
    const match = content.match(/<!--\s*PIPELINE_SIGNAL:\s*AUTO-FIX=(\d+)\s+ESCALATE=(\d+)\s*-->/)
    if (match) return { autoFix: parseInt(match[1]), escalate: parseInt(match[2]) }
  } catch { /* file missing or unreadable */ }
  // If signal is missing, assume there's work to do (fail-safe: keep looping)
  console.log("   ⚠  No PIPELINE_SIGNAL found in triage doc — assuming AUTO-FIX>0")
  return { autoFix: 1, escalate: 0 }
}

async function runStep(
  command: string,
  log: string,
  signal: AbortSignal,
): Promise<{ exitCode: number }> {
  const { spawn } = await import("node:child_process")
  const exitCode = await new Promise<number>((resolve) => {
    const proc = spawn("bash", ["-c", `${command} > "${log}" 2>&1`], {
      cwd: ROOT,
      env: { ...process.env, CI: "true", GIT_TERMINAL_PROMPT: "0" },
      signal,
    })
    proc.on("close", resolve)
    proc.on("error", () => resolve(1))
  })
  console.log(`   ${exitCode === 0 ? "✅" : "❌"} exit ${exitCode}  log: ${log}`)
  return { exitCode }
}

function verifyArtifact(path: string, step: string): void {
  if (!existsSync(path))
    throw new Error(`Step '${step}' did not produce expected artifact:\n  ${path}`)
}

// ── Review Cycle Loop ──────────────────────────────────────────────────────
//
// Runs: Grok review → AGY Opus triage → fix → repeat until PASS or max
//
// Returns the final triage artifact and pass/escalate status.
// ──────────────────────────────────────────────────────────────────────────

interface CycleContext {
  type: "task" | "plan" | "code"
  /** Where the reviewer should look for things to review */
  reviewTarget: string
  /** Where the fixer should apply fixes */
  fixTarget: string
  /** Extra context (e.g. plans dir path) passed to agents */
  extraContext?: string
  /** Grok skill name */
  reviewSkill: "task-review" | "plan-review" | "code-review"
  /** AGY fix skill + model */
  fixSkill: string
  fixModel: string
  maxIterations?: number
}

interface CycleResult {
  passed: boolean
  escalated: boolean
  iterations: number
  lastReviewPath: string
  lastTriagePath: string
  allArtifacts: string[]
}

async function runReviewCycle(
  ctx: CycleContext,
  signal: AbortSignal,
): Promise<CycleResult> {
  const max = ctx.maxIterations ?? 3
  const allArtifacts: string[] = []
  let lastReviewPath = ""
  let lastTriagePath = ""

  for (let i = 1; i <= max; i++) {
    console.log(`\n   ┌─ ${ctx.type.toUpperCase()} REVIEW CYCLE — Iteration ${i}/${max} ─────────────────`)

    // ── Grok: Review ────────────────────────────────────────────────────
    console.log(`   │  Grok: ${ctx.reviewSkill}`)
    const reviewPath = reviewArtifact(`${ctx.type}-review`, i)
    const reviewLog  = stepLog(`${ctx.type}-review-iter${i}`)
    console.log(`   │  📄 ${reviewPath}`)

    const contextNote = ctx.extraContext ? ` Context: ${ctx.extraContext}.` : ""
    const { exitCode: reviewExit } = await runStep(
      `source ~/.bashrc && JOB_TIMEOUT=1800 tools/agent-job.sh grok ${ctx.reviewSkill} "" ` +
      `"Review target: ${ctx.reviewTarget}.${contextNote} Write review to: ${reviewPath}"`,
      reviewLog, signal,
    )
    if (reviewExit !== 0 && !existsSync(reviewPath)) {
      console.log(`   │  ❌ Review step failed. Escalating.`)
      return { passed: false, escalated: true, iterations: i, lastReviewPath, lastTriagePath, allArtifacts }
    }
    if (exitCode => reviewPath && existsSync(reviewPath)) verifyArtifact(reviewPath, `${ctx.type}-review`)
    allArtifacts.push(reviewPath)
    lastReviewPath = reviewPath

    // ── AGY Opus: Triage ────────────────────────────────────────────────
    console.log(`   │  AGY Opus: review-triage`)
    const triagePath = reviewArtifact(`triage-${ctx.type}`, i)
    const triageLog  = stepLog(`triage-${ctx.type}-iter${i}`)
    console.log(`   │  📥 ${reviewPath}`)
    console.log(`   │  📄 ${triagePath}`)

    const { exitCode: triageExit } = await runStep(
      `source ~/.bashrc && JOB_TIMEOUT=1800 tools/agent-job.sh agy review-triage claude-opus-4-6 ` +
      `"CONTEXT: ${ctx.type}-review triage, iteration ${i}. Input artifact: ${reviewPath}. ` +
      `Fix target: ${ctx.fixTarget}. Write triage doc to: ${triagePath}. ` +
      `MANDATORY: end doc with <!-- PIPELINE_SIGNAL: AUTO-FIX=N ESCALATE=M -->"`,
      triageLog, signal,
    )
    if (triageExit !== 0 && !existsSync(triagePath)) {
      return { passed: false, escalated: true, iterations: i, lastReviewPath, lastTriagePath, allArtifacts }
    }
    allArtifacts.push(triagePath)
    lastTriagePath = triagePath

    // ── Parse signal ────────────────────────────────────────────────────
    const signal2 = parseTriageSignal(triagePath)
    console.log(`   │  Signal: AUTO-FIX=${signal2.autoFix} ESCALATE=${signal2.escalate}`)

    if (signal2.escalate > 0) {
      console.log(`   └─ ESCALATE — pausing for human review`)
      return { passed: false, escalated: true, iterations: i, lastReviewPath, lastTriagePath, allArtifacts }
    }

    if (signal2.autoFix === 0) {
      console.log(`   └─ PASS ✅ — review cycle complete after ${i} iteration${i > 1 ? "s" : ""}`)
      return { passed: true, escalated: false, iterations: i, lastReviewPath, lastTriagePath, allArtifacts }
    }

    // ── Still items to fix — but not on the last iteration ──────────────
    if (i === max) {
      console.log(`   └─ MAX ITERATIONS (${max}) reached. Escalating.`)
      return { passed: false, escalated: true, iterations: i, lastReviewPath, lastTriagePath, allArtifacts }
    }

    // ── AGY: Fix ─────────────────────────────────────────────────────────
    console.log(`   │  AGY ${ctx.fixModel}: ${ctx.fixSkill} (fixing ${signal2.autoFix} item${signal2.autoFix > 1 ? "s" : ""})`)
    const fixLog = stepLog(`fix-${ctx.type}-iter${i}`)
    await runStep(
      `source ~/.bashrc && JOB_TIMEOUT=1800 tools/agent-job.sh agy ${ctx.fixSkill} ${ctx.fixModel} ` +
      `"Fix the AUTO-FIX items from triage: ${triagePath}. Apply fixes to: ${ctx.fixTarget}."`,
      fixLog, signal,
    )
    console.log(`   │  Fixes applied — running next review iteration`)
  }

  // Should not reach here
  return { passed: false, escalated: true, iterations: max, lastReviewPath, lastTriagePath, allArtifacts }
}


// ── Phase Pipeline ─────────────────────────────────────────────────────────

export const phasePipeline = createWorkflow({ name: "phase", input: z.object({}) })

  // 1. Task review cycle
  .step("task-review-cycle", {
    retry: { maxAttempts: 1, backoff: "linear" as const },
    timeoutMs: 5_400_000, // 90 min — could be up to 3 iterations
    handler: async ({ signal }) => {
      console.log("\n   ━━━ Stage 1: Task Review Cycle ━━━")
      const result = await runReviewCycle({
        type: "task",
        reviewTarget: join(ROOT, "tasks", "current"),
        fixTarget: join(ROOT, "tasks", "current"),
        reviewSkill: "task-review",
        fixSkill: "review-triage", // re-use triage skill for task fixes (light edits)
        fixModel: "gemini-3.8-flash",
      }, signal)
      if (result.escalated) {
        writeEscalation("task-review", result.lastTriagePath)
        throw new Error(`Task review cycle escalated after ${result.iterations} iterations`)
      }
      return { passed: result.passed, iterations: result.iterations, allArtifacts: result.allArtifacts }
    },
  })

  // 2. Create plans
  .step("make-plans", {
    retry: { maxAttempts: 2, backoff: "linear" as const },
    timeoutMs: 1_800_000,
    handler: async ({ signal }) => {
      console.log("\n   ━━━ Stage 2: Create Plans (AGY Sonnet) ━━━")
      const log = stepLog("make-plans")
      console.log(`   📄 ${PLANS_DIR}/`)
      const { exitCode } = await runStep(
        `source ~/.bashrc && JOB_TIMEOUT=1800 tools/agent-job.sh agy make-plans claude-sonnet-4-6 ` +
        `"Write plans to: ${PLANS_DIR}/"`,
        log, signal,
      )
      return { success: exitCode === 0, artifactPath: PLANS_DIR, logPath: log }
    },
  })

  // 3. Plan review cycle
  .step("plan-review-cycle", {
    retry: { maxAttempts: 1, backoff: "linear" as const },
    timeoutMs: 5_400_000,
    handler: async ({ signal }) => {
      console.log("\n   ━━━ Stage 3: Plan Review Cycle ━━━")
      const result = await runReviewCycle({
        type: "plan",
        reviewTarget: PLANS_DIR,
        fixTarget: PLANS_DIR,
        extraContext: `Tasks: ${join(ROOT, "tasks", "current")}`,
        reviewSkill: "plan-review",
        fixSkill: "review-triage",
        fixModel: "claude-opus-4-6", // plans need careful fixes
      }, signal)
      if (result.escalated) {
        writeEscalation("plan-review", result.lastTriagePath)
        throw new Error(`Plan review cycle escalated after ${result.iterations} iterations`)
      }
      return { passed: result.passed, iterations: result.iterations, allArtifacts: result.allArtifacts }
    },
  })

  // 4. Refine plans (Grok one-shot polish, not a cycle)
  .step("refine-plans", {
    retry: { maxAttempts: 2, backoff: "linear" as const },
    timeoutMs: 1_800_000,
    handler: async ({ signal }) => {
      console.log("\n   ━━━ Stage 4: Refine Plans (Grok) ━━━")
      const log = stepLog("refine-plans")
      console.log(`   📄 ${PLANS_DIR}/ (refined in place)`)
      const { exitCode } = await runStep(
        `source ~/.bashrc && JOB_TIMEOUT=1800 tools/agent-job.sh grok refine-plan "" ` +
        `"Plans to refine: ${PLANS_DIR}/"`,
        log, signal,
      )
      return { success: exitCode === 0, artifactPath: PLANS_DIR, logPath: log }
    },
  })

  // ── APPROVAL GATE ──────────────────────────────────────────────────────
  .waitForEvent("approve-plans", {
    timeoutMs: 72 * 60 * 60 * 1000,
  })

  // 5. Implement
  .step("implement", {
    retry: { maxAttempts: 2, backoff: "linear" as const },
    timeoutMs: 1_800_000,
    handler: async ({ signal }) => {
      console.log("\n   ━━━ Stage 5: Implement Plans (AGY Sonnet) ━━━")
      const log = stepLog("implement")
      const commitBefore = gitHead()
      console.log(`   📥 ${PLANS_DIR}/`)
      const { exitCode } = await runStep(
        `source ~/.bashrc && JOB_TIMEOUT=1800 tools/agent-job.sh agy implement-plan claude-sonnet-4-6 ` +
        `"Plans: ${PLANS_DIR}/."`,
        log, signal,
      )
      return { success: exitCode === 0, artifactPath: PLANS_DIR, commitBefore, commitAfter: gitHead(), logPath: log }
    },
  })

  // 6. Smoke tests
  .step("smoke-tests", {
    retry: { maxAttempts: 2, backoff: "linear" as const },
    timeoutMs: 120_000,
    handler: async ({ signal }) => {
      console.log("\n   ━━━ Stage 6: Smoke Tests ━━━")
      const log = stepLog("smoke-tests")
      const { exitCode } = await runStep(
        `cd "${join(ROOT, "fox-code-cli")}" && CI=true timeout 90s bun run test:smoke`,
        log, signal,
      )
      return { success: exitCode === 0, artifactPath: log, logPath: log }
    },
  })

  // 7. Fix test failures (one-shot, not a cycle)
  .step("fix-tests", {
    retry: { maxAttempts: 2, backoff: "linear" as const },
    timeoutMs: 1_200_000,
    when: ({ prev }) => !(prev as any)?.success,
    handler: async ({ prev, signal }) => {
      console.log("\n   ━━━ Stage 7: Fix Test Failures (AGY Sonnet) ━━━")
      const testLog = (prev as any).artifactPath as string
      const log = stepLog("fix-tests")
      console.log(`   📥 ${testLog}`)
      const { exitCode } = await runStep(
        `source ~/.bashrc && JOB_TIMEOUT=1200 tools/agent-job.sh agy implement-plan claude-sonnet-4-6 ` +
        `"Test failures. Log: ${testLog}. Plans: ${PLANS_DIR}/. Fix root cause, re-run to verify."`,
        log, signal,
      )
      return { success: exitCode === 0, logPath: log }
    },
  })

  // 8. Code review cycle (the main iterative loop)
  .step("code-review-cycle", {
    retry: { maxAttempts: 1, backoff: "linear" as const },
    timeoutMs: 5_400_000,
    handler: async ({ steps, signal }) => {
      console.log("\n   ━━━ Stage 8: Code Review Cycle ━━━")
      const commitSha: string = (steps as any)["implement"]?.commitAfter ?? "HEAD"
      const result = await runReviewCycle({
        type: "code",
        reviewTarget: join(ROOT, "fox-code-cli"),
        fixTarget: join(ROOT, "fox-code-cli", "src"),
        extraContext: `Plans: ${PLANS_DIR}/. Commit ref: ${commitSha}`,
        reviewSkill: "code-review",
        fixSkill: "implement-plan",
        fixModel: "claude-sonnet-4-6",
      }, signal)
      if (result.escalated) {
        writeEscalation("code-review", result.lastTriagePath)
        throw new Error(`Code review cycle escalated after ${result.iterations} iterations`)
      }
      return {
        passed: result.passed, iterations: result.iterations,
        allArtifacts: result.allArtifacts, lastReviewPath: result.lastReviewPath,
      }
    },
  })

  // 9. Full test suite
  .step("full-tests", {
    retry: { maxAttempts: 2, backoff: "linear" as const },
    timeoutMs: 180_000,
    handler: async ({ signal }) => {
      console.log("\n   ━━━ Stage 9: Full Test Suite ━━━")
      const log = stepLog("full-tests")
      const { exitCode } = await runStep(
        `cd "${join(ROOT, "fox-code-cli")}" && CI=true timeout 150s bun run test`,
        log, signal,
      )
      return { success: exitCode === 0, artifactPath: log }
    },
  })

  // 10. Walkthrough
  .step("walkthrough", {
    handler: async ({ steps }) => {
      console.log("\n   ━━━ Stage 10: Walkthrough ━━━")
      const phase = currentPhase()
      const out = join(REVIEW_DIR, `${timestamp()}_walkthrough-phase-${phase}.md`)
      const impl = (steps as any)["implement"]
      const commitRange = impl?.commitBefore && impl?.commitAfter
        ? `${impl.commitBefore.slice(0, 8)}..${impl.commitAfter.slice(0, 8)}` : "N/A"

      let gitLog = "N/A"
      try {
        gitLog = execSync(
          `GIT_TERMINAL_PROMPT=0 git log --oneline ${impl?.commitBefore ?? ""}..HEAD`,
          { cwd: join(ROOT, "fox-code-cli"), encoding: "utf-8", timeout: 10000 }
        ).trim()
      } catch { /* ignore */ }

      const stageRows = Object.entries(steps as Record<string, any>)
        .map(([name, r], i) => {
          const icon = r?.passed === true ? "✅ PASS" : r?.success !== false ? "✅" : "❌"
          const iter = r?.iterations ? ` (${r.iterations} iter)` : ""
          return `| ${i + 1} | ${name} | ${icon}${iter} |`
        }).join("\n")

      writeFileSync(out, `# Phase ${phase.toUpperCase()} — Pipeline Walkthrough

**Generated**: ${new Date().toISOString()}
**Commit range**: \`${commitRange}\`

---

## Stage Results

| # | Stage | Result |
|:--|:------|:-------|
${stageRows}

---

## Commits

\`\`\`
${gitLog}
\`\`\`

---

> Fox Pipeline Engine — iterative review cycles, artifact-driven.
`)
      console.log(`   📄 ${out}`)
      return { success: true, artifactPath: out }
    },
  })

  .onFailure(async ({ error, stepName }) => {
    const out = join(REVIEW_DIR, `${timestamp()}_escalation.md`)
    writeFileSync(out,
      `# Pipeline Escalation\n\n**Step**: ${stepName}\n**Error**: ${error.message}\n` +
      `**Time**: ${new Date().toISOString()}\n\nResume: \`bun run jobs pipeline resume\`\n`
    )
    console.log(`\n   🚨 Failed at '${stepName}': ${error.message}`)
    console.log(`   📄 ${out}`)
  })


// ── Plan-only pipeline ─────────────────────────────────────────────────────

export const planPipeline = createWorkflow({ name: "plan", input: z.object({}) })
  .step("task-review-cycle", {
    retry: { maxAttempts: 1, backoff: "linear" as const }, timeoutMs: 5_400_000,
    handler: async ({ signal }) => {
      console.log("\n   ━━━ Task Review Cycle ━━━")
      const result = await runReviewCycle({
        type: "task", reviewTarget: join(ROOT, "tasks", "current"),
        fixTarget: join(ROOT, "tasks", "current"), reviewSkill: "task-review",
        fixSkill: "review-triage", fixModel: "gemini-3.8-flash",
      }, signal)
      if (result.escalated) throw new Error("Task review escalated")
      return { passed: result.passed, iterations: result.iterations }
    },
  })
  .step("make-plans", {
    retry: { maxAttempts: 2, backoff: "linear" as const }, timeoutMs: 1_800_000,
    handler: async ({ signal }) => {
      const log = stepLog("make-plans")
      console.log(`\n   ━━━ Create Plans (AGY Sonnet) ━━━\n   📄 ${PLANS_DIR}/`)
      const { exitCode } = await runStep(
        `source ~/.bashrc && JOB_TIMEOUT=1800 tools/agent-job.sh agy make-plans claude-sonnet-4-6 "Plans go to: ${PLANS_DIR}/"`,
        log, signal)
      return { success: exitCode === 0, artifactPath: PLANS_DIR }
    },
  })
  .step("plan-review-cycle", {
    retry: { maxAttempts: 1, backoff: "linear" as const }, timeoutMs: 5_400_000,
    handler: async ({ signal }) => {
      console.log("\n   ━━━ Plan Review Cycle ━━━")
      const result = await runReviewCycle({
        type: "plan", reviewTarget: PLANS_DIR, fixTarget: PLANS_DIR,
        reviewSkill: "plan-review", fixSkill: "review-triage", fixModel: "claude-opus-4-6",
      }, signal)
      if (result.escalated) throw new Error("Plan review escalated")
      return { passed: result.passed, iterations: result.iterations }
    },
  })
  .step("refine-plans", {
    retry: { maxAttempts: 2, backoff: "linear" as const }, timeoutMs: 1_800_000,
    handler: async ({ signal }) => {
      const log = stepLog("refine-plans")
      const { exitCode } = await runStep(
        `source ~/.bashrc && JOB_TIMEOUT=1800 tools/agent-job.sh grok refine-plan "" "Plans: ${PLANS_DIR}/"`,
        log, signal)
      return { success: exitCode === 0, artifactPath: PLANS_DIR }
    },
  })
  .onFailure(async ({ error, stepName }) =>
    console.log(`\n   🚨 Plan pipeline failed at '${stepName}': ${error.message}`))


// ── Implement-only pipeline ────────────────────────────────────────────────

export const implementPipeline = createWorkflow({ name: "implement", input: z.object({}) })
  .step("implement", {
    retry: { maxAttempts: 2, backoff: "linear" as const }, timeoutMs: 1_800_000,
    handler: async ({ signal }) => {
      const log = stepLog("implement"); const commitBefore = gitHead()
      const { exitCode } = await runStep(
        `source ~/.bashrc && JOB_TIMEOUT=1800 tools/agent-job.sh agy implement-plan claude-sonnet-4-6 "Plans: ${PLANS_DIR}/"`,
        log, signal)
      return { success: exitCode === 0, commitBefore, commitAfter: gitHead() }
    },
  })
  .step("smoke-tests", {
    retry: { maxAttempts: 2, backoff: "linear" as const }, timeoutMs: 120_000,
    handler: async ({ signal }) => {
      const log = stepLog("smoke-tests")
      const { exitCode } = await runStep(
        `cd "${join(ROOT, "fox-code-cli")}" && CI=true timeout 90s bun run test:smoke`, log, signal)
      return { success: exitCode === 0, artifactPath: log }
    },
  })
  .step("fix-tests", {
    retry: { maxAttempts: 2, backoff: "linear" as const }, timeoutMs: 1_200_000,
    when: ({ prev }) => !(prev as any)?.success,
    handler: async ({ prev, signal }) => {
      const testLog = (prev as any).artifactPath as string; const log = stepLog("fix-tests")
      const { exitCode } = await runStep(
        `source ~/.bashrc && JOB_TIMEOUT=1200 tools/agent-job.sh agy implement-plan claude-sonnet-4-6 "Test log: ${testLog}. Fix failures."`,
        log, signal)
      return { success: exitCode === 0 }
    },
  })
  .step("code-review-cycle", {
    retry: { maxAttempts: 1, backoff: "linear" as const }, timeoutMs: 5_400_000,
    handler: async ({ steps, signal }) => {
      console.log("\n   ━━━ Code Review Cycle ━━━")
      const commitSha: string = (steps as any)["implement"]?.commitAfter ?? "HEAD"
      const result = await runReviewCycle({
        type: "code", reviewTarget: join(ROOT, "fox-code-cli"),
        fixTarget: join(ROOT, "fox-code-cli", "src"),
        extraContext: `Plans: ${PLANS_DIR}/. Commit: ${commitSha}`,
        reviewSkill: "code-review", fixSkill: "implement-plan", fixModel: "claude-sonnet-4-6",
      }, signal)
      if (result.escalated) throw new Error("Code review escalated")
      return { passed: result.passed, iterations: result.iterations }
    },
  })
  .onFailure(async ({ error, stepName }) =>
    console.log(`\n   🚨 Implement pipeline failed at '${stepName}': ${error.message}`))


// ── Escalation writer ──────────────────────────────────────────────────────

function writeEscalation(stage: string, triagePath: string): void {
  const out = join(REVIEW_DIR, `${timestamp()}_escalation-${stage}.md`)
  writeFileSync(out,
    `# Escalation: ${stage}\n\n` +
    `**Time**: ${new Date().toISOString()}\n` +
    `**Triage doc**: ${triagePath}\n\n` +
    `## What to Do\n\n` +
    `1. Read the triage doc above\n` +
    `2. Resolve the ESCALATE items manually\n` +
    `3. Resume: \`bun run jobs pipeline resume\`\n`
  )
  console.log(`   📄 Escalation: ${out}`)
}


// ── Engine ─────────────────────────────────────────────────────────────────

export async function createPipelineEngine() {
  const storage = new SQLiteStorage(DB_PATH)
  await storage.initialize()
  return createEngine({
    storage,
    workflows: [phasePipeline, planPipeline, implementPipeline],
    concurrency: 1,
    hooks: {
      onRunStart: (e) => {
        console.log()
        console.log("🦊 Fox Pipeline Engine — iterative, artifact-driven")
        console.log(`   Workflow : ${e.workflow}`)
        console.log(`   Run ID   : ${e.runId}`)
        console.log(`   Phase    : ${currentPhase().toUpperCase()}`)
        console.log()
      },
      onStepComplete: (e) => console.log(`   ✅ ${e.stepName} (attempt ${e.attempts})`),
      onStepSkipped:  (e) => console.log(`   ⏭  ${e.stepName} (skipped)`),
      onRunComplete:  () => {
        console.log("\n   ════════════════════════════════════════")
        console.log("   ✅ Pipeline Complete!")
        console.log("   ════════════════════════════════════════\n")
      },
      onRunFailed: (e) => console.error(`   ❌ Failed at '${e.stepName}': ${e.error.message}`),
    },
  })
}


// ── Public API ─────────────────────────────────────────────────────────────

export async function startPipeline(name: string): Promise<string> {
  const engine = await createPipelineEngine()
  await engine.start()  // begin polling loop — required to claim and execute runs
  const run = await engine.enqueue(name as any, {})
  console.log(`\nPipeline: ${run.id}  phase: ${currentPhase().toUpperCase()}\n`)

  let approvalBannerShown = false
  for await (const event of engine.stream()) {
    if (event.runId !== run.id) continue  // ignore events from other runs
    if (event.type === "stepStart")    console.log(`  ▶ ${event.stepName}`)
    if (event.type === "stepComplete") console.log(`  ✅ ${event.stepName}`)
    if (event.type === "stepSkipped")  console.log(`  ⏭ ${event.stepName} (skipped)`)
    if (event.type === "runFailed")    { console.log(`  ❌ ${event.stepName}: ${event.error.message}`); break }
    if (event.type === "runComplete")  break
    // Approval gate: poll DB status since reflow-ts has no waitForEvent event
    if (event.type === "stepComplete" && !approvalBannerShown) {
      const runInfo = await engine.getRunStatus(run.id)
      if (runInfo?.run.status === "waiting") {
        approvalBannerShown = true
        const bannerPath = join(STATE_DIR, "APPROVAL_NEEDED.md")
        writeFileSync(bannerPath,
          [
            "# \u23f8  Pipeline Waiting for Plan Approval", "",
            `**Run ID**: ${run.id}`,
            `**Phase**: ${currentPhase().toUpperCase()}`,
            `**Time**: ${new Date().toISOString()}`, "",
            "## Plans to Review", "",
            "```", `ls ${PLANS_DIR}/`, "```", "",
            "## Approve", "",
            "```bash", "bun run jobs pipeline approve", "```", "",
          ].join("\n")
        )
        console.log("\n   ╔══════════════════════════════════════════╗")
        console.log("   ║  ⏸  WAITING FOR YOUR PLAN APPROVAL       ║")
        console.log("   ╠══════════════════════════════════════════╣")
        console.log(`   ║  Plans: ${PLANS_DIR}/`)
        console.log("   ╠══════════════════════════════════════════╣")
        console.log("   ║  bun run jobs pipeline approve            ║")
        console.log("   ╚══════════════════════════════════════════╝\n")
      }
    }
  }
  await engine.stop()
  return run.id
}

export async function resumeLatestPipeline(): Promise<string | null> {
  const engine = await createPipelineEngine()
  await engine.start()  // required to claim and execute runs
  const failed = await engine.listRuns({ status: "failed" })
  if (failed.length === 0) { console.log("No failed pipelines."); await engine.stop(); return null }
  const latest = failed[0]
  console.log(`Resuming: ${latest.workflow} — ${latest.id}`)
  if (!await engine.resume(latest.id)) { console.log("Cannot resume."); await engine.stop(); return null }
  for await (const event of engine.stream()) {
    if (event.type === "runComplete" && event.runId === latest.id) break
    if (event.type === "runFailed"   && event.runId === latest.id) break
  }
  await engine.stop()
  return latest.id
}

export async function approvePipeline(runId?: string): Promise<void> {
  const engine = await createPipelineEngine()
  let targetId = runId
  if (!targetId) {
    const waiting = await engine.listRuns({ status: "waiting" })
    if (waiting.length === 0) { console.log("No pipeline waiting."); await engine.stop(); return }
    targetId = waiting[0].id
    console.log(`Approving: ${waiting[0].workflow} — ${targetId}`)
  }
  const sent = await engine.sendEvent(targetId, "approve-plans", { approved: true, at: new Date().toISOString() })
  if (sent) {
    // Remove the approval needed banner
    const bannerPath = join(STATE_DIR, "APPROVAL_NEEDED.md")
    try { require("node:fs").unlinkSync(bannerPath) } catch { /* already gone */ }
    console.log("\n✅ Approved! Pipeline proceeding to implementation.")
    console.log("   Watch: bun run jobs pipeline status")
  } else {
    console.log("❌ Could not approve — run may not be waiting.")
  }
  await engine.stop()
}

export async function showPipelineStatus(): Promise<void> {
  const engine = await createPipelineEngine()
  const icons: Record<string, string> = { running:"▶", waiting:"⏸", pending:"⏳", sleeping:"😴", failed:"❌" }
  for (const status of ["running","waiting","pending","sleeping","failed"] as const) {
    const runs = await engine.listRuns({ status })
    if (runs.length > 0) {
      console.log(`\n${icons[status] ?? "?"} ${status.toUpperCase()} (${runs.length}):`)
      for (const r of runs)
        console.log(`  ${r.workflow.padEnd(12)} ${r.id}  ${new Date(r.createdAt).toISOString()}`)
    }
  }
  const done = await engine.listRuns({ status: "completed", limit: 5 })
  if (done.length > 0) {
    console.log("\n✅ COMPLETED (last 5):")
    for (const r of done) console.log(`  ${r.workflow.padEnd(12)} ${r.id}`)
  }
  await engine.stop()
}

export async function listPipelines(): Promise<void> {
  const engine = await createPipelineEngine()
  const runs = await engine.listRuns({ limit: 20 })
  if (runs.length === 0) { console.log("No pipelines found."); await engine.stop(); return }
  const icons: Record<string, string> = { completed:"✅", running:"▶", failed:"❌", waiting:"⏸", sleeping:"😴", pending:"⏳" }
  console.log("\nPipeline History:\n" + "─".repeat(80))
  for (const r of runs)
    console.log(`  ${icons[r.status]??""} ${r.workflow.padEnd(12)} ${r.status.padEnd(10)} ${r.id.slice(0,12)}  ${new Date(r.createdAt).toISOString()}`)
  await engine.stop()
}

export const PIPELINE_NAMES = ["phase", "plan", "implement"] as const

export function describePipelines(): string {
  return [
    "  phase      Full sprint with iterative review cycles (task→plan→[approve]→impl→code)",
    "  plan       Planning only: task-review-cycle → plans → plan-review-cycle → refine",
    "  implement  Implementation: implement → smoke → code-review-cycle",
  ].join("\n")
}

export function getPipelineNames(): string[] { return [...PIPELINE_NAMES] }
