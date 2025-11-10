#!/usr/bin/env node
import path from "node:path";
import { Command } from "commander";
import packageJson from "../../package.json" with { type: "json" };
import { resolveContext, type RepoOptions } from "../core/service.js";
import {
  type ConfigDiagnostics,
  type RepoContext,
  type RepoDiagnostic,
} from "../config.js";
import { formatRepoContext } from "./repo-format.js";
import { collectRepoOptions } from "./options.js";
import { registerDecisionCommands } from "./decision-command.js";
import { registerRepoCommands } from "./repo-command.js";
import { registerConfigCommands } from "./config-command.js";
import { registerGovernanceCommands } from "./governance-command.js";

interface GlobalCliOptions {
  repo?: string;
  git?: boolean;
  noGit?: boolean;
}

const packageVersion =
  typeof packageJson.version === "string" ? packageJson.version : "0.0.0";

const program = new Command();
program
  .name("drctl")
  .description("Decision Record CLI")
  .version(packageVersion);

program.option("--repo <repo>", "target repo alias or path");
program.option("--config <config>", "path to drctl configuration file");
program.option("--git", "force git-backed lifecycle commands (default: auto)");
program.option("--no-git", "disable git integration for lifecycle commands");

export { legacyWarningTest as __legacyWarningTest } from "./decision-command.js";

export function reportConfigDiagnostics(
  diagnostics: ConfigDiagnostics,
): boolean {
  logConfigSummary(diagnostics);
  logRepositoryList(diagnostics.repos);
  const hasWarnings = diagnostics.warnings.length > 0;
  const hasErrors = diagnostics.errors.length > 0;
  for (const warning of diagnostics.warnings) {
    console.warn(`⚠️ ${warning}`);
  }
  for (const error of diagnostics.errors) {
    console.error(`❌ ${error}`);
  }
  if (!hasErrors && !hasWarnings) {
    console.log("✅ Configuration looks good.");
  }
  return hasErrors;
}

function logConfigSummary(diagnostics: ConfigDiagnostics): void {
  console.log(`🧭 Working directory: ${diagnostics.cwd}`);
  console.log(`📄 Local config: ${diagnostics.localConfigPath ?? "not found"}`);
  console.log(
    `🏠 Global config: ${diagnostics.globalConfigPath ?? "not found"}`,
  );
  console.log(`⭐ Default repo: ${diagnostics.defaultRepoName ?? "(not set)"}`);
}

function logRepositoryList(repos: RepoDiagnostic[]): void {
  if (repos.length === 0) {
    console.log("📚 Repositories: none");
    return;
  }
  console.log("📚 Repositories:");
  for (const repo of repos) {
    logRepositoryEntry(repo);
  }
}

function logRepositoryEntry(repo: RepoDiagnostic): void {
  const status = repo.exists ? "✅" : "⚠️";
  const sourceLabel =
    repo.definitionSource === "local" ? "local-config" : "global-config";
  let gitLabel = "git: n/a";
  if (repo.exists) {
    if (repo.gitMode === "disabled" && repo.gitModeSource !== "detected") {
      gitLabel = `git: disabled (${repo.gitModeSource})`;
    } else {
      gitLabel = repo.gitInitialized
        ? "git: initialised"
        : "git: not initialised";
    }
  }
  console.log(
    `   ${status} ${repo.name} → ${repo.root} (${sourceLabel}, ${gitLabel})`,
  );
  if (repo.defaultDomainDir) {
    console.log(`      Domain root: ${repo.defaultDomainDir}`);
  }
  if (repo.defaultTemplate) {
    console.log(`      Template: ${repo.defaultTemplate}`);
  }
  if (repo.gitRoot) {
    const normalizedRepoRoot = path.normalize(repo.root);
    const normalizedGitRoot = path.normalize(repo.gitRoot);
    const suffix =
      normalizedGitRoot === normalizedRepoRoot ? "" : " (inherited)";
    console.log(`      Git root: ${normalizedGitRoot}${suffix}`);
  }
}

function resolveRepoOptions(
  command: Command,
): RepoOptions & { context: RepoContext } {
  const repoOptions = collectRepoOptions(command);
  const context = resolveContext(repoOptions);
  const merged: RepoOptions & { context: RepoContext } = {
    ...repoOptions,
    context,
  };
  if (!merged.onGitDisabled) {
    let notified = false;
    merged.onGitDisabled = ({ context: ctx }) => {
      /* c8 ignore next -- handler suppresses duplicate notifications */
      if (notified) return;
      notified = true;
      const label = ctx.name ? `repo "${ctx.name}"` : ctx.root;
      console.log(
        `ℹ️ Git disabled for ${label}; lifecycle commands leave changes unstaged.`,
      );
    };
  }
  return merged;
}

function handleAction<T extends unknown[]>(
  fn: (this: Command, ...args: T) => void | Promise<void>,
) {
  return async function (this: Command, ...args: T) {
    try {
      await fn.apply(this, args);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unexpected error occurred";
      console.error(`❌ ${message}`);
      process.exitCode = 1;
    }
  };
}

function logRepo(context: RepoContext): void {
  const lines = formatRepoContext(context);
  for (const line of lines) {
    console.log(line);
  }
}

function createRepoAction<T extends unknown[]>(
  fn: (
    this: Command,
    repoOptions: RepoOptions & { context: RepoContext },
    ...args: T
  ) => void | Promise<void>,
) {
  return handleAction(function (this: Command, ...args: T) {
    const repoOptions = resolveRepoOptions(this);
    logRepo(repoOptions.context);
    return fn.apply(this, [repoOptions, ...args]);
  });
}

registerRepoCommands({
  program,
  handleAction,
  resolveRepoOptions,
  logRepo,
});

registerConfigCommands({
  program,
  handleAction,
  reportConfigDiagnostics,
});

registerGovernanceCommands({
  program,
  createRepoAction,
});

registerDecisionCommands({ program, createRepoAction });

if (process.env.DRCTL_SKIP_PARSE !== "1") {
  await program.parseAsync();
}
