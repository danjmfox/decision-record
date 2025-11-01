---
id: DR--20251101--meta--decisionops-framing
dateCreated: "2025-11-01"
version: 1.0.0
status: accepted
changeType: creation
domain: meta
slug: decisionops-framing
tags:
  - decisionops
  - governance
changelog:
  - date: "2025-11-01"
    note: Initial creation
  - date: "2025-11-01"
    note: Marked as draft
  - date: "2025-11-01"
    note: Marked as proposed
  - date: "2025-11-01"
    note: Marked as accepted
lastEdited: "2025-11-01"
dateAccepted: "2025-11-01"
---

# DR--20251101--meta--decisionops-framing

## 🧭 Context

drctl has evolved beyond ADR scaffolding into a governance-aware system. Contributors asked how the CLI aligns with established delivery practices (Agile, BDD, DDD, DevOps, Kanban) and how to reassure audiences who worry that capturing decisions slows delivery. We need a single, inspectable source that frames drctl as the backbone of “DecisionOps” while giving both flow-oriented and rules-oriented teams a shared language.

## ⚖️ Options Considered

| Option                                   | Description                                                                         | Outcome  | Rationale                                                                                    |
| ---------------------------------------- | ----------------------------------------------------------------------------------- | -------- | -------------------------------------------------------------------------------------------- |
| Document incremental hints only          | Keep agile/governance parallels in ad-hoc notes or conversations                    | Rejected | Creates drift; audiences keep asking the same questions                                      |
| Publish external article                 | Explain DecisionOps in a blog post outside the repo                                 | Rejected | Not version-controlled with the tool; hard to evolve with the code                           |
| Capture a meta DR + doc updates (chosen) | Record the framing as a decision and surface tailored explanations in README/AGENTS | Accepted | Keeps reasoning in-repo, versioned, and reusable by both agile and governance-minded readers |

## 🧠 Decision

Position drctl as a DecisionOps platform by:

- Capturing this meta framing in a decision record that links drctl to contemporary practices.
- Updating README guidance so agile teams see the flow/TDD parallels and understand that DRs accelerate, not block, delivery.
- Updating collaboration docs so governance-focused readers recognise the system as “governance-as-code” with validation and lifecycle guarantees.

## 🪶 Principles

- **Reasoning is code** — the framing must live alongside the implementation.
- **Progressive disclosure** — meet agile and rules-based audiences where they are without duplicating content.
- **Trust through transparency** — articulate why drctl enforces lifecycle integrity and how validation mirrors automated tests.

## 🔁 Lifecycle

Status remains `draft` while content lands in README/AGENTS. Promote to `proposed` once the documentation updates and DecisionOps messaging are ready for review.

## 🧩 Reasoning

- **User stories & BDD** — DR structure mirrors who/what/why, while principles + governance validation act as acceptance criteria and executable specs.
- **Unit / integration tests** — schema and cross-record validations give confidence that the reasoning system still “builds”.
- **Lifecycle ≈ CI/CD** — draft → accepted → superseded flows match delivery pipelines, showing that DRs keep cadence rather than add ceremony.
- **DDD & bounded contexts** — repos/domain folders behave like bounded contexts; governance rules enforce the ubiquitous language.
- **DevOps & observability** — indices, lineage, and validation provide telemetry on organisational reasoning.
- **Flow/Kanban** — lifecycle states map to workflow columns, enabling lead-time/WIP insights for decision-making work.

## 🔄 Next Actions

- Update README with an “Agile-friendly” section highlighting flow, TDD, and CI parallels.
- Add a companion paragraph for governance/rules-focused teams explaining validation, lifecycle enforcement, and DecisionOps benefits.
- Cross-link AGENTS.md and relevant DRs so the collaboration agreement reflects the DecisionOps posture.
- Explore a follow-up DR to scope governance validation enhancements (e.g. `drctl governance validate`).

## 🧠 Confidence

0.7 — The framing aligns with observed usage and community feedback, but we still need adoption data once documentation updates ship.

## 🧾 Changelog
