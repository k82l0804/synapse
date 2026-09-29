# Synapse Framework — Domain Adaptation

> **Reference for:** [definitions.md](definitions.md) Part 1 (Design Principles)
> **Status:** Design intent only — not implemented with a second domain

---

## The Principle

This framework is designed to be domain-agnostic. It separates an **invariant core** (statuses, templates, conformance, gates, dependencies, traceability) from **domain-customizable aspects** (terminology, verification types, AC/HLD caps, gate timeouts, additional required fields).

If and when the framework is applied to a non-software domain (e.g., simulation engineering, legal compliance), the customizable aspects would be captured in a domain profile that extends the core. The invariant core cannot be relaxed — only tightened or extended.

## What Can Be Customized

| Aspect | What Can Change | Example |
|--------|-----------------|---------|
| Terminology | Rename labels (not semantics) | "Deliverable" → "Work Package" |
| Verification types | Add domain-specific types | Nav Sim: "reference-comparison" with tolerance |
| AC/HLD caps | Adjust limits with justification | Safety-critical: 5 AC max, 3 HLD max |
| Gate timeouts | Adjust per domain needs | Research: 30-day FEATURE_GATE timeout |
| Additional fields | Add required fields per artifact type | Nav Sim: `reference_dataset`, `tolerance` |
| Metric types | Add measurement procedures | Legal: "gold-set F1 score" |

## What Cannot Be Customized (Invariant Core)

- Status values and transitions
- Required template fields
- Conformance schema rules
- Gate protocol (Author ≠ Approver)
- Dependency system
- Split and replan protocols
- Coverage matrix requirement

## Illustration

See [examples.md](examples.md) (Example 2: Nav Sim) for how the framework applies to a non-software domain. The spec says "sub-quadratic complexity" (domain constraint, no algorithm named); the plan names "Barnes-Hut" (implementation choice). This layer discipline works the same regardless of domain.
