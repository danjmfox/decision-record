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
| **CLI Core**       | Support full DR lifecycle (new → accept → revise → supersede → retire)               | ✅ Implemented |
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
| **Decision records** | Each architectural choice (like this config system) is captured in a `DR--YYYYMMDD--meta--*.md`.                                     |
| **File conventions** | Use `DR--YYYYMMDD--domain--slug.md` IDs; domain as folder; markdown + YAML frontmatter.                                              |
| **Private data**     | `.drctl.yaml` and `decisions/` folders are `.gitignore`d; only `decisions-example/` is public.                                       |
| **AI collaboration** | All reasoning steps remain inspectable; outputs versioned in code, not ephemeral.                                                    |

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

1. **Config System**
   - [ ] Implement multi-repo `.drctl.yaml` support (`decisions.work`, `decisions.home`).
   - [ ] Add CLI flag `--repo` (default from config or env `DRCTL_REPO`).
   - [ ] Add config validation command: `drctl config check`.

2. **Repository Logic**
   - [ ] Update `repository.ts` to handle per-repo domain folders.
   - [ ] Auto-create domain subfolders if missing.
   - [ ] Add `index` generator across multiple repos.

3. **Example Setup**
   - [x] Move sample DR to `decisions-example/meta/DR--20251029--meta--decision-policy.md`.
   - [ ] Add note in README: “Uses decisions-example as default demo workspace.”

4. **Documentation**
   - [ ] Keep this `AGENTS.md` as the canonical collaboration record.
   - [ ] Add meta DR for config design: `DR--20251030--meta--multi-repo-config.md`.

5. **Future**
   - [ ] Add REST API and dashboard layer.
   - [ ] Support remote DR syncing via `git` or API calls.
   - [ ] Explore n8n automation for scheduled reviews.

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

| Date           | Event                                                                           |
| -------------- | ------------------------------------------------------------------------------- |
| **2025-10-29** | Initial Decision Record Policy (`DR--20251029--meta--decision-policy`) created. |
| **2025-10-30** | Multi-repo `.drctl.yaml` config pattern agreed.                                 |
| **2025-10-31** | AGENTS.md introduced as meta-collaboration record.                              |

---

> _“This project is a living experiment in reasoning as infrastructure.”_
