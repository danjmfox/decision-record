# 🧭 Decision Record System - Overview & Plan

## 🎯 Purpose

A lightweight, human-readable system for recording, tracking, and evolving key decisions across projects - technical, organisational, or personal:

- Recall why you did something, not just what you did
- Every decision has a clear lifecycle and can be revisited or replaced intentionally
- Reasoning becomes a first-class citizen of your systems - versioned, reviewable, and automatable

In short:

> _“A living, durable, auditable, and low-friction log of reasoning”_

## 🪶 Principles

| Principle                         | Description                                                                                    |
| --------------------------------- | ---------------------------------------------------------------------------------------------- |
| **Lightweight over bureaucratic** | One Markdown file per decision, minimal ceremony.                                              |
| **Traceable change**              | Each decision evolves through explicit states (proposed → accepted → superseded…).             |
| **Atomic reasoning**              | Each file answers one question clearly — no sprawling documents.                               |
| **Chronological uniqueness**      | IDs encode date + domain + slug, e.g. DR--20251029--infra--secure-repo-split.                  |
| **Confidence over certainty**     | Record uncertainty levels and trigger reviews when confidence changes.                         |
| **Versioned truth**               | Minor updates (corrections/revisions) live in metadata; major ones (supersession) get new DRs. |
| **Composable system**             | CLI, API, and UI all share the same core logic; adapters handle interfaces.                    |
| **Future-friendly**               | Local Markdown today; API, n8n automation, or Vue dashboard tomorrow.                          |

## 🧩 Scope

This system covers any domain where reasoning matters, e.g.:

- **Infrastructure**: e.g., self-hosting n8n, backup architecture.
- **Automation**: e.g., modular Shortcuts design, logger schema.
- **Preparedness**: e.g., gear modularisation or policy frameworks.
- **Finance & Governance**: e.g., insurance reviews, tax logic.
- **Coaching & Business**: e.g., service design or pricing principles.
- **Knowledge Systems**: e.g., TheBrain import structure, ontology design.

Each domain can have its own folder under `~/decisions/`, or live in project-local `/docs/decisions/`.

## 🧠 Model & Lifecycle

### Decision Record (DR)

A Markdown file with YAML frontmatter holding:

- **identity** (id, domain, slug, version)
- **lifecycle state** (status, changeType)
- **reasoning** (context, decision, reasoning, confidence)
- **lineage** (supersedes, supersededBy)
- **revision log** (changelog — timestamped list of notable updates stored in YAML)

### Lifecycle States

`Proposed` → `Accepted` → (`Deprecated` | `Superseded`) → `Retired` → `Archived`

### Change Types

| Type             | When Used                     | Representation             |
| ---------------- | ----------------------------- | -------------------------- |
| **creation**     | First capture of decision     | new file                   |
| **correction**   | Fixing small errors           | same file, changelog entry |
| **revision**     | Updated confidence or context | same file, version bump    |
| **supersession** | Decision replaced             | new DR, linked both ways   |
| **retirement**   | Decision obsolete             | mark as retired            |

## ⚙️ Implementation Summary

| Layer               | Purpose                                           |
| ------------------- | ------------------------------------------------- |
| **CLI (Commander)** | Entry point for creating and managing DRs (drctl) |
| **Core Services**   | Business logic: create, revise, supersede, list   |
| **Repository**      | File persistence via YAML + Markdown              |
| **Versioning**      | Bumps versions, manages changelogs                |
| **Config**          | Defines root path, default behaviour              |

## Key CLI Commands

| Command                             | Purpose                                |
| ----------------------------------- | -------------------------------------- |
| `drctl new <domain> <slug>`         | Create new record                      |
| `drctl list`                        | List decisions (filterable)            |
| `drctl accept <id>`                 | Mark proposed decision accepted        |
| `drctl correct <id> --note`         | Record a small correction              |
| `drctl revise <id> --note`          | Increment version, update metadata     |
| `drctl supersede <old_id> <new_id>` | Replace old decision                   |
| `drctl retire <id>`                 | Retire obsolete decision               |
| `drctl index`                       | Rebuild master index                   |
| `drctl export`                      | Export metadata as JSON for dashboards |

## 🧮 File Structure Example

```bash
~/decisions/
├── DecisionIndex.md
├── infra/
│   ├── DR--20251029--infra--secure-docs-repo-split.md
│   └── DR--20251110--infra--merge-secure-and-backup-policies.md
├── automation/
│   └── DR--20251030--automation--shortcuts-logger.md
└── meta/
    └── DR--0000--decision-policy.md
```

Each DR looks like:

```yaml
id: DR--20251029--infra--secure-docs-repo-split
version: "1.2"
status: accepted
changeType: revision
confidence: 0.9
changelog:
  - date: 2025-11-05
    note: Increased confidence after successful backups
supersededBy: DR--20251110--infra--merge-secure-and-backup-policies
```

## 🔁 Workflow Summary

1. Capture: `drctl new infra "secure-docs-repo"`
2. Accept: `drctl accept <id>` when it’s adopted
3. Revise: `drctl revise <id> --note "Raised confidence" --confidence 0.9`
4. Supersede: `drctl supersede <old_id> <new_id>` when replaced
5. Review: periodically check reviewDate for updates.
6. Index: auto-generate `DecisionIndex.md` for browsing.

## 🌱 Plan for Evolution

| Phase             | Goal                        | Outcome                                      |
| ----------------- | --------------------------- | -------------------------------------------- |
| **Phase 1 (Now)** | CLI-only, file-based, no DB | Test friction and cognitive value            |
| **Phase 2**       | Add index and diff commands | Trace history and lineage easily             |
| **Phase 3**       | Add REST API adapter        | n8n, Express, or local service layer         |
| **Phase 4**       | Vue dashboard               | Search, filter, and view reasoning visually  |
| **Phase 5**       | Sync/export layer           | Integrate with Notion, Airtable, or TheBrain |

## 🧩 Design Philosophy

- **Decision hygiene** (Annie Duke): recording uncertainty, confidence, and review triggers
- **A knowledge graph** of reasoning, not just outcomes
- **A scientific mindset**: decisions are hypotheses, subject to revision
- **Systemic, complexity-aware**: lightweight, inspectable, evolvable

## 🧠 Steps

1. Implement `drctl index` and drctl diff` for complete lifecycle visibility.
2. Dogfood the workflow for 2–3 weeks (real decisions only).
3. Capture meta-observations in `DR--0001--meta--decision-policy--learnings.md`.
4. Decide whether to pursue API integration or local dashboard first.
