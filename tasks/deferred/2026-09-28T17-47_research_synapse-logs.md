# Deferred: synapse logs command 

**Origin:** docs/research/2026-09-28T15-19_synapse-foundation-plan.md  
**Deferred by:** research-to-features  
**Date:** 2026:09:28T17:47  
**Reason:** cap exceeded — ranked beyond top 5

## Feature Summary

synapse logs command — read crash/failure output for a run; synapse retry / synapse skip

## Why Deferred

Ranked beyond the top 5 features for Phase 2. Infrastructure features
(product-registration, daemon-engine, signal-parser, human-gate, artifact-index)
must ship first. This feature depends on all 5.

## How to Pick Up

Re-run research-to-features with `--include-id synapse-logs` to extract this
specific feature in a later phase.
