---
id: DR--20251101--meta--architecture-overview
dateCreated: "2025-11-01"
version: "1.0"
status: accepted
changeType: creation
domain: meta
slug: architecture-overview
changelog:
  - date: "2025-11-01"
    note: Initial creation
  - date: "2025-11-01"
    note: Marked as draft
  - date: "2025-11-01"
    note: Marked as accepted
lastEdited: "2025-11-01"
dateAccepted: "2025-11-01"
---

# DR--20251101--meta--architecture-overview

## 🧭 Context

The CLI has evolved past an experiment: we now support multi-repo config resolution, git-backed lifecycle commands, and repository indexing. We need an explicit architectural record so new contributors understand the layering (CLI ⇄ services ⇄ repository/config) and how this compares with existing tools such as `adr-tools`. This DR also seeds the canonical `ARCHITECTURE.md`.

## ⚖️ Options Considered

| Option                                   | Description                                                                      | Outcome  | Rationale                                                                             |
| ---------------------------------------- | -------------------------------------------------------------------------------- | -------- | ------------------------------------------------------------------------------------- |
| Extend `adr-tools`                       | Fork/augment the bash scripts                                                    | Rejected | Difficult to test; assumes single repo; lacks structured metadata and git automation. |
| Ad-hoc TS commands                       | Implement features directly inside the CLI                                       | Rejected | Encourages duplicated logic and makes lifecycle changes harder to test.               |
| Layered TypeScript architecture (chosen) | Commander CLI with shared middleware, service layer, repository + config modules | Accepted | Provides separation of concerns, easier testing, and future extension points.         |

## 🧠 Decision

Adopt a layered architecture:

- **CLI (Commander)** – parses arguments, collects global options (`--repo`, `--config`), logs repo context, and delegates to services.
- **Services (`src/core/service.ts`)** – orchestrate lifecycle transitions, ensure frontmatter-only mutations, manage changelog entries, and call the git client.
- **Repository (`src/core/repository.ts`)** – handles filesystem I/O, YAML parsing with `gray-matter`, and body preservation.
- **Configuration (`src/config.ts`)** – resolves repo context via CLI flag, env variable, local/global configs, and fallbacks, exposing diagnostics.
- **Tests (Vitest)** – colocated unit tests cover config resolution, lifecycle commands, indexing, and repo management.

## 🪶 Principles

- **Separation of concerns** – clear boundaries between CLI, services, repository, and config modules.
- **Reasoning is code** – architecture decisions are documented and enforced by tests and DRs.
- **Future-proofing** – the Node/TypeScript foundation can power additional surfaces such as REST APIs or dashboards.

## 🔁 Lifecycle

Status: `draft` pending publication of `ARCHITECTURE.md` and peer review.

## 🧩 Reasoning

Commander middleware avoids repeating repo-resolution logic per command. Abstracting git operations lets tests stub them while keeping production behaviour consistent. Compared with `adr-tools`, the TypeScript stack unlocks multi-repo support, richer metadata, and easier composition. The structure matches our documentation rhythm: README/AGENTS mirror the code layout, and new features land with tests because services provide focused seams.

## 🔄 Next Actions

- Author `ARCHITECTURE.md` summarising the layers and linking to this DR.
- Revisit the architecture once API/UI adapters ship to ensure the layering still holds.

## 🧠 Confidence

High – the structure is already delivering maintainability benefits; ongoing tests guard against regressions.

## 🧾 Changelog

- 2025-11-01 — Initial creation.
