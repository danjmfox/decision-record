---
id: DR--20251111--meta--value-stream-links
dateCreated: "2025-11-11"
lastEdited: "2025-11-11"
version: 1.0.0
status: accepted
changeType: creation
domain: meta
slug: value-stream-links
changelog:
  - date: "2025-11-11"
    note: Initial creation
  - date: "2025-11-11"
    note: Marked as draft
  - date: "2025-11-11"
    note: Marked as proposed
  - date: "2025-11-11"
    note: Marked as accepted
confidence: 0.7
reviewDate: "2026-02-01"
tags:
  - metadata
  - governance
dateAccepted: "2025-11-11"
---

# DR--20251111--meta--value-stream-links

## 🧭 Context

`drctl` already captures lifecycle and lineage metadata, but we have no structured way to cite where ideas originated or where the resulting changes landed. Contributors currently paste links into Markdown prose, which breaks automation, makes governance validation blind to missing evidence, and prevents the index from showing whether an accepted decision actually shipped. We need a consistent schema and CLI workflow so sources, implementations, and contextual artifacts are first-class, audit-friendly data.

## ⚖️ Options Considered

| Option                                        | Description                                                                                    | Outcome  | Rationale                                                                                         |
| --------------------------------------------- | ---------------------------------------------------------------------------------------------- | -------- | ------------------------------------------------------------------------------------------------- |
| Keep metadata free-form                       | Leave sources/implementations buried in prose or ad-hoc checklists                             | Rejected | Impossible to lint or render; contradicts “reasoning is code” because data stays unstructured     |
| Overload existing fields (e.g. `tags`, body)  | Reuse `tags` or Markdown tables to embed URIs                                                  | Rejected | Collides with current semantics, forces brittle parsing, and blocks future API/graph integrations |
| Structured link arrays + CLI support (chosen) | Introduce explicit arrays in frontmatter plus a `drctl decision link` command and richer index | Accepted | Keeps schema explicit, easy to validate, works with git-disabled repos, and exposes data via CLI  |

## 🧠 Decision

Extend the Decision Record schema and tooling to capture the full value stream:

1. **Schema** — Add optional arrays `sources`, `implementedBy`, and `relatedArtifacts` to frontmatter. Each entry is a free-form string (URL, identifier, or note). The repository layer normalises empty strings away but otherwise preserves order for diffability.
2. **CLI workflow** — Introduce `drctl decision link <id>` subcommand that appends/removes entries via flags such as `--source`, `--impl`, `--related`, and `--remove`. Each invocation records a `revision` change type + patch version bump unless `--no-version` is explicitly requested for corrections.
3. **Display & reporting** — Update `drctl decision index` to show per-decision counts (e.g., `Inputs:3·Outputs:2·Context:5`) in the Kanban cards and optionally render tables listing the actual links when `--include-links` is set.
4. **Governance** — Extend `drctl governance validate` so repos can flag empty entries, duplicates, or missing categories (future config hook). Config diagnostics should mention the new fields when summarising sample records.
5. **Documentation/tests** — README + docs gain examples for linking commands; tests cover schema parsing, CLI flags, index rendering, and governance rules in both git-enabled and git-disabled scenarios.

## 🪶 Principles

- **Reasoning is code** — Sources and implementations must be as traceable as lifecycle metadata.
- **Progressive disclosure** — Show link counts by default, with opt-in detail tables to avoid overwhelming readers.
- **DecisionOps mindset** — Treat inputs/outputs as testable surfaces so governance can catch missing evidence before acceptance.
- **Git optionality** — Link editing must work even when git commits are disabled.

## 🔁 Lifecycle

Status: `draft`, changeType: `creation`. Promote to proposed/accepted after implementation and documentation updates land.

## 🧩 Reasoning

- Link arrays keep the schema lightweight while enabling structured validation, diffing, and future graph exports.
- Separate categories (sources vs. implementations vs. contextual artifacts) map directly to value-stream checkpoints, letting automated audits confirm that accepted decisions cite their inspirations and where they took effect.
- A dedicated subcommand avoids hand-editing YAML, keeps changelog history intact, and works for teams operating without git.
- Rendering link counts in the index provides quick health signals without forcing readers to scroll through full URLs unless they opt in.
- More expressive link objects (labels, types) can be layered later without breaking compatibility.

## 🔄 Next Actions

1. Extend `src/core/models.ts`, repository loaders, and serializers to read/write the new arrays (with tests).
2. Implement `drctl decision link` (parser, service hooks, versioning rules, CLI help) plus `unlink`/`--remove` ergonomics.
3. Update governance validation + config diagnostics to understand and lint the link fields.
4. Enhance `drctl decision index` (and tests) to display link counts and optional full listings.
5. Refresh README/docs (particularly CLI quickstart + CI guide) with linking examples, and capture usage guidance in `docs/project.md`.
6. Evaluate optional policy knobs (e.g., require at least one implementation before `accept`) for follow-up DRs.

## 🧠 Confidence

Medium-high (0.7). Schema changes are simple, but UX for additive/removal flows needs validation; review scheduled Feb 2026.

## 🧾 Changelog

See frontmatter for change log entries.
