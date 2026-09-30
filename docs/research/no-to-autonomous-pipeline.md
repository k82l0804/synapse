**You are right that it will not be fully autonomous and still produce solid products.** A working pipeline can draft and execute. It cannot own the product. That is not mainly a “wait for the next model” gap.

What models are good at now is **local correctness against a prompt**: write a spec that matches a feature file, write a plan that matches a spec, write code that matches a plan and a test list. What they are weak at is **deciding whether that chain was the right product**, and noticing when an earlier document was confidently wrong.

Those are different jobs. The pipeline only automates the first.

## Where autonomy actually works

Once intent is frozen and the acceptance test is real, implementation can be mostly agent-driven. That matches your instinct that review matters less toward code — **if and only if** the spec is specific, the plan is small, and “done” is executable (tests, a UI path, a performance budget), not prose.

Agents already:

- implement a well-bounded task
- run tests and fix the failures they can see
- keep style and structure consistent inside one repo
- produce a first draft of specs and plans that is worth editing

That is real leverage. It is not “build the product.”

## Why the full pipeline cannot be left alone

Each stage conditions the next. A fluent, wrong feature file becomes a coherent spec set, then a neat plan, then green tests for the wrong behavior. Green is not the same as good.

The failures that stay expensive in 2026:

- **Unstated constraints.** You never wrote “don’t add a settings page,” “this must work offline in Acadia,” “do not couple these two modules.” The model fills the silence with a reasonable default. Reasonable defaults are how products get bloated and coupled.
- **Cross-artifact drift.** Spec 2 quietly redefines a term from spec 1. A dual-model review catches some of that. It does not catch “we shouldn’t be building this module at all.”
- **Verification only checks what you listed.** Acceptance tests encode the spec. They do not encode taste, operator load, or the user who will ignore the happy path.
- **No one is accountable for tradeoffs.** Shipping means choosing worse-on-purpose: smaller scope, uglier API, later feature. Models optimize for completeness and plausibility. Products need refusal.
- **The world is not in the repo.** Users, support load, store policy, hardware, timing, “this feels like one product.” That feedback does not appear as a failing test.

Smarter models shrink the first class of errors (sloppy code, weak drafts, missed edge cases in the prompt). They do not remove the need for someone who can say **no** to a coherent plan.

## Human after every artifact is too much — and too little

Reviewing every generated file will not hold. On a real feature you will get a feature writeup, several specs, several plans, a todo list per spec, then a pile of implementation diffs. If you read all of it with equal seriousness, you will rubber-stamp the middle so you can finish the day.

The scarce thing is **judgment at freeze points**, not eyeballs on every markdown file.

Put a human where a decision becomes expensive to unwind:

| After this | Human? | Why |
|---|---|---|
| Feature in `design/` | **Always.** Hard gate. | This is the product. Scope, non-goals, vocabulary, what you refuse to build. |
| Spec set in `plan/` (as a set, not one file at a time) | **Always.** Hard gate. | This freezes architecture and seams. Dual independent review helps; you still accept or reject. |
| Individual task list / plan for a small spec | **Skim or skip** if the spec was tight and the plan is mechanical. | Low leverage. Read it when the spec was ambiguous or the plan invents new types/APIs. |
| Implementation in `build/` | **Not every diff.** Review the integration surface and anything the tests cannot see. | Agents can grind on tasks. You review the module boundary, UX, failure behavior, and “does this still match the feature I approved.” |
| `build/ → done/` | **Always.** Hard gate. | Acceptance is a product act: run it, use it, decide it is the thing you meant. |

So: human at each **cycle that freezes intent**, not at each **file the generator emitted**.

That is stricter than “fully autonomous” and looser than “touch every artifact.” The second policy fails because you cannot sustain it. The first fails because wrong intent compiles all the way to green.

## A useful split

Treat two different review standards:

**Product artifacts** (feature, spec set, acceptance criteria) — you are the author of record. Agents draft. You edit until you would defend the text to a user.

**Execution artifacts** (plans, tasks, code behind a frozen spec) — agents may run with a thin human sample: glance at the plan, watch the tests, inspect the risky files. Pull the brake only when the implementation invents scope.

Towards code, the human job shifts from *writing* to *spotting invention*. The failure mode is not syntax. It is a helper class, a new flag, a “while I was here” abstraction that was not in the spec.

## What “solid” still requires a person for

- Taste and omission (what the product is *not*)
- Naming and conceptual integrity across the spec set
- When to stop and ship a thinner slice
- Whether a passing test is the behavior you want in the world
- Priority when two specs are individually fine and jointly too much

A pipeline with today’s best models can be a very strong junior staff: fast drafts, fast implementation of agreed work, decent self-check against tests. It is not a PM, a tech lead, and a user rolled into one process.

**Opinion, compressed:** assume autonomy for *execution inside a frozen spec*. Do not assume autonomy for *design or acceptance*. Drop per-file review so you can keep the three gates that actually protect the product: approve the feature, approve the spec set, accept the running result.