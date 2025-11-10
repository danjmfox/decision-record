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
  const gitInfo = gitRoot ? { detectedGitRoot: gitRoot } : {};

  const cascade: Array<{ value: GitMode | null; source: GitModeSource }> = [
    { value: options.gitFlag, source: "cli" },
    { value: options.gitEnv, source: "env" },
    { value: options.gitConfig, source: "config" },
  ];

  const override = cascade.find(
    (entry): entry is { value: GitMode; source: GitModeSource } =>
      entry.value !== null,
  );

  if (!override) {
    return { mode: detected, source: "detected", ...gitInfo };
  }

  const overrideSource =
    override.source === "detected" ? undefined : override.source;

  if (override.value === "disabled" && gitExists && overrideSource) {
    return {
      mode: "enabled",
      source: "detected",
      overrideCleared: overrideSource,
      ...gitInfo,
    };
  }

  return {
    mode: override.value,
    source: override.source,
    ...gitInfo,
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
