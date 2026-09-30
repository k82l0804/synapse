**Make Claude the author. Make Grok and Gemini the critics. Do not let Claude triage its own work.**

You have three vendors. Use that for independence, not for variety on the same role.

## Assignment

| Role | Model | Why |
|---|---|---|
| Generate (feature draft, specs, plans) | **Claude flagship** (Opus-class) | Best as a structured author. One voice across the artifact set. |
| Fix after reviews | **Claude flagship** (same as generate) | Author revises. Same family keeps names and structure stable. |
| Reviewer A | **Grok flagship** | Different vendor. Good at “this is extra / this is slop / this isn’t justified.” |
| Reviewer B | **Gemini flagship** | Third vendor. Strong at whole-set consistency and “did the spec set cover the feature.” |
| Triage | **Gemini fast** or **Grok fast** | Not Claude. Rubric only: `auto_advance \| human \| send_back`. Cheap is fine. |
| Implement | **Claude mid** (Sonnet-class) or **Gemini fast** | Volume. Mid/fast is enough once the spec is frozen. |
| Implementation review (risky diffs only) | **Grok flagship** | One critic on invented surface area, not a second author. |
| Feature approve, spec-set approve, `done/` | **You** | Models do not accept the product. |

Flagship = best model you have in that family. Fast = Flash / mini / whatever you use for cheap structured calls.

## Why this split

Claude as generator + Claude as reviewer is the setup to kill. That is one vendor talking to itself. Your old pairing (generate Opus, review Grok + Claude) wastes a reviewer seat on the author.

Grok and Gemini disagree in useful ways: Grok punches at scope and vagueness; Gemini checks coverage and cross-file seams. That is the dual review you actually want.

Triage does not need to be smart. It needs to **not be the author** and to obey the rubric. Gemini-fast or Grok-fast in a fresh context is enough. Do not use Claude-fast for triage either; same family, same taste.

Implementation can drop a tier. After `plan/` is accepted, you are paying for turns and tools, not for product taste.

## Rules that make the assignment work

- **One author family per feature.** Do not generate spec 1 with Claude and spec 2 with Gemini. Drift in vocabulary will look like design.
- **Reviewers never see the generation transcript.** Artifact + parent feature/spec only.
- **Triage never sees the generation transcript.** Artifact + two review reports + rubric.
- **Triage cannot edit files.** Separate run for Claude-fix.
- **Auto-advance is illegal** on the feature, the spec set, and `build/ → done/`, no matter who approved.

Triage rubric, in order:

1. Freeze artifact → `human`
2. Reviewers disagree → `human`
3. Either reviewer flags new public surface, new product behavior, or weak acceptance tests → `human`
4. Both approve, nits only, artifact is a plan/task/code slice → `auto_advance` or `send_back` for nits if you want them applied first

## What not to do

- Three-vendor “committee generate” (inconsistent architecture)
- Claude review of Claude drafts
- Grok review and Grok triage in the **same** thread
- Gemini-fast as a spec reviewer (too cheap for the freeze you care about)
- Swapping implementer families mid-feature unless the first one is stuck

## Cheap vs expensive

Spend flagship tokens on **author once** and **two reviews of design artifacts**.  
Spend fast tokens on **triage and most implementation**.  
Spend your time on **three gates**: feature, spec set, running result.

That is the whole map: Claude writes and patches, Grok and Gemini argue with the text, a fast non-Claude model decides whether you are needed, you still own the product.