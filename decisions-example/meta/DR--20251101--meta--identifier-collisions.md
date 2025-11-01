---
id: DR--20251101--meta--identifier-collisions
dateCreated: "2025-11-01"
version: "1.0"
status: draft
changeType: creation
domain: meta
slug: identifier-collisions
changelog:
  - date: "2025-11-01"
    note: Initial creation
  - date: "2025-11-01"
    note: Marked as draft
lastEdited: "2025-11-01"
---

# DR--20251101--meta--identifier-collisions

## 🧭 Context

On 2025-11-01 we created seven meta DRs sharing the same date prefix (e.g., `DR--20251101--meta--…`). While the date conveys chronology, the filenames become visually similar, making it harder to browse or reference records. We need to explore naming schemes that stay unique when many decisions land on the same day, especially across multiple contributors.

## ⚖️ Options Considered

| Option                  | Description                                    | Notes                                                        |
| ----------------------- | ---------------------------------------------- | ------------------------------------------------------------ |
| Date-only IDs (current) | Keep `DR--YYYYMMDD--domain--slug`              | Simple but noisy if many DRs share the date                  |
| Date + sequence         | Append per-day counter (`DR--20251101--02--…`) | Familiar, requires allocating the next number safely         |
| Global counter          | Use `DR--0001--…` regardless of date           | Monotonic ordering, needs persistent counter + migration     |
| Date + time             | Include timestamp (`DR--20251101T1530--…`)     | Automatically unique, longer IDs and timezone considerations |
| Date + hash             | Append short hash from slug/date               | Collision-resistant, less human-friendly                     |

## 🧠 Decision

_To be decided._ This record logs the problem; we will evaluate options and choose an approach in a follow-up revision.

## 🪶 Principles

- Maintain human-readable, sortable IDs.
- Avoid heavy coordination in multi-user environments.
- Preserve traceability if we rename existing DRs (update frontmatter and git history).

## 🔁 Lifecycle

Status: `draft`. Update once an approach is selected.

## 🧩 Reasoning

Several same-day DRs highlighted that date-only prefixes lead to clutter. Sequenced IDs (per day or global) feel promising, but implementation details (collision avoidance, migration) need investigation. Capturing the issue ensures it stays visible.

## 🔄 Next Actions

- Evaluate per-day versus global sequencing feasibility.
- Prototype collision detection before generating IDs.
- Update this DR with the chosen strategy and migration plan.

## 🧠 Confidence

Medium – the problem is clear; solution requires further analysis.

## 🧾 Changelog

- 2025-11-01 — Initial capture of identifier concern.
