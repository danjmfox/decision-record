---
id: DR--20251101--meta--lifecycle-fast-track
dateCreated: "2025-11-01"
version: "1.0"
status: draft
changeType: creation
domain: meta
slug: lifecycle-fast-track
changelog:
  - date: "2025-11-01"
    note: Initial creation
  - date: "2025-11-01"
    note: Marked as draft
  - date: "2025-11-01"
    note: Marked as draft
lastEdited: "2025-11-01"
---

# DR--20251101--meta--lifecycle-fast-track

## 🧭 Context

The lifecycle flow currently supports `draft → proposed → accepted`, but some decisions (e.g., internal process updates) may be reviewed synchronously and accepted immediately. We want clarity on whether a command like `drctl accept` can move a record from `draft` directly to `accepted`, effectively skipping time in the proposed state without losing auditability.

## ⚖️ Options Considered

| Option                                               | Description                                                                         | Outcome  | Rationale                                                                          |
| ---------------------------------------------------- | ----------------------------------------------------------------------------------- | -------- | ---------------------------------------------------------------------------------- |
| Require explicit propose step                        | Enforce `drctl propose` before `accept`                                             | Rejected | Adds ceremony even when reviewers agree synchronously; encourages workarounds.     |
| Allow direct accept with implicit changelog (chosen) | Permit `drctl accept` to run on drafts, recording the transition in a single commit | Accepted | Minimises friction while changelog + git history show the instantaneous promotion. |
| Auto-call propose when accepting                     | Chain commands internally                                                           | Rejected | Hides behaviour; multiple commits clutter history; harder to reason about.         |

## 🧠 Decision

Allow lifecycle commands (`accept`, `reject`, etc.) to run on `draft` records directly. The service layer already updates changelog entries and writes git commits, providing a clear audit: status steps straight from `draft` to `accepted` (or other target), with the changelog noting the action. Teams may still run `drctl propose` explicitly when asynchronous review time is needed.

## 🪶 Principles

- **Kanban-friendly** – respect flow efficiency; do not force a queue state when none is required.
- **Transparency** – rely on changelog entries and git log to show that acceptance was immediate.
- **Flexibility** – teams retain autonomy to insert a `proposed` stage when useful.

## 🔁 Lifecycle

Status: `draft`. Update documentation to clarify the behaviour, then promote to `proposed`/`accepted` after review.

## 🧩 Reasoning

CLI commands already mutate frontmatter deterministically and commit with descriptive messages (`drctl: accept …`). Skipping the intermediate state simply means the changelog shows a single entry (“Marked as accepted”) with no preceding “Marked as proposed”. Teams that prefer the explicit step can still run it; the system does not prevent consecutive status changes if they wish to demonstrate the dwell time. Automated dashboards can detect the absence of a `proposed` entry if they need to highlight “fast-tracked” decisions.

## 🔄 Next Actions

- Document this policy in README/AGENTS so users understand the intent.
- Consider tagging changelog entries or metrics to identify decisions that skipped `proposed`.

## 🧠 Confidence

High – behaviour is already supported, and audit trails remain intact via changelog and git history.

## 🧾 Changelog

- 2025-11-01 — Initial creation.
