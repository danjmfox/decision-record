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
  return yaml.load(readFileSync(path, "utf8")) as Config;
}

// 🚫 Avoid
export default function (cfg) {
  return yaml.load(cfg);
}
```

## Wider Reference

- Refer to the ground rules in `../AGENTS.md` for wider context.
