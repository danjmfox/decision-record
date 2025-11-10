# 🤝 AGENTS.md

> A living agreement between the human developer (Dan) and AI agents co-developing the **Decision Record CLI (`drctl`)** — an experiment in _reasoning as infrastructure_.

## Collaboration Style

- Be very honest. Tell me something I need to know even if I don't want to hear it
- Be pro-active: flag issues before they become problems
- Be succinct
- Use **calm, concise reasoning**
- Reflect uncertainty explicitly
- Prefer exploration before convergence
- Record substantive insights in Decision Records (`drctl decision new meta ...`)
- Keep command logs visible — avoid hidden reasoning
- Use ascii diagrams where appropriate

## Chat Shortcuts

I use shortcuts to communicate with you, to save me typing time and save you token parsing.

e.g. `/cc` should be considered to mean `propose a series of 1 or more git add and commit commands to reflect the logical changesets we've made`

→ [chat-shortcuts.md](./docs/chat-shortcuts.md)

## Specialist Knowledge

Refer to these sections when relevant:

- [project.md](./docs/project.md) — project overview
- [refactoring-process.md](./docs/refactoring-process.md) — refactoring guidance
- [tdd-process.md](./docs/tdd-process.md) — TDD workflow
- [tech-stack.md](./docs/tech-stack.md) — tech and tools
- [test-plan.md](./docs/test-plan.md) — testing and coverage
- [typescript-style.md](./docs/typescript-style.md) — coding conventions
- [release.md](./docs/release.md) — release-it workflow, tagging, post-release steps
- [README.md](./README.md) — quickstart commands and documentation index

---

## ⚙️ Setup & Commands

### Install & Build

```bash
npm install
npm run build
```

### Dev & Test

```bash
npm dev              # Start local dev mode
npm test             # Run all tests
npm test:coverage    # Run with V8 coverage
npx trunk check      # Lint, type, and policy checks
```

### Release

```bash
npm run release      # Uses release-it + conventional commits
```

See [docs/release.md](./docs/release.md) for prerequisites, validation steps, and troubleshooting before running the command.

---

## 🧱 Code Structure

| Path                     | Purpose                                                            |
| ------------------------ | ------------------------------------------------------------------ |
| `src/cli/index.ts`       | CLI entry point                                                    |
| `src/config/`            | Config loader modules (`types`, `paths`, `git-mode`, orchestrator) |
| `src/core/service.ts`    | High-level lifecycle actions                                       |
| `src/core/repository.ts` | Persistence layer for Markdown frontmatter                         |
| `src/core/versioning.ts` | Semantic version bumping                                           |
| `src/core/git.ts`        | Git integration layer                                              |
| `decisions-example/`     | Example decision records for testing/demo                          |

See also: [ARCHITECTURE.md](./ARCHITECTURE.md)
and meta decision record [DR--20251101--meta--architecture-overview](decisions-example/meta/DR--20251101--meta--architecture-overview.md).

---

## 🧠 Design Principles

1. **Reasoning is code** — Decisions are first-class, versioned artefacts.
2. **Separation of concerns** — App, config, and data live in distinct repos.
3. **Progressive disclosure** — Simple defaults; complexity scales by need.
4. **Trust through transparency** — Each architectural choice has a DR.
5. **Human–AI collaboration** — Calm, reflective, non-performative dialogue.
6. **DecisionOps mindset** — Treat decision flow as a testable system.
7. **Future-proofing** — File-based now; API + n8n + UI integration later.

---

## 🧩 Working Agreements

| Topic               | Agreement                                                                                            |
| ------------------- | ---------------------------------------------------------------------------------------------------- |
| **Repos**           | `decision-record` (public) holds code; private repos store DRs (`work-decisions`, `home-decisions`). |
| **Config**          | `.drctl.yaml` supports multiple named repos and domain folders.                                      |
| **Privacy**         | `.drctl.yaml` and `decisions/` are `.gitignore`d.                                                    |
| **Git optionality** | Disable via `git: disabled`, `DRCTL_GIT`, or `--no-git`.                                             |
| **Lifecycle flow**  | Commands auto-progress lifecycle states; changelogs track every transition.                          |
| **Branching**       | Protected main; feature branches + PRs only.                                                         |
| **Automation**      | Future: `drctl index`, `drctl diff`, `drctl sync`.                                                   |

---

## 🧰 Example `.drctl.yaml`

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

Override order:
`--config` → `DRCTL_CONFIG` → nearest `.drctl.yaml` → global defaults (`~/.config/drctl/drconfig.yaml`).

---

## 🔒 Security & Supply Chain

- GitHub dependency review blocks vulnerable deps.
- Track overrides in `package.json` for known advisories.
- `dist/` is git-ignored; built via `npm run build && npm pack`.

---

## 📅 Meta-History

| Date           | Change                                              |
| -------------- | --------------------------------------------------- |
| **2025-10-29** | Initial policy: Decision Record structure defined.  |
| **2025-10-30** | Multi-repo `.drctl.yaml` pattern agreed.            |
| **2025-10-31** | AGENTS.md introduced for co-development guidance.   |
| **2025-11-02** | CI pipeline and build artefact strategy added.      |
| **2025-11-02** | `release-it` adopted for changelog-driven releases. |

---

## 📚 Inspirations

- Annie Duke — _How to Decide_
- Cynefin — complexity-aware sense-making
- ADR pattern — architectural decision records
- Obsidian / TheBrain — knowledge graphs
- Open-source ethics + inner development goals

---

> _"Reasoning and software co-evolve here."_

---

### ✅ Why this format

This file follows the open **[agents.md](https://agents.md)** convention: a predictable, agent-readable place for build/test/code/communication guidance — complementing human-focused docs (`README.md`).

For details, see:

- [Project Overview](docs/project.md)
- [Refactoring Process](docs/refactoring-process.md)
- [Test-Driven Development](docs/tdd-process.md)
- [TypeScript Style](docs/typescript-style.md)
- [Tech Stack](docs/tech-stack.md)
- [Test Plan](docs/test-plan.md)
- [Chat Shortcuts](docs/chat-shortcuts.md)
