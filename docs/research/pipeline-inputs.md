**Call the moving folder a change, not a feature.** Feature is one *kind* of change. A bug fix and a refactor are also changes. Same four bins, same move rules, different templates and done tests.

`feature` as the class name forces every incoming thing to pretend it is new product behavior. That warps design: a refactor grows a vision statement, a bug fix grows a mini-PRD, and the pipeline starts lying.

## The names

| Word | Use it for |
|---|---|
| **change** | The unit that lives in `design/` → `plan/` → `build/` → `done/`. One folder, one move. |
| **kind** | Discriminator inside the folder: `feature`, `fix`, `refactor`, `chore`, `spike`. |
| **brief** | The human-authored input in `design/`. Not `FEATURE.md`. |
| **feature** | Only when `kind: feature`. Keep the word; shrink its job. |
| **spec / plan / task** | Children of a change. Do not promote them to first-class bins. |

The brief is “what we intend.” The change is the packet that carries that intent plus everything generated from it.

```
design/fix-geofence-race/
  BRIEF.md          # kind, problem, non-goals, done-when
  ...later specs, plans, tasks, evidence
```

## Why “change” and not the other generics

- **item / work item** — accurate, dull, easy to confuse with a task line. Use only if “change” collides too hard with git in your docs.
- **ticket / issue** — tracker smell; “issue” reads as bug.
- **epic / story** — process costume. A one-line fix is not an epic.
- **initiative / project** — too big.
- **brief** — good for the *document*, bad for the folder that still exists in `build/`.
- **job** — already means a daemon run.
- **task** — already a child of a plan.

“Change” is slightly bland. That is a virtue. It does not promise user-visible value, which a refactor does not have.

## Same pipeline, different kind

Do not build `fix-design/` or a second board. Fork templates, not bins.

| Kind | What `design/` must freeze | What `plan/` must produce | `build/ → done/` means |
|---|---|---|---|
| `feature` | Problem, user, scope, non-goals, vocabulary | Spec set + plans + tasks | Acceptance tests + you used it |
| `fix` | Repro, expected, blast radius, what we will not “also clean up” | Tight spec or a single plan if the hole is small | Repro is dead; no extra scope landed |
| `refactor` | Why, seam, behavior that must not change | Plan + characterization tests | Behavior unchanged; structure changed |
| `chore` | Why now, blast radius | Often a task list, not a spec set | The chore is done; nothing else rode along |
| `spike` | Question, time box, decision needed | Optional thin plan | Written answer, not shipped product |

Admission rules can be kind-specific (“a `chore` may skip a multi-spec review if the brief says so”). The bins stay `design / plan / build / done`.

## What to put on the brief

Every change, regardless of kind:

- `kind`
- one-sentence intent
- non-goals
- done-when (executable if it will hit `build/`)
- blast radius (repos, APIs, users)

Kind-specific extra fields live in the template. The daemon should refuse to leave `design/` if `kind` and `done-when` are missing. That is cheaper than debating whether a refactor “counts as a feature.”

## Slugs

Name the folder after the change, not the kind:

- `design/fix-geofence-race/` — good
- `design/feature-fix-geofence-race/` — noise
- `design/refactor-extract-nav-filter/` — kind in the slug is optional; prefer `kind:` in the brief

Kind in the path makes later moves and searches worse. Put kind in metadata.

## What this does to the earlier rules

Nothing important changes:

- One change in `current` work (your `plan/` + `build/` WIP), not one feature.
- Specs and plans stay inside the change folder.
- Human gates stay: approve the brief, approve the plan artifacts when the kind requires a spec set, accept `done/`.
- Dual review still looks at the artifact set for *this change*, not “all features.”

A `fix` can still be a full trip through the pipeline. It should just be a thinner brief and a thinner plan, not a different machine.

**Use `change` + `kind` + `BRIEF.md`.** Keep “feature” as the default kind people will write most often. Do not name the pipeline after that default.