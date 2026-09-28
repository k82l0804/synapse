# Synapse — Deferred Tasks

Items deferred from active phases. Not lost — parked for future consideration.

## Phase 2 candidates

- **Scoped MCP by role**: Role-specific `agent-job-*.sh` with minimal MCP configs
  (planner gets features+git, coder gets git+tasks, triage gets git only)
- **Grok config file**: `synapse/.grok/config` enforcing read-only + scoped --add-dir
- **Spec + test contract template**: Standardized plan output with all required sections
- **Multi-repo pipeline**: Synapse managing multiple repos from a single control plane
