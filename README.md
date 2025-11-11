# 🧭 Decision Record CLI (`drctl`)

![CI](https://github.com/danjmfox/decision-record/actions/workflows/ci.yml/badge.svg)
[![CodeQL](https://github.com/danjmfox/decision-record/actions/workflows/codeql.yml/badge.svg)](https://github.com/danjmfox/decision-record/actions/workflows/codeql.yml)
[![codecov](https://codecov.io/gh/danjmfox/decision-record/branch/main/graph/badge.svg?token=dbd18aca-0a06-448b-a2e3-fa346995b240)](https://codecov.io/gh/danjmfox/decision-record)
[![Security Contact](https://img.shields.io/badge/security-contact-blueviolet)](SECURITY.md)
[![OpenSSF Scorecard](https://img.shields.io/ossf-scorecard/github.com/danjmfox/decision-record?label=OpenSSF%20Scorecard)](https://securityscorecards.dev/viewer/?uri=github.com/danjmfox/decision-record)
[![Quality Gate Status](https://sonarcloud.io/api/project_badges/measure?project=danjmfox_decision-record&metric=alert_status)](https://sonarcloud.io/summary/new_code?id=danjmfox_decision-record)

`drctl` treats reasoning as code: decisions live as Markdown files with explicit lifecycle states, changelog metadata, and automated governance hooks. The CLI automates creation, promotion, supersession, and auditing of Decision Records across multiple repositories. For the full narrative, see [docs/project.md](docs/project.md).

---

## 📚 Documentation Index

| Topic                                                     | Reference                                                  |
| --------------------------------------------------------- | ---------------------------------------------------------- |
| Project overview, principles, scope                       | [docs/project.md](docs/project.md)                         |
| Tech stack, tooling, and conventions                      | [docs/tech-stack.md](docs/tech-stack.md)                   |
| Test-driven workflow                                      | [docs/tdd-process.md](docs/tdd-process.md)                 |
| Release workflow & tagging                                | [docs/release.md](docs/release.md)                         |
| Refactoring guardrails (duplication, tmp dirs, dead code) | [docs/refactoring-process.md](docs/refactoring-process.md) |
| TypeScript style guide                                    | [docs/typescript-style.md](docs/typescript-style.md)       |
| Test strategy & coverage expectations                     | [docs/test-plan.md](docs/test-plan.md)                     |
| Collaboration shortcuts                                   | [docs/chat-shortcuts.md](docs/chat-shortcuts.md)           |
| Partnership charter                                       | [AGENTS.md](AGENTS.md)                                     |

Decision policies that guide the CLI itself live under [`decisions-example/meta`](decisions-example/meta).

---

## 🚀 Getting Started

```bash
npm install
npm run build
npm test
npm run test:coverage
npx trunk check      # lint + type + policy
npm run dev -- --help
```

`npm run dev -- …` proxies arguments straight to `tsx src/cli/index.ts`. Prefer this entry point during development so `tsconfig` paths and ESM settings match CI.

---

## 🧑‍💻 Everyday Commands

Common lifecycle and repo operations (full explanations live in [docs/project.md](docs/project.md)):

| Command                                                                                  | Purpose                                                                                                |
| ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `drctl decision new <domain> <slug>`                                                     | Capture a `new` Decision Record (unstaged until promoted)                                              |
| `drctl decision draft / propose / accept / reject / deprecate / retire / supersede`      | Advance lifecycle with git-integrated commits                                                          |
| `drctl decision correction`                                                              | Apply patch update. Lifecycle state is not changed                                                     |
| `drctl decision revise`                                                                  | revise id with a note …                                                                                |
| `drctl decision list --status accepted`                                                  | Inspect records                                                                                        |
| `drctl repo show`                                                                        | Display resolved repository context                                                                    |
| `drctl repo new <alias> <path> [--domain-dir <dir>] [--default]`                         | Register repositories in `.drctl.yaml`                                                                 |
| `drctl repo bootstrap <alias>`                                                           | Initialise git (auto no-op if already initialised)                                                     |
| `drctl config check`                                                                     | Validate local/global configs via the modular `src/config/` pipeline and warn about missing git        |
| `drctl index [--status <status...>] [--upcoming <days>] [--no-kanban] [--output <file>]` | Generate the dashboard-style Markdown index (summary metrics, review radar, per-domain tables, Kanban) |
| `drctl governance validate [--json]`                                                     | Run structural checks across a repo                                                                    |

Legacy top-level lifecycle verbs remain hidden aliases; the canonical surface is `drctl decision …`.

Lifecycle commands automatically back-fill missing states per [DR--20251103--meta--auto-accept-transitions](decisions-example/meta/DR--20251103--meta--auto-accept-transitions.md). Newly created records intentionally start in `status: "new"` and remain unstaged; the first lifecycle action (`drctl decision draft`, or a higher-level command such as `drctl decision accept`) records the draft/proposed transitions, stages the file if git is enabled, and then applies the requested state. This keeps the git history aligned with the changelog without forcing extra manual steps.

### Decision Index Output

`drctl index` now produces a multi-section Markdown report per [DR--20251110--meta--decision-index-ux](decisions-example/meta/DR--20251110--meta--decision-index-ux.md):

- **Summary dashboard** with aggregate metrics, status counts, and the five most recently updated decisions.
- **Upcoming reviews** table that highlights overdue items plus anything with a `reviewDate` inside the configurable `--upcoming` window (default 30 days).
- **Domain catalogues** listing every decision with linked title/ID, lifecycle status, dates, confidence, tags, and lineage helpers.
- **Status Kanban** grouping Draft → Accepted → Deprecated → Superseded → Rejected → Retired/Archived entries for at-a-glance flow checks (toggle via `--no-kanban`).

Use `--status <status...>` to narrow the view, `--output <file>` / `--title <text>` for custom renders, and combine them with lifecycle commands to keep repos navigable.

---

## 🗂️ Repository Layout

```bash
src/               # CLI + core services
decisions-example/ # meta decisions for drctl as sample decision records
docs/              # Process & style guides
coverage/          # Generated by npm test -- --coverage
```

### Key Modules

- `src/cli/index.ts` bootstraps Commander and hands off to focused builders in `cli/decision-command.ts`, `cli/repo-command.ts`, `cli/config-command.ts`, and `cli/governance-command.ts` (see [DR--20251110--meta--modularise-large-files](decisions-example/meta/DR--20251110--meta--modularise-large-files.md)).
- `src/core/service.ts` coordinates lifecycle actions while delegating template hygiene to `src/core/templates.ts` and git helpers in `src/core/git-helpers.ts`.
- Tests mirror this structure: `src/core/service.lifecycle.test.ts` covers lifecycle flows, `src/core/service.templates.test.ts` focuses on template resolution, and `src/core/service.test.ts` now concentrates on revisions, corrections, and git-root edge cases.

See [docs/tech-stack.md](docs/tech-stack.md) for dependencies and build tooling, and [docs/test-plan.md](docs/test-plan.md) for coverage expectations.

---

## 🧠 Decision Records

- Templates & samples: [`decisions-example/decision-record-template.md`](decisions-example/decision-record-template.md)
- Meta-level governance DRs: [`decisions-example/meta`](decisions-example/meta)
- Lifecycle automation is defined in [DR--20251105--meta--decision-subcommand-refactor](decisions-example/meta/DR--20251105--meta--decision-subcommand-refactor.md) and related records.
- Review metadata lives with the record: `reviewDate` schedules the next check-in, `lastReviewedAt` captures the most recent review, and `reviewHistory[]` keeps structured entries (`type`, `outcome`, `reviewer`, `reason`) so governance tooling can surface context. Repo defaults for cadence/warnings live under `review_policy` in `.drctl.yaml`.

Use `drctl decision new` + lifecycle commands rather than editing files manually so changelog/version metadata stay consistent.

---

## 🤝 Collaboration & Quality

- Follow [docs/tdd-process.md](docs/tdd-process.md) for red/green/refactor cycles and coverage requirements.
- Apply the guardrails in [docs/refactoring-process.md](docs/refactoring-process.md) whenever touching existing code (duplication <3%, safe temp dirs, remove unused assignments, keep Codecov happy).
- Coordinate via the norms in [AGENTS.md](AGENTS.md) and shorthand listed in [docs/chat-shortcuts.md](docs/chat-shortcuts.md).
- Before shipping, ensure CI, CodeQL, Sonar, Trunk, and Codecov all pass; refer to [docs/test-plan.md](docs/test-plan.md) when adding new functionality.

---

## 🛣️ Roadmap

Future enhancements, automation concepts, and release cadence are captured either as:

- In `./TODO.md` as initial ideas
- As Decision Records under [`decisions-example/meta`](decisions-example/meta)
  - Run `drctl decision list --status proposed` to see what’s queued up.

---

## 🔒 Security & Disclosure

Report vulnerabilities via the process documented in [SECURITY.md](SECURITY.md).
Supply chain monitoring is tracked through dependency review, npm audit, and OpenSSF Scorecard automation.
