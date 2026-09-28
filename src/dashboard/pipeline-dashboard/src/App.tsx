import { useState, useEffect, useCallback, useMemo } from "react"
import {
  ReactFlow, Background, Controls, MiniMap,
  type Node, type Edge, type NodeTypes,
} from "@xyflow/react"
import "@xyflow/react/dist/style.css"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { StageNode, CycleNode, GateNode } from "./nodes"
import { fetchPipelineState, fetchArtifactContent, approvePipeline } from "./api"
import type { PipelineRun, StepArtifact, StepInfo } from "./types"

// ── Node layout ───────────────────────────────────────────────────────────
// Phase pipeline stages in order with x positions
const PHASE_LAYOUT: Array<{ name: string; type: "stage" | "cycle" | "gate"; x: number; y: number }> = [
  { name: "task-review-cycle",  type: "cycle", x: 0,    y: 80  },
  { name: "make-plans",         type: "stage", x: 260,  y: 80  },
  { name: "plan-review-cycle",  type: "cycle", x: 480,  y: 80  },
  { name: "refine-plans",       type: "stage", x: 740,  y: 80  },
  { name: "approve-gate",       type: "gate",  x: 960,  y: 60  },
  { name: "implement",          type: "stage", x: 1110, y: 80  },
  { name: "smoke-tests",        type: "stage", x: 1330, y: 40  },
  { name: "fix-tests",          type: "stage", x: 1330, y: 160 },
  { name: "code-review-cycle",  type: "cycle", x: 1560, y: 80  },
  { name: "full-tests",         type: "stage", x: 1820, y: 80  },
  { name: "walkthrough",        type: "stage", x: 2040, y: 80  },
]

const PLAN_LAYOUT: Array<{ name: string; type: "stage" | "cycle" | "gate"; x: number; y: number }> = [
  { name: "task-review-cycle", type: "cycle", x: 0,   y: 80 },
  { name: "make-plans",        type: "stage", x: 260, y: 80 },
  { name: "plan-review-cycle", type: "cycle", x: 480, y: 80 },
  { name: "refine-plans",      type: "stage", x: 740, y: 80 },
]

const IMPLEMENT_LAYOUT: Array<{ name: string; type: "stage" | "cycle" | "gate"; x: number; y: number }> = [
  { name: "implement",         type: "stage", x: 0,   y: 80 },
  { name: "smoke-tests",       type: "stage", x: 220, y: 40 },
  { name: "fix-tests",         type: "stage", x: 220, y: 160 },
  { name: "code-review-cycle", type: "cycle", x: 460, y: 80 },
]

function getLayout(workflow: string) {
  if (workflow === "plan")      return PLAN_LAYOUT
  if (workflow === "implement") return IMPLEMENT_LAYOUT
  return PHASE_LAYOUT
}

// ── Edge definitions ──────────────────────────────────────────────────────
function buildEdges(layout: typeof PHASE_LAYOUT): Edge[] {
  const edges: Edge[] = []
  for (let i = 0; i < layout.length - 1; i++) {
    const from = layout[i]
    const to   = layout[i + 1]
    // smoke→fix-tests and smoke→code-review-cycle branching
    if (from.name === "smoke-tests" && to.name === "fix-tests") {
      edges.push({ id: `${from.name}-${to.name}`, source: from.name, target: to.name,
        style: { stroke: "#f97316", strokeDasharray: "4 4" }, label: "if failed", labelStyle: { fill: "#f97316", fontSize: 10 } })
    } else if (from.name === "fix-tests") {
      edges.push({ id: `${from.name}-${to.name}`, source: from.name, target: to.name,
        style: { stroke: "#64748b", strokeDasharray: "4 4" } })
    } else {
      edges.push({ id: `${from.name}-${to.name}`, source: from.name, target: to.name,
        style: { stroke: "#334155", strokeWidth: 2 }, animated: false })
    }
  }
  // smoke → code-review-cycle direct path
  const smokeIdx = layout.findIndex(n => n.name === "smoke-tests")
  const crcIdx   = layout.findIndex(n => n.name === "code-review-cycle")
  if (smokeIdx >= 0 && crcIdx >= 0) {
    edges.push({ id: "smoke-code-direct", source: "smoke-tests", target: "code-review-cycle",
      style: { stroke: "#22c55e", strokeWidth: 1 }, label: "if passed", labelStyle: { fill: "#22c55e", fontSize: 10 } })
  }
  return edges
}

// ── Artifact viewer panel ─────────────────────────────────────────────────
function ArtifactViewer({ artifact, onClose }: { artifact: StepArtifact; onClose: () => void }) {
  const [content, setContent] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    fetchArtifactContent(artifact.path)
      .then(setContent)
      .finally(() => setLoading(false))
  }, [artifact.path])

  const isLog = artifact.type === "log" || artifact.path.endsWith(".log")
  const fileName = artifact.path.split("/").at(-1)

  return (
    <div style={{
      position: "fixed", right: 0, top: 0, bottom: 0, width: 520,
      background: "#0f172a", borderLeft: "1px solid #1e293b",
      display: "flex", flexDirection: "column", zIndex: 1000,
      boxShadow: "-4px 0 24px #00000088",
    }}>
      {/* Header */}
      <div style={{ padding: "12px 16px", borderBottom: "1px solid #1e293b",
        display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
        <div>
          <div style={{ color: "#f1f5f9", fontWeight: 600, fontSize: 14 }}>{fileName}</div>
          <div style={{ color: "#64748b", fontSize: 11, marginTop: 2 }}>{artifact.path}</div>
        </div>
        <button onClick={onClose} style={{ background: "none", border: "1px solid #334155",
          borderRadius: 4, color: "#94a3b8", cursor: "pointer", padding: "4px 8px", fontSize: 12 }}>
          ✕ Close
        </button>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: "auto", padding: "16px 20px" }}>
        {loading ? (
          <div style={{ color: "#64748b", textAlign: "center", marginTop: 60 }}>Loading...</div>
        ) : isLog ? (
          <pre style={{ color: "#94a3b8", fontSize: 12, lineHeight: 1.6, margin: 0, whiteSpace: "pre-wrap" }}>
            {content}
          </pre>
        ) : (
          <div style={{ color: "#cbd5e1", fontSize: 13, lineHeight: 1.7 }}>
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{content ?? ""}</ReactMarkdown>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Step detail sidebar ───────────────────────────────────────────────────
function StepSidebar({
  step, run, onArtifactClick, onApprove,
}: {
  step: StepInfo | null
  run: PipelineRun | null
  onArtifactClick: (a: StepArtifact) => void
  onApprove: () => void
}) {
  if (!step && !run) return null

  const isGate = !step && run?.status === "waiting"

  return (
    <div style={{
      position: "fixed", right: 0, top: 0, bottom: 0, width: 320,
      background: "#0f172a", borderLeft: "1px solid #1e293b",
      padding: 16, overflowY: "auto", zIndex: 100,
    }}>
      {isGate ? (
        <>
          <div style={{ color: "#f97316", fontSize: 16, fontWeight: 700, marginBottom: 8 }}>
            ⏸ Waiting for Approval
          </div>
          <div style={{ color: "#94a3b8", fontSize: 13, marginBottom: 16 }}>
            Plans are ready for your review. Approve to proceed to implementation.
          </div>
          <div style={{ color: "#64748b", fontSize: 12, marginBottom: 4 }}>Plans directory:</div>
          <code style={{ color: "#94a3b8", fontSize: 11, display: "block", marginBottom: 16,
            background: "#1e293b", padding: "4px 8px", borderRadius: 4 }}>
            plans/current/
          </code>
          <button onClick={onApprove} style={{
            width: "100%", padding: "10px 0", background: "#15803d",
            border: "1px solid #22c55e", borderRadius: 6, color: "#dcfce7",
            fontSize: 14, fontWeight: 700, cursor: "pointer",
          }}>
            ✅ Approve Plans
          </button>
        </>
      ) : step ? (
        <>
          <div style={{ color: "#f1f5f9", fontSize: 15, fontWeight: 700, marginBottom: 4 }}>
            {step.name.replace(/-/g, " ")}
          </div>
          <div style={{ color: "#64748b", fontSize: 11, marginBottom: 12 }}>
            Status: <span style={{ color: "#94a3b8" }}>{step.status}</span>
            {step.attempts > 1 && ` · attempt ${step.attempts}`}
            {step.iterations ? ` · iter ${step.iterations}/${step.maxIterations}` : ""}
          </div>
          {step.error && (
            <div style={{ background: "#450a0a", border: "1px solid #ef4444",
              borderRadius: 6, padding: "8px 12px", marginBottom: 12 }}>
              <div style={{ color: "#fca5a5", fontSize: 12 }}>{step.error}</div>
            </div>
          )}
          {step.artifacts.filter(a => a.type === "input").length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ color: "#64748b", fontSize: 11, marginBottom: 6 }}>📥 Input</div>
              {step.artifacts.filter(a => a.type === "input").map(a => (
                <button key={a.path} onClick={() => onArtifactClick(a)} style={{
                  display: "block", width: "100%", textAlign: "left",
                  background: "#1e293b", border: "1px solid #334155", borderRadius: 4,
                  padding: "4px 8px", color: "#94a3b8", fontSize: 11, cursor: "pointer",
                  marginBottom: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                }}>
                  {a.path.split("/").at(-1)}
                </button>
              ))}
            </div>
          )}
          {step.artifacts.filter(a => a.type === "output").length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ color: "#64748b", fontSize: 11, marginBottom: 6 }}>📄 Output</div>
              {step.artifacts.filter(a => a.type === "output").map(a => (
                <button key={a.path} onClick={() => onArtifactClick(a)} style={{
                  display: "block", width: "100%", textAlign: "left",
                  background: "#1e293b", border: "1px solid #334155", borderRadius: 4,
                  padding: "4px 8px", color: "#93c5fd", fontSize: 11, cursor: "pointer",
                  marginBottom: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                }}>
                  {a.path.split("/").at(-1)}
                </button>
              ))}
            </div>
          )}
          {step.artifacts.filter(a => a.type === "log").length > 0 && (
            <div>
              <div style={{ color: "#64748b", fontSize: 11, marginBottom: 6 }}>📋 Log</div>
              {step.artifacts.filter(a => a.type === "log").map(a => (
                <button key={a.path} onClick={() => onArtifactClick(a)} style={{
                  display: "block", width: "100%", textAlign: "left",
                  background: "#1e293b", border: "1px solid #334155", borderRadius: 4,
                  padding: "4px 8px", color: "#6ee7b7", fontSize: 11, cursor: "pointer",
                  marginBottom: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                }}>
                  {a.path.split("/").at(-1)}
                </button>
              ))}
            </div>
          )}
        </>
      ) : null}
    </div>
  )
}

// ── Main App ─────────────────────────────────────────────────────────────

const nodeTypes: NodeTypes = {
  stage: StageNode as NodeTypes[string],
  cycle: CycleNode as NodeTypes[string],
  gate:  GateNode  as NodeTypes[string],
}

export default function App() {
  const [state, setState] = useState<{ runs: PipelineRun[]; activeRunId: string | null }>({ runs: [], activeRunId: null })
  const [selectedStep, setSelectedStep] = useState<StepInfo | null>(null)
  const [viewingArtifact, setViewingArtifact] = useState<StepArtifact | null>(null)
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date())
  const [approveLoading, setApproveLoading] = useState(false)

  const activeRun = state.runs.find(r => r.id === state.activeRunId) ?? state.runs[0]

  const refresh = useCallback(async () => {
    try {
      const data = await fetchPipelineState()
      setState(data)
      setLastRefresh(new Date())
    } catch (e) {
      console.error("API error:", e)
    }
  }, [])

  useEffect(() => {
    refresh()
    const timer = setInterval(refresh, 15_000)
    return () => clearInterval(timer)
  }, [refresh])

  const handleApprove = useCallback(async () => {
    if (!activeRun) return
    setApproveLoading(true)
    try {
      await approvePipeline(activeRun.id)
      await refresh()
    } catch (e) {
      console.error("Approve error:", e)
    } finally {
      setApproveLoading(false)
    }
  }, [activeRun, refresh])

  const onArtifactClick = useCallback((a: StepArtifact) => {
    setViewingArtifact(a)
  }, [])

  // Build React Flow nodes
  const { nodes, edges } = useMemo(() => {
    if (!activeRun) return { nodes: [], edges: [] }
    const layout = getLayout(activeRun.workflow)
    const stepMap = new Map<string, StepInfo>(activeRun.steps.map(s => [s.name, s]))
    const isWaiting = activeRun.status === "waiting"

    const nodes: Node[] = layout.map(item => {
      if (item.type === "gate") {
        const gateStatus = isWaiting ? "waiting"
          : activeRun.steps.some(s => s.name === "implement" && s.status === "completed") ? "completed"
          : "pending"
        return {
          id: item.name,
          type: "gate",
          position: { x: item.x, y: item.y },
          data: {
            status: gateStatus,
            runId: activeRun.id,
            onApprove: handleApprove,
          },
        }
      }
      const step = stepMap.get(item.name) ?? {
        name: item.name, status: "pending" as const, attempts: 0, artifacts: [],
      }
      return {
        id: item.name,
        type: item.type,
        position: { x: item.x, y: item.y },
        data: { ...step, onArtifactClick },
      }
    })

    return { nodes, edges: buildEdges(layout) }
  }, [activeRun, handleApprove, onArtifactClick])

  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    if (node.type === "gate") { setSelectedStep(null); return }
    const step = activeRun?.steps.find(s => s.name === node.id) ?? null
    setSelectedStep(step)
    setViewingArtifact(null)
  }, [activeRun])

  const sidebarVisible = (selectedStep || activeRun?.status === "waiting") && !viewingArtifact
  const rightPad = viewingArtifact ? 520 : sidebarVisible ? 320 : 0

  return (
    <div style={{ width: "100vw", height: "100vh", background: "#0a0f1a", fontFamily: "'Inter', system-ui, sans-serif" }}>
      {/* Top bar */}
      <div style={{
        position: "fixed", top: 0, left: 0, right: 0, height: 52, zIndex: 200,
        background: "#0f172a", borderBottom: "1px solid #1e293b",
        display: "flex", alignItems: "center", padding: "0 20px", gap: 16,
      }}>
        <span style={{ fontSize: 20 }}>🦊</span>
        <span style={{ color: "#f1f5f9", fontWeight: 700, fontSize: 15 }}>Fox Pipeline</span>
        {activeRun && (
          <>
            <div style={{ height: 20, width: 1, background: "#334155" }} />
            <span style={{ color: "#94a3b8", fontSize: 13 }}>{activeRun.workflow.toUpperCase()}</span>
            <span style={{ color: "#64748b", fontSize: 12 }}>Phase {activeRun.phase?.toUpperCase()}</span>
            <div style={{
              background: activeRun.status === "running" ? "#1e3a5f"
                : activeRun.status === "waiting" ? "#431407"
                : activeRun.status === "completed" ? "#14532d"
                : activeRun.status === "failed" ? "#450a0a" : "#1e293b",
              border: `1px solid ${activeRun.status === "running" ? "#3b82f6"
                : activeRun.status === "waiting" ? "#f97316"
                : activeRun.status === "completed" ? "#22c55e"
                : activeRun.status === "failed" ? "#ef4444" : "#475569"}`,
              borderRadius: 4, padding: "2px 8px", fontSize: 11, fontWeight: 600,
              color: activeRun.status === "running" ? "#93c5fd"
                : activeRun.status === "waiting" ? "#fed7aa"
                : activeRun.status === "completed" ? "#86efac"
                : activeRun.status === "failed" ? "#fca5a5" : "#94a3b8",
            }}>
              {activeRun.status.toUpperCase()}
            </div>
          </>
        )}
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 10 }}>
          {/* Run selector */}
          {state.runs.length > 1 && (
            <select
              value={state.activeRunId ?? ""}
              onChange={e => setState(s => ({ ...s, activeRunId: e.target.value }))}
              style={{ background: "#1e293b", border: "1px solid #334155", borderRadius: 4,
                color: "#94a3b8", fontSize: 12, padding: "4px 8px" }}
            >
              {state.runs.map(r => (
                <option key={r.id} value={r.id}>
                  {r.workflow} · {r.id.slice(0, 8)} · {r.status}
                </option>
              ))}
            </select>
          )}
          <span style={{ color: "#475569", fontSize: 11 }}>
            ↻ {lastRefresh.toLocaleTimeString()}
          </span>
          <button onClick={refresh} style={{
            background: "#1e293b", border: "1px solid #334155", borderRadius: 4,
            color: "#94a3b8", cursor: "pointer", padding: "4px 10px", fontSize: 12,
          }}>
            Refresh
          </button>
          {activeRun?.status === "waiting" && (
            <button onClick={handleApprove} disabled={approveLoading} style={{
              background: "#15803d", border: "1px solid #22c55e", borderRadius: 4,
              color: "#dcfce7", cursor: "pointer", padding: "4px 14px", fontSize: 12, fontWeight: 700,
            }}>
              {approveLoading ? "Approving..." : "✅ Approve Plans"}
            </button>
          )}
        </div>
      </div>

      {/* Graph area */}
      <div style={{ position: "absolute", top: 52, left: 0, right: rightPad, bottom: 0 }}>
        {nodes.length === 0 ? (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center",
            height: "100%", color: "#475569", fontSize: 14 }}>
            {state.runs.length === 0
              ? "No pipelines found. Run: bun run jobs pipeline plan"
              : "Loading pipeline graph..."}
          </div>
        ) : (
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            onNodeClick={onNodeClick}
            fitView
            fitViewOptions={{ padding: 0.2 }}
            style={{ background: "#0a0f1a" }}
            defaultEdgeOptions={{ style: { stroke: "#334155", strokeWidth: 2 } }}
          >
            <Background color="#1e293b" gap={24} />
            <Controls style={{ background: "#0f172a", border: "1px solid #1e293b" }} />
            <MiniMap style={{ background: "#0f172a", border: "1px solid #1e293b" }}
              nodeColor={n => {
                const s = (n.data as StepInfo | undefined)?.status
                return s === "completed" ? "#22c55e" : s === "running" ? "#3b82f6"
                  : s === "failed" ? "#ef4444" : s === "waiting" ? "#f97316" : "#334155"
              }}
            />
          </ReactFlow>
        )}
      </div>

      {/* Artifact viewer (full panel) */}
      {viewingArtifact && (
        <ArtifactViewer artifact={viewingArtifact} onClose={() => setViewingArtifact(null)} />
      )}

      {/* Step sidebar */}
      {sidebarVisible && (
        <StepSidebar
          step={selectedStep}
          run={activeRun ?? null}
          onArtifactClick={(a) => { setViewingArtifact(a) }}
          onApprove={handleApprove}
        />
      )}

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.7; }
        }
        * { box-sizing: border-box; }
      `}</style>
    </div>
  )
}
