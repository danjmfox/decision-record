# ✅ DecisionOps Implementation Plan (Codex Checklist)

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
