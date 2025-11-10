---
id: DR--20251110--meta--lifecycle-new-state
dateCreated: "2025-11-10"
version: 1.0.0
status: proposed
changeType: creation
domain: meta
slug: lifecycle-new-state
changelog:
  - date: "2025-11-10"
    note: Initial creation
  - date: "2025-11-10"
    note: Marked as draft
  - date: "2025-11-10"
    note: Marked as proposed
lastEdited: "2025-11-10"
---

# DR--20251110--meta--lifecycle-new-state

## 🧭 Context

`drctl decision new` currently writes a record with `status: draft` and immediately stages/commits it when git is enabled. That breaks the intended lifecycle contract captured in [DR--20251103--meta--auto-accept-transitions](./DR--20251103--meta--auto-accept-transitions.md): we want the system to record the whole flow (`new → draft → proposed → …`) while keeping “freshly captured” decisions off the git stage until someone intentionally moves them forward. Legacy records still show `status: "new"` in their frontmatter, so auto-accept had to special-case that status. We never formalised `new` as a first-class lifecycle state, so the CLI templates, docs, and governance tooling are inconsistent.

## ⚖️ Options Considered

| Option                                       | Description                                                                                                                       | Outcome  | Rationale                                                                                                   |
| -------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | -------- | ----------------------------------------------------------------------------------------------------------- |
| Keep “draft” as initial state                | Continue writing `status: draft`, ignore legacy `new`.                                                                            | Rejected | Auto-promote logic remains fragile; we lose the “not yet staged” semantics we want for brand-new decisions. |
| Add a hidden `new` flag                      | Track “newness” via a separate boolean or changelog note.                                                                         | Rejected | Duplicates status information and confuses downstream tooling that already understands lifecycle states.    |
| Make `new` a formal lifecycle state (chosen) | Update models, templates, docs, and commands so `new` precedes `draft`, stays unstaged, and auto-promotion handles it everywhere. | Accepted | Aligns implementation with policy, makes the workflow explicit, and removes legacy edge cases.              |

## 🧠 Decision

Introduce `new` as the canonical pre-draft lifecycle state:

1. `drctl decision new` writes `status: "new"` and does **not** stage or commit anything, even if git is enabled.
2. The first lifecycle command (`drctl decision draft`, or any command that auto-walks through draft/proposed such as `accept`) captures the “Marked as draft” changelog entry _and_ stages/commits the file when git is on.
3. Auto-promotion logic (accept, deprecate, retire, etc.) treats `new` as equivalent to “missing draft/proposed” and back-fills the necessary states with dated changelog entries and commit boundaries.
4. Docs, templates, tests, and governance checks reference the expanded lifecycle (`new → draft → propose → …`) so future contributors expect the same behaviour.

## 🪶 Principles

- **Lifecycle fidelity** — Every state transition should exist in the DR history, even if steps happen instantly.
- **Intentional staging** — Decisions only enter git when someone deliberately promotes them.
- **Backward compatibility** — Legacy files that already use `status: new` must behave identically under the new flow.
- **Trust through documentation** — README, project docs, and templates all describe the same lifecycle.

## 🔁 Lifecycle

Status: `draft` (this record will move to accepted once the implementation lands).

## 🧩 Reasoning

Treating `new` as a real status eliminates the need for ad-hoc guardrails (e.g., “if status === 'new' then pretend it’s draft”). Making the workflow explicit ensures:

- Fresh records can sit on disk, unstaged, while authors capture context.
- Git history mirrors the DR changelog; the first commit that touches a record will always be the draft transition, which is easier to review.
- Auto-promotion logic becomes simpler: it just asks “what’s the current status?” and walks forward, without guessing whether “new” is valid.
- Governance tooling can warn if a record has been in `new` longer than a configurable threshold, prompting teams to triage drafts.

## 🔄 Next Actions

1. Update `DecisionStatus`/models to include `"new"` and adjust templates (`drctl decision new`) to emit it.
2. Ensure lifecycle commands:
   - Skip git staging when status is `new`.
   - Auto-walk from `new` through `draft` when higher-level commands run.
3. Adjust docs (README, docs/project.md, AGENTS) to describe the new lifecycle and staging behaviour.
4. Add governance/lint rules that flag long-lived `new` decisions.

## 🧠 Confidence

0.75 — We already depend on `new` implicitly; formalising it mostly removes edge cases. We’ll fine-tune staging behaviour after dogfooding.

## 🧾 Changelog

- 2025-11-10 — Initial capture.
