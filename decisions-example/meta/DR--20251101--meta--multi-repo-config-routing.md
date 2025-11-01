---
id: DR--20251101--meta--multi-repo-config-routing
dateCreated: "2025-11-01"
version: "1.0"
status: draft
changeType: creation
domain: meta
slug: multi-repo-config-routing
changelog:
  - date: "2025-11-01"
    note: Initial creation
  - date: "2025-11-01"
    note: Marked as draft
lastEdited: "2025-11-01"
---

# DR--20251101--meta--multi-repo-config-routing

## 🧭 Context

We need a predictable way to resolve decision repositories across personal and organisational workspaces. Users may have:

- multiple DR silos (work, home, experiments),
- local overrides per project,
- global defaults in their home directory, and
- CLI invocations that should work even without a config file.

The original CLI prototype only searched a single fallback folder, which made multi-repo usage brittle and opaque.

## ⚖️ Options Considered

| Option                      | Description                                                                     | Outcome  | Rationale                                                                |
| --------------------------- | ------------------------------------------------------------------------------- | -------- | ------------------------------------------------------------------------ |
| Env-only                    | Require callers to set `DRCTL_REPO` / `DRCTL_CONFIG` for every command          | Rejected | Fragile and hostile to newcomers; no discoverability or layering.        |
| Single local config         | Look only for the nearest `.drctl.yaml`                                         | Rejected | Breaks global defaults and cross-repo reuse; offers no escape hatch.     |
| Layered resolution (chosen) | Combine CLI flag, env var, local config, global config, plus sensible fallbacks | Accepted | Balances explicit override with progressive disclosure and transparency. |

## 🧠 Decision

Implement a layered repository resolver that honours (in order):

1. `--config <path>` flag,
2. `DRCTL_CONFIG` environment variable,
3. nearest `.drctl.yaml` walking up from `cwd`,
4. global config candidates (`~/.drctl.yaml`, `~/.config/drctl/...`),
5. fallback `./decisions` or `~/decisions`.

Repo metadata (alias, path, domain overrides, default repo) is stored in YAML, surfaced by `drctl repo`, and logged before each command. Duplicate aliases pointing to the same path are blocked with an actionable error. `drctl repo switch` updates `defaultRepo`, while `--repo` / `DRCTL_REPO` allow ad-hoc selection.

## 🪶 Principles

- **Progressive disclosure** – sensible defaults “just work,” yet advanced users can override via flag/env/config layers.
- **Separation of concerns** – configuration lives beside the CLI, keeping decision data repositories clean.
- **Trust through transparency** – every command logs which repo/config combination is in play.

## 🔁 Lifecycle

Status remains `draft` until we add a dedicated config DR and backfill documentation evidence.

## 🧩 Reasoning

TypeScript + Commander middleware give us a single place to collect global options and pass them to services. Exporting `resolveConfigPath` lets both CLI layers and repo management utilities share semantics. Blocking duplicate repo entries prevents subtle mistakes when multiple aliases point at the same working tree. The layered search mirrors tools like Git (local → global → fallback), making the mental model intuitive. We consciously avoided writing to `.drctl.yaml` automatically when running read-only commands; instead, we provide explicit `repo new/switch` helpers so changes remain deliberate.

## 🔄 Next Actions

- Capture this decision formally in the docs (`README`/`AGENTS`) and link the resulting DR.
- Extend config diagnostics to surface pending warnings (missing default repo, duplicate aliases) in CI.

## 🧠 Confidence

High – the resolver is well-covered by unit tests and has been exercised during CLI development.

## 🧾 Changelog

- 2025-11-01 — Initial creation.
