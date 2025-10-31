#!/usr/bin/env node
import fs from "fs";
import { Command } from "commander";
import {
  acceptDecision,
  createDecision,
  draftDecision,
  proposeDecision,
  listAll,
  resolveContext,
  type CreateDecisionOptions,
  type RepoOptions,
} from "../core/service.js";
import type { RepoContext } from "../config.js";
import { formatRepoContext } from "./repo-format.js";
import { collectRepoOptions, ensureRepoFlagNotUsed } from "./options.js";
import { createRepoEntry } from "./repo-manage.js";

interface GlobalCliOptions {
  repo?: string;
}

const program = new Command();
program.name("drctl").description("Decision Record CLI").version("0.1.0");

program.option("--repo <repo>", "target repo alias or path");

const repoCommand = program
  .command("repo")
  .description("Show or manage repository configuration")
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
      const cwd = process.cwd();
      const repoOptions = {
        cwd,
        name,
        repoPath: root,
        setDefault: Boolean(command.default),
        ...(command.domainDir ? { defaultDomainDir: command.domainDir } : {}),
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

program.parse();

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
