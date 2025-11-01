---
id: DR--20251101--meta--embedded-decisions
dateCreated: "2025-11-01"
version: "1.0"
status: draft
changeType: creation
domain: meta
slug: embedded-decisions
changelog:
  - date: "2025-11-01"
    note: Initial creation
  - date: "2025-11-01"
    note: Marked as draft
lastEdited: "2025-11-01"
---

# DR--20251101--meta--embedded-decisions

## 🧭 Context

Some teams prefer to keep decision records within the same repository as their application (e.g., `./decisions/` inside the project root) to align code changes and decisions in one place. The CLI already supports pointing a repo alias to a subdirectory, but we need explicit guidance on configuration, git hygiene, and upcoming guardrails to prevent accidental commits.

## ⚖️ Options Considered

| Option                                                | Description                                                          | Outcome  | Rationale                                                                          |
| ----------------------------------------------------- | -------------------------------------------------------------------- | -------- | ---------------------------------------------------------------------------------- |
| Dedicated decisions repos only                        | Require standalone repositories for all decisions                    | Rejected | Inflexible for small teams or prototypes; increases friction.                      |
| Allow embedded usage without guidance                 | Rely on existing behaviour and user intuition                        | Rejected | Risks accidental commits and unclear workflows; poor onboarding.                   |
| Document embedded workflow & plan guardrails (chosen) | Provide recipes for embedded configs and warn about git implications | Accepted | Keeps flexibility while reinforcing good practices and paving path for safeguards. |

## 🧠 Decision

Recognise embedded decisions as a supported workflow by:

- Documenting how to configure `.drctl.yaml` with paths such as `./decisions` inside an existing project.
- Updating README/AGENTS with git hygiene advice (run `drctl` on a clean staging area, expect dedicated commits).
- Planning a staged-files preflight check so lifecycle commands warn when other files are staged.

## 🪶 Principles

- **Progressive disclosure** – surface embedded usage explicitly so teams don’t rely on undocumented behaviour.
- **Trust through transparency** – highlight implications (git commits, staging rules) and guide towards safe workflows.
- **Future-proofing** – note forthcoming guardrails and potential enhancements (`--no-commit`).

## 🔁 Lifecycle

Status: `draft` pending documentation updates and implementation of the staged-files warning.

## 🧩 Reasoning

The multi-repo config system already supports arbitrary paths, so enabling embedded decisions is mostly an documentation concern. Without guidance, users may run lifecycle commands with other files staged, leading to noisy commits. Capturing this decision makes expectations explicit and frames follow-on work for guardrails or alternative workflows (e.g., manual commit mode).

## 🔄 Next Actions

- Update README/AGENTS with embedded setup examples and git hygiene notes.
- Implement staged-files preflight check (see plan in AGENTS).
- Evaluate adding a `--no-commit` flag for teams that prefer manual git control (future).

## 🧠 Confidence

Medium – usage is already possible and exercised, but guardrails are pending.

## 🧾 Changelog

- 2025-11-01 — Initial creation.
