---
id: DR--20251029--meta--decision-policy
dateCreated: 2025-10-29
lastEdited: 2025-10-29
version: "1.0"
status: accepted
changeType: creation
changelog: []
confidence: 0.9
reviewDate: 2026-04-29
domain: meta
slug: decision-policy
supersedes: null
supersededBy: null
tags: 
  - governance
  - meta
---

# # Decision Policy (DR--20251029--meta--decision-policy)

## 🧭 Context

Across many projects and domains (technical, organisational, personal), decisions are made that shape architecture, workflows, and behaviour.  
These choices are often implicit, scattered, or forgotten — creating rework, uncertainty, and loss of institutional memory.

A simple, consistent mechanism is needed to:

- capture reasoning at the time of decision
- preserve lineage and confidence
- evolve thinking without losing history, and
- make decisions discoverable across systems and tools

## ⚖️ Options Considered

*List the main options or alternatives that were evaluated before making the decision, including why each was accepted or rejected.*

| Option | Description | Outcome | Rationale |
|---------|--------------|----------|------------|
| **A. Do nothing** | Continue with implicit decisions and ad-hoc reasoning. | Rejected | Lacks traceability and continuity across domains. |
| **B. Use a standard ADR framework (e.g. MADR, Nygard)** | Adopt formal software-style ADR format across all domains. | Rejected | Too rigid for cross-domain use; heavy for personal workflow. |
| **C. Create lightweight cross-domain Decision Record system (this)** | Design minimal YAML + Markdown format with CLI support. | **Accepted** | Matches personal systems philosophy; composable and automatable. |

## 🧠 Decision

Establish a **Lightweight Decision Record Policy** governing how decisions are captured, updated, and retired.

Each decision is stored as a Markdown file with YAML frontmatter describing:

- **Identity** – `id`, `domain`, `slug`, and `version`
- **Lifecycle** – `status`, `changeType`, `confidence`, `reviewDate`
- **Reasoning** – `context`, `decision`, `reasoning`
- **Lineage** – `supersedes`, `supersededBy`
- **Revision Log** – `changelog`

The canonical CLI for managing these files is **`drctl`**, built with modular logic that can later support REST APIs, automations, or UI layers.

## 🪶 Principles

1. **Lightweight over bureaucratic** – One Markdown file per decision, minimal ceremony
2. **Traceable change** – Each decision evolves through explicit states (`Proposed → Accepted → Superseded → Retired`)
3. **Atomic reasoning** – One question answered per record
4. **Chronological uniqueness** – ID pattern: `DR--YYYYMMDD--domain--slug`
5. **Confidence over certainty** – Capture uncertainty; schedule reviews
6. **Versioned truth** – Small corrections = metadata edits; major changes = supersession
7. **Composable system** – CLI, API, and UI share a single core logic
8. **Future-friendly** – Local Markdown first; networked integrations later

## 🔁 Lifecycle Model

### States

`Proposed → Accepted → (Deprecated | Superseded) → Retired → Archived`

### Change Types

| Type | Meaning | Representation |
|------|----------|----------------|
| **creation** | Initial capture | new file |
| **correction** | Minor factual or formatting fix | same file, changelog note |
| **revision** | Confidence or context update | version bump (`1.0 → 1.1`) |
| **supersession** | Decision replaced | new DR linked both ways |
| **retirement** | Decision obsolete | marked `retired` |

## ⚙️ Implementation Guidelines

| Layer | Role |
|-------|------|
| **CLI (`drctl`)** | Create, list, accept, revise, supersede, retire decisions. |
| **Core Services** | Contain reusable business logic. |
| **Repository** | File persistence with YAML + Markdown via `gray-matter`. |
| **Versioning** | Manages version bumps and changelogs. |
| **Config** | Defines root path and defaults. |

Example root layout:

```bash
~/decisions/
├── DecisionIndex.md
├── infra/
│   ├── DR--20251029--infra--secure-docs-repo.md
│   └── DR--20251110--infra--merge-secure-and-backup-policies.md
└── meta/
    └── DR--20251029--meta--decision-policy.md
```

## 🌱 Plan

| Phase | Goal | Outcome |
|-------|------|----------|
| **Phase 1** | CLI-only, file-based | Validate friction and value |
| **Phase 2** | Add index & diff | Trace history and lineage |
| **Phase 3** | REST API adapter | Allow n8n / Express integrations |
| **Phase 4** | Vue dashboard | Visualise and search reasoning |
| **Phase 5** | Sync/export layer | Integrate with Notion, Airtable, TheBrain |

## 🧩 Reasoning

This approach balances rigour with simplicity:

- Treats decisions as *living hypotheses* rather than final truths
- Encourages healthy revision without bureaucratic overhead
- Keeps reasoning portable — usable via text, API, or automation
- Fits your broader systems mindset of modular, observable design

## 🔄 Next Actions

1. Implement `drctl index` and `drctl diff` for lifecycle visibility
2. Dogfood for 2–3 weeks using real decisions
3. Capture learnings in `DR--20251029--meta--decision-policy--learnings`
4. Re-evaluate policy after initial adoption period

## 🧠 Confidence

0.9: High confidence in design intent and architecture; low operational data so far.  
Review scheduled after the initial dogfooding period (April 2026).

## 🧾 Changelog

- 2025-10-29: Initial creation

*End of record.*
