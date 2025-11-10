---
id: DR--20251105--meta--decision-subcommand-refactor
dateCreated: "2025-11-05"
lastEdited: "2025-11-05"
version: 1.0.0
status: accepted
changeType: creation
domain: meta
slug: decision-subcommand-refactor
changelog:
  - date: "2025-11-05"
    note: Initial creation
  - date: "2025-11-05"
    note: Documented decision-subcommand implementation and doc updates
  - date: "2025-11-05"
    note: Marked as draft
  - date: "2025-11-05"
    note: Marked as proposed
  - date: "2025-11-05"
    note: Marked as accepted
dateAccepted: "2025-11-05"
---

# DR--20251105--meta--decision-subcommand-refactor

## 🧭 Context

The CLI previously surfaced every lifecycle command (`new`, `draft`, `propose`, `accept`, etc.) at the root `drctl` namespace. As more features landed (`repo`, `config`, `governance`, `index`, upcoming `diff`/`export`), the top-level command list became noisy and difficult to scan. Contributors now rely on README/AGENTS callouts to remember which verbs mutate decision records, and automation scripts must import a growing set of discrete commands.

Centralising lifecycle behaviours under a dedicated `decision` subcommand keeps the CLI aligned with the service layer (`core/service.ts`) and reduces accidental misuse. Transitional shims are required so existing workflows do not break immediately.

## ⚖️ Options Considered

| Option | Description                                                                                 | Outcome      | Rationale                                                                                                                             |
| ------ | ------------------------------------------------------------------------------------------- | ------------ | ------------------------------------------------------------------------------------------------------------------------------------- |
| A      | Keep the current flat command layout                                                        | Rejected     | Top-level command list stays crowded; future lifecycle additions worsen discoverability and documentation overhead.                   |
| B      | Introduce aliases (`drctl decision new` alongside existing commands)                        | Rejected     | Adds duplication to maintain; unclear deprecation story; still forces users to remember two entry points.                             |
| C      | Move lifecycle verbs under a dedicated `decision` subcommand and provide transitional shims | **Accepted** | Aligns CLI structure with the service layer; creates a single discoverable home for decision actions while allowing staged migration. |

## 🧠 Decision

Expose all decision lifecycles under `drctl decision …` and keep the existing root-level verbs as shims that delegate internally while emitting deprecation warnings. The new subcommand owns:

- Lifecycle verbs (`new`, `draft`, `propose`, `accept`, `reject`, `deprecate`, `retire`, `supersede`, `revise`, `correction`/`correct`).
- Helper commands (`list`, `index`) so decision-focused workflows stay in one namespace.

Root-level commands will be removed after telemetry confirms adoption. Until then they warn once per invocation with guidance to migrate.

## 🪶 Principles

- **Progressive disclosure** – Experienced users can continue running familiar commands for now, while newcomers see a tidy `drctl decision --help` surface.
- **Reasoning is code** – CLI shape mirrors the service architecture and DecisionOps documentation so concepts stay aligned.
- **Calm collaboration** – Explicit deprecation messaging avoids surprise breakage across scripts, CI jobs, and AI-assisted flows.

## 🔁 Lifecycle

Status: `accepted`. Change type: `creation`. Track telemetry before planning shim removal.

## 🧩 Reasoning

Refactoring the command wiring reduces duplication: the new handlers live in dedicated functions and both the subcommand and legacy shims reuse them. Tests cover the new shape (`drctl decision …`) and confirm shims warn once while still delegating to the service layer. Documentation (README, AGENTS) now references the subcommand explicitly so future adopters do not learn the deprecated syntax. This sets the stage for eventually pruning the top-level verbs once usage metrics (CLI output or wrappers) indicate it is safe.

## 🔄 Next Actions

1. ✅ Ship the Commander refactor with Vitest coverage and deprecation warnings.
2. ✅ Update README, AGENTS, and related guidance to reference `drctl decision` commands.
3. 🔄 Capture telemetry/feedback (CLI warning counts, support requests) to determine when it is safe to remove shims.
4. 🔜 Replace shims with hard errors in a subsequent minor release and promote this DR once adoption is confirmed.

## 🧠 Confidence

0.8 — Implementation and docs are in place; waiting on adoption signals before promoting to `proposed`/`accepted`.

## 🧾 Changelog

- See YAML frontmatter for dated updates.
