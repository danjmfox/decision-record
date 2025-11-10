---
id: DR--20251110--meta--decision-index-ux
dateCreated: "2025-11-10"
version: 1.0.0
status: proposed
changeType: creation
domain: meta
slug: decision-index-ux
changelog:
  - date: "2025-11-10"
    note: Initial creation
  - date: "2025-11-10"
    note: Marked as draft
  - date: "2025-11-10"
    note: Marked as proposed
  - date: "2025-11-10"
    note: Marked as draft
  - date: "2025-11-10"
    note: Marked as proposed
lastEdited: "2025-11-10"
---

# DR--20251110--meta--decision-index-ux

## 🧭 Context

`DR--20251101--meta--repository-indexing` codified that `drctl index` should present a navigable catalogue so humans don’t have to trawl directories, yet the current generator still emits a plain ordered list of IDs grouped by domain (`src/core/indexer.ts`). That drift breaks the “reasoning is code” promise from the decision policy — we capture status, lifecycle, confidence, review cadence, and lineage in frontmatter, but the index hides all of it. Multiple docs keep calling for richer navigation (`README.md` command table, `docs/TODO.md` tasks for domain indexes + hierarchical views, `AGENTS.md` automation roadmap), so we need to close the gap before layering on dashboards or APIs.

## ⚖️ Options Considered

| Option                                 | Description                                                                                                | Outcome  | Rationale                                                                                                                                                    |
| -------------------------------------- | ---------------------------------------------------------------------------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Status-quo list                        | Keep the current numbered list grouped by domain.                                                          | Rejected | Hides lifecycle state, dates, confidence, and lineage; contradicts DR requirements.                                                                          |
| Minimal table                          | Replace bullets with a single flat table (ID, status, date).                                               | Rejected | Better than today but still ignores per-domain navigation, overdue reviews, and Kanban view requested in TODO.                                               |
| Progressive Markdown surfaces (chosen) | Generate a multi-section Markdown report: overview metrics, domain tables, review radar, and Kanban lists. | Accepted | Matches “progressive disclosure” principle, stays static-site friendly, and surfaces every critical metadata field without jumping straight to a bespoke UI. |

## 🧠 Decision

Revise `drctl index` to emit a richer Markdown dossier with four complementary sections:

1. **Summary dashboard** – status counts, domain counts, and “recently changed” rows (lastEdited desc) so readers see flow health instantly.
2. **Upcoming reviews** – table of decisions whose `reviewDate` is in the future (or overdue), showing confidence + owner domain for proactive follow-up.
3. **Domain catalogues** – per-domain tables sorted by `dateCreated` desc with columns for linked Title/ID, `status`, `version`, `changeType`, `dateAccepted` (or created), `lastEdited`, `reviewDate`, `confidence`, `tags`, and relationship badges (`supersedes`, `supersededBy`).
4. **Status Kanban** – grouped bullet lists (Draft, Proposed, Accepted, Deprecated, Superseded, Rejected, Retired/Archived) displaying `[Title – Domain] (vX.Y, last edited YYYY-MM-DD)` so teams can scan WIP without reading tables.

The generator keeps deterministic ordering (for diffability), falls back to slug-derived titles when the Markdown heading is missing, and remains pure-Markdown so docs portals or GitHub can render it without extra tooling.

## 🪶 Principles

- **Progressive disclosure** – quick-glance overview before deep tables.
- **Reasoning is code** – every captured metadata field becomes visible somewhere in the index.
- **Trust through transparency** – Kanban and review radar highlight stale or blocked decisions.
- **Future-proofing** – sections map 1:1 to potential JSON exports or UI widgets later.

## 🔁 Lifecycle

Status: `accepted`. We will revisit once real-world usage validates readability and performance.

## 🧩 Reasoning

The frontmatter schema (`DR--20251029--meta--decision-policy`, `src/core/models.ts`) already standardises lifecycle metadata, so the cost of surfacing it is limited to formatting work. Splitting the index into summary metrics, review radar, detailed domain tables, and Kanban balances varied audiences:

- Portfolio stakeholders want aggregate counts and change velocity.
- Maintainers need to see overdue reviews and confidence maybe dipping.
- Contributors need to find specific decisions quickly within a domain, with context about status, version, and lineage.

Markdown tables keep things printable and diffable. Kanban lists use ordinary headings + bullet lists, so they render anywhere while approximating a board. We explicitly defer interactive web UI or JSON-only outputs: those are separate deliverables captured in TODO and other DRs. This change answers the documentation drift today and sets up subsequent automation (e.g., `drctl index --json`, `drctl dashboard`) without schema churn.

## 🔄 Next Actions

1. Update `src/core/indexer.ts` (and tests) to compute derived metrics, parse first heading for titles (fallback to slug/title case), and render the four sections described above.
2. Add CLI flags for format toggles (`--no-kanban`, `--status <status>`, `--upcoming <days>` defaults) so small repos can trim output.
3. Refresh `README.md`, `docs/project.md`, and `docs/TODO.md` to describe the new index structure plus regeneration guidance.
4. Consider emitting a parallel JSON file (same data model) to unlock dashboards and automation in later DRs.
5. Evaluate auto-regeneration hooks after lifecycle commands or at least remind operators when the index is stale.

## 🧠 Confidence

0.7 – Approach is straightforward but needs user feedback on readability; we’ll reassess once dogfooded on the meta repo.

## 🧾 Changelog

- 2025-11-10 — Initial creation.
