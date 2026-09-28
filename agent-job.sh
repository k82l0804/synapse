#!/usr/bin/env bash
# tools/agent-job.sh — Generic AGY / Grok dev workflow job runner
#
# Dispatches a dev workflow job to either agy or grok, injecting the
# canonical skill file as the prompt body. Runs non-interactively from
# the workspace root.
#
# Usage:
#   tools/agent-job.sh <cli> <skill> [model] [extra-prompt]
#
#   cli:          agy | grok
#   skill:        name of a skill dir under fox/skills/ (e.g. code-review, make-plans)
#   model:        (agy only) model flag — e.g. gemini-3.8-flash, claude-sonnet-4-6
#   extra-prompt: optional extra context appended to the skill prompt
#
# Environment overrides:
#   AGY_EFFORT:      reasoning effort for agy (default: high)
#   GROK_EFFORT:     reasoning effort for grok (default: high)
#   JOB_TIMEOUT:     timeout in seconds (default: 300)
#   JOB_CWD:         working directory for the agent (default: fox-code-cli/)
#   JOB_REPO:        repo key in repos.yaml to override default CWD
#   SYNAPSE_ROOT:    path to synapse repo root (default: auto-detected as workspace/synapse)
#
# Examples:
#   tools/agent-job.sh agy code-review gemini-3.8-flash
#   tools/agent-job.sh grok make-plans
#   tools/agent-job.sh agy implement-plan claude-sonnet-4-6 "Focus on Task 3 only"
#   bun run jobs push --cmd "source ~/.bashrc && tools/agent-job.sh agy code-review gemini-3.8-flash" --name "AGY: Code Review" --timeout 300000

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

CLI="${1:?Error: cli required (agy | grok)}"
SKILL="${2:?Error: skill name required (e.g. code-review)}"
MODEL="${3:-}"
EXTRA_PROMPT="${4:-}"

AGY_EFFORT="${AGY_EFFORT:-high}"
GROK_EFFORT="${GROK_EFFORT:-high}"
JOB_TIMEOUT="${JOB_TIMEOUT:-300}"
# Target repo: set JOB_REPO to override (e.g. JOB_REPO=fox-acp-client)
# Resolved from repos.yaml; defaults to fox-code-cli
JOB_REPO="${JOB_REPO:-fox-code-cli}"
JOB_CWD="${JOB_CWD:-${REPO_ROOT}/${JOB_REPO}}"

# Synapse root: where tasks/, plans/, specs/, reviews/ live for the active product
# Default: synapse/ subdir of workspace root (override with SYNAPSE_ROOT)
SYNAPSE_ROOT="${SYNAPSE_ROOT:-${REPO_ROOT}/synapse}"

SKILL_FILE="${REPO_ROOT}/skills/${SKILL}/SKILL.md"

if [[ ! -f "${SKILL_FILE}" ]]; then
  echo "Error: skill file not found: ${SKILL_FILE}" >&2
  echo "Available skills: $(ls "${REPO_ROOT}/skills/")" >&2
  exit 1
fi

# Build the prompt: skill body + workspace context + optional extra
SKILL_BODY="$(cat "${SKILL_FILE}")"

# T-1-1: Read-only constraint injected into every Grok prompt.
# Grok reviews artifacts only — it MUST NOT edit any source file, spec,
# plan, task, or review. The constraint is appended here unconditionally
# for all grok invocations, regardless of skill.
GROK_READONLY_CONSTRAINT="
---
## GROK READ-ONLY CONSTRAINT (injected by agent-job.sh — mandatory)

You are in READ-ONLY mode for this job.

- You MUST NOT edit, create, or delete any file except your review output artifact.
- You MUST NOT run any git command that modifies the repository (no commit, add, rm, mv).
- Your ONLY file write is the review document in reviews/{type}/.
- If you identify a fix, describe it in your review findings under 'Required action'.
  Do NOT implement it. The triage agent (AGY) implements fixes.
- Violation of this constraint is a pipeline invariant breach."

PROMPT="${SKILL_BODY}

---
Workspace root: ${REPO_ROOT}
Working directory: ${JOB_CWD}
Tasks:   ${SYNAPSE_ROOT}/tasks/current/
Plans:   ${SYNAPSE_ROOT}/plans/current/
Specs:   ${SYNAPSE_ROOT}/specs/
Reviews: ${SYNAPSE_ROOT}/reviews/
Skills:  ${REPO_ROOT}/skills/"

if [[ -n "${EXTRA_PROMPT}" ]]; then
  PROMPT="${PROMPT}

${EXTRA_PROMPT}"
fi

echo "==> ${CLI} job: skill=${SKILL} model=${MODEL:-default} effort=${AGY_EFFORT}" >&2
echo "==> CWD: ${JOB_CWD}" >&2

export GIT_TERMINAL_PROMPT=0

case "${CLI}" in
  agy)
    MODEL_FLAG=""
    if [[ -n "${MODEL}" ]]; then
      MODEL_FLAG="--model ${MODEL}"
    fi
    exec timeout "${JOB_TIMEOUT}s" \
      agy \
        --print \
        --dangerously-skip-permissions \
        --effort "${AGY_EFFORT}" \
        ${MODEL_FLAG} \
        --add-dir "${REPO_ROOT}" \
        --add-dir "${JOB_CWD}" \
        "${PROMPT}"
    ;;

  grok)
    # T-1-1: append read-only constraint to every Grok prompt
    GROK_PROMPT="${PROMPT}${GROK_READONLY_CONSTRAINT}"
    if [[ -n "${EXTRA_PROMPT}" ]]; then
      GROK_PROMPT="${GROK_PROMPT}

${EXTRA_PROMPT}"
    fi
    exec timeout "${JOB_TIMEOUT}s" \
      grok \
        --always-approve \
        --reasoning-effort "${GROK_EFFORT}" \
        --output-format plain \
        --add-dir "${SYNAPSE_ROOT}" \
        --cwd "${JOB_CWD}" \
        -- "${GROK_PROMPT}"
    ;;

  *)
    echo "Error: unknown CLI '${CLI}'. Use 'agy' or 'grok'." >&2
    exit 1
    ;;
esac
