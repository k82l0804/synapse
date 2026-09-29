# Three-Way Review Comparison: AGY vs Grok vs Claude

> Reviews compared:
> - AGY: `reviews/spec/2026-09-28T22-22_spec-review-phase-2.md` (generator — conflict of interest)
> - Grok: `reviews/spec/2026-09-28T22-27_grok-spec-review.md` (blind, independent)
> - Claude: `reviews/spec/2026-09-28T22-58_claude-spec-review.md` (saw Grok's review first — partial independence)
> **Date:** 2026-09-28

---

## Finding coverage by reviewer

| Finding | AGY | Grok | Claude | Confidence |
|---------|-----|------|--------|------------|
| S-0NN naming schema violation | ❌ | ✅ BLOCKING | ✅ BLOCKING | HIGH (2/3) |
| GATE file naming conflict (WAITING vs GATE-{id}.md) | ❌ | ✅ BLOCKING | ✅ BLOCKING | HIGH (2/3) |
| S-012 step sequence missing | ✅ B-1 | ✅ BLOCKING | ✅ BLOCKING | HIGH (3/3) |
| **tasks/phase-2.md violates 1:1 HLT-to-task rule** | ❌ | ❌ | ✅ BLOCKING | SINGLE-SOURCE |
| S-014 regeneration mechanism undefined | ✅ B-2 | ✅ BLOCKING | partial | HIGH (2/3) |
| S-013 failure reason strings ≠ protocol | partial | ✅ WARNING | ✅ WARNING | HIGH (2/3) |
| S-011 .gitkeep MUST NOT contradiction | ❌ | ✅ WARNING | ✅ WARNING | HIGH (2/3) |
| S-015 three directory lists disagree | ✅ W-6 | ✅ WARNING | ✅ WARNING | HIGH (3/3) |
| S-015 `shipped` not in status enum | ❌ | ✅ WARNING | ✅ WARNING | HIGH (2/3) |
| S-012 HLT-4 re-describes S-013 (not delegating) | ✅ I-* | ✅ INFO | ✅ WARNING | HIGH (3/3) |
| S-012 never calls S-015 indexer | ✅ W-10 | partial | ✅ WARNING | HIGH (2/3) |
| S-011 AC-2 depends on undefined `synapse products` | ✅ W-1 | ✅ WARNING | partial | HIGH (2/3) |
| S-012 "real time" untestable | ✅ W-2 | ✅ INFO | ✅ INFO | HIGH (3/3) |
| S-015 first-run empty DB ambiguity | ✅ W-7 | ✅ WARNING | ✅ INFO | HIGH (3/3) |
| S-013 seek/tail non-observable MUST NOT | ✅ I-* | ✅ WARNING | ✅ INFO | HIGH (3/3) |
| S-012 auto_resume unspecified | ❌ | ✅ WARNING | ✅ missing test | HIGH (2/3) |
| S-014 inbox gate type missing from MUST | ✅ I-* | ✅ missing test | ✅ missing test | HIGH (3/3) |

---

## What Claude uniquely found

### [BLOCKING] `tasks/current/phase-2.md` violates the 1:1 HLT-to-task mapping rule

`feature-spec-format.md §3.4` requires: "Each task maps to exactly one task block."
Every task block in phase-2.md covers an *entire feature's* HLTs (e.g. T-2-1 = HLT-1
through HLT-6 of S-013). That's 6 units of work bundled into one task.

**Why this matters beyond the spec fixes:** Fixing the specs doesn't fix this. The task
file is already in violation independently. More practically: if the daemon is supposed to
track per-HLT status, a single task block makes that impossible.

**The decision:** Either:
- (a) Split each task into per-HLT blocks (T-2-1-1 .. T-2-1-6, etc.) — more granular tracking
- (b) Amend `feature-spec-format.md §3.4` to say "one task block per feature, covering all its HLTs" — simpler, but the format doc's 1:1 rule is wrong/misleading as written

Option (b) is probably correct — the 1:1 rule in the format was likely overly strict. Features naturally have multiple HLTs. The current phase-2.md structure (one block per feature) is the right granularity for pipeline tracking.

---

## What Claude confirmed that Grok found (Grok was right)

All three BLOCKING findings from Grok's review were independently confirmed by Claude:
- S-0NN naming ✅ confirmed
- GATE file conflict ✅ confirmed (Claude added the important detail: S-014's own
  multi-product inbox requirement is *internally* unimplementable with a single WAITING file)
- S-012 step sequence ✅ confirmed

---

## Independence note

Claude explicitly acknowledged reading Grok's review before writing its own. This means:
- Claude's confirmations of Grok's findings are stronger (independent reasoning reached same conclusion)
- Claude's unique finding (task file format violation) is genuinely new — Grok missed it
- The comparison is not fully three-way blind, but is still useful

**For future reviews:** To enforce blind independence, put each reviewer in a clean directory
without prior reviews visible, or use `--no-project-context` style flags if available.

---

## Updated finding count

| Reviewer | BLOCKING | WARNING | INFO | Unique finds |
|----------|----------|---------|------|-------------|
| AGY | 2 | 7 | 9 | 0 (all covered by others) |
| Grok | 3 | 3 | 3 | S-0NN naming, GATE file conflict |
| Claude | 4 | 4 | 2 | task file format violation |
| **Union** | **4** | **9** | **4** | |

The three-review union found **4 BLOCKING** findings — vs. 2 from AGY alone.
Two of those blockers (S-0NN and GATE file) were missed entirely by the generator doing self-review.
One blocker (task file) was missed by both AGY and Grok.

This empirically validates the Multi-Provider Review principle.
