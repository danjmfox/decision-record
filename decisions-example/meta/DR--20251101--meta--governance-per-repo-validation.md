---
id: DR--20251101--meta--governance-per-repo-validation
dateCreated: "2025-11-01"
version: 1.0.0
status: proposed
changeType: creation
domain: meta
slug: governance-per-repo-validation
tags:
  - governance
  - validation
changelog:
  - date: "2025-11-01"
    note: Initial creation
  - date: "2025-11-01"
    note: Marked as draft
  - date: "2025-11-01"
    note: Marked as proposed
lastEdited: "2025-11-01"
---

# DR--20251101--meta--governance-per-repo-validation

## 🧭 Context

We are introducing a governance validation workflow for drctl so teams can check Decision Record integrity after manual edits or merges. A proposal suggested maintaining a global `registry.json` that tracked every DR across personal and work repositories. That approach raised concerns about privacy boundaries (keeping home vs work reasoning separate), synchronisation complexity, and storing cross-repo data by default when most teams operate within one repo at a time.

## ⚖️ Options Considered

| Option                       | Description                                                     | Outcome  | Rationale                                                                                  |
| ---------------------------- | --------------------------------------------------------------- | -------- | ------------------------------------------------------------------------------------------ |
| Do nothing                   | Rely on discipline; no automated validation                     | Rejected | Drift risk remains; humans will still edit files manually                                  |
| Global registry (default)    | Maintain a single `registry.json` aggregating all repos         | Rejected | Breaks personal/work isolation, adds sync burden, stores unwanted data                     |
| Per-repo validation (chosen) | Validate each repo independently; no shared registry by default | Accepted | Preserves boundaries, keeps implementation simple, still enables optional federation later |

## 🧠 Decision

Default governance validation operates per repository. `drctl governance validate` reads the active repo (and any explicitly supplied repos), detects metadata issues, and reports them without writing global state. Any cross-repo federation will be opt-in and explicitly invoked so users can keep personal and work catalogues isolated.

## 🪶 Principles

- **Privacy by design** — personal/workspaces stay separate unless the user chooses to merge them.
- **Progressive disclosure** — start with the simplest useful behaviour (per-repo checks), then layer optional federation later.
- **Human authority** — validators inform; they never write shared registries or modify DRs automatically.

## 🔁 Lifecycle

Status remains `draft` while validation tooling is still in design. Promote to `proposed` once the CLI prototype and documentation reflect the per-repo scope.

## 🧩 Reasoning

- Teams already configure drctl per repo; governance validation should match that mental model.
- Keeping data local reduces accidental leakage of private decisions and simplifies compliance discussions.
- Developers can still produce a combined view later (e.g. via an explicit `drctl governance export`) without forcing it on every user.
- Avoiding a background registry keeps the implementation composable for now and reduces the amount of state we must support long term.

## 🔄 Next Actions

- Implement the per-repo `drctl governance validate` command using the iterative plan.
- Document how to run validation locally and in CI.
- Explore an opt-in federation/registry pattern once per-repo validation has shipped and real demands surface.

## 🧠 Confidence

0.7 — aligns with current usage patterns and privacy expectations; revisit if multiple teams require shared registries.

## 🧾 Changelog
