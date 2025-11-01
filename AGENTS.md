# 🤝 AGENTS.md

A living agreement between the app developer (human agent) and **ChatGPT (GPT-5)** (AI agent), co-developing and reasoning about the **Decision Record CLI system**.

This document defines shared purpose, design approach, principles, and working agreements  
for building and evolving this project — combining human judgment and AI assistance.

---

## 🎯 Purpose

To co-create a **lightweight, open, auditable system** for recording, tracking, and evolving key decisions —  
integrating principles from agile delivery, knowledge management, and reasoning hygiene (Annie Duke).

This system (codename: `drctl`) should:

- Make reasoning and context _visible and versioned_
- Be _useful both personally and organisationally_
- Enable _multi-repo configuration_ (e.g., work, home)
- Balance _openness_ (public CLI) with _privacy_ (personal data separation)
- Embody _clarity, calm, and systemic thinking_

For more information, refer to [meta/DR--20251029--meta--decision-policy.md](decisions-example/meta/DR--20251029--meta--decision-policy.md) which, as well as acting as an example, is also the core reasoning behind this project.

---

## 🧩 Current Goals

| Area               | Objective                                                                            | Status         |
| ------------------ | ------------------------------------------------------------------------------------ | -------------- |
| **CLI Core**       | Support full DR lifecycle (new → draft → propose → accept → revise → retire)         | ✅ Implemented |
| **Config System**  | Support `.drctl.yaml` with named repositories (`work`, `home`) and domain subfolders | 🔄 In progress |
| **Repo Structure** | Separate app (`decision-record`) and data repos (`work-decisions`, `home-decisions`) | ✅ Agreed      |
| **Examples**       | Include `decisions-example/` folder for demos and tests                              | ✅ Done        |
| **Documentation**  | Maintain `README.md` (user guide) and `AGENTS.md` (process guide)                    | 🧭 Ongoing     |
| **Automation**     | Future: `drctl index`, `drctl diff`, `drctl sync`                                    | 🧠 Planned     |

---

## 🧠 Design Principles

| Principle                      | Description                                                                     |
| ------------------------------ | ------------------------------------------------------------------------------- |
| **Reasoning is code**          | Decisions are first-class, version-controlled artefacts.                        |
| **Separation of concerns**     | App logic, configuration, and decision data live in distinct repos.             |
| **Progressive disclosure**     | Defaults work out of the box; advanced config scales with need.                 |
| **Trust through transparency** | Every design choice has a Decision Record (meta-governance).                    |
| **Human-AI collaboration**     | Maintain calm, reflective, evidence-based dialogue — no performative authority. |
| **Future-proofing**            | File-based today; API, n8n, and UI integrations tomorrow.                       |

---

## ⚙️ Working Agreements

| Topic                | Agreement                                                                                                                            |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| **Source control**   | `decision-record` (public GitHub) contains code and examples; actual DRs live in private repos (`work-decisions`, `home-decisions`). |
| **Configuration**    | `.drctl.yaml` supports multiple named repos and optional domain mappings.                                                            |
| **Development**      | Use `tsx` + `Commander.js` for CLI; logic separated from CLI interface for future API/UI reuse.                                      |
| **Decision records** | Each architectural choice (for this app) is captured in a `DR--YYYYMMDD--meta--*.md`.                                                |
| **File conventions** | Use `DR--YYYYMMDD--domain--slug.md` IDs; domain as folder; markdown + YAML frontmatter.                                              |
| **Private data**     | `.drctl.yaml` and `decisions/` folders are `.gitignore`d; only `decisions-example/` is public.                                       |
| **AI collaboration** | All reasoning steps remain inspectable; outputs versioned in code, not ephemeral.                                                    |
| **CLI feedback**     | Commands echo repo context and file paths; `drctl repo` surfaces the resolved workspace on demand.                                   |
| **Lifecycle flow**   | `drctl new` scaffolds a draft; `drctl draft`/`drctl propose` manage status updates and git commits.                                  |

---

### 🧪 Testing Strategy

- Prefer colocated test files (`*.test.ts`) alongside the modules they cover.
- Use Vitest for fast, ESM-friendly unit and integration tests.
- Write tests first (TDD-style) whenever practical; code changes should land with corresponding coverage.
- Coverage runs via Vitest's V8 provider (`npm run test:coverage`).

---

### 📓 Documentation Rhythm

- When README.md is updated, mirror relevant context in AGENTS.md so both guides stay in sync.

---

### 🧱 Code Structure (Current)

| Path                     | Purpose                                                             |
| ------------------------ | ------------------------------------------------------------------- |
| `src/cli/index.ts`       | CLI entry point with shared repo middleware delegating to services. |
| `src/cli/repo-format.ts` | Formats repo context information for display/logging.               |
| `src/cli/repo-manage.ts` | Helpers for updating `.drctl.yaml` repo entries.                    |
| `src/config.ts`          | Multi-layer config loader resolving repo and domain directories.    |
| `src/config.test.ts`     | Vitest checks ensuring config resolution behaves as designed.       |
| `src/core/models.ts`     | Shared decision record types and enums.                             |
| `src/core/utils.ts`      | ID helpers and domain extraction utilities.                         |
| `src/core/repository.ts` | Persistence layer writing/reading Markdown frontmatter files.       |
| `src/core/service.ts`    | High-level actions (create/list/accept) that thread repo context.   |
| `src/core/versioning.ts` | Semantic version bump helper.                                       |
| `src/types/js-yaml.d.ts` | Minimal type declaration for js-yaml loader.                        |
| `decisions-example/`     | Example decision records used for demos and tests.                  |

Refer to [ARCHITECTURE.md](./ARCHITECTURE.md) for the layered overview and reasoning captured in [DR--20251101--meta--architecture-overview](decisions-example/meta/DR--20251101--meta--architecture-overview.md).

#### Embedded Decision Workflows

- Teams may embed decision records inside existing repositories (e.g., `./decisions/`). Configure `.drctl.yaml` with an alias such as:

  ```yaml
  repos:
    project-decisions:
      path: ./decisions
      defaultDomainDir: domains
  defaultRepo: project-decisions
  ```

- Run lifecycle commands with a clean staging area; drctl commits the files it changes.
- drctl aborts when other files are staged, so contributors should check `git status` before running commands if they expect to batch changes.
- Communicate with delivery teams about CI behaviour—pipelines can ignore commits whose messages start with `drctl:` if desired.

---

### 🔐 Gitignore Baseline

Add these entries to keep personal workspaces private while collaborating publicly:

```
# drctl workspaces
.drctl.yaml
.drctl.yml
decisions/
work-decisions/
home-decisions/
```

---

## 🧱 Implementation Steps

1. **Repository Logic (Next Up)**
   - [x] Update `repository.ts` to honour per-repo domain folders from config.
   - [ ] Auto-create domain subfolders when writing records.
   - [ ] Add an `index` generator that aggregates across configured repos.
   - [x] Prevent duplicate repo aliases pointing at the same filesystem path.
   - [ ] Generate repo/domain `index.md` files with linked decision records.
   - [ ] Enable hierarchical navigation between config → repo → domain → DR.

2. **Examples & Documentation**
   - [ ] Add a README note clarifying `decisions-example/` as the default demo workspace.
   - [ ] Capture the multi-repo config design in `DR--20251030--meta--multi-repo-config.md`.
   - [ ] Continue treating `AGENTS.md` as the canonical collaboration record (update as decisions land).

3. **Automation & Integrations (Future)**
   - [ ] Add REST API and dashboard layer.
   - [ ] Support remote DR syncing via `git` or API calls.
   - [ ] Explore n8n automation for scheduled reviews.

4. **Completed**
   - [x] Multi-repo config resolution + `--repo` flag support.
   - [x] `drctl config check` diagnostics.
   - [x] Example decision records relocated to `decisions-example/meta/...`.
   - [x] Community-first docs (`CODE_OF_CONDUCT.md`, `CONTRIBUTING.md`, `SECURITY.md`, `SUPPORT.md`).

5. **Lifecycle Automation (Current Focus)**
   - [x] Harden `drctl accept` so the git-backed status flow mirrors `draft`/`propose`.
   - [x] Add `drctl reject` and `drctl deprecate` with consistent changelog handling.
   - [ ] Implement `drctl supersede`/`drctl retire`, ensuring markdown bodies persist.
   - [ ] Add regression tests covering body preservation and changelog entries for every transition.
   - [ ] Decide whether lifecycle commands should regenerate or remind about repository indexes.

---

### 🔄 Working Rhythm

- Default to **test-first TDD**: add or update a failing test before implementing behaviour, then make the smallest change to go green, refactor, and commit.
- Keep the tree green: run the relevant `npm test` scope before every commit.
- Follow **trunk-based development**: ship incremental, focused changes; avoid long-lived branches.
- Use **conventional commits** for each logical change (e.g. `feat:`, `fix:`, `test:`).
- If a change spans multiple concerns, split into multiple TDD cycles and commits.

### 🔄 Quickstart (from a new repo)

```bash
# Add a repo entry and make it default
npm run dev -- repo new demo ./decisions-demo --default

# Initialise git in the repo
npm run dev -- repo bootstrap demo

# Sanity check config
npm run dev -- config check

# Create, propose, and accept a decision (replace <id> with the generated ID)
npm run dev -- new meta initial-guardrails
npm run dev -- list
npm run dev -- draft <id>
npm run dev -- propose <id>
npm run dev -- accept <id>

# Regenerate the index
npm run dev -- index
```

---

### 🗂️ Sample `.drctl.yaml` Locations

- **Local project override**: place a `.drctl.yaml` at the repo root (`./.drctl.yaml`) to define project-specific repo aliases.
- **Global defaults**: use `~/.drctl.yaml` or `~/.config/drctl/drconfig.yaml` for personal fallbacks shared across projects.

Each config should define named repos and optional domain folders, for example:

```yaml
defaultRepo: work
repos:
  work:
    path: ~/Documents/work-decisions
    defaultDomainDir: domains
  home:
    path: ~/Documents/home-decisions
    domains:
      investing: money/investing
      family: family
```

- **Override order**: an explicit `--config <path>` flag wins, then `DRCTL_CONFIG`, then the nearest `.drctl.yaml`, then global fallbacks. Use `--config`/`DRCTL_CONFIG` when writing to shared configs from another workspace.

---

## 🧭 Communication Style

- Calm, concise, reflective reasoning.
- Use STARL or system-thinking narratives for context-heavy examples.
- Encourage iteration and exploration — **no premature convergence**.
- Maintain a “decision hygiene” mindset — capture uncertainty explicitly.

---

## 📘 References & Inspirations

- Annie Duke — _How to Decide_ (decision hygiene & calibration)
- Cynefin Framework — complexity-aware sense-making
- ADR pattern — software architecture decision records
- Modern knowledge tools: Obsidian, TheBrain, n8n, Notion
- Open-source ethics and inner development goals

---

## 📅 Meta-History

Please maintain this to ensure we have a good record of major changes:

| Date           | Event                                                                           |
| -------------- | ------------------------------------------------------------------------------- |
| **2025-10-29** | Initial Decision Record Policy (`DR--20251029--meta--decision-policy`) created. |
| **2025-10-30** | Multi-repo `.drctl.yaml` config pattern agreed.                                 |
| **2025-10-31** | AGENTS.md introduced as meta-collaboration record.                              |

---

> _“This project is a living experiment in reasoning as infrastructure.”_
