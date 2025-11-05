---
id: DR--20251103--meta--branch-protection-workflow
dateCreated: "2025-11-03"
version: 1.0.0
status: accepted
changeType: creation
domain: meta
slug: branch-protection-workflow
changelog:
  - date: "2025-11-03"
    note: Initial creation
  - date: "2025-11-05"
    note: Marked as draft
  - date: "2025-11-05"
    note: Marked as proposed
  - date: "2025-11-05"
    note: Marked as proposed
  - date: "2025-11-05"
    note: Marked as accepted
lastEdited: "2025-11-05"
dateAccepted: "2025-11-05"
---

# DR--20251103--meta--branch-protection-workflow

## 🧭 Context

Branch protection is now required for `decision-record`: we rely on GitHub Actions (CI, CodeQL, Scorecard, dependency-review) and human approvals to keep `main` trustworthy. Without an explicit DR, contributors (human + AI) would forget to branch, push PRs, and wait for checks, especially now that direct pushes are blocked. We need a durable record explaining why the branch/PR workflow is mandatory and how it integrates with DecisionOps practices.

## ⚖️ Options Considered

| Option | Description                                                   | Outcome  | Rationale                                                      |
| ------ | ------------------------------------------------------------- | -------- | -------------------------------------------------------------- |
| A      | Keep pushing directly to `main`                               | Rejected | Fails Scorecard, no approvals, high risk of regressions        |
| B      | Rely on “remember to branch” discipline only                  | Rejected | Easy to slip, no automated enforcement for AI agent            |
| C      | Enforce GitHub branch protection + document workflow (chosen) | Accepted | Automates reviews + status checks; aligns with governance + CI |

## 🧠 Decision

Institutionalise a branch-protection workflow:

- Protect `main` with GitHub rulesets: require PRs, ≥1 approval, status checks (`CI build-and-test`, `CLI integration`, `CodeQL`, `Scorecard`, `Dependency Review`), block force-push/deletes.
- Contributors (human + AI) work only on feature branches; every change (including DRs) follows the loop: branch → DR if needed → TDD → docs → conventional commits → PR → merge.
- Document this flow in README/AGENTS/CONTRIBUTING so new collaborators follow it by default.

## 🪶 Principles

1. **Reasoning is code** – workflow policy belongs in a DR so it’s auditable.
2. **Trust through transparency** – PRs + checks make the decision lifecycle inspectable.
3. **DecisionOps discipline** – branch/PR loop mirrors the DR lifecycle (draft → propose → accept).

## 🔁 Lifecycle

Status: `draft` (lifecycle commands pending in this environment). Change type: `creation`.

## 🧩 Reasoning

- Scorecard, CodeQL, and dependency-review are only useful if PRs trigger them; branch protection makes that non-optional.
- Feature-branch flow keeps `main` deployable, aligning with trunk-based development and AI collaboration guardrails.
- Documenting the workflow prevents future drift, especially when automation or new contributors join.

## 🔄 Next Actions

1. Keep documentation (README/AGENTS/CONTRIBUTING) aligned with the branch workflow.
2. Review branch rules quarterly; add/remove required checks as pipelines evolve.

## 🧠 Confidence

High – branch protection is widely adopted and already enforced by GitHub; enforcement + docs cover both humans and AI agents. Review annually or when workflow automation changes.

## 🧾 Changelog

See YAML frontmatter for dated entries.
