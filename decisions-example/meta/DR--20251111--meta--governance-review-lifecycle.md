---
id: DR--20251111--meta--governance-review-lifecycle
dateCreated: "2025-11-11"
dateAccepted: "2025-11-11"
reviewDate: "2026-11-11"
version: 1.0.0
status: proposed
changeType: creation
domain: meta
slug: governance-review-lifecycle
changelog:
  - date: "2025-11-11"
    note: Initial creation
  - date: "2025-11-11"
    note: Accepted with implicit review scope
  - date: "2025-11-11"
    note: Marked as draft
  - date: "2025-11-11"
    note: Marked as proposed
lastEdited: "2025-11-11"
---

# DR-2025-11-11--meta--governance-review-lifecycle.md

_Integrate Decision Review Lifecycle and Implicit Review Metadata._

## 🧭 Context

As the Decision Record (DR) system matured, accepted decisions became static artefacts that lacked a clear mechanism for re-evaluation.  
While lifecycle transitions (`revise`, `retire`, `supersede`) allowed change, they did not explicitly capture the reasoning or governance event leading to that change.  
We needed a **lightweight review process** to ensure decisions remain valid and discoverable over time, without adding unnecessary ceremony.

## ⚖️ Options Considered

| Option | Description                                                                                  | Outcome      | Rationale                                                                     |
| ------ | -------------------------------------------------------------------------------------------- | ------------ | ----------------------------------------------------------------------------- |
| A      | Introduce formal review workflow as explicit lifecycle state (`review → approved → retired`) | Rejected     | Added complexity and friction; duplicated existing lifecycle logic            |
| B      | Make `review` a canonical precondition for any post-accept lifecycle change                  | Rejected     | Strong audit trail but too prescriptive; would slow normal decision evolution |
| C      | Implement implicit review metadata automatically recorded during lifecycle transitions       | **Accepted** | Maintains lean UX while ensuring transparent audit and learning trail         |

## 🧠 Decision

Adopt an **implicit review model** that keeps lifecycle verbs lean while guaranteeing every governance touch is recorded:

- **CLI behaviour**
  - Introduce `drctl decision review <id> [--type scheduled|adhoc|contextual] [--outcome keep|revise|retire|supersede] [--note "..."]`.
  - The command writes a `review_history` entry, updates `lastReviewedAt`, and (when `review_policy` permits) rolls `reviewDate` forward.
  - Lifecycle commands (`revise`, `retire`, `supersede`, and future transitions) implicitly invoke `drctl decision review … --type adhoc --outcome <transition>`, with console hints so contributors know an audit entry was recorded.
- **YAML schema**
  - Maintain `reviewDate: "YYYY-MM-DD"` as the planning anchor.
  - Add a structured `review_history` array:
    ```yaml
    review_history:
      - date: "YYYY-MM-DD"
        type: scheduled|adhoc|contextual
        outcome: keep|revise|retire|supersede
        reviewer: "<user>"
        reason: "<string or note>"
    ```
  - Persist `lastReviewedAt` (mirror of the most recent entry) for simplified filtering and reporting.
- **Configuration**
  - `.drctl.yaml` accepts
    ```yaml
    review_policy:
      default_type: scheduled
      interval_months: 12
      warn_before_days: 30
    ```
  - Policies define cadence, default review types, and warning windows consumed by the CLI and automation.
- **Governance & validation**
  - `drctl governance validate --check review_dates` warns when reviews are overdue, `reviewDate` is missing, or lifecycle transitions occur without matching `review_history`.
  - JSON output includes review diagnostics so CI pipelines or n8n flows can react programmatically.
- **Index & reporting**
  - `drctl index` adds “Next Review” and “Last Review Outcome” columns, honours `--upcoming <days>` (defaulting to the policy window), and exposes `--reviews` to render the full history per decision.
  - `drctl decision show` surfaces the latest review summary (e.g. `Last reviewed 2025-11-10 • outcome: revise • type: adhoc`).
- **Automation path**
  - Future schedulers can read policy metadata, auto-trigger `drctl decision review`, open PRs for human confirmation, or tag overdue DRs.

## 🪶 Principles

- **Honest, proactive collaboration** — Reviews should surface uncomfortable truths early, not hide drift.
- **Reasoning is code** — Review history, cadence, and outcomes live beside the decision record as auditable metadata.
- **Trust through transparency** — Every lifecycle change logs an explicit review event so observers can reconstruct reasoning.
- **DecisionOps mindset** — Review cadence, warnings, and automation hooks are treated as testable system flows.
- **Lean governance** — Default to implicit, metadata-rich reviews rather than heavyweight approval stages; automate reminders, not bureaucracy.

## 🔁 Lifecycle

This decision is **accepted** as of 2025-11-11.  
Its next review is scheduled for 2026-11-11 to evaluate adoption, usability, and governance clarity.  
Related CLI changes affect `review`, `revise`, `retire`, and `supersede` commands.

## 🧩 Reasoning

The implicit review approach (Perspective 3) offers the best trade-off between system learning and developer experience:

- Maintains a **canonical review event model**, but hides it from everyday use.
- Reduces ceremony for frequent changes, while still producing a complete governance trail.
- Encourages natural learning through visible metadata (e.g. `review_history`, `reviewDate`, and `drctl index` views).
- Aligns with continuous-learning, flow-based governance seen in modern DevOps and Agile organisations.

## 🔄 Next Actions

1. Extend `DecisionRecord` models, templates, validation, and example DRs with `review_history`, `lastReviewedAt`, and the `review_policy` config cascade.
2. Ship `drctl decision review` plus shared helpers so lifecycle commands can record implicit reviews without duplicating file writes or git commits; ensure console output highlights the implicit action and shows how to override defaults.
3. Update `drctl index`, `drctl decision show`, governance validators, and related tests to surface review warnings, upcoming reminders, and last-outcome metadata (including JSON diagnostics).
4. Document lifecycle ⇄ review equivalence (e.g. `retire` ≈ `review --type adhoc --outcome retire`) in CLI help, README, AGENTS, and docs/project.md.
5. Provide migration guidance/scripts: seed at least one `review_history` entry per accepted DR (deriving from `dateAccepted` if necessary) and relax validation for legacy records until backfill completes.

## ⚠️ Remaining Concerns

- **Legacy coverage** – Existing DRs lack `review_history`; we need tooling or transitional validation so adoption does not block repositories until they backfill data.
- **Validation noise** – Detecting transitions without reviews can false-positive on records created before this DR; scoping rules or suppressions are required.
- **Policy semantics** – Clarify whether every implicit review extends `reviewDate` by `interval_months` or only certain outcomes (`keep`, `revise`). Repo overrides must be honoured consistently across CLI, governance, and automation.
- **User feedback** – Implicit reviews triggered by lifecycle commands must log succinct notices; otherwise contributors may miss that metadata changed (including `reviewDate` bumps).
- **Multi-repo automation** – `warn_before_days` behaviour and exit codes need definition when `drctl governance validate` runs across multiple repos so CI signals remain actionable.

## 🧠 Confidence

High — aligns with lean governance principles, preserves audit integrity, and scales easily with future policy enhancements.

## 🧾 Changelog

See YAML front-matter for full changelog.
