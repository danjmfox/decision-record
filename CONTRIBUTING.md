# Contributing to Decision Record CLI (`drctl`)

Thank you for investing time in improving `drctl`. This project is a collaboration between human and AI agents that treats reasoning as a first-class artifact. Contributions that preserve clarity, calm, and transparency are especially welcome.

## Quick Start

1. **Fork & clone** this repository.
2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Run the test suite** to confirm the baseline is green:

   ```bash
   npm test
   ```

4. **Run Trunk checks** for formatting, linting, and supply-chain scans:

   ```bash
   npx trunk check
   ```

5. **Create a branch** following the conventional format, e.g. `feat/multi-repo-sync`.

## Development Workflow

- Always branch off `main` (e.g. `git checkout -b feat/my-change`), push the branch, and merge via PR; main is protected and blocks direct pushes.
- Start each change with a **failing test** (or missing coverage) and iterate red → green → refactor.
- Keep commits **small and incremental**; avoid batching unrelated changes.
- run `npm test` (or the targeted suite) before every commit to keep `main` green.
- Run `npx trunk check` (or `npx trunk fmt` / `npx trunk lint`) before pushing to ensure formatting, lint, and security scans are clean.
- Follow a **test-driven mindset**. Add or update unit tests (Vitest) before implementing behaviour when practical.
- Keep changes **small and focused**. Prefer multiple logical commits over a single large one.
- Use **conventional commits** for each changeset:
  - `feat:` for new functionality
  - `fix:` for bug fixes
  - `docs:`, `refactor:`, `test:`, etc. for other categories
- Ensure `npm test` passes after every significant change.
- Update documentation (`README.md`, `AGENTS.md`, or relevant decision records) whenever behaviour or workflow changes.
- Before submitting a PR, run a final `npm test` and `npm run build` (if applicable) to confirm the tree is clean.

## Project Norms

- **Repository resolution**: the CLI uses shared middleware to resolve repo context. When adding new commands, thread the repo context using `createRepoAction`.
- **Decision records**: every substantial architectural or behavioural decision should be captured as a Decision Record (DR) under `decisions-example/` or the appropriate private repo, following the `DR--YYYYMMDD--domain--slug.md` naming convention.
- **Testing**: colocate new tests with the code they cover (`*.test.ts`). Aim for meaningful assertions that exercise both positive and negative paths.
- **Style**: the project is TypeScript + ESM. Use descriptive names, keep functions focused, and add succinct comments only when intent is not obvious.
- **Git hygiene**: avoid force pushes to the main branch. Rebase feature branches if needed before opening or updating a PR.

## Submitting Changes

1. Push your branch to your fork.
2. Open a Pull Request with:
   - A clear title using conventional commit style.
   - A concise summary that explains _why_ the change is needed and _how_ it was implemented.
   - Links to any relevant decision records or issues.
3. Be ready to discuss design decisions and tests. Review conversations are collaborative and focus on shared understanding.

## Reporting Issues

- Search open issues first to avoid duplicates.
- Provide as much context as possible: environment, steps to reproduce, expected vs. actual behaviour, and any relevant logs.
- If the issue relates to decision policy or governance, consider capturing it as a Decision Record proposal (`drctl new meta ...`) and link it in the issue.

## Code of Conduct

Please review and adhere to our [Code of Conduct](./CODE_OF_CONDUCT.md). Instances of unacceptable behaviour can be reported privately via [conduct@daedaluscoaching.com](mailto:conduct@daedaluscoaching.com).

## Security

Security vulnerabilities should **not** be reported publicly. Refer to [SECURITY.md](./SECURITY.md) for the responsible disclosure process.

We appreciate your willingness to contribute to a calmer, more transparent reasoning ecosystem. Thank you!
