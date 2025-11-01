---
id: DR--20251101--meta--inactive-states
dateCreated: "2025-11-01"
version: "1.0"
status: draft
changeType: creation
domain: meta
slug: inactive-states
changelog:
  - date: "2025-11-01"
    note: Initial creation
  - date: "2025-11-01"
    note: Marked as draft
lastEdited: "2025-11-01"
---

# DR--20251101--meta--inactive-states

## 🧭 Context

As we automate the lifecycle beyond `accept`, we must distinguish between decisions that are simply discouraged and those replaced by a newer DR. We also need a way to flag proposals that are explicitly declined. Without clear inactive states the catalogue becomes ambiguous and dashboards cannot show which items deserve follow-up.

## ⚖️ Options Considered

| Option                            | Description                                                       | Outcome  | Rationale                                                              |
| --------------------------------- | ----------------------------------------------------------------- | -------- | ---------------------------------------------------------------------- |
| Single inactive state             | Collapse everything into `deprecated`                             | Rejected | Loses the signal that a successor exists; makes reviews harder.        |
| Free-form annotations             | Keep status `accepted`, add notes manually                        | Rejected | Inconsistent, hard to query, relies on discipline rather than tooling. |
| Separate inactive states (chosen) | Keep `deprecated` and `superseded`, plus explicit `rejected` flow | Accepted | Balances expressiveness with automation; enables precise filters.      |

## 🧠 Decision

Introduce CLI support for:

- `drctl reject <id>` – set status `rejected`, log, and commit, signalling proposals that will not proceed.
- `drctl deprecate <id>` – set status `deprecated`, record `dateDeprecated`, append changelog, and commit.
- `drctl supersede <oldId> <newId>` – mark the old DR `superseded`, set `supersededBy`, update the new DR with `supersedes`, add reciprocal changelog entries, and commit both files atomically.

Status vocabulary therefore becomes `draft → proposed → accepted → (deprecated | superseded) → retired → archived`, with optional `rejected` for proposals.

## 🪶 Principles

- **Reasoning is code** – lifecycle signals live in structured frontmatter, not ad-hoc prose.
- **Future-proofing** – keeping both `deprecated` and `superseded` ensures future reporting can distinguish “no replacement” vs “replaced”.
- **Trust through transparency** – the CLI prints both file paths when superseding so reviewers can inspect changes immediately.

## 🔁 Lifecycle

Status: `draft`. We’ll move to `proposed` once the documentation is updated to describe the new commands.

## 🧩 Reasoning

The service layer preserves Markdown content and updates both records in one operation during supersede, preventing mismatched links. Consistent changelog notes (`Supersedes …`, `Superseded by …`) make history scannable. Returning both file paths allows downstream automation (e.g., re-indexing) to react. We rejected the single-state approach after observing that product and platform decisions often overlap; being able to filter “has successor” decisions improves reviews. Keeping `reject` separate avoids polluting `draft` lists with proposals that will never ship.

## 🔄 Next Actions

- Implement `drctl retire` to close out inactive decisions after cleanup.
- Update dashboards/reporting to interpret `supersededBy` links.

## 🧠 Confidence

Medium – behaviour is tested, but we expect to revisit when `retire`/`archive` automation arrives.

## 🧾 Changelog

- 2025-11-01 — Initial creation.
