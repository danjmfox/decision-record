#!/usr/bin/env node
import { Command } from "commander";
import {
  acceptDecision,
  createDecision,
  listAll,
  type CreateDecisionOptions,
  type RepoOptions,
} from "../core/service.js";

interface GlobalCliOptions {
  repo?: string;
}

const program = new Command();
program.name("drctl").description("Decision Record CLI").version("0.1.0");

program.option("--repo <repo>", "target repo alias or path");

program
  .command("new <domain> <slug>")
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
      const repoOptions = buildRepoOptions(command);
      const confidence =
        typeof commandOptions.confidence === "number" &&
        Number.isFinite(commandOptions.confidence)
          ? commandOptions.confidence
          : undefined;
      const options: CreateDecisionOptions = { ...repoOptions };
      if (confidence !== undefined) {
        options.confidence = confidence;
      }
      const rec = createDecision(domain, slug, options);
      console.log(`✅ Created ${rec.id} (${rec.status})`);
    }),
  );

program
  .command("list")
  .option("--status <status>", "filter by status")
  .action(
    handleAction(function (
      commandOptions: { status?: string },
      command: Command,
    ) {
      const repoOptions = buildRepoOptions(command);
      const list = listAll(commandOptions.status, repoOptions);
      list.forEach((r) =>
        console.log(`${r.id.padEnd(45)} ${r.status.padEnd(10)} ${r.domain}`),
      );
    }),
  );

program.command("accept <id>").action(
  handleAction(function (id: string, command: Command) {
    const repoOptions = buildRepoOptions(command);
    const rec = acceptDecision(id, repoOptions);
    console.log(`✅ ${rec.id} marked as accepted`);
  }),
);

program.parse();

function buildRepoOptions(command: Command): RepoOptions {
  const opts = command.optsWithGlobals<GlobalCliOptions>();
  const repoOptions: RepoOptions = { cwd: process.cwd() };
  if (opts.repo) {
    repoOptions.repo = opts.repo;
  }
  return repoOptions;
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
