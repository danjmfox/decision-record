# 🚀 Release Process

`drctl` ships via [release-it](https://github.com/release-it/release-it) with Conventional Commits. Policies are captured in [DR--20251102--meta--build-artifacts-strategy](../decisions-example/meta/DR--20251102--meta--build-artifacts-strategy.md); this guide explains the practical steps.

---

## Prerequisites

- Feature branch merged into `main` with all CI checks green (Vitest, Trunk, CodeQL, Sonar, Codecov).
- Decision Records for the release are in the **accepted** state.
- Working tree clean: `git status` should show no staged or unstaged changes.
- Logged into npm with publish rights (`npm whoami`).

---

## Release Steps

1. **Sync main**

   ```bash
   git checkout main
   git pull origin main
   ```

2. **Final verification**

   ```bash
   npm install
   npm run build
   npm test -- --coverage
   npx trunk check
   ```

3. **Run release-it**

   ```bash
   npm run release
   ```

   - Select the appropriate semantic version bump.
   - release-it updates `package.json`, generates changelog entries, tags the commit, and (when configured) publishes to npm/GitHub Releases.
   - Pass `-- --dry-run` for rehearsal.

4. **Push**
   ```bash
   git push origin main --follow-tags
   ```

---

## Post-Release

- Announce the release (release notes are generated automatically; edit if needed).
- Capture any retrospective insights in a Decision Record.
- Plan the next iteration (see [README](../README.md) for workflow quick links).

---

## Troubleshooting

| Issue                                | Remedy                                                                  |
| ------------------------------------ | ----------------------------------------------------------------------- |
| release-it rejects due to dirty tree | Commit/stash local work; repeat verification                            |
| npm auth failure                     | `npm login` or refresh token before re-running                          |
| Changelog looks wrong                | Edit `CHANGELOG.md` before confirming the release prompt                |
| Tag already exists                   | Delete the local tag (`git tag -d vX.Y.Z`), fix version, re-run release |

Use `npm run release -- --dry-run --verbose` to diagnose further problems.
