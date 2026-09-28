import { memo, useState } from "react"
import { Handle, Position, type NodeProps } from "@xyflow/react"
import type { StepInfo, StepArtifact } from "../types"

// ── Status colors & icons ─────────────────────────────────────────────────

const STATUS_CONFIG = {
  pending:   { bg: "#1e293b", border: "#334155", icon: "⬜", label: "Pending",   pulse: false },
  running:   { bg: "#1e3a5f", border: "#3b82f6", icon: "🔵", label: "Running",   pulse: true  },
  completed: { bg: "#14532d", border: "#22c55e", icon: "✅", label: "Done",      pulse: false },
  failed:    { bg: "#450a0a", border: "#ef4444", icon: "❌", label: "Failed",    pulse: false },
  skipped:   { bg: "#1e293b", border: "#475569", icon: "⏭",  label: "Skipped",   pulse: false },
  waiting:   { bg: "#451a03", border: "#f97316", icon: "⏸",  label: "Waiting",   pulse: true  },
}

// ── Artifact badge ────────────────────────────────────────────────────────

function ArtifactBadge({ artifact, onClick }: { artifact: StepArtifact; onClick: (a: StepArtifact) => void }) {
  const icons = { input: "📥", output: "📄", log: "📋" }
  const fileName = artifact.path.split("/").at(-1) ?? artifact.path
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onClick(artifact) }}
      title={artifact.path}
      style={{
        display: "flex", alignItems: "center", gap: 4,
        background: "#0f172a", border: "1px solid #334155",
        borderRadius: 4, padding: "2px 6px", cursor: "pointer",
        color: "#94a3b8", fontSize: 11, maxWidth: 180,
        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
      }}
    >
      <span>{icons[artifact.type]}</span>
      <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{fileName}</span>
    </button>
  )
}

// ── Stage Node (regular pipeline step) ───────────────────────────────────

export interface StageNodeData extends StepInfo {
  onArtifactClick: (a: StepArtifact) => void
}

export const StageNode = memo(({ data, selected }: NodeProps<StageNodeData & Record<string, unknown>>) => {
  const cfg = STATUS_CONFIG[(data as unknown as StageNodeData).status] ?? STATUS_CONFIG.pending
  const step = data as unknown as StageNodeData
  const inputs  = step.artifacts?.filter(a => a.type === "input")  ?? []
  const outputs = step.artifacts?.filter(a => a.type === "output") ?? []
  const logs    = step.artifacts?.filter(a => a.type === "log")    ?? []

  return (
    <div style={{
      background: cfg.bg,
      border: `2px solid ${selected ? "#e2e8f0" : cfg.border}`,
      borderRadius: 10, padding: "10px 14px", minWidth: 180, maxWidth: 220,
      boxShadow: cfg.pulse ? `0 0 12px ${cfg.border}88` : "0 2px 8px #00000044",
      animation: cfg.pulse ? "pulse 2s ease-in-out infinite" : "none",
      cursor: "pointer",
    }}>
      <Handle type="target" position={Position.Left} style={{ background: cfg.border }} />

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
        <span style={{ fontSize: 14 }}>{cfg.icon}</span>
        <span style={{ color: "#f1f5f9", fontWeight: 600, fontSize: 13, lineHeight: 1.2 }}>
          {step.name.replace(/-/g, " ")}
        </span>
      </div>

      {/* Status badge */}
      <div style={{
        display: "inline-block", background: cfg.border + "22",
        border: `1px solid ${cfg.border}`, borderRadius: 4,
        padding: "1px 6px", color: cfg.border, fontSize: 10, fontWeight: 600,
        marginBottom: inputs.length + outputs.length + logs.length > 0 ? 8 : 0,
      }}>
        {cfg.label}
        {step.attempts > 1 ? ` (attempt ${step.attempts})` : ""}
      </div>

      {/* Artifacts */}
      {inputs.length > 0 && (
        <div style={{ marginBottom: 4 }}>
          {inputs.map(a => <ArtifactBadge key={a.path} artifact={a} onClick={step.onArtifactClick} />)}
        </div>
      )}
      {outputs.map(a => <ArtifactBadge key={a.path} artifact={a} onClick={step.onArtifactClick} />)}
      {logs.length > 0 && (
        <div style={{ marginTop: 4 }}>
          {logs.map(a => <ArtifactBadge key={a.path} artifact={a} onClick={step.onArtifactClick} />)}
        </div>
      )}

      <Handle type="source" position={Position.Right} style={{ background: cfg.border }} />
    </div>
  )
})

// ── Cycle Node (review loop with iteration counter) ───────────────────────

export const CycleNode = memo(({ data, selected }: NodeProps<StageNodeData & Record<string, unknown>>) => {
  const step = data as unknown as StageNodeData
  const cfg = STATUS_CONFIG[step.status] ?? STATUS_CONFIG.pending
  const outputs = step.artifacts?.filter(a => a.type !== "input") ?? []
  const iter = step.iterations ?? 0
  const max  = step.maxIterations ?? 3

  return (
    <div style={{
      background: cfg.bg,
      border: `2px solid ${selected ? "#e2e8f0" : cfg.border}`,
      borderRadius: 12, padding: "10px 14px", minWidth: 200, maxWidth: 240,
      boxShadow: cfg.pulse ? `0 0 16px ${cfg.border}99` : "0 2px 8px #00000044",
      animation: cfg.pulse ? "pulse 2s ease-in-out infinite" : "none",
      cursor: "pointer",
    }}>
      <Handle type="target" position={Position.Left} style={{ background: cfg.border }} />

      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
        <span style={{ fontSize: 14 }}>🔄</span>
        <span style={{ color: "#f1f5f9", fontWeight: 700, fontSize: 13 }}>
          {step.name.replace(/-/g, " ")}
        </span>
      </div>

      <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 6 }}>
        <div style={{
          display: "inline-block", background: cfg.border + "22",
          border: `1px solid ${cfg.border}`, borderRadius: 4,
          padding: "1px 6px", color: cfg.border, fontSize: 10, fontWeight: 600,
        }}>
          {cfg.label}
        </div>
        {iter > 0 && (
          <div style={{
            background: "#1e293b", border: "1px solid #475569",
            borderRadius: 4, padding: "1px 6px", color: "#94a3b8", fontSize: 10,
          }}>
            iter {iter}/{max}
          </div>
        )}
      </div>

      {/* Iteration progress dots */}
      {iter > 0 && (
        <div style={{ display: "flex", gap: 3, marginBottom: 6 }}>
          {Array.from({ length: max }).map((_, i) => (
            <div key={i} style={{
              width: 8, height: 8, borderRadius: "50%",
              background: i < iter
                ? (step.status === "completed" ? "#22c55e" : cfg.border)
                : "#334155",
            }} />
          ))}
        </div>
      )}

      {outputs.map(a => <ArtifactBadge key={a.path} artifact={a} onClick={step.onArtifactClick} />)}

      <Handle type="source" position={Position.Right} style={{ background: cfg.border }} />
    </div>
  )
})

// ── Gate Node (approval diamond) ──────────────────────────────────────────

export interface GateNodeData {
  status: "pending" | "waiting" | "completed"
  runId: string
  onApprove: (runId: string) => void
}

export const GateNode = memo(({ data, selected }: NodeProps<GateNodeData & Record<string, unknown>>) => {
  const gate = data as unknown as GateNodeData
  const isWaiting = gate.status === "waiting"
  const isDone    = gate.status === "completed"
  const color = isDone ? "#22c55e" : isWaiting ? "#f97316" : "#475569"

  return (
    <div style={{
      width: 90, height: 90,
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      background: isDone ? "#14532d" : isWaiting ? "#431407" : "#1e293b",
      border: `2px solid ${selected ? "#e2e8f0" : color}`,
      transform: "rotate(45deg)",
      borderRadius: 6,
      boxShadow: isWaiting ? `0 0 20px ${color}99` : "0 2px 8px #00000044",
      animation: isWaiting ? "pulse 1.5s ease-in-out infinite" : "none",
      cursor: isWaiting ? "pointer" : "default",
    }}
    onClick={() => isWaiting && gate.onApprove(gate.runId)}
    >
      <Handle type="target" position={Position.Left}
        style={{ background: color, transform: "rotate(-45deg)", left: -6, top: "50%" }} />
      <div style={{ transform: "rotate(-45deg)", textAlign: "center" }}>
        <div style={{ fontSize: 18 }}>{isDone ? "✅" : isWaiting ? "⏸" : "◇"}</div>
        <div style={{ color, fontSize: 9, fontWeight: 700, lineHeight: 1.2 }}>
          {isDone ? "APPROVED" : isWaiting ? "APPROVE?" : "GATE"}
        </div>
      </div>
      <Handle type="source" position={Position.Right}
        style={{ background: color, transform: "rotate(-45deg)", right: -6, top: "50%" }} />
    </div>
  )
})
