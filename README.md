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

`Draft` → `Proposed` → `Accepted` → (`Deprecated` | `Superseded` | `Rejected`) → `Retired` → `Archived`

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
| **Config**          | Defines root path, default behaviour              |
| **Tests (Vitest)**  | Colocated unit tests ensuring config & CLI logic  |

### Running the Suite

```bash
npm test             # run vitest
npm run test:watch   # watch mode
npm run test:coverage # coverage report
```

Vitest is configured to pick up `*.test.ts` files inside `src/`, keeping tests close to the code they exercise.

### CLI Usage

During development you can invoke the CLI via tsx without building:

```bash
npx tsx src/cli/index.ts new personal hydrate-every-hour --repo home
```

To install `drctl` on your PATH:

```bash
npm run build   # produce dist/cli/index.js
npm link        # exposes the drctl bin globally

drctl list --repo home
drctl new personal hydrate-every-hour --repo home
```

Every command resolves repository context through a shared middleware, so `--repo`/`DRCTL_REPO` overrides are honoured consistently and the resolved workspace is logged automatically.

Every command echoes the resolved repo and any file it touches. Example output:

```bash
📁 Repo: home (/Users/me/Documents/home-decisions)
   Source: local-config
   Definition: local
   Config: /Users/me/.drctl.yaml
   Default domain dir: domains
   Domain overrides: none
✅ Created DR--20251030--personal--hydrate (draft)
📄 File: /Users/me/Documents/home-decisions/domains/personal/DR--20251030--personal--hydrate.md
```

Remove the link later with `npm unlink -g decision-record` (or run `npm unlink` inside the repo).

## 🧱 Code Structure

For a deeper architectural overview (layers, lifecycle automation, comparisons with adr-tools), see [ARCHITECTURE.md](./ARCHITECTURE.md).

| Path                     | Purpose                                                                   |
| ------------------------ | ------------------------------------------------------------------------- |
| `src/cli/index.ts`       | Commander-based CLI entry point; shared repo middleware + service wiring. |
| `src/cli/repo-format.ts` | Formats repo context information for CLI output.                          |
| `src/cli/repo-manage.ts` | Utilities for mutating `.drctl.yaml` repo definitions.                    |
| `src/config.ts`          | Loads `.drctl.yaml` configs (CLI/env/local/global), resolves repo roots.  |
| `src/config.test.ts`     | Vitest coverage of configuration resolution scenarios.                    |
| `src/core/models.ts`     | Type definitions shared across the domain.                                |
| `src/core/utils.ts`      | Helpers (`generateId`, `extractDomainFromId`).                            |
| `src/core/repository.ts` | File-system access; saves, loads, lists Markdown decisions.               |
| `src/core/service.ts`    | Business logic wrapping repository operations with repo context.          |
| `src/core/versioning.ts` | Version bump helper for decision records.                                 |
| `src/types/js-yaml.d.ts` | Minimal types so `js-yaml` can be imported without errors.                |
| `decisions-example/`     | Public sample decision records for demonstrations/tests.                  |

## Key CLI Commands

| Command                             | Purpose                                 |
| ----------------------------------- | --------------------------------------- |
| `drctl new <domain> <slug>`         | Scaffold a new draft (no git yet)       |
| `drctl draft <id>`                  | Commit the current draft state          |
| `drctl propose <id>`                | Move draft to proposed + commit         |
| `drctl list`                        | List decisions (filterable)             |
| `drctl accept <id>`                 | Mark proposed decision accepted         |
| `drctl reject <id>`                 | Mark proposed decision rejected         |
| `drctl deprecate <id>`              | Mark decision deprecated (no successor) |
| `drctl repo`                        | Display the currently resolved repo     |
| `drctl repo new <name> <path>`      | Add a repo entry to the nearest config  |
| `drctl repo bootstrap <name>`       | Initialise git for a configured repo    |
| `drctl repo switch <name>`          | Make an existing repo the default       |
| `drctl correct <id> --note`         | Record a small correction               |
| `drctl revise <id> --note`          | Increment version, update metadata      |
| `drctl supersede <old_id> <new_id>` | Replace old decision                    |
| `drctl retire <id>`                 | Retire obsolete decision                |
| `drctl config check`                | Validate configuration files and repos  |
| `drctl index`                       | Rebuild master index                    |
| `drctl export`                      | Export metadata as JSON for dashboards  |

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

Each DR comprises YAML frontmatter, and a series of headings:

```markdown
---
id: DR--20251029--infra--secure-docs-repo-split
version: "1.2"
status: accepted
changeType: revision
confidence: 0.9
changelog:
  - date: 2025-11-05
    note: Increased confidence after successful backups
supersededBy: DR--20251110--infra--merge-secure-and-backup-policies
---

# {{name}} {{id}}

## 🧭 Context

_Describe the background and circumstances leading to this decision._

## ⚖️ Options Considered

_List the main options or alternatives that were evaluated before making the decision, including why each was accepted or rejected._

| Option | Description | Outcome  | Rationale                      |
| ------ | ----------- | -------- | ------------------------------ |
| A      | Do nothing  | Rejected | Insufficient long-term clarity |
| B      |             |          |                                |

## 🧠 Decision

## 🪶 Principles

## 🔁 Lifecycle

## 🧩 Reasoning

## 🔄 Next Actions

## 🧠 Confidence

## 🧾 Changelog
```

See [decision-record-template.md](./decisions-example/decision-record-template.md)

## 🔁 Workflow Summary

1. **Capture**: `drctl new infra "secure-docs-repo"`
2. **Draft**: `drctl draft <id>` once the starter content is ready to track
3. **Propose**: `drctl propose <id>` to circulate for review
4. **Accept**: `drctl accept <id>` when it’s adopted
5. **Revise**: `drctl revise <id> --note "Raised confidence" --confidence 0.9`
6. **Supersede**: `drctl supersede <old_id> <new_id>` when replaced
7. **Review**: periodically check reviewDate for updates.

8. **Index**: auto-generate `DecisionIndex.md` for browsing.

### ⚙️ Configuration Overrides

`drctl` looks for configuration in this order:

1. CLI flag `--config <path>`
2. Environment variable `DRCTL_CONFIG`
3. Nearest `.drctl.yaml` walking up from the current working directory
4. Global defaults (`~/.drctl.yaml`, `~/.config/drctl/drconfig.yaml`, etc.)

The selected config then determines repo aliases, domain folders, and the default repo for commands that interact with decisions. Use the flag or env var when you want to target a shared/global config from another workspace:

```bash
# Write to a shared config kept under ~/decisions/.drctl.yaml
npm run dev -- --config ~/decisions/.drctl.yaml repo new research ~/research-decisions --default

# Equivalent using the environment variable
DRCTL_CONFIG=~/decisions/.drctl.yaml npm run dev -- repo switch research
```

#### Embedded Decisions inside an Existing Project

To keep decision records within an application repository, define a repo alias pointing to a subdirectory:

```yaml
repos:
  app-decisions:
    path: ./decisions
    defaultDomainDir: domains
defaultRepo: app-decisions
```

Place this `.drctl.yaml` in the project root (or reference it via `--config`). Best practices:

- Run lifecycle commands on a clean staging area; `drctl` stages and commits the decision files it edits.
- Store decision records under a dedicated folder (e.g., `decisions/`) to keep histories tidy.
- Use descriptive commit messages (the CLI defaults to `drctl: <action> <id>`).
- If your CI pipeline runs on every commit, consider configuring a skip rule for messages that start with `drctl:` (e.g., `[skip ci]` or equivalent) or run lifecycle commands in a separate branch that you squash on merge.
- `drctl` aborts if other files are staged; run `git status` first if you expect to batch changes.

### 🔄 Quickstart Commands

Run through the full lifecycle from a blank slate:

```bash
# Create a new repo entry and set it as default
npm run dev -- repo new demo ./decisions-demo --default

# Initialise git inside the repo (required for draft/propose/accept)
npm run dev -- repo bootstrap demo

# Double-check configuration
npm run dev -- config check

# Create a decision (status: draft)
npm run dev -- new meta initial-guardrails

# Grab the generated ID from this listing
npm run dev -- list

# Commit the draft to git, record changelog entry
npm run dev -- draft <id>

# Advance to proposed
npm run dev -- propose <id>

# Mark as accepted
npm run dev -- accept <id>

# Rebuild the repo index so the DR is linked under its domain
npm run dev -- index
```

## 🌱 Plan for Evolution

| Phase             | Goal                        | Outcome                                             |
| ----------------- | --------------------------- | --------------------------------------------------- |
| **Phase 1 (Now)** | CLI-only, file-based, no DB | Test friction and cognitive value                   |
| **Phase 1 (Now)** | Harden repo management      | ✅ Prevent duplicate aliases targeting same path    |
| **Phase 1 (Now)** | Add index generator         | Emit repo/domain `index.md` with linked decisions   |
| **Phase 2**       | Hierarchical navigation     | Navigate repo ⇄ domain ⇄ decisions seamlessly       |
| **Phase 2**       | Index enhancements          | Sorting, status roll-ups, review reminders, filters |
| **Phase 3**       | Add REST API adapter        | n8n, Express, or local service layer                |
| **Phase 4**       | Vue dashboard               | Search, filter, and view reasoning visually         |
| **Phase 5**       | Sync/export layer           | Integrate with Notion, Airtable, or TheBrain        |

### 🔜 Lifecycle Automation Priorities

1. Extend `drctl accept` so the git-backed flow mirrors `draft`/`propose` (status update, changelog entry, commit).
2. Introduce `drctl reject` / `drctl deprecate` with the same frontmatter-only updates. ✅
3. Implement `drctl supersede` / `drctl retire`, preserving markdown bodies while adjusting metadata.
4. Add regression tests that verify changelog consistency and body preservation across every transition.
5. Decide whether lifecycle commands should trigger `drctl index` (or emit a reminder) after updates.

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
