# 🧭 Project Overview

`drctl` is a **lightweight, auditable system** for recording, tracking, and evolving key decisions — blending agile delivery, knowledge management, and reasoning hygiene.

> Need the quickstart or command cheatsheet? Jump to the [README](../README.md) and return here for the deeper programme details.

The CLI enables:

- Full decision lifecycle (`new → draft → propose → accept → revise → retire`)
- Multi-repo configuration (`work`, `home`, etc.) backed by the modular `src/config/` stack
- Modular CLI surfaces (decision, repo, config, governance) that share a single bootstrap in `src/cli/index.ts`
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

1. Reasoning is code
2. Separation of concerns
3. Progressive disclosure
4. Trust through transparency
5. DecisionOps mindset
6. Future-proofing

## Related Docs

- [README](../README.md) — entry-point summary, commands, repo map
- [Tech Stack](tech-stack.md)
- [Refactoring Process](refactoring-process.md)
- [TDD Process](tdd-process.md)
- Refer to the ground rules in [AGENTS.md](../AGENTS.md) for wider context
