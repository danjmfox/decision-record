---
id: DR--20251105--meta--git-optional-lifecycle
dateCreated: "2025-11-05"
version: 1.0.1
status: accepted
changeType: correction
domain: meta
slug: git-optional-lifecycle
changelog:
  - date: "2025-11-05"
    note: Initial creation
  - date: "2025-11-05"
    note: Marked as draft
  - date: "2025-11-05"
    note: Marked as proposed
  - date: "2025-11-05"
    note: Marked as accepted
  - date: "2025-11-05"
    note: clarify lifecycle section usage
lastEdited: "2025-11-05"
dateAccepted: "2025-11-05"
---

# DR--20251105--meta--git-optional-lifecycle

## 🧭 Context

Teams that rely on `drctl` for reasoned decision tracking want the lifecycle flow (`draft` → `accept`, revisions, corrections, etc.) without depending on git. This affects less-technical contributors working from shared network drives or locked-down desktops where repository bootstrapping is out of scope. Today every lifecycle command stages and commits, failing with bootstrap hints when git is unavailable. We need a deliberate policy—aligned with `DR--20251101--meta--git-backed-lifecycle`—that preserves changelog fidelity while making git optional on a per-repo basis.

## ⚖️ Options Considered

| Option                                      | Description                                                                     | Outcome  | Rationale                                                                                                  |
| ------------------------------------------- | ------------------------------------------------------------------------------- | -------- | ---------------------------------------------------------------------------------------------------------- |
| Keep git mandatory                          | Retain current behaviour; lifecycle commands abort without a git repository     | Rejected | Blocks adoption for governance-heavy but tool-light teams; contradicts progressive disclosure commitments. |
| Ad-hoc environment flag                     | Add a `DRCTL_NO_GIT` env var that short-circuits commits                        | Rejected | Hidden, global flag; hard to audit, no repo-level provenance, brittle when multiple repos are in play.     |
| Configurable git mode with cascade (chosen) | Introduce an explicit git mode resolver (CLI flag → env var → repo config → fs) | Accepted | Balances flexibility and transparency; keeps git-first default while enabling documented opt-out paths.    |

## 🧠 Decision

Adopt a git-mode cascade that resolves per repository in this priority order: CLI override (`--git` / `--no-git`), environment variable (e.g. `DRCTL_GIT=disabled`), repo configuration (`.drctl.yaml` entry), and finally filesystem detection (presence of `.git/`). The resolved `gitMode` travels in `RepoContext` so lifecycle commands, config diagnostics, and repo logging share a consistent understanding.

When git mode is disabled:

1. Lifecycle commands still mutate YAML frontmatter and changelogs, but they skip staged-file checks and commit attempts.
2. CLI output replaces the bootstrap hint with a “git disabled” acknowledgement.
3. `drctl config check` reports the repo as git-disabled rather than uninitialised.

Additional guardrails:

- Forbid `--no-git` when a `.git/` directory is present; auto-flip to enabled and surface a warning so users don’t silently bypass commits.
- Running `drctl repo bootstrap <name>` on a git-disabled repo re-enables git for that entry, clearing any persisted `git: disabled` flag.
- Emit telemetry-friendly breadcrumbs (console messaging now, future JSON output) so auditors can trace when git is intentionally off.

The CLI stays git-first—gitless operation is explicit opt-in with visible audit trails.

## 🪶 Principles

- **Progressive disclosure** – Git-backed lifecycle stays the default, but teams can opt out with a documented flag.
- **Trust through transparency** – Every git mode decision is visible in CLI output, config diagnostics, and repo context formatting.
- **DecisionOps framing** – Supports teams that must record decisions even in non-developer environments, preserving lifecycle rigour.

## 🔁 Lifecycle

Lifecycle status is recorded in the YAML frontmatter; use `drctl` lifecycle commands to advance states and capture changelog entries. Track implementation, documentation, and regression tests as follow-on actions.

## 🧩 Reasoning

The cascade mirrors existing repo-resolution behaviour, reducing cognitive load. Persisting git mode in `RepoContext` keeps downstream calls cohesive, and the guardrails prevent accidental “no commit” operation inside active git workspaces. Preserving changelog mutations ensures future automation (indexes, exports) tell a consistent story regardless of git availability. Documented opt-in also sets the stage for future sync features that may rely on explicit git metadata when available.

## 🔄 Next Actions

- Update `RepoContext`/config parsing to include git mode resolution and persistence.
- Extend lifecycle services plus tests to operate in both git-enabled and git-disabled modes.
- Refresh README and AGENTS to describe git-optional workflows and new CLI flags.
- Add governance/config diagnostics that reflect git-disabled repositories without nagging users.

## 🧠 Confidence

Medium – concept well-understood, but requires implementation and regression coverage to validate ergonomics.

## 🧾 Changelog

- 2025-11-05 — Initial creation.
