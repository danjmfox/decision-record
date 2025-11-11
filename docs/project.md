# 🧭 Project Overview

`drctl` is a **lightweight, auditable system** for recording, tracking, and evolving key decisions — blending agile delivery, knowledge management, and reasoning hygiene.

> Need the quickstart or command cheatsheet? Jump to the [README](../README.md) and return here for the deeper programme details.

The CLI enables:

- Full decision lifecycle (`new → draft → propose → accept → revise → retire`), where the `new` state keeps fresh records unstaged until the first lifecycle command promotes them
- Multi-repo configuration (`work`, `home`, etc.) backed by the modular `src/config/` stack
- Modular CLI surfaces (decision, repo, config, governance) that share a single bootstrap in `src/cli/index.ts`
- Dashboard-style `drctl index` output with summary metrics, review radar, per-domain catalogues, and Kanban groupings (see DR--20251110--meta--decision-index-ux)
- Auto-promotion of lifecycle states: commands like `drctl decision accept` back-fill missing transitions (including legacy `status: "new"`) so changelog history stays complete (see DR--20251103--meta--auto-accept-transitions)
- Clear separation between app (public) and personal decision data (private)
- Calm, transparent, systemic collaboration between human and AI

Reference example:  
[`decisions-example/meta/DR--20251029--meta--decision-policy.md`](decisions-example/meta/DR--20251029--meta--decision-policy.md)

## Purpose

Create a **lightweight, auditable CLI** for managing Decision Records — treating reasoning as code.

## Core Goals

- Version-controlled decision lifecycle
- Multi-repo config (`work`, `home`, etc.)
- Privacy by design (`.gitignore` defaults)
- Calm human–AI collaboration
- Progressive disclosure: works out-of-the-box, scales with need
- Modular source layout so that CLI wiring, template hygiene, and lifecycle services can evolve independently (see [DR--20251110--meta--modularise-large-files](../decisions-example/meta/DR--20251110--meta--modularise-large-files.md))

## Design Principles

1. Honest, proactive collaboration
2. Reasoning is code
3. Separation of concerns
4. Progressive disclosure
5. Trust through transparency
6. DecisionOps mindset
7. Lean governance
8. Future-proofing

## Related Docs

- [README](../README.md) — entry-point summary, commands, repo map
- [Tech Stack](tech-stack.md)
- [Refactoring Process](refactoring-process.md)
- [TDD Process](tdd-process.md)
- Refer to the ground rules in [AGENTS.md](../AGENTS.md) for wider context
