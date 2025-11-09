# 🧪 Testing & CI

- Unit & integration tests use **Vitest** (ESM, colocated `*.test.ts`).
- Coverage thresholds: statements ≥80%, branches ≥70%, functions ≥80%, lines ≥80%.
- CI: GitHub Actions (`ci.yml`) runs build, test, CodeCov, SonarQube, dependency review, CodeQL, and Scorecard.

## Scope

- Unit tests for core modules
- Integration tests for lifecycle commands
- Example-based tests for decision hygiene (`decisions-example/`)

## Coverage Targets

| Metric     | Minimum |
| ---------- | ------- |
| Statements | 80%     |
| Branches   | 70%     |
| Functions  | 80%     |
| Lines      | 80%     |

## Tooling

- Vitest (V8 coverage)
- CI runs via GitHub Actions (`ci.yml`)
- Dependency review + CodeQL + Scorecard checks

## Local Commands

```bash
npm test
npm test:coverage
npx trunk check
```

## Wider Reference

Refer to the ground rules in `../AGENTS.md` for wider context.
