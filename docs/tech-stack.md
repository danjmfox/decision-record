# ⚙️ Tech Stack

| Layer           | Tool                              | Purpose                               |
| --------------- | --------------------------------- | ------------------------------------- |
| Language        | TypeScript (strict, ESM)          | Strong typing, modern tooling         |
| CLI Framework   | Commander.js                      | Declarative commands                  |
| Build           | tsx + npm                         | Fast iteration, lightweight packaging |
| Tests           | Vitest                            | Unit/integration testing              |
| Lint            | Trunk                             | Unified lint & policy checks          |
| Versioning      | release-it + conventional commits | Automated changelog & releases        |
| Repo Management | GitHub Actions                    | CI/CD, dependency review, CodeQL      |

## Folder Layout

```bash
src/
cli/
core/
types/
decisions-example/
docs/
```

## Wider Reference

- See [test-plan.md](test-plan.md) for CI & coverage details.
- Refer to the ground rules in [AGENTS.md](../AGENTS.md) for wider context.
