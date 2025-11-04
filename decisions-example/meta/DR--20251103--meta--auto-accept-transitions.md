---
id: DR--20251103--meta--auto-accept-transitions
dateCreated: "2025-11-03"
version: 1.0.0
status: proposed
changeType: creation
domain: meta
slug: auto-accept-transitions
changelog:
  - date: "2025-11-03"
    note: Initial creation
  - date: "2025-11-04"
    note: Marked as draft
  - date: "2025-11-04"
    note: Marked as proposed
lastEdited: "2025-11-04"
---

# DR--20251103--meta--auto-accept-transitions

## 🧭 Context

We currently call individual lifecycle commands (`draft`, `propose`, `accept`, etc.) manually. If a DR is still in `draft` and we run `drctl accept`, the command records only the final state. That hides the intermediate transitions in the changelog and forces humans (or AI helpers) to remember to invoke multiple commands in sequence. With main now protected by branch/PR workflows, we want lifecycle automation to be equally disciplined: every state transition should be captured automatically so the DR changelog reflects the Kanban-style flow (draft → proposed → accepted) even when a decision is fast-tracked.

## ⚖️ Options Considered

| Option | Description                                                                                      | Outcome      | Rationale                                                              |
| ------ | ------------------------------------------------------------------------------------------------ | ------------ | ---------------------------------------------------------------------- |
| A      | Keep requiring explicit `drctl draft` + `drctl propose` before `drctl accept`                    | Rejected     | Error-prone, inconsistent changelog history, cumbersome for automation |
| B      | Add a `--force` flag that skips missing states                                                   | Rejected     | Still hides transitions unless the flag is remembered; awkward UX      |
| C      | Auto-walk missing states when a command advances further (e.g. `accept` fills in draft/proposed) | **Accepted** | Preserves a complete lifecycle trail without extra commands            |

## 🧠 Decision

Enhance lifecycle commands—starting with `drctl accept`—so they inspect the current status and automatically apply any missing intermediate transitions (recording changelog entries and timestamps) before finalising the requested state. For example, calling `drctl accept` on a `draft` decision will:

1. Record the draft state (if not already logged),
2. Record the proposed state,
3. Finally mark the record as accepted (existing behaviour).

Each step should mirror the standalone command (changelog note, status/date updates, git commit scope). Follow-up work can extend the same pattern to other “jump” commands (e.g. `deprecate`, `retire`) as needed.

## 🪶 Principles

1. **Lifecycle fidelity** – Decision records must reflect every state they pass through.
2. **Automation with intent** – CLI commands enforce the workflow rather than rely on memory.
3. **Transparency** – Changelog history should communicate the actual flow (even if it happened quickly).

## 🔁 Lifecycle

Status: `draft`. Change type: `creation`.

## 🧩 Reasoning

- Teams already expect decisions to flow through defined states; automation should match that expectation.
- Auto-walking states reduces the number of commands contributors run, lowering friction without sacrificing traceability.
- Implementing this at the CLI/service layer keeps behaviour consistent across future adapters (API/UI) that reuse the same service.

## 🔄 Next Actions

1. Update `acceptDecision` (and supporting helpers) so it sequences missing transitions and captures the correct changelog entries/dates.
2. Add Vitest coverage to assert changelog history, git commit sequencing, and behaviour when states are already advanced.
3. Extend documentation (README/AGENTS/CONTRIBUTING) to mention the auto-progression.

## 🧠 Confidence

Medium-high – behaviour matches contributor expectations, but we’ll monitor for edge cases (e.g. superseded DRs) once implemented.

## 🧾 Changelog
