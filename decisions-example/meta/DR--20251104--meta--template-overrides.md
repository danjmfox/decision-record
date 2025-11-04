---
id: DR--20251104--meta--template-overrides
dateCreated: "2025-11-04"
version: 1.0.0
status: draft
changeType: creation
domain: meta
slug: template-overrides
changelog:
  - date: "2025-11-04"
    note: Initial creation
  - date: "2025-11-04"
    note: Documented template cascade implementation progress
---

# DR--20251104--meta--template-overrides

## 🧭 Context

`drctl new` currently emits a single baked-in Markdown template. Teams adopting DecisionOps often tailor headings or add prompts per domain. Without first-class template support, contributors copy/paste bespoke scaffolds, risking drift, missing sections, and noisy diffs. We need a lightweight way to point `drctl` at custom templates while staying aligned with the existing configuration cascade and lifecycle automation.

## ⚖️ Options Considered

| Option | Description                                                                   | Outcome  | Rationale                                                                                  |
| ------ | ----------------------------------------------------------------------------- | -------- | ------------------------------------------------------------------------------------------ |
| A      | Keep the single hard-coded template                                           | Rejected | Blocks domain-specific guidance; forces manual edits that undermine lifecycle consistency. |
| B      | Introduce a rich “Template object” model parsed from Markdown into JSON       | Rejected | Over-engineers v1, adds parsing complexity before we have real template variability.       |
| C      | Add configurable Markdown templates with simple validation hooks (**chosen**) | Accepted | Meets immediate needs, reuses existing config cascade, keeps implementation incremental.   |

## 🧠 Decision

Implement configurable Markdown templates for `drctl new` with minimal scaffolding:

- Add `--template <path>` to `drctl new`, pointing at a Markdown file relative to the repo root (or absolute path). When supplied, the CLI copies that file instead of the default.
- Introduce a discovery cascade: CLI flag → `DRCTL_TEMPLATE` env var → repo-level default in `.drctl.yaml` (e.g., `template: meta/default.md`) → packaged default.
- When a non-packaged template is used, copy it into the decision repo (if not already tracked) so it is version-controlled alongside the resulting DRs. Record the template path in the frontmatter (e.g., `templateUsed: meta/default.md`) for traceability.
- Keep template handling string-based for now—no JSON template model—while reserving extension points for future metadata.
- During `drctl propose`/`drctl accept`, warn if templated headings remain empty or placeholder strings are untouched; allow override with a confirmation flag so CI can fail on this hygiene check if desired.
- Extend `drctl config check` to verify that declared templates exist, are readable, and (for git-backed repos) are committed; surface actionable errors if they are missing.

## 🪶 Principles

1. **Progressive disclosure** – defaults keep working; custom templates opt in via existing config patterns.
2. **Reasoning is code** – template provenance is recorded in frontmatter and tracked under version control.
3. **Trust through transparency** – lifecycle commands surface template hygiene issues before decisions advance.

## 🔁 Lifecycle

- Status: `draft` (awaiting implementation and validation).
- Change type: `creation`.

## 🧩 Reasoning

The chosen approach gives contributors flexibility without committing to a fully structured template language we might regret. Reusing the configuration cascade (`--template`, `DRCTL_TEMPLATE`, repo defaults) mirrors how repos are resolved today, minimising cognitive load. Storing templates inside the decision repo ensures reviewers can inspect both the decision and its scaffold. Recording `templateUsed` links each DR back to its source, aiding audits and future migrations. Placeholder checks during lifecycle transitions keep decisions from shipping with boilerplate text while still letting experts override when necessary.

Rejecting a parsed Template object keeps the implementation small and testable; we can layer richer metadata later if real-world templates demand it. Warning-based validation honours existing workflows, and the optional confirmation switch allows teams to enforce strict behaviour in CI without breaking local experimentation.

## 🔄 Next Actions

- [x] Update `src/config.ts` and repo resolution to load a `template` default per repo and honour `DRCTL_TEMPLATE`.
- [x] Extend `drctl new` service logic to copy templates, record `templateUsed`, and ensure external templates land inside the repo.
- [x] Add lifecycle validation hooks (`propose`, `accept`) that warn when placeholder text remains.
- [ ] Expand `drctl config check` (and/or governance validation) to confirm templates are tracked in git, not just present on disk.
- [ ] Decide whether an explicit `--force`/CI flag is needed to bypass template warnings when pipelines expect non-interactive runs.

## 🧠 Confidence

Medium – the flow mirrors existing config patterns, but placeholder detection heuristics need tuning with real templates. Revisit after initial implementation to assess whether we need stricter validation or richer metadata.

## 🧾 Changelog

- 2025-11-04 — Decision recorded as new.
- 2025-11-04 — Template cascade implemented (config/env/CLI) with lifecycle warnings and documentation updates captured.
