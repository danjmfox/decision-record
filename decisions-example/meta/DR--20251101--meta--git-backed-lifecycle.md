---
id: DR--20251101--meta--git-backed-lifecycle
dateCreated: "2025-11-01"
version: "1.0"
status: accepted
changeType: creation
domain: meta
slug: git-backed-lifecycle
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

# DR--20251101--meta--git-backed-lifecycle

## 🧭 Context

Decision records only provide value when their lifecycle is trustworthy. Early experiments required authors to run `git add/commit` manually and risked wiping the Markdown body when updating frontmatter. We wanted a CLI that:

- enforces consistent YAML mutations,
- adds changelog entries automatically,
- writes commits with meaningful messages, and
- guides users when the repo is not yet a git workspace.

## ⚖️ Options Considered

| Option                       | Description                                                  | Outcome  | Rationale                                                             |
| ---------------------------- | ------------------------------------------------------------ | -------- | --------------------------------------------------------------------- |
| Manual git workflow          | Leave lifecycle commands to edit files only                  | Rejected | Too easy to forget staging/commit; inconsistent histories.            |
| Git hooks / wrappers         | Keep commands simple and rely on external hooks              | Rejected | Hard to document and test; increases onboarding friction.             |
| Built-in git client (chosen) | Lifecycle commands mutate frontmatter and commit immediately | Accepted | Provides deterministic, auditable workflow with strong test coverage. |

## 🧠 Decision

Wrap every lifecycle command (`draft`, `propose`, `accept`, `reject`, `deprecate`, `supersede`) in service functions that:

1. Load the DR, mutate status/changelog/frontmatter while preserving the Markdown body.
2. Save the record back to disk.
3. Stage and commit relevant files using a shared git client (`drctl: <action> <id>`).
4. When git operations fail because the repo is uninitialised, throw an error with a `drctl repo bootstrap` hint.

## 🪶 Principles

- **Reasoning is code** – lifecycle metadata lives alongside versioned content, never out-of-sync.
- **Trust through transparency** – commits capture exactly which command ran; changelog entries narrate every transition.
- **Human-AI collaboration** – automated guards catch mistakes (e.g. missing git repo) before they surprise collaborators.

## 🔁 Lifecycle

Status: `draft`. The behaviour is implemented; we’ll mark this DR `proposed` once reader-facing docs capture the workflow, then `accepted` after community review.

## 🧩 Reasoning

Vitest coverage exercises each transition, asserting both frontmatter changes and git commit invocation. The service layer uses a shared `stageAndCommitWithHint` helper to standardise error messages. Rendering the template only on creation and preserving the Markdown body on updates eliminates the “blank file” regressions we saw earlier. The commit format (`drctl: <verb> <id>` or `drctl: supersede old -> new`) makes git history searchable. While we considered automatically regenerating indices, we chose to separate concerns: lifecycle commands report file paths and leave indexing to an explicit command.

## 🔄 Next Actions

- Document the lifecycle flow prominently in README and AGENTS (in progress).
- Add smoke tests that run commands end-to-end within a temporary git repo.

## 🧠 Confidence

High – behaviour is unit-tested and reinforced by conventional commits during development.

## 🧾 Changelog

- 2025-11-01 — Initial creation.
