# 🧭 Decision Record CLI (`drctl`)

![CI](https://github.com/danjmfox/decision-record/actions/workflows/ci.yml/badge.svg)
[![CodeQL](https://github.com/danjmfox/decision-record/actions/workflows/codeql.yml/badge.svg)](https://github.com/danjmfox/decision-record/actions/workflows/codeql.yml)
[![codecov](https://codecov.io/gh/danjmfox/decision-record/branch/main/graph/badge.svg?token=dbd18aca-0a06-448b-a2e3-fa346995b240)](https://codecov.io/gh/danjmfox/decision-record)
[![Security Contact](https://img.shields.io/badge/security-contact-blueviolet)](SECURITY.md)
[![OpenSSF Scorecard](https://img.shields.io/ossf-scorecard/github.com/danjmfox/decision-record?label=OpenSSF%20Scorecard)](https://securityscorecards.dev/viewer/?uri=github.com/danjmfox/decision-record)
[![Quality Gate Status](https://sonarcloud.io/api/project_badges/measure?project=danjmfox_decision-record&metric=alert_status)](https://sonarcloud.io/summary/new_code?id=danjmfox_decision-record)

`drctl` treats reasoning as code: decisions live as Markdown files with explicit lifecycle states, changelog metadata, and automated governance hooks. The CLI automates creation, promotion, supersession, and auditing of Decision Records across multiple repositories. For the full narrative, see [docs/project.md](docs/project.md).

---

## Who It’s For

- [CLI quickstart](#cli-quickstart) — install `drctl`, point it at a decisions folder, and record lifecycle changes from any shell.
- [Project workflows](#project-workflows) — add `drctl` to a repository, manage multi-repo config, and keep templates/tests in sync.
- [CI integration](#ci-integration) — run governance checks, regenerate indexes, and gate releases; see the detailed playbook in [docs/ci.md](docs/ci.md).

Decision policies that guide the CLI itself live under [`decisions-example/meta`](decisions-example/meta).

---

## CLI Quickstart

### Install

```bash
# Global install (preferred for day-to-day use)
npm install -g decision-record

# Or run ad-hoc via npx
npx drctl --help
```

### Configure

`drctl` reads the nearest `.drctl.yaml`. Start with the minimal multi-repo config agreed in [AGENTS.md](AGENTS.md):

```yaml
defaultRepo: work
repos:
  work:
    path: ~/Documents/work-decisions
    defaultDomainDir: domains
```

Run `drctl repo show` to verify the resolved context before issuing lifecycle commands.

### Capture a decision

```bash
drctl decision new meta architecture-overview
drctl decision draft DR--20251101--meta--architecture-overview
drctl decision accept DR--20251101--meta--architecture-overview
drctl decision index --output docs/DecisionIndex.md
```

- Pass `--template` for custom Markdown scaffolds and `--confidence` to seed metadata.
- Git is enabled by default. Use `--no-git` or `DRCTL_GIT=disabled` when working in shared drives; the CLI emits an ℹ️ notice and leaves files unstaged.
- `drctl governance validate` surfaces structural errors before you trust a repository.

### Everyday commands

Commands are grouped by intent; see [docs/project.md](docs/project.md) for deeper context.

#### Capture

| Command                              | Purpose                                                   |
| ------------------------------------ | --------------------------------------------------------- |
| `drctl decision new <domain> <slug>` | Capture a `new` Decision Record (unstaged until promoted) |

#### Lifecycle

| Command                                                                             | Purpose                                                        |
| ----------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| `drctl decision draft / propose / accept / reject / deprecate / retire / supersede` | Advance lifecycle with git-integrated commits                  |
| `drctl decision correction`                                                         | Apply patch update. Lifecycle state is not changed             |
| `drctl decision revise`                                                             | Apply a revision (minor version) with optional confidence/note |

#### Review & Governance

| Command                                                          | Purpose                                                                 |
| ---------------------------------------------------------------- | ----------------------------------------------------------------------- |
| `drctl decision review <id> [--type …] [--outcome …] [--note …]` | Record a review event (`reviewHistory`, `lastReviewedAt`, `reviewDate`) |
| `drctl decision list --status accepted`                          | Inspect records with optional filters                                   |
| `drctl governance validate [--json]`                             | Run structural checks across a repo                                     |

#### Reporting & Repo hygiene

| Command                                                  | Purpose                                          |
| -------------------------------------------------------- | ------------------------------------------------ |
| `drctl decision index [--output index.md] [--no-kanban]` | Rich Markdown dossier (summary, reviews, Kanban) |
| `drctl repo show`                                        | Print the resolved repo context (root, git mode) |
| `drctl repo new <alias> <path>`                          | Add a repo entry to the nearest `.drctl.yaml`    |
| `drctl repo bootstrap <alias>`                           | Initialise git + domain directories for a repo   |
| `drctl config check`                                     | Show diagnostic output for layered configs       |
| `drctl config path <file>`                               | Resolve a config file path relative to the cwd   |

Use `drctl decision new` + lifecycle commands rather than editing files manually so changelog/version metadata stay consistent.

---

## Project Workflows

- **Scaffold repositories** with `drctl repo new <alias> <root> [--domain-dir domains]`, then `drctl repo bootstrap <alias>` to initialise git (or opt out via `.drctl.yaml` `git: disabled`).
- **Map domains and templates** per repo (`defaultDomainDir`, `domains`, `defaultTemplate`) so teams get consistent folder layouts and Markdown scaffolds.
- **Share configs**: repo commands read from the nearest `.drctl.yaml`, `DRCTL_CONFIG`, or `--config`; see `src/config.ts` for the resolution order captured in the meta DRs.
- **Validate regularly**: pair lifecycle commands with `drctl governance validate --json` to block malformed frontmatter before PRs merge.
- **Automate indexes**: run `drctl decision index` post-commit or as part of documentation jobs to refresh the dashboard-style digest defined in DR--20251110.

Refer to [docs/project.md](docs/project.md) for a deeper architectural overview and to [docs/tech-stack.md](docs/tech-stack.md) for the module layout.

---

## CI Integration

Run `drctl` anywhere Node ≥18.17 is available. Typical pipeline steps:

```bash
npm install decision-record
drctl governance validate --json > dr-governance.json
drctl decision index --output DecisionIndex.md
```

- Fail the job if validation reports errors; stash `dr-governance.json`/`DecisionIndex.md` as build artifacts for dashboards.
- Pass repo aliases via `--repo` or `DRCTL_REPO` so CI can target work/home domains without editing configs.
- Need fuller examples? See [docs/ci.md](docs/ci.md) for GitHub Actions, GitLab, and generic shell snippets plus caching tips.

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
| CI integration cookbook                                   | [docs/ci.md](docs/ci.md)                                   |
| Test strategy & coverage expectations                     | [docs/test-plan.md](docs/test-plan.md)                     |
| Collaboration shortcuts                                   | [docs/chat-shortcuts.md](docs/chat-shortcuts.md)           |
| Partnership charter                                       | [AGENTS.md](AGENTS.md)                                     |

---

## Contribute & Develop

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
