import type { Command } from "commander";
import type { RepoOptions } from "../core/service.js";

interface RepoFlag {
  repo?: string;
}

interface ConfigFlag {
  config?: string;
}

interface GitFlag {
  git?: boolean;
  noGit?: boolean;
}

export function collectRepoOptions(command: Command): RepoOptions {
  const repoOptions: RepoOptions = { cwd: process.cwd() };
  const repo = findRepoFlag(command);
  if (repo) {
    repoOptions.repo = repo;
  }
  const config = findConfigFlag(command);
  if (config) {
    repoOptions.configPath = config;
  }
  const gitPreference = resolveGitPreference(command);
  if (gitPreference === "enabled") {
    repoOptions.gitModeFlag = "enabled";
  } else if (gitPreference === "disabled") {
    repoOptions.gitModeFlag = "disabled";
  }
  return repoOptions;
}

export function ensureRepoFlagNotUsed(
  command: Command,
  commandName: string,
): void {
  const repo = findRepoFlag(command);
  if (repo) {
    throw new Error(`--repo cannot be used with ${commandName}`);
  }
}

function findRepoFlag(command: Command | null | undefined): string | undefined {
  if (!command) return undefined;
  const opts = typeof command.opts === "function" ? command.opts() : undefined;
  const repo = (opts as RepoFlag | undefined)?.repo;
  if (repo && typeof repo === "string" && repo.trim().length > 0) {
    return repo;
  }
  return findRepoFlag(command.parent as Command | undefined);
}

function findConfigFlag(
  command: Command | null | undefined,
): string | undefined {
  if (!command) return undefined;
  const opts = typeof command.opts === "function" ? command.opts() : undefined;
  const config = (opts as ConfigFlag | undefined)?.config;
  if (config && typeof config === "string" && config.trim().length > 0) {
    return config;
  }
  return findConfigFlag(command.parent as Command | undefined);
}

function resolveGitPreference(
  command: Command | null | undefined,
): "enabled" | "disabled" | undefined {
  let cursor: Command | null | undefined = command;
  while (cursor) {
    const opts = typeof cursor.opts === "function" ? cursor.opts() : undefined;
    if (opts) {
      const git = (opts as GitFlag).git;
      if (typeof git === "boolean") {
        return git ? "enabled" : "disabled";
      }
      const noGit = (opts as GitFlag).noGit;
      if (typeof noGit === "boolean") {
        return noGit ? "disabled" : "enabled";
      }
    }
    cursor = cursor.parent as Command | undefined;
  }
  return undefined;
}
