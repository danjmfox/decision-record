#!/usr/bin/env node
import fs from "fs";
import path from "path";
import { Command } from "commander";
import {
  acceptDecision,
  correctionDecision,
  createDecision,
  draftDecision,
  proposeDecision,
  listAll,
  rejectDecision,
  deprecateDecision,
  supersedeDecision,
  reviseDecision,
  resolveContext,
  type CreateDecisionOptions,
  type RepoOptions,
} from "../core/service.js";
import {
  diagnoseConfig,
  resolveRepoContext,
  type RepoContext,
} from "../config.js";
import { formatRepoContext } from "./repo-format.js";
import { collectRepoOptions, ensureRepoFlagNotUsed } from "./options.js";
import { createRepoEntry, switchDefaultRepo } from "./repo-manage.js";
import { initGitRepo } from "../core/git.js";
import { generateIndex } from "../core/indexer.js";

interface GlobalCliOptions {
  repo?: string;
}

const program = new Command();
program.name("drctl").description("Decision Record CLI").version("0.1.0");

program.option("--repo <repo>", "target repo alias or path");
program.option("--config <config>", "path to drctl configuration file");

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
    createRepoAction(function () {
      // Repo context already logged by middleware.
    }),
  );

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
      console.log(`🧭 Working directory: ${diagnostics.cwd}`);
      console.log(
        `📄 Local config: ${diagnostics.localConfigPath ?? "not found"}`,
      );
      console.log(
        `🏠 Global config: ${diagnostics.globalConfigPath ?? "not found"}`,
      );
      console.log(
        `⭐ Default repo: ${diagnostics.defaultRepoName ?? "(not set)"}`,
      );

      if (diagnostics.repos.length > 0) {
        console.log("📚 Repositories:");
        for (const repo of diagnostics.repos) {
          const status = repo.exists ? "✅" : "⚠️";
          const sourceLabel =
            repo.definitionSource === "local"
              ? "local-config"
              : "global-config";
          const gitLabel = repo.exists
            ? repo.gitInitialized
              ? "git: initialised"
              : "git: not initialised"
            : "git: n/a";
          console.log(
            `   ${status} ${repo.name} → ${repo.root} (${sourceLabel}, ${gitLabel})`,
          );
        }
      } else {
        console.log("📚 Repositories: none");
      }

      for (const warning of diagnostics.warnings) {
        console.warn(`⚠️ ${warning}`);
      }
      for (const error of diagnostics.errors) {
        console.error(`❌ ${error}`);
      }

      if (
        diagnostics.errors.length === 0 &&
        diagnostics.warnings.length === 0
      ) {
        console.log("✅ Configuration looks good.");
      }

      if (diagnostics.errors.length > 0) {
        process.exitCode = 1;
      }
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
      const context = resolveRepoContext({
        repoFlag: name,
        cwd: globalOptions.cwd,
        ...(globalOptions.configPath
          ? { configPath: globalOptions.configPath }
          : {}),
      });
      logRepo(context);
      fs.mkdirSync(context.root, { recursive: true });
      const alreadyInitialised = fs.existsSync(path.join(context.root, ".git"));
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
      const cwd = globalOptions.cwd;
      const result = switchDefaultRepo({
        cwd,
        name,
        ...(globalOptions.configPath
          ? { configPath: globalOptions.configPath }
          : {}),
      });
      console.log(`⭐ Default repo switched to ${result.defaultRepo}`);
      const context = resolveRepoContext({
        cwd,
        ...(globalOptions.configPath
          ? { configPath: globalOptions.configPath }
          : {}),
      });
      logRepo(context);
    }),
  );

program.addCommand(repoCommand);

program
  .command("index")
  .description("Generate a markdown index for the current repository")
  .action(
    createRepoAction(function (repoOptions) {
      const { filePath } = generateIndex(repoOptions.context);
      console.log(`📑 Generated index: ${filePath}`);
    }),
  );

program
  .command("new <domain> <slug>")
  .description("Create a new decision record for the given domain and slug")
  .option("--confidence <n>", "initial confidence", (value) =>
    Number.parseFloat(value),
  )
  .action(
    createRepoAction(function (
      repoOptions,
      domain: string,
      slug: string,
      commandOptions: { confidence?: number },
    ) {
      const confidence =
        typeof commandOptions.confidence === "number" &&
        Number.isFinite(commandOptions.confidence)
          ? commandOptions.confidence
          : undefined;
      const options: CreateDecisionOptions = { ...repoOptions };
      if (confidence !== undefined) {
        options.confidence = confidence;
      }
      const result = createDecision(domain, slug, options);
      console.log(`✅ Created ${result.record.id} (${result.record.status})`);
      console.log(`📄 File: ${result.filePath}`);
    }),
  );

program
  .command("correction <id>")
  .description("Apply a minor correction (patch version) to a decision")
  .option("--note <note>", "changelog note to record")
  .action(
    createRepoAction(async function (
      repoOptions,
      id: string,
      command: { note?: string },
    ) {
      const result = await correctionDecision(id, {
        ...repoOptions,
        ...(command.note ? { note: command.note } : {}),
      });
      console.log(
        `🛠️ ${result.record.id} corrected (v${result.record.version})`,
      );
      console.log(`📄 File: ${result.filePath}`);
    }),
  );

program
  .command("revise <id>")
  .description("Apply a revision (minor version) to a decision")
  .option("--note <note>", "changelog note to record")
  .option("--confidence <value>", "update confidence", (value) =>
    Number.parseFloat(value),
  )
  .action(
    createRepoAction(async function (
      repoOptions,
      id: string,
      command: { note?: string; confidence?: number },
    ) {
      const confidenceOption =
        typeof command.confidence === "number" &&
        Number.isFinite(command.confidence)
          ? { confidence: command.confidence }
          : {};
      const result = await reviseDecision(id, {
        ...repoOptions,
        ...(command.note ? { note: command.note } : {}),
        ...confidenceOption,
      });
      console.log(`📝 ${result.record.id} revised (v${result.record.version})`);
      console.log(`📄 File: ${result.filePath}`);
    }),
  );

program
  .command("list")
  .description("List decision records, optionally filtered by status")
  .option("--status <status>", "filter by status")
  .action(
    createRepoAction(function (
      repoOptions,
      commandOptions: { status?: string },
    ) {
      const list = listAll(commandOptions.status, repoOptions);
      list.forEach((r) =>
        console.log(`${r.id.padEnd(45)} ${r.status.padEnd(10)} ${r.domain}`),
      );
    }),
  );

program
  .command("draft <id>")
  .description("Mark a decision as draft and commit the changes")
  .action(
    createRepoAction(async function (repoOptions, id: string) {
      const result = await draftDecision(id, {
        ...repoOptions,
      });
      console.log(`✏️ ${result.record.id} saved as draft`);
      console.log(`📄 File: ${result.filePath}`);
    }),
  );

program
  .command("propose <id>")
  .description("Mark a decision as proposed and commit the changes")
  .action(
    createRepoAction(async function (repoOptions, id: string) {
      const result = await proposeDecision(id, {
        ...repoOptions,
      });
      console.log(`📤 ${result.record.id} proposed`);
      console.log(`📄 File: ${result.filePath}`);
    }),
  );

program
  .command("accept <id>")
  .description("Mark a decision as accepted and update its changelog")
  .action(
    createRepoAction(async function (repoOptions, id: string) {
      const result = await acceptDecision(id, { ...repoOptions });
      console.log(`✅ ${result.record.id} marked as accepted`);
      console.log(`📄 File: ${result.filePath}`);
    }),
  );

program
  .command("reject <id>")
  .description("Mark a decision as rejected and commit the change")
  .action(
    createRepoAction(async function (repoOptions, id: string) {
      const result = await rejectDecision(id, { ...repoOptions });
      console.log(`🚫 ${result.record.id} marked as rejected`);
      console.log(`📄 File: ${result.filePath}`);
    }),
  );

program
  .command("deprecate <id>")
  .description("Mark a decision as deprecated and commit the change")
  .action(
    createRepoAction(async function (repoOptions, id: string) {
      const result = await deprecateDecision(id, { ...repoOptions });
      console.log(`⚠️ ${result.record.id} marked as deprecated`);
      console.log(`📄 File: ${result.filePath}`);
    }),
  );

program
  .command("supersede <oldId> <newId>")
  .description("Mark an existing decision as superseded by another")
  .action(
    createRepoAction(async function (
      repoOptions,
      oldId: string,
      newId: string,
    ) {
      const result = await supersedeDecision(oldId, newId, {
        ...repoOptions,
      });
      console.log(
        `🔁 ${result.record.id} superseded by ${result.newRecord.id}`,
      );
      console.log(`📄 Updated: ${result.filePath}`);
      console.log(`📄 Updated: ${result.newFilePath}`);
    }),
  );

function resolveRepoOptions(
  command: Command,
): RepoOptions & { context: RepoContext } {
  const repoOptions = collectRepoOptions(command);
  const context = resolveContext(repoOptions);
  return { ...repoOptions, context };
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

await program.parseAsync();
