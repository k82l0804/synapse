# Spec Triage v3: Phase 2 — Final

> **Supersedes:** reviews/triage/2026-09-28T22-35_spec-triage-phase-2-v2.md
> **Based on:** Three-way review (AGY + Grok + Claude)
> **Date:** 2026-09-28
> **Status:** APPROVED — applying all fixes now

---

## Decisions

| ID | Finding | Decision | Notes |
|----|---------|----------|-------|
| B-1 | S-0NN naming schema violation | FIX feature-spec-format.md | Allow `[A-Z]-\d{3}` prefix. Don't rename specs. |
| B-2 | S-012 step sequence missing | FIX S-012 | Add step sequence section + status enum + auto_resume |
| B-3 | GATE file naming conflict | FIX S-014 + AGENTS.md | Use `GATE-{run-id}.md` per AGENTS.md |
| B-4 | tasks/phase-2.md HLT-to-task violation | FIX feature-spec-format.md §3.4 | One block per feature (not per HLT) is correct granularity |
| W-4 | S-011 MUST NOT vs .gitkeep | FIX S-011 | Allow .gitkeep in new dirs |
| W-5 | S-011 AC-2 `synapse products` undefined | FIX S-011 | Test against DB row instead |
| W-6 | S-011 missing non-git AC | FIX S-011 | Add AC-7 |
| W-7 | S-013 failure reason strings ≠ protocol | FIX S-013 | Quote protocol verbatim; fix tasks/phase-2.md T-2-1 |
| W-8 | S-013 DB schema undefined | FIX S-013 | Add schema section |
| W-9 | S-015 dir lists disagree + `shipped` | FIX S-015 | One canonical list; fix example |
| W-10 | S-015/S-012 indexer call missing | FIX S-012 + S-015 | S-012 HLT-3 calls indexer; S-015 cross-ref |
| W-11 | S-012 AC-5 "real time" | FIX S-012 | → "last committed DB state" |
| W-12 | S-012 auto_resume unspecified | FIX S-012 | Default false, stored in repos.yaml |
| W-13 | S-014 inbox gate type missing | FIX S-014 | Add MUST |
| W-14 | S-015 first-run empty DB | FIX S-015 | No row = insert, not mismatch |
| W-15 | S-015 --type values unlisted | FIX S-015 | List all valid values |

**Fix sequence:** feature-spec-format.md → S-012 → S-014 → AGENTS.md → S-011 → S-013 → S-015 → tasks/phase-2.md
