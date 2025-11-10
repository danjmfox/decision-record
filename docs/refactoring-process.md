# 🧰 Refactoring Process

## Intent

Maintain quality through small, safe, reversible changes — always covered by tests and Decision Records.

## Steps

1. Identify duplication, complexity, or clarity issue
2. Add or confirm existing tests
3. Extract behaviour, rename, or simplify logic
4. Run `npm test` — must stay green
5. Open PR with context + before/after summary

## Refactoring Guidance

In particular, look out for these common issues, and refactor code appropriately before claiming completion of the task:

1. Avoid Code Duplication: Refactor repeated code into called functions to keep duplication below 3%.
1. Avoid “publicly writable directory”: use fs.mkdtempSync() instead of "tmp"
1. Unused variable/useless assignment: remove these
1. Ensure Code coverage thresholds are met:
   a. consult `npm run test:coverage`
   a. check the `./coverage` directory for insights.
   c. exercise each branch
1. Highlight large, complex functions (cyclomatic complexity > 15) for substantial refactoring

## Notes

- Refactor incrementally; avoid speculative generalisation
- Confirm structural changes align with architectural DRs

See also [TDD Process](./tdd-process.md)
