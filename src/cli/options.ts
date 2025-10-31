import type { Command } from "commander";
import type { RepoOptions } from "../core/service.js";

interface RepoFlag {
  repo?: string;
}

export function collectRepoOptions(command: Command): RepoOptions {
  const repoOptions: RepoOptions = { cwd: process.cwd() };
  const repo = findRepoFlag(command);
  if (repo) {
    repoOptions.repo = repo;
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
