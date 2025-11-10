import { Command } from "commander";
import { diagnoseConfig, type ConfigDiagnostics } from "../config.js";
import { ensureRepoFlagNotUsed } from "./options.js";

type ActionWrapper = <T extends unknown[]>(
  fn: (this: Command, ...args: T) => void | Promise<void>,
) => (...args: T) => void | Promise<void>;

export interface RegisterConfigCommandOptions {
  program: Command;
  handleAction: ActionWrapper;
  reportConfigDiagnostics: (diagnostics: ConfigDiagnostics) => boolean;
}

export function registerConfigCommands({
  program,
  handleAction,
  reportConfigDiagnostics,
}: RegisterConfigCommandOptions): void {
  const configCommand = program
    .command("config")
    .description("Inspect drctl configuration");

  configCommand
    .command("check")
    .description("Validate configuration files and repository paths")
    .action(
      handleAction(function (this: Command) {
        ensureRepoFlagNotUsed(this, "config check");
        const diagnostics = diagnoseConfig({ cwd: process.cwd() });
        const hasErrors = reportConfigDiagnostics(diagnostics);
        if (hasErrors) {
          process.exitCode = 1;
        }
      }),
    );
}
