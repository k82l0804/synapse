import type { PipelineState } from "./types"

const BASE = "/api"

export async function fetchPipelineState(): Promise<PipelineState> {
  const res = await fetch(`${BASE}/pipeline`)
  if (!res.ok) throw new Error(`API error: ${res.status}`)
  return res.json()
}

export async function fetchArtifactContent(path: string): Promise<string> {
  const res = await fetch(`${BASE}/artifact?path=${encodeURIComponent(path)}`)
  if (!res.ok) return `Error loading artifact: ${res.status}`
  return res.text()
}

export async function approvePipeline(runId: string): Promise<void> {
  const res = await fetch(`${BASE}/approve`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ runId }),
  })
  if (!res.ok) throw new Error(`Approve failed: ${res.status}`)
}
