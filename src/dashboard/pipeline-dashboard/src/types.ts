// API types shared between the Bun server and React app

export type StepStatus = "pending" | "running" | "completed" | "failed" | "skipped" | "waiting"

export interface StepArtifact {
  label: string
  path: string
  type: "input" | "output" | "log"
}

export interface StepInfo {
  name: string
  status: StepStatus
  attempts: number
  startedAt?: string
  completedAt?: string
  artifacts: StepArtifact[]
  iterations?: number      // for cycle steps
  maxIterations?: number
  error?: string
}

export interface PipelineRun {
  id: string
  workflow: string          // "phase" | "plan" | "implement"
  status: "pending" | "running" | "completed" | "failed" | "waiting" | "sleeping"
  createdAt: string
  completedAt?: string
  phase: string             // e.g. "2i"
  steps: StepInfo[]
}

export interface PipelineState {
  runs: PipelineRun[]
  activeRunId: string | null
}
