import fs from "node:fs";
import path from "node:path";
import type { GitMode, GitModeOverrideSource, GitModeSource } from "./types.js";

export interface ResolveGitModeOptions {
  root: string;
  gitFlag: GitMode | null;
  gitEnv: GitMode | null;
  gitConfig: GitMode | null;
}

export function resolveGitMode(options: ResolveGitModeOptions): {
  mode: GitMode;
  source: GitModeSource;
  overrideCleared?: GitModeOverrideSource;
  detectedGitRoot?: string;
} {
  const gitRoot = findGitRoot(options.root);
  const gitExists = Boolean(gitRoot);
  const detected: GitMode = gitExists ? "enabled" : "disabled";

  const cascade: Array<{ value: GitMode | null; source: GitModeSource }> = [
    { value: options.gitFlag, source: "cli" },
    { value: options.gitEnv, source: "env" },
    { value: options.gitConfig, source: "config" },
  ];

  for (const entry of cascade) {
    if (!entry.value) continue;
    if (entry.value === "disabled" && gitExists) {
      const overrideSource =
        entry.source === "detected" ? undefined : entry.source;
      if (overrideSource) {
        return {
          mode: "enabled",
          source: "detected",
          overrideCleared: overrideSource,
          ...(gitRoot ? { detectedGitRoot: gitRoot } : {}),
        };
      }
    }
    return {
      mode: entry.value,
      source: entry.source,
      ...(gitRoot ? { detectedGitRoot: gitRoot } : {}),
    };
  }

  return {
    mode: detected,
    source: "detected",
    ...(gitRoot ? { detectedGitRoot: gitRoot } : {}),
  };
}

export function findGitRoot(start: string): string | undefined {
  let current = path.resolve(start);
  while (true) {
    const candidate = path.join(current, ".git");
    if (fs.existsSync(candidate)) {
      return current;
    }
    const parent = path.dirname(current);
    if (parent === current) {
      return undefined;
    }
    current = parent;
  }
}

export function coerceGitMode(value: unknown): GitMode | null {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (
      normalized === "enabled" ||
      normalized === "enable" ||
      normalized === "on" ||
      normalized === "true" ||
      normalized === "1" ||
      normalized === "yes"
    ) {
      return "enabled";
    }
    if (
      normalized === "disabled" ||
      normalized === "disable" ||
      normalized === "off" ||
      normalized === "false" ||
      normalized === "0" ||
      normalized === "no"
    ) {
      return "disabled";
    }
    return null;
  }
  if (typeof value === "boolean") {
    return value ? "enabled" : "disabled";
  }
  return null;
}
