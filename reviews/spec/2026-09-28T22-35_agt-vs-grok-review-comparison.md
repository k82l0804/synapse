# Spec Review Comparison: AGY vs Grok

> **Purpose:** Compare AGY's adversarial review (conflict of interest) against Grok's independent review.
> Outcome feeds the new canonical triage recommendations.
> **Date:** 2026-09-28

---

## What Grok found that AGY missed

These are the significant gaps — things Grok caught that I did not.

### 1. [BLOCKING] The `S-0NN` vs `F-0NN` naming schema violation (Grok only)

**Grok read `feature-spec-format.md` line-by-line. I did not.** The format requires `F-\d{3}` IDs
and `specs/F-XXX-name.md` filenames. Every spec uses `S-0NN`. Grok called this a schema failure
that blocks the `approved` status from being valid.

This is the most important miss. Grok cross-referenced the format spec; I analyzed the content
of the 5 specs themselves and never checked them against the format contract.

**What this means:** Either the format spec must be updated to allow `S-\d{3}` (since we
intentionally used S-prefix for Synapse specs to distinguish from fox's F-prefix), or all specs
must be renamed. This is a real decision needed before any status can be `approved`.

### 2. [BLOCKING] GATE file naming conflict: AGENTS.md vs S-014 (Grok only)

AGENTS.md says the daemon writes `.synapse/run/GATE-{run-id}.md`. S-014 says it writes
`.synapse/run/WAITING`. These are different file names and different structures. `inbox` cannot
be implemented until one contract wins. I completely missed this contradiction because I read
S-014 in isolation, not against AGENTS.md.

### 3. [WARNING] S-011 MUST NOT contradiction with `.gitkeep` writes (Grok only)

MUST NOT says "must not modify any file inside the registered repo except creating dirs."
But creating `.gitkeep` files IS writing files. Grok caught the internal contradiction. I missed it.

### 4. [WARNING] S-013 failure reason strings don't match `pipeline-signal-protocol.md` (Grok only)

Grok read `pipeline-signal-protocol.md` directly and found:
- Protocol says: `SIGNAL_ABSENT: no valid signal on last line of artifact`
- S-013 says: `failure_reason = "SIGNAL_ABSENT"` (no suffix)
- Protocol says: `SCHEMA_VIOLATION: signal present but malformed: {last_line}`
- S-013 says: `"SCHEMA_VIOLATION: <line>"` (different format)

Tests written to S-013 will fail against the protocol spec. I noted a SCHEMA_VIOLATION
boundary issue but didn't catch the actual string mismatch by reading the protocol.

### 5. [WARNING] `shipped` is not in the spec status enum (Grok only)

S-015 uses `shipped` in its mismatch example. The spec format only allows: `draft | approved | done`.
`shipped` doesn't exist. Grok caught this; I didn't.

### 6. [WARNING] `tasks/future/` in S-011 dir list vs not in AGENTS.md layout (Grok only)

S-011 visible outcome lists `tasks/future/` as a required dir. AGENTS.md layout doesn't include it
under the pipeline dirs. Minor but real inconsistency.

### 7. [WARNING] `auto_resume` product config field unspecified (Grok only)

S-012 AC-6 says "unless `auto_resume` is set in the product config" — but the config field name,
where it lives, and its default are never defined. Grok flagged this; I missed it.

### 8. [INFO] Whitespace-only `--note ""` (Grok more specific)

I mentioned this briefly. Grok made it a concrete MUST finding: "non-empty after trim" is the
precise requirement. My version was vaguer.

---

## What AGY found that Grok didn't

These are things in my review that Grok's review doesn't explicitly cover.

| AGY finding | Assessment |
|-------------|------------|
| W-3: Missing `depends_on: [S-013]` in S-012 frontmatter | Grok covered this implicitly under architectural risk. Low value as a standalone finding. |
| W-4: One WAITING file per product — invariant not in spec | Covered more thoroughly by Grok's GATE file naming finding (which is the root issue). |
| W-6: S-015 AC-1 dirs too narrow | Grok found this too (and more precisely). |
| W-7: S-015 first-run ambiguity | Grok found this too and was more specific ("no row = insert, conflict = halt"). |
| I-*: misc info items | Mostly duplicates of Grok's findings or covered implicitly. |

**Honest conclusion:** AGY found the same structural gaps as Grok, but less precisely. Grok's review
is more grounded because it read the format spec and protocol spec carefully. My review was
content-level analysis. Grok's was contract-level analysis. This confirms the principle —
the reviewer must be independent, reads the artifacts with fresh eyes, and cross-references
all dependencies.

---

## Where both reviews agree (confirmed findings)

| Finding | My ID | Grok finding |
|---------|-------|--------------|
| S-012 step sequence missing | B-1 | [BLOCKING] |
| S-014 regeneration undefined | B-2 | [BLOCKING] |
| S-011 AC-2 depends on `synapse products` | W-1 | [WARNING] |
| S-012 "real time" untestable | W-2 | [INFO] |
| S-015 first-run mismatch ambiguity | W-7 | [WARNING] |
| S-015 `--type` valid values unlisted | I-* | [WARNING] |

---

## Verdict comparison

| | AGY review | Grok review |
|---|---|---|
| BLOCKING | 2 | 3 (+1 naming schema Grok only) |
| WARNING | 7 | 3 (fewer but more precise, plus new ones) |
| INFO | 9 | 3 |
| Verdict | — | REQUEST_CHANGES |
| Gate file conflict | ❌ missed | ✅ caught |
| Naming schema violation | ❌ missed | ✅ caught |
| Protocol string mismatch | ❌ partial | ✅ caught precisely |
| `.gitkeep` MUST NOT contradiction | ❌ missed | ✅ caught |

**The naming schema violation (S-0NN vs F-0NN) is the most important unique finding.**
Without it, specs could enter implementation with an invalid identity. Grok's structural
cross-referencing is what caught it.

---

## New canonical triage (supersedes earlier triage doc)

See: `reviews/triage/2026-09-28T22-35_spec-triage-phase-2-v2.md`
