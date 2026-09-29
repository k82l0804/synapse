# Feature ↔ Research Traceability Matrix

> **Purpose:** Links each Phase 2 spec to the section(s) of the research doc it was extracted from.
> Produced by: research-to-features (AGY/Architect role)
> Research source: `docs/research/2026-09-28T15-19_synapse-foundation-plan.md`
> Date: 2026-09-28

---

## Extraction summary

| Feature ID | Name | Research Sections | Extraction notes |
|------------|------|-------------------|-----------------|
| S-011 | product-registration | §4.0 (CLI), §4.2 (Product Lifecycle), §4.7 (Data Reconciliation) | Scoped to `synapse add` only. Archive/remove commands deferred. |
| S-012 | daemon-engine | §4.1 (One Daemon), §4.2 (Product Lifecycle), §4.3 (Graceful Stop), §4.4 (Reboot), §4.5 (Serial mode) | Scoped to serial mode only. Accelerate mode deferred. |
| S-013 | signal-parser | §4.1 (Workflow executor reads PIPELINE_SIGNAL/TESTER_SIGNAL), `specs/pipeline-signal-protocol.md` | Internal component — not directly user-facing. |
| S-014 | human-gate | §4.9 (Notification System), §4.9 (Resolution scenarios: GATE_WAITING) | Scoped to GATE_WAITING only. TASK_FAILED/ESCALATED/MERGE_CONFLICT resolution deferred. |
| S-015 | artifact-index | §4.7 (Data Reconciliation Rules), §5 (State/Storage: synapse.db tables), §4.0 (`synapse artifacts` CLI) | Scoped to index + query. `synapse repair` deferred. |

## Deferred features (cap exceeded — ranked 6-11)

| Feature slug | Research section | Why deferred |
|---|---|---|
| graceful-stop-resume | §4.3, §4.4 | Partial stop is in daemon-engine (S-012). Full resume after escalation is its own feature. |
| accelerate-mode | §4.5 | Depends on S-012 serial mode being proven. Branch management required. |
| branch-policy | §4.6 | Depends on accelerate mode. |
| synapse-logs | §4.9 (TASK_FAILED resolution) | Depends on daemon capturing subprocess output (S-012 partial). |
| notification-system | §4.9 (WAITING file options 2-4) | WAITING file itself is in S-014. Shell integration is user-configured. |
| schema-violation-recovery | §4.9 (SCHEMA_VIOLATION resolution) | Depends on daemon and gate (S-012, S-014). |

## Coverage gaps (research sections not extracted into any feature)

| Section | Content | Disposition |
|---------|---------|-------------|
| §4.7 Rule 6: "Pipeline reads docs/research/ but NEVER rewrites it" | Human research protection | Captured as AGENTS.md rule, not a feature. |
| §4.8 LLM Rate Limits | Retry with exponential backoff | Deferred — daemon handles 429 at call site when built. |
| §5 synapse.db schema (full DDL) | Complete table definitions | Captured in S-013 (signal parser) D-1 as DB schema deliverable. |
| §6 GUI | React Flow dashboard | Explicitly deferred in research doc. Phase 3+. |
| §2.5 Uniform Review Cycle | Core pipeline principle | Captured as architectural doc (AGENTS.md), not a feature. |

## Traceability completeness

- **11 features identified** from research doc
- **5 extracted** into specs (S-011..S-015) — Phase 2
- **6 deferred** into `tasks/deferred/` with origin links
- **0 lost** — all identified features are accounted for
