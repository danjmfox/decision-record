import fs from "node:fs";
import { Command } from "commander";
import { validateRepository } from "../core/governance.js";
import type { RepoContext } from "../config.js";
import type { RepoOptions } from "../core/service.js";

type RepoActionFactory = <T extends unknown[]>(
  fn: (
    this: Command,
    repoOptions: RepoOptions & { context: RepoContext },
    ...args: T
  ) => void | Promise<void>,
) => (...args: T) => void | Promise<void>;

export interface RegisterGovernanceCommandOptions {
  program: Command;
  createRepoAction: RepoActionFactory;
}

export function registerGovernanceCommands({
  program,
  createRepoAction,
}: RegisterGovernanceCommandOptions): void {
  const governanceCommand = program
    .command("governance")
    .description("Governance utilities");

  governanceCommand
    .command("validate")
    .description("Validate decision records in the current repository")
    .option("--json", "output diagnostics as JSON")
    .action(
      createRepoAction(function (repoOptions, command: { json?: boolean }) {
        if (!fs.existsSync(repoOptions.context.root)) {
          console.error(
            `❌ Repo root "${repoOptions.context.root}" does not exist. Adjust your configuration or recreate the repository before running governance validation.`,
          );
          process.exitCode = 1;
          return;
        }
        const issues = validateRepository(repoOptions.context);
        const errorCount = issues.filter(
          (issue) => issue.severity === "error",
        ).length;
        const warningCount = issues.filter(
          (issue) => issue.severity === "warning",
        ).length;

        if (command.json) {
          console.log(
            JSON.stringify(
              {
                repo: repoOptions.context.name ?? null,
                issues,
              },
              null,
              2,
            ),
          );
        } else if (issues.length === 0) {
          console.log("✅ Governance validation passed (no issues).\n");
        } else {
          console.log(
            `Governance validation: ${issues.length} issue(s) (${errorCount} error(s), ${warningCount} warning(s))`,
          );
          for (const issue of issues) {
            const severityIcon = issue.severity === "error" ? "❌" : "⚠️";
            console.log(
              `${severityIcon} [${issue.severity.toUpperCase()}] ${issue.recordId} ${issue.code} – ${issue.message}`,
            );
            if (issue.filePath) {
              console.log(`   ↳ ${issue.filePath}`);
            }
          }
        }

        if (errorCount > 0) {
          process.exitCode = 1;
        }
      }),
    );
}
