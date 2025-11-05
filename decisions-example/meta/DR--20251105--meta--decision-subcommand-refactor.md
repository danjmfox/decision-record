---
id: DR--20251105--meta--decision-subcommand-refactor
dateCreated: "2025-11-05"
version: 1.0.0
status: draft
changeType: creation
domain: meta
slug: decision-subcommand-refactor
changelog:
  - date: "2025-11-05"
    note: Initial creation
---

# DR--20251105--meta--decision-subcommand-refactor

## 🧭 Context

The CLI currently exposes lifecycle commands (`new`, `draft`, `propose`, `accept`, `revise`, etc.) directly off the root `drctl` command. As the surface area has grown (repo utilities, governance checks, indexing, configuration diagnostics), the top-level namespace has become crowded and harder to scan. Contributors now rely on the README/AGENTS guides to remember which commands mutate decision records versus configuration state.

Upcoming lifecycle enhancements (hierarchical indexes, export/diff, manual linting) will add more verbs. Without a clear grouping, discoverability continues to erode and onboarding gets noisier—especially for teams delegating the CLI work to automation scripts or less experienced collaborators. Previous DRs (`DR--20251101--meta--architecture-overview`, `DR--20251101--meta--revision-commands`) assume lifecycle operations can be composed as a coherent unit; our command structure should reflect that intent.

## ⚖️ Options Considered

| Option | Description                                                                                 | Outcome  | Rationale                                                                                                                             |
| ------ | ------------------------------------------------------------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| A      | Keep the current flat command layout                                                        | Rejected | Top-level command list stays noisy; future lifecycle additions worsen discoverability and documentation overhead.                     |
| B      | Introduce aliases (`drctl decision new` alongside existing commands)                        | Rejected | Adds duplication to maintain; unclear deprecation path; still requires users to remember two sets of verbs.                           |
| C      | Move lifecycle verbs under a dedicated `decision` subcommand and provide transitional shims | Chosen   | Aligns CLI structure with the service layer; creates a single discoverable home for decision actions while allowing staged migration. |

## 🧠 Decision

Create a dedicated `drctl decision` command that owns all decision-record lifecycle verbs (`new`, `draft`, `propose`, `accept`, `reject`, `deprecate`, `revise`, `correction`, `retire`, `supersede`, list/index helpers). The existing top-level commands will become thin shims that delegate to the subcommand while emitting deprecation notices and telemetry so adopters can migrate intentionally.

CLI help output, README examples, and AGENTS working agreements will be updated to reference the new structure. Once documentation and automation pipelines are proven against the subcommand, the shims can be retired in a follow-up DR.

## 🪶 Principles

- **Progressive disclosure** – Group decision lifecycle commands behind a single, discoverable namespace without breaking existing workflows.
- **Reasoning as code** – Keep lifecycle ergonomics consistent with our DR policy so the CLI reflects the architectural layering.
- **Calm collaboration** – Reduce command sprawl to make it easier for human + AI contributors to follow governance checks and automation guidance.

## 🔁 Lifecycle

Status: `draft` (new policy captured prior to implementation). Change type: `creation`.

## 🧩 Reasoning

Service-layer functions already accept a `RepoOptions` bundle, making it straightforward to move Commander wiring into a dedicated subcommand module. Consolidating help output under `drctl decision --help` reinforces that lifecycle commands share common flags (`--repo`, `--config`, git mode overrides).

A transitional shim honours progressive disclosure: end-users can keep muscle memory while the CLI emits guidance, and automation can migrate gradually. This approach also unlocks future grouping (`drctl repo`, `drctl config`, `drctl governance`, `drctl automation`) without overwhelming the root command.

We intentionally rejected a dual-command approach (Option B) because maintaining two paths risks documentation drift and increases testing burden. By choosing a single canonical home, we preserve clarity and reduce maintenance costs.

## 🔄 Next Actions

1. Implement Commander subcommand wiring with comprehensive Vitest coverage (service delegation, help output, shim logging).
2. Update README, AGENTS, and relevant DRs to reflect the new command paths and migration guidance.
3. Capture telemetry/deprecation messaging strategy in a follow-up revision once usage is observed.

## 🧠 Confidence

Confidence: 0.7 (high confidence in structural benefits; awaiting feedback from real-world usage before retiring shims). Review after subcommand rollout and documentation updates land.

## 🧾 Changelog

See YAML frontmatter for dated entries.
