---
id: DR--20251101--meta--repository-indexing
dateCreated: "2025-11-01"
version: "1.0"
status: accepted
changeType: creation
domain: meta
slug: repository-indexing
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

# DR--20251101--meta--repository-indexing

## 🧭 Context

Stakeholders need a quick way to browse the catalogue of decisions without dropping to the terminal or scanning directories manually. Earlier, contributors kept ad-hoc README tables that easily drifted from the actual records. We wanted an automated, repeatable command that produces a canonical Markdown index for any configured repository.

## ⚖️ Options Considered

| Option                            | Description                                    | Outcome  | Rationale                                                              |
| --------------------------------- | ---------------------------------------------- | -------- | ---------------------------------------------------------------------- |
| Manual README                     | Let maintainers curate tables by hand          | Rejected | Too easy to forget updates; duplicates metadata already stored in DRs. |
| Dynamic UI                        | Build a web/dashboard layer first              | Rejected | Overkill for CLI-first workflow; requires hosting and sync complexity. |
| Static generator command (chosen) | Provide `drctl index` to emit Markdown in-repo | Accepted | Simple, testable, aligns with docs-as-code practices and git reviews.  |

## 🧠 Decision

Add `drctl index` which resolves the current repo, enumerates all decision records, ignores non-DR Markdown, and writes an `index.md` that:

- groups entries by domain (alphabetically),
- lists each decision with its ID and title linked to the file path, and
- overwrites the file deterministically so diffs are easy to review.

The command reports the generated path so scripts or humans can chain further actions.

## 🪶 Principles

- **Reasoning is code** – the index is version-controlled alongside DRs, keeping context in sync.
- **Progressive disclosure** – basic Markdown now; richer filters/navigation can iterate later.
- **Future-proofing** – generator relies on structured frontmatter, enabling dashboards to reuse the same data.

## 🔁 Lifecycle

Status: `draft`. We’ll move to `proposed` once domain-level indices and status filters are scoped.

## 🧩 Reasoning

The generator reuses repository services so it honours domain overrides and default domain directories. Tests assert that unrelated Markdown (docs, templates) is ignored, reducing noise. We intentionally decoupled indexing from lifecycle commands to avoid surprise commits and give teams control over when indices regenerate. Markdown keeps the barrier low while supporting publication to wikis or static sites.

## 🔄 Next Actions

- Add `drctl index --domain <name>` support to produce domain-specific navigation.
- Explore optional status filters (hide superseded/retired by default).

## 🧠 Confidence

Medium – behaviour is unit-tested; adoption feedback will guide enhancements.

## 🧾 Changelog

- 2025-11-01 — Initial creation.
