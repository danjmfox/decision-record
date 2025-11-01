---
id: DR--20251101--meta--revision-commands
dateCreated: "2025-11-01"
version: "1.0"
status: draft
changeType: creation
domain: meta
slug: revision-commands
changelog:
  - date: "2025-11-01"
    note: Initial creation
  - date: "2025-11-01"
    note: Marked as draft
lastEdited: "2025-11-01"
---

# DR--20251101--meta--revision-commands

## 🧭 Context

Today we corrected a decision record directly in git. While acceptable for a quick fix, it leaves little audit trail and may confuse collaborators (“your copy differs from mine”). We already track significant lifecycle changes (draft → accept, supersede), but we lack CLI commands for minor corrections and moderate revisions that should still be traceable.

## ⚖️ Options Considered

| Option                                                             | Description                    | Outcome                                                                                                             | Rationale                                                                             |
| ------------------------------------------------------------------ | ------------------------------ | ------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| Manual edits only                                                  | Continue editing DRs directly  | Rejected                                                                                                            | Inconsistent changelog/version handling; little visibility.                           |
| Single revision command                                            | Add one generic `drctl revise` | Considered                                                                                                          | Clearer than manual edits, but conflates tiny corrections with substantive revisions. |
| Split commands: `correction` (bugfix) and `revise` (minor version) | Accepted                       | Distinguishes semantic intent, matches versioning expectations (`x.x.1` vs `x.(x+1)`), keeps lifecycle flow intact. |

## 🧠 Decision

Introduce two new CLI commands:

- `drctl correction <id> [--note ...]` – applies small factual/typo fixes. Bumps patch version (`1.0.0 → 1.0.1`), updates `lastEdited`, and appends a changelog entry (default message “Minor correction”).
- `drctl revise <id> [--note ...] [--confidence ...]` – applies moderate updates (context, confidence, metadata). Bumps minor version (`1.0.0 → 1.1.0`), updates `lastEdited`, and records the reason.

Both commands preserve the Markdown body unless changes are made, and neither affects lifecycle status. Larger shifts (supersede, retire) continue using existing commands.

## 🪶 Principles

- **Traceable history** – Every adjustment leaves a changelog entry with semantic meaning.
- **Semantic versioning for DRs** – Patch = correction, minor = revision, major reserved for future use if needed.
- **Low friction** – Provide CLI helpers so editors avoid ad-hoc manual edits.

## 🔁 Lifecycle

Status: `draft`. Promote after commands, tests, and documentation are implemented.

## 🧩 Reasoning

Differentiating “corrections” from “revisions” clarifies intent: patch updates communicate bug fixes, minor bumps signal content changes, and existing lifecycle commands handle status transitions. Providing CLI support ensures the changelog and version numbers stay in sync without manual editing. A future `--no-commit` option or staged-file guard still applies.

## 🔄 Next Actions

- Implement TDD for `correction` (patch bump) and `revise` (minor bump) commands.
- Update README/AGENTS to describe version semantics (`x.y.z`).
- Consider migration tooling for existing DRs (optional).

## 🧠 Confidence

Medium – concept aligns with versioning practices; implementation pending.

## 🧾 Changelog

- 2025-11-01 — Initial draft.

# DR--20251101--meta--revision-commands

## 🧭 Context

_Describe the background and circumstances leading to this decision._

## ⚖️ Options Considered

_List the main options or alternatives that were evaluated before making the decision, including why each was accepted or rejected._

| Option | Description | Outcome  | Rationale                      |
| ------ | ----------- | -------- | ------------------------------ |
| A      | Do nothing  | Rejected | Insufficient long-term clarity |
| B      |             |          |                                |

## 🧠 Decision

_State the decision made clearly and succinctly._

## 🪶 Principles

_List the guiding principles or values that influenced this decision._

## 🔁 Lifecycle

_Outline the current lifecycle state and any relevant change types._

## 🧩 Reasoning

_Explain the rationale, trade-offs, and considerations behind the decision._

## 🔄 Next Actions

_Specify the immediate next steps or actions following this decision._

## 🧠 Confidence

_Indicate the confidence level in this decision and any planned reviews._

## 🧾 Changelog

_Summarise notable updates, revisions, or corrections. Each should have a date and note in YAML frontmatter for traceability._
