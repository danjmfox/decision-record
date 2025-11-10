# 🧪 Test-Driven Development (TDD) Process

## Flow

1. Store the feature plan as a temporary file in the project folder: `feature-plan-{name}.md`
1. Write a failing test
1. Implement the minimal code to make it pass
1. Refactor safely
1. Repeat

## Guidelines

- One small behaviour per cycle
- Co-locate tests (`*.test.ts`)
- Use Vitest’s watch mode
- Each change must improve both **behaviour** and **understanding**

## Commands

```bash
npm test
npm test:coverage
```

## Example

"Add drctl repo check command" is

1. Read the `feature-plan-{name}.md`
1. Read and apply the [typescript guidelines](typescript-style.md)
1. Summarise the plan and the TDD steps
1. For each item in the plan:
   a. Write failing test for missing repo alias
   a. Implement code to pass tests (no more than this).
   a. Refactor shared logic to src/core/config.ts as part of the feature delivery work - see [Refactoring Guidance](./refactoring-process.md)
1. Validate:
   a. Run `npm run test:coverage`
   b. Address low test coverage with additional tests
   c. Review new code to ensure we've correctly applied the [typescript guidelines](typescript-style.md)
1. Summarise changes
