# ✅ DecisionOps Implementation Plan (Codex Checklist)

## 🧱 Implementation Steps

1. **Repository Logic (Next Up)**
   - [x] Update `repository.ts` to honour per-repo domain folders from config.
   - [x] Auto-create domain subfolders when writing records.
   - [x] Add an `index` generator that aggregates across configured repos.
   - [x] Prevent duplicate repo aliases pointing at the same filesystem path.
   - [x] Support configurable templates (CLI/env/config cascade + frontmatter provenance).
   - [x] Expand repo index output with summary metrics, per-domain catalogues, review radar, and Kanban (DR--20251110--meta--decision-index-ux).
   - [ ] Enable hierarchical navigation between config → repo → domain → DR across multiple repos (beyond the Markdown index).

2. **Examples & Documentation**
   - [x] Add a README note clarifying `decisions-example/` as the default demo workspace.
   - [x] Document build artefact strategy and packaging workflow (README, AGENTS, DR--20251102--meta--build-artifacts-strategy).
   - [ ] Capture the multi-repo config design in `DR--20251101--meta--multi-repo-config-routing`.
   - [ ] Continue treating `AGENTS.md` as the canonical collaboration record (update as decisions land).
   - [ ] Restructure docs (split README, add JSDoc-style references, explore publishing DRs as browsable HTML).

3. **Automation & Integrations (Future)**
   - [x] Establish CI pipeline (GitHub Actions build + test).`
   - [x] Trial automated release tooling (`release-it` with conventional changelog + GitHub releases).
   - [x] Add OpenSSF Scorecard workflow to surface supply-chain health.
   - [ ] Implement `drctl export` JSON metadata command.
   - [ ] Implement `drctl diff` to compare decision metadata across repos or revisions.
   - [ ] Add REST API and dashboard layer.
   - [ ] Support remote DR syncing via `git` or API calls.
   - [ ] Explore n8n automation for scheduled reviews.

4. **Completed**
   - [x] Multi-repo config resolution + `--repo` flag support.
   - [x] `drctl config check` diagnostics.
   - [x] Example decision records relocated to `decisions-example/meta/...`.
   - [x] Community-first docs (`CODE_OF_CONDUCT.md`, `CONTRIBUTING.md`, `SECURITY.md`, `SUPPORT.md`).
   - [x] Per-repo governance validation command (`drctl governance validate`).

5. **Lifecycle Automation (Current Focus)**
   - [x] Harden `drctl decision accept` so the git-backed status flow mirrors `decision draft`/`decision propose`.
   - [x] Add `drctl decision reject` and `drctl decision deprecate` with consistent changelog handling.
   - [x] Implement `drctl decision supersede`/`drctl decision retire`, ensuring markdown bodies persist.
   - [x] Honour git-mode overrides (CLI/env/config) so lifecycle commands run without a git repo (`DR--20251105--meta--git-optional-lifecycle`).
   - [ ] Add regression tests covering body preservation and changelog entries for every transition.
   - [ ] Decide whether lifecycle commands should regenerate or remind about repository indexes.
   - [ ] Provide guardrails for manually-authored decision files (lint/doctor command or stronger governance hints when frontmatter is incomplete).
   - [x] Restructure lifecycle commands under a `drctl decision` subcommand group for clearer CLI organisation (legacy shims emit deprecation warnings).

6. **Reliability & Modernisation (Planned)**
   - [ ] Generate signed release provenance and SBOMs alongside `npm pack`, archiving them in CI artifacts.
   - [ ] Expand CI coverage to run key smoke tests on macOS and Windows runners in addition to Linux.
   - [ ] Wire lifecycle regression suites into CI so every state transition is exercised end-to-end before merge.
   - [ ] Automate repository index refresh or surface actionable reminders after lifecycle commands complete.
   - [ ] Publish structured metadata outputs (JSON feeds, knowledge-graph hooks) so telemetry, dashboards, or governance tooling can ingest DR state safely.
   - [ ] Stand up scheduled governance validation (e.g., via n8n) to detect drift in long-lived repositories.
   - [ ] Strengthen contributor onboarding with CODEOWNERS, curated project boards, and DR-friendly issue templates.
   - [ ] Refactor test suites with clearer `describe` groupings and shared helpers to improve readability and reuse.
   - [ ] Add Snyk security scanning to CI alongside existing supply-chain checks.

## 🧱 CORE REPO FOUNDATION — Highest priority

- [ ] **Protect `main` branch (local + remote)**
  - [ ] Enforce `main` as read-only (no direct commits)
  - [ ] Add local git config to block main pushes
  - [ ] Add optional pre-commit hook warning if committing to `main`

- [ ] **Adopt trunk-based workflow**
  - [ ] Require all feature work via PRs
  - [ ] Enable squash merge only?
  - [ ] Enforce CI on PRs before merge

- [ ] **Establish monorepo structure**

  ```bash
  decisionops/
  ├── packages/
  │   ├── core/
  │   ├── cli/
  │   ├── api/
  │   └── ui/
  └── turbo.json
  ```

- [ ] **Enable workspace tooling**
  - [ ] Configure npm workspaces in root `package.json`
  - [ ] Add Changesets for per-package versioning
  - [ ] Configure `release-it` for human-readable changelogs

---

## ⚙️ BUILD + RELEASE PIPELINE — High priority

- [ ] **Add Lerna orchestration**
  - [ ] Install `lerna@^8`
  - [ ] Create `lerna.json` with independent versioning and conventional commits
  - [ ] Add commands:
    - [ ] `lerna bootstrap`
    - [ ] `lerna run build --scope @decision/cli`
    - [ ] `lerna publish from-package --scope @decision/cli`

- [ ] **Add GitHub Actions CI/CD**
  - [ ] Add `.github/workflows/release.yml` using Turbo + Lerna
  - [ ] Build/test only changed packages
  - [ ] Publish to npm on `main` push using `NPM_TOKEN`
  - [ ] Auto-tag versions on release

- [ ] **Automate releases**
  - [ ] `lerna version --conventional-commits` before merge
  - [ ] CI runs `lerna publish from-package --yes` on `main`

---

## 🧩 PACKAGE MODULARISATION — Medium priority

- [ ] **Define package boundaries**
      | Package | Purpose | Publish? |
      |----------|----------|-----------|
      | `@decision/core` | core logic + types | ✅ |
      | `@decision/cli` | drctl binary | ✅ |
      | `@decision/api` | REST API | ✅ |
      | `@decision/ui` | Vue dashboard | ✅ |
      | `@decision/ai-agent` | chat automation | 🚧 |

- [ ] **Prepare CLI spin-out**
  - [ ] Tag `drctl-pre-split`
  - [ ] Clone and filter CLI history to new repo
  - [ ] Update deps to use `@decision/core` from npm
  - [ ] Add CI workflow for standalone CLI build/test/publish

---

## 🧮 GOVERNANCE + DECISIONOPS — Medium priority

- [ ] **Formalise DR governance**
  - [ ] Keep meta-decisions under `decisions-example/meta/`
  - [ ] Add `drctl governance validate` to CI
  - [ ] Link lifecycle automation to GitHub Actions (e.g., DR accept on release)

- [ ] **DecisionOps API service**
  - [ ] Create `@decision/api` adapter for REST automation
  - [ ] Add endpoints for `POST /decisions`, `PATCH /decisions/:id/lifecycle`, `GET /decisions`

---

## 💡 EXPERIMENTAL / FUTURE — Lower priority

- [ ] **AI-assisted DR authoring**
  - [ ] Extend CLI with `--ai` flag for AI-generated DRs from prompt/transcript
  - [ ] Or build a chat agent that captures discussion → drafts DR → commits lifecycle

- [ ] **DecisionOps dashboard**
  - [ ] Vue front-end for DR flow metrics (lead time, throughput)
  - [ ] Visualise via `drctl export --json`

- [ ] **API deployment**
  - [ ] Containerise `@decision/api` via Docker
  - [ ] Deploy to Fly.io / Render with OIDC or API key security

---

## 🧭 DOCUMENTATION & QUALITY

- [ ] Maintain per-package `README.md`
- [ ] Update `ARCHITECTURE.md` with diagrams
- [ ] Keep DR history current under `decisions-example/meta/`
- [ ] Auto-generate `CHANGELOG.md` from commits

---

### Priority Summary

| Priority    | Group                 | Key Deliverables                                  |
| ----------- | --------------------- | ------------------------------------------------- |
| 🔥 Critical | Core repo & workflow  | Protect `main`, monorepo setup, Turbo, Changesets |
| 🚀 High     | CI/CD & releases      | Lerna setup, Actions, npm automation              |
| ⚙️ Medium   | Packages & governance | CLI spin-out, API, DR validation                  |
| 🌱 Future   | AI & dashboard        | AI authoring, visual metrics UI                   |
