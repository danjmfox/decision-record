import fs from "node:fs";
import path from "node:path";
import { Command } from "commander";
import { collectRepoOptions, ensureRepoFlagNotUsed } from "./options.js";
import { createRepoEntry, switchDefaultRepo } from "./repo-manage.js";
import {
  resolveRepoContext,
  type ResolveRepoOptions,
  type RepoContext,
} from "../config.js";
import { initGitRepo } from "../core/git.js";
import type { RepoOptions } from "../core/service.js";

type ActionWrapper = <T extends unknown[]>(
  fn: (this: Command, ...args: T) => void | Promise<void>,
) => (...args: T) => void | Promise<void>;

type ResolveRepoOptionsFn = (
  command: Command,
) => RepoOptions & { context: RepoContext };

export interface RegisterRepoCommandOptions {
  program: Command;
  handleAction: ActionWrapper;
  resolveRepoOptions: ResolveRepoOptionsFn;
  logRepo: (context: RepoContext) => void;
}

export function registerRepoCommands({
  program,
  handleAction,
  resolveRepoOptions,
  logRepo,
}: RegisterRepoCommandOptions): void {
  const repoCommand = new Command("repo")
    .description("Show or manage repository configuration")
    .action(
      handleAction(function (this: Command) {
        this.outputHelp();
        const repoOptions = resolveRepoOptions(this);
        logRepo(repoOptions.context);
      }),
    );

  repoCommand.addHelpText(
    "after",
    "\nTip: Use --config <path> or DRCTL_CONFIG to target a specific .drctl.yaml when running repo commands.\n",
  );

  repoCommand
    .command("show")
    .description("Display resolved repository context")
    .action(
      handleAction(function (this: Command) {
        const repoOptions = resolveRepoOptions(this);
        logRepo(repoOptions.context);
      }),
    );

  repoCommand
    .command("new <name> <root>")
    .description("Add a repository entry to the nearest .drctl.yaml")
    .option("--default", "mark the new repo as the default")
    .option(
      "--domain-dir <dir>",
      "relative path to the folder where domain directories live",
    )
    .action(
      handleAction(function (
        this: Command,
        name: string,
        root: string,
        command: Command & { default?: boolean; domainDir?: string },
      ) {
        ensureRepoFlagNotUsed(this, "repo new");
        const globalOptions = collectRepoOptions(this);
        const cwd = process.cwd();
        const repoOptions = {
          cwd,
          name,
          repoPath: root,
          setDefault: Boolean(command.default),
          ...(command.domainDir ? { defaultDomainDir: command.domainDir } : {}),
          ...(globalOptions.configPath
            ? { configPath: globalOptions.configPath }
            : {}),
        } satisfies Parameters<typeof createRepoEntry>[0];
        const result = createRepoEntry(repoOptions);
        fs.mkdirSync(result.repoRoot, { recursive: true });
        console.log(`🆕 Added repo "${name}" → ${root}`);
        if (command.domainDir) {
          console.log(`   Domain directory: ${command.domainDir}`);
        }
        if (command.default) {
          console.log("   Marked as default repo");
        }
        console.log(`📝 Updated config: ${result.configPath}`);
      }),
    );

  repoCommand
    .command("bootstrap <name>")
    .description("Initialise git for a configured repository")
    .action(
      handleAction(async function (this: Command, name: string) {
        ensureRepoFlagNotUsed(this, "repo bootstrap");
        const globalOptions = collectRepoOptions(this);
        const resolveOptions: ResolveRepoOptions = {
          repoFlag: name,
          ...(globalOptions.cwd ? { cwd: globalOptions.cwd } : {}),
        };
        if (globalOptions.configPath !== undefined) {
          resolveOptions.configPath = globalOptions.configPath;
        }
        const context = resolveRepoContext(resolveOptions);
        logRepo(context);
        fs.mkdirSync(context.root, { recursive: true });
        const alreadyInitialised = fs.existsSync(
          path.join(context.root, ".git"),
        );
        if (alreadyInitialised) {
          console.log(`✅ Git already initialised at ${context.root}`);
          return;
        }
        await initGitRepo(context.root);
        console.log(`✅ Initialised git repository at ${context.root}`);
      }),
    );

  repoCommand
    .command("switch <name>")
    .description("Set the default repository alias")
    .action(
      handleAction(function (this: Command, name: string) {
        ensureRepoFlagNotUsed(this, "repo switch");
        const globalOptions = collectRepoOptions(this);
        const cwd = globalOptions.cwd ?? process.cwd();
        const result = switchDefaultRepo({
          cwd,
          name,
          ...(globalOptions.configPath
            ? { configPath: globalOptions.configPath }
            : {}),
        });
        console.log(`⭐ Default repo switched to ${result.defaultRepo}`);
        const context = resolveRepoContext({
          ...(globalOptions.configPath
            ? { configPath: globalOptions.configPath }
            : {}),
          cwd,
        });
        logRepo(context);
      }),
    );

  program.addCommand(repoCommand);
}
