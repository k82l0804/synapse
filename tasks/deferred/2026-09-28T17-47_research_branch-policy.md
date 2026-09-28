# Deferred: Branch policy enforcement 

**Origin:** docs/research/2026-09-28T15-19_synapse-foundation-plan.md  
**Deferred by:** research-to-features  
**Date:** 2026:09:28T17:47  
**Reason:** cap exceeded — ranked beyond top 5

## Feature Summary

Branch policy enforcement — work/{run-id}-{task-id} branches; auto-merge after triage+gate

## Why Deferred

Ranked beyond the top 5 features for Phase 2. Infrastructure features
(product-registration, daemon-engine, signal-parser, human-gate, artifact-index)
must ship first. This feature depends on all 5.

## How to Pick Up

Re-run research-to-features with `--include-id branch-policy` to extract this
specific feature in a later phase.
