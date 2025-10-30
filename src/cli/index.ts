#!/usr/bin/env node
import { Command } from "commander";
import {
  acceptDecision,
  createDecision,
  listAll,
  resolveContext,
  type CreateDecisionOptions,
  type RepoOptions,
} from "../core/service.js";
import type { RepoContext } from "../config.js";
import { formatRepoContext } from "./repo-format.js";
import { collectRepoOptions } from "./options.js";

interface GlobalCliOptions {
  repo?: string;
}

const program = new Command();
program.name("drctl").description("Decision Record CLI").version("0.1.0");

program.option("--repo <repo>", "target repo alias or path");

program
  .command("repo")
  .description("Show the resolved repository context")
  .action(
    handleAction(function (command: Command) {
      const repoOptions = resolveRepoOptions(command);
      logRepo(repoOptions.context);
    }),
  );

program
  .command("new <domain> <slug>")
  .description("Create a new decision record for the given domain and slug")
  .option("--confidence <n>", "initial confidence", (value) =>
    Number.parseFloat(value),
  )
  .action(
    handleAction(function (
      domain: string,
      slug: string,
      commandOptions: { confidence?: number },
      command: Command,
    ) {
      const repoOptions = resolveRepoOptions(command);
      logRepo(repoOptions.context);
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
    handleAction(function (
      commandOptions: { status?: string },
      command: Command,
    ) {
      const repoOptions = resolveRepoOptions(command);
      logRepo(repoOptions.context);
      const list = listAll(commandOptions.status, repoOptions);
      list.forEach((r) =>
        console.log(`${r.id.padEnd(45)} ${r.status.padEnd(10)} ${r.domain}`),
      );
    }),
  );

program
  .command("accept <id>")
  .description("Mark a decision as accepted and update its changelog")
  .action(
    handleAction(function (id: string, command: Command) {
      const repoOptions = resolveRepoOptions(command);
      logRepo(repoOptions.context);
      const result = acceptDecision(id, repoOptions);
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
