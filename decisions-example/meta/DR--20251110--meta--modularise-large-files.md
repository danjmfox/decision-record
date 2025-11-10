---
id: DR--20251110--meta--modularise-large-files
dateCreated: "2025-11-10"
version: 1.0.0
status: proposed
changeType: creation
domain: meta
slug: modularise-large-files
changelog:
  - date: "2025-11-10"
    note: Initial creation
  - date: "2025-11-10"
    note: Marked as draft
  - date: "2025-11-10"
    note: Marked as proposed
lastEdited: "2025-11-10"
---

# DR--20251110--meta--modularise-large-files

## 🧭 Context

`drctl` has three “mega files” that now exceed 750 lines each:

- `src/config.ts` mixes config discovery, YAML parsing, git-mode inference, diagnostics formatting, and helper utilities.
- `src/core/service.ts` combines lifecycle orchestration, git helpers, traversal/index logic, and template rendering.
- `src/cli/index.ts` wires every command plus legacy shims, repo logging, and bespoke handler glue.

The code is still functional, but the size makes review, refactoring, and dependabot merges painful. Modularising these surfaces has been on the TODO list; this DR captures the approach before we start large-scale moves.

## ⚖️ Options Considered

| Option | Description                                                              | Outcome  | Rationale                                                                                                        |
| ------ | ------------------------------------------------------------------------ | -------- | ---------------------------------------------------------------------------------------------------------------- |
| A      | Leave the large files as-is and rely on comments/tests for understanding | Rejected | Cognitive load keeps growing; harder to isolate defects or reuse logic.                                          |
| B      | Opportunistic cleanup when touching each file                            | Rejected | Leads to piecemeal patterns and conflicting structures; no guiding vision.                                       |
| C      | Plan a deliberate modularisation (chosen)                                | Accepted | Provides a defined target structure, enables incremental PRs, and keeps lifecycle/git/config concerns separated. |

## 🧠 Decision

Adopt a staged modularisation:

1. Split `src/config.ts` into cohesive modules (`config/layers.ts`, `config/git-mode.ts`, `config/diagnostics.ts`, etc.) with an index that re-exports the public API.
2. Extract lifecycle handlers and traversal helpers from `src/core/service.ts` into `core/lifecycle/*` and `core/filesystem/*`, leaving `service.ts` as a thin orchestrator.
3. Break `src/cli/index.ts` into subcommand builders (`cli/decision.ts`, `cli/config.ts`, `cli/repo.ts`, `cli/governance.ts`) to constrain Commander wiring per concern.
4. Each extraction keeps existing tests green; new unit tests accompany the new modules.

## 🪶 Principles

- **Separation of concerns**: Config, lifecycle, and CLI stacking should have their own modules.
- **Progressive disclosure**: Smaller files make it easier for new contributors (human/AI) to find relevant logic.
- **DecisionOps mindset**: Capturing intent in a DR ensures future refactors or revert decisions stay auditable.

## 🔁 Lifecycle

Status: `draft`, changeType: `creation`. Promote after first extraction lands and patterns prove workable.

## 🧩 Reasoning

Without a guiding DR, each refactor would risk subjective structure. Centralising the plan:

- Aligns with `docs/TODO.md` items that already call for modularisation.
- Gives reviewers a single artifact to reference when evaluating the inevitable multi-PR sequence.
- Sets expectations that functionality must remain unchanged; only structure moves.

## 🔄 Next Actions

1. Extract config-layer modules and ensure `config.test.ts` covers the reshaped API.
2. Move lifecycle/gov helpers out of `core/service.ts`, updating imports and tests incrementally.
3. Introduce per-command builder files under `src/cli/`, wiring them together in `index.ts`.
4. Update documentation (README, AGENTS) once the new structure stabilises.

## 🧠 Confidence

0.7 — The plan mirrors patterns used in similar CLIs, but execution details (module boundaries, exported helpers) will evolve during implementation.

## 🧾 Changelog

- 2025-11-10 — Initial creation (draft) capturing modularisation strategy.
