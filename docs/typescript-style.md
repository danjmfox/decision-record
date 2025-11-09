# 🧩 TypeScript Style Guide

## Rules

- Strict mode enabled
- ESM imports only
- Single quotes, no semicolons
- Prefer functional, composable patterns
- Avoid classes unless encapsulation is essential

## Patterns

- Pure functions preferred
- Explicit types; avoid `any`
- Use descriptive names for config keys
- Export default only for React/CLI entry points

## Examples

```ts
// ✅ Good
export function loadConfig(path: string): Config {
  return yaml.load(readFileSync(path, 'utf8')) as Config;
}

// 🚫 Avoid
export default function(cfg) {
  return yaml.load(cfg);
}

## Wider Reference

- Refer to the ground rules in `../AGENTS.md` for wider context.
```

src/cli/index.repo.test.ts (lines 34-78) – Sonar flagged the per-test declaration of createWorkspaceRepo as duplicate logic (≈24% duplication). The function now lives at module scope, so every test calls the shared helper instead of re-declaring it, satisfying the “avoid duplicated code” rule.

src/cli/index.repo.test.ts (lines 592-659) – Sonar’s “publicly writable directory” warning applied to diagnostics tests that hard-coded /tmp/.... Each test now provisions a salted workspace via fs.mkdtempSync(path.join(os.tmpdir(), "drctl-config-")), passes that path into the helper, and removes it afterward, eliminating the insecure path warning while keeping behavior unchanged.

src/config.ts (line 603) – Sonar noted gitRootForRepo was assigned but never read when computing diagnostics. The dead assignment was removed so that diagnoseConfig now relies solely on gitResolution.detectedGitRoot and findGitRoot(repo.root), clearing the “unused variable/useless assignment” rule.

src/config.test.ts (lines 656-772) – Codecov reported branch gaps around coerceGitMode, domain normalization, and template resolution. New tests cover boolean/string git overrides, invalid values, domain entries that aren’t strings/objects, and absolute template paths, so the remaining uncovered branches in src/config.ts dropped into Codecov’s acceptable range.

src/cli/index.repo.test.ts (lines 592-752) – Additional CLI tests exercise each branch of reportConfigDiagnostics, repo new --domain-dir/--default, and the early-return path of repo bootstrap when .git already exists. These scenarios were previously untested, causing Codecov failures on src/cli/index.ts; they now execute under test, lifting the file’s branch coverage above the threshold.
