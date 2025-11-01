# Architecture Overview

This document summarises the structure of the `drctl` Decision Record CLI and references the relevant decisions captured in `decisions-example/meta/`, in particular [DR--20251101--meta--architecture-overview](decisions-example/meta/DR--20251101--meta--architecture-overview.md).

## High-Level Structure

```
src/
 ├─ cli/          # Commander entrypoints, shared middleware, repo utilities
 ├─ core/         # Service and domain layers (lifecycle, repository, git helpers)
 ├─ types/        # Type declarations for external packages
decisions-example/ # Public sample decision records for tests and documentation
```

The CLI adopts a layered approach:

1. **CLI Layer (`src/cli/index.ts`)**
   - Defines commands (`new`, `draft`, `propose`, `accept`, `reject`, `deprecate`, `supersede`, `index`, `repo ...`).
   - Collects global options (`--repo`, `--config`) via shared middleware.
   - Logs the resolved repository context for transparency before delegating to services.

2. **Service Layer (`src/core/service.ts`)**
   - Implements lifecycle transitions while preserving Markdown bodies.
   - Appends changelog entries and writes git commits through `stageAndCommitWithHint`.
   - Provides helpers such as `listAll` to support CLI output.

3. **Repository & Configuration Layers**
   - `src/core/repository.ts` handles filesystem reads/writes using `gray-matter` for frontmatter parsing.
   - `src/config.ts` resolves repositories using a layered strategy: CLI flag → `DRCTL_CONFIG` → nearest `.drctl.yaml` → global config candidates → fallback directories. Diagnostics surface issues such as missing repos or duplicate aliases (see [DR--20251101--meta--multi-repo-config-routing](decisions-example/meta/DR--20251101--meta--multi-repo-config-routing.md)).

4. **Git Integration (`src/core/git.ts`)**
   - Thin wrapper around `git add/commit`.
   - Errors instruct users to run `drctl repo bootstrap` if the repo is not initialised (captured in [DR--20251101--meta--git-backed-lifecycle](decisions-example/meta/DR--20251101--meta--git-backed-lifecycle.md)).

## Lifecycle States

The CLI manages the following states (`draft → proposed → accepted → (deprecated | superseded) → retired → archived`) plus `rejected` for proposals that are declined. Current automation covers:

- `drctl draft`, `drctl propose`, `drctl accept` – status updates, changelog entries, git commits.
- `drctl reject`, `drctl deprecate`, `drctl supersede` – inactive state handling and cross-linking between decisions (see [DR--20251101--meta--inactive-states](decisions-example/meta/DR--20251101--meta--inactive-states.md)).
- `drctl index` – generates repository indexes (see [DR--20251101--meta--repository-indexing](decisions-example/meta/DR--20251101--meta--repository-indexing.md)).

Future work (recorded in AGENTS.md) includes implementing `drctl retire`, `drctl archive`, and hierarchical indexes.

## Testing Approach

Vitest suites colocated with their modules cover:

- Config resolution and diagnostics (`src/config.test.ts`).
- Repo management operations (`src/cli/repo-manage.test.ts`).
- Lifecycle services (`src/core/service.test.ts`).
- CLI wiring for repo commands (`src/cli/index.repo.test.ts`).

Git interactions are stubbed in tests, while error paths urge users to bootstrap repositories when necessary.

## Technology Choices

- **Language/Runtime:** Node.js + TypeScript (ESM) for type safety and future extensibility.
- **CLI Framework:** Commander, offering composable middleware and structured help output.
- **Frontmatter Parsing:** `gray-matter` to keep Markdown bodies intact.
- **Testing:** Vitest for fast, ESM-friendly unit tests.
- **Formatting/Linting:** Project CI runs formatting checks prior to commits (see Husky configuration).

## Relationship to ADR Tools

While inspired by `adr-tools`, `drctl` extends the concept with multi-repository configuration, git-backed lifecycle automation, richer metadata (`supersedes`, `supersededBy`, changelog arrays), and comprehensive tests. This architecture decision ensures the CLI remains maintainable as we explore API adapters or UI surfaces in the future.
