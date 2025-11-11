import fs from "node:fs";
import { Command } from "commander";
import {
  acceptDecision,
  correctionDecision,
  createDecision,
  deprecateDecision,
  draftDecision,
  listAll,
  proposeDecision,
  rejectDecision,
  retireDecision,
  reviewDecision,
  reviseDecision,
  supersedeDecision,
  type CreateDecisionOptions,
  type RepoOptions,
} from "../core/service.js";
import { generateIndex, type GenerateIndexOptions } from "../core/indexer.js";
import type {
  DecisionStatus,
  ReviewOutcome,
  ReviewType,
} from "../core/models.js";
import type { RepoContext } from "../config.js";

type RepoActionFactory = <T extends unknown[]>(
  fn: (
    this: Command,
    repoOptions: RepoOptions & { context: RepoContext },
    ...args: T
  ) => void | Promise<void>,
) => (...args: T) => void | Promise<void>;

interface DecisionCommandOptions {
  program: Command;
  createRepoAction: RepoActionFactory;
}

interface ReviewCommandOptions {
  type?: string;
  outcome?: string;
  note?: string;
  reviewer?: string;
}

const legacyDecisionWarningsShown = new Set<string>();

function emitLegacyDecisionWarning(legacyName: string, newPath: string): void {
  /* c8 ignore next -- exercised only when a legacy command repeats in one run */
  if (legacyDecisionWarningsShown.has(legacyName)) return;
  legacyDecisionWarningsShown.add(legacyName);
  console.warn(
    `⚠️ The "${legacyName}" command is moving under "${newPath}". Update scripts to use the new form; this top-level command will be removed in a future release.`,
  );
}

type DecisionHandler<T extends unknown[]> = (
  repoOptions: RepoOptions & { context: RepoContext },
  ...args: T
) => void | Promise<void>;

function createDecisionAction<T extends unknown[]>(
  createRepoAction: RepoActionFactory,
  handler: DecisionHandler<T>,
) {
  return createRepoAction(async function (
    this: Command,
    repoOptions,
    ...args: T
  ) {
    await handler.apply(this, [repoOptions, ...args]);
  });
}

function createLegacyDecisionAction<T extends unknown[]>(
  createRepoAction: RepoActionFactory,
  legacyName: string,
  newSubcommand: string,
  handler: DecisionHandler<T>,
) {
  const action = createDecisionAction(
    createRepoAction,
    async (repoOptions, ...args: T) => {
      emitLegacyDecisionWarning(legacyName, `drctl decision ${newSubcommand}`);
      await handler(repoOptions, ...args);
    },
  );
  return action;
}

export function registerDecisionCommands({
  program,
  createRepoAction,
}: DecisionCommandOptions): void {
  const decisionCommand = new Command("decision")
    .alias("dr")
    .description("Manage decision records and lifecycle operations");

  const decisionAction = <T extends unknown[]>(handler: DecisionHandler<T>) =>
    createDecisionAction(createRepoAction, handler);

  applyIndexOptions(
    decisionCommand
      .command("index")
      .description("Generate a markdown index for the current repository"),
  ).action(decisionAction(handleGenerateIndex));

  decisionCommand
    .command("new <domain> <slug>")
    .description("Create a new decision record for the given domain and slug")
    .option("--confidence <n>", "initial confidence", (value) =>
      Number.parseFloat(value),
    )
    .option(
      "--template <path>",
      "path to a markdown template (overrides config/env defaults)",
    )
    .action(decisionAction(handleDecisionNew));

  decisionCommand
    .command("correction <id>")
    .alias("correct")
    .description("Apply a minor correction (patch version) to a decision")
    .option("--note <note>", "changelog note to record")
    .action(decisionAction(handleDecisionCorrection));

  decisionCommand
    .command("revise <id>")
    .description("Apply a revision (minor version) to a decision")
    .option("--note <note>", "changelog note to record")
    .option("--confidence <value>", "update confidence", (value) =>
      Number.parseFloat(value),
    )
    .action(decisionAction(handleDecisionRevise));

  decisionCommand
    .command("review <id>")
    .description("Record a review event for a decision")
    .option("--type <value>", "review type (scheduled|adhoc|contextual)")
    .option(
      "--outcome <value>",
      "review outcome (keep|revise|retire|supersede)",
    )
    .option("--note <note>", "reason to capture alongside the review")
    .option(
      "--reviewer <name>",
      "override the reviewer metadata (defaults to environment)",
    )
    .action(decisionAction(handleDecisionReview));

  decisionCommand
    .command("list")
    .description("List decision records, optionally filtered by status")
    .option("--status <status>", "filter by status")
    .action(decisionAction(handleDecisionList));

  decisionCommand
    .command("draft <id>")
    .description("Mark a decision as draft and commit the changes")
    .action(decisionAction(handleDecisionDraft));

  decisionCommand
    .command("propose <id>")
    .description("Mark a decision as proposed and commit the changes")
    .action(decisionAction(handleDecisionPropose));

  decisionCommand
    .command("accept <id>")
    .description("Mark a decision as accepted and update its changelog")
    .action(decisionAction(handleDecisionAccept));

  decisionCommand
    .command("reject <id>")
    .description("Mark a decision as rejected and commit the change")
    .action(decisionAction(handleDecisionReject));

  decisionCommand
    .command("deprecate <id>")
    .description("Mark a decision as deprecated and commit the change")
    .action(decisionAction(handleDecisionDeprecate));

  decisionCommand
    .command("retire <id>")
    .description("Retire a decision and commit the change")
    .action(decisionAction(handleDecisionRetire));

  decisionCommand
    .command("supersede <oldId> <newId>")
    .description("Mark an existing decision as superseded by another")
    .action(decisionAction(handleDecisionSupersede));

  program.addCommand(decisionCommand);

  applyIndexOptions(
    program
      .command("index")
      .description("Generate a markdown index for the current repository"),
  ).action(decisionAction(handleGenerateIndex));

  const legacyAction = <T extends unknown[]>(
    legacyName: string,
    subcommand: string,
    handler: DecisionHandler<T>,
  ) =>
    createLegacyDecisionAction(
      createRepoAction,
      legacyName,
      subcommand,
      handler,
    );

  program
    .command("new <domain> <slug>", { hidden: true })
    .description("Create a new decision record for the given domain and slug")
    .option("--confidence <n>", "initial confidence", (value) =>
      Number.parseFloat(value),
    )
    .option(
      "--template <path>",
      "path to a markdown template (overrides config/env defaults)",
    )
    .action(legacyAction("new", "new", handleDecisionNew));

  program
    .command("correction <id>", { hidden: true })
    .alias("correct")
    .description("Apply a minor correction (patch version) to a decision")
    .option("--note <note>", "changelog note to record")
    .action(legacyAction("correction", "correction", handleDecisionCorrection));

  program
    .command("revise <id>", { hidden: true })
    .description("Apply a revision (minor version) to a decision")
    .option("--note <note>", "changelog note to record")
    .option("--confidence <value>", "update confidence", (value) =>
      Number.parseFloat(value),
    )
    .action(legacyAction("revise", "revise", handleDecisionRevise));

  program
    .command("list", { hidden: true })
    .description("List decision records, optionally filtered by status")
    .option("--status <status>", "filter by status")
    .action(legacyAction("list", "list", handleDecisionList));

  program
    .command("draft <id>", { hidden: true })
    .description("Mark a decision as draft and commit the changes")
    .action(legacyAction("draft", "draft", handleDecisionDraft));

  program
    .command("propose <id>", { hidden: true })
    .description("Mark a decision as proposed and commit the changes")
    .action(legacyAction("propose", "propose", handleDecisionPropose));

  program
    .command("accept <id>", { hidden: true })
    .description("Mark a decision as accepted and update its changelog")
    .action(legacyAction("accept", "accept", handleDecisionAccept));

  program
    .command("reject <id>", { hidden: true })
    .description("Mark a decision as rejected and commit the change")
    .action(legacyAction("reject", "reject", handleDecisionReject));

  program
    .command("deprecate <id>", { hidden: true })
    .description("Mark a decision as deprecated and commit the change")
    .action(legacyAction("deprecate", "deprecate", handleDecisionDeprecate));

  program
    .command("retire <id>", { hidden: true })
    .description("Retire a decision and commit the change")
    .action(legacyAction("retire", "retire", handleDecisionRetire));

  program
    .command("supersede <oldId> <newId>", { hidden: true })
    .description("Mark an existing decision as superseded by another")
    .action(legacyAction("supersede", "supersede", handleDecisionSupersede));
}

export const legacyWarningTest = {
  emitLegacyDecisionWarning,
  legacyDecisionWarningsShown,
};

function handleDecisionNew(
  repoOptions: RepoOptions & { context: RepoContext },
  domain: string,
  slug: string,
  commandOptions: { confidence?: number; template?: string },
): void {
  const confidence =
    typeof commandOptions.confidence === "number" &&
    Number.isFinite(commandOptions.confidence)
      ? commandOptions.confidence
      : undefined;
  const options: CreateDecisionOptions = { ...repoOptions };
  if (confidence !== undefined) {
    options.confidence = confidence;
  }
  if (
    typeof commandOptions.template === "string" &&
    commandOptions.template.trim().length > 0
  ) {
    options.templatePath = commandOptions.template;
  }
  const envTemplate = process.env.DRCTL_TEMPLATE;
  if (typeof envTemplate === "string" && envTemplate.trim().length > 0) {
    options.envTemplate = envTemplate;
  }
  const result = createDecision(domain, slug, options);
  console.log(`✅ Created ${result.record.id} (${result.record.status})`);
  console.log(`📄 File: ${result.filePath}`);
  if (result.record.templateUsed) {
    console.log(`🧩 Template: ${result.record.templateUsed}`);
  }
}

async function handleDecisionCorrection(
  repoOptions: RepoOptions & { context: RepoContext },
  id: string,
  command: { note?: string },
): Promise<void> {
  const result = await correctionDecision(id, {
    ...repoOptions,
    ...(command.note ? { note: command.note } : {}),
  });
  console.log(`🛠️ ${result.record.id} corrected (v${result.record.version})`);
  console.log(`📄 File: ${result.filePath}`);
}

async function handleDecisionRevise(
  repoOptions: RepoOptions & { context: RepoContext },
  id: string,
  command: { note?: string; confidence?: number },
): Promise<void> {
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
  console.log("🧾 Review: adhoc → revise (override via drctl decision review)");
}

async function handleDecisionReview(
  repoOptions: RepoOptions & { context: RepoContext },
  id: string,
  command: ReviewCommandOptions,
): Promise<void> {
  const reviewType = parseReviewType(command.type);
  const outcome = parseReviewOutcome(command.outcome);
  const note =
    typeof command.note === "string" && command.note.trim().length > 0
      ? command.note
      : undefined;
  const reviewer =
    typeof command.reviewer === "string" && command.reviewer.trim().length > 0
      ? command.reviewer
      : undefined;

  const result = await reviewDecision(id, {
    ...repoOptions,
    ...(reviewType ? { reviewType } : {}),
    ...(outcome ? { outcome } : {}),
    ...(note ? { note } : {}),
    ...(reviewer ? { reviewer } : {}),
  });

  console.log(
    `🧾 ${result.record.id} reviewed (${result.reviewEntry.type} → ${result.reviewEntry.outcome})`,
  );
  console.log(`📄 File: ${result.filePath}`);
  if (result.record.reviewDate) {
    console.log(`📆 Next review: ${result.record.reviewDate}`);
  }
}

function handleDecisionList(
  repoOptions: RepoOptions & { context: RepoContext },
  commandOptions: { status?: string },
): void {
  const records = listAll(commandOptions.status, repoOptions);
  for (const record of records) {
    console.log(
      `${record.id.padEnd(45)} ${record.status.padEnd(10)} ${record.domain}`,
    );
  }
}

async function handleDecisionDraft(
  repoOptions: RepoOptions & { context: RepoContext },
  id: string,
): Promise<void> {
  const result = await draftDecision(id, { ...repoOptions });
  console.log(`✏️ ${result.record.id} saved as draft`);
  console.log(`📄 File: ${result.filePath}`);
}

async function handleDecisionPropose(
  repoOptions: RepoOptions & { context: RepoContext },
  id: string,
): Promise<void> {
  const options = {
    ...repoOptions,
    onTemplateWarning:
      repoOptions.onTemplateWarning ??
      ((message: string) => console.warn(message)),
  };
  const result = await proposeDecision(id, options);
  console.log(`📤 ${result.record.id} proposed`);
  console.log(`📄 File: ${result.filePath}`);
}

async function handleDecisionAccept(
  repoOptions: RepoOptions & { context: RepoContext },
  id: string,
): Promise<void> {
  const options = {
    ...repoOptions,
    onTemplateWarning:
      repoOptions.onTemplateWarning ??
      ((message: string) => console.warn(message)),
  };
  const result = await acceptDecision(id, options);
  console.log(`✅ ${result.record.id} marked as accepted`);
  console.log(`📄 File: ${result.filePath}`);
}

async function handleDecisionReject(
  repoOptions: RepoOptions & { context: RepoContext },
  id: string,
): Promise<void> {
  const result = await rejectDecision(id, { ...repoOptions });
  console.log(`🚫 ${result.record.id} marked as rejected`);
  console.log(`📄 File: ${result.filePath}`);
}

async function handleDecisionDeprecate(
  repoOptions: RepoOptions & { context: RepoContext },
  id: string,
): Promise<void> {
  const result = await deprecateDecision(id, { ...repoOptions });
  console.log(`⚠️ ${result.record.id} marked as deprecated`);
  console.log(`📄 File: ${result.filePath}`);
}

async function handleDecisionRetire(
  repoOptions: RepoOptions & { context: RepoContext },
  id: string,
): Promise<void> {
  const result = await retireDecision(id, { ...repoOptions });
  console.log(`🪦 ${result.record.id} marked as retired`);
  console.log(`📄 File: ${result.filePath}`);
  console.log("🧾 Review: adhoc → retire (override via drctl decision review)");
}

async function handleDecisionSupersede(
  repoOptions: RepoOptions & { context: RepoContext },
  oldId: string,
  newId: string,
): Promise<void> {
  const result = await supersedeDecision(oldId, newId, {
    ...repoOptions,
  });
  console.log(`🔁 ${result.record.id} superseded by ${result.newRecord.id}`);
  console.log(`📄 Updated: ${result.filePath}`);
  console.log(`📄 Updated: ${result.newFilePath}`);
  console.log(
    "🧾 Review: adhoc → supersede (override via drctl decision review)",
  );
}

async function handleGenerateIndex(
  this: Command,
  repoOptions: RepoOptions & { context: RepoContext },
): Promise<void> {
  if (!fs.existsSync(repoOptions.context.root)) {
    console.error(
      `❌ Repo root "${repoOptions.context.root}" does not exist. Adjust your configuration or recreate the repository before running this command.`,
    );
    process.exitCode = 1;
    return;
  }
  const cliOptions = resolveIndexOptions(this);
  const { filePath } = generateIndex(repoOptions.context, cliOptions);
  console.log(`📑 Generated index: ${filePath}`);
}

function applyIndexOptions(command: Command): Command {
  return command
    .option("--output <file>", "write the index to a custom file path")
    .option("--title <title>", "override the generated index title")
    .option(
      "--status <status...>",
      "limit contents to one or more lifecycle statuses (repeat flag as needed)",
    )
    .option(
      "--upcoming <days>",
      "show review reminders for decisions due within <days> (default: 30)",
      (value: string) => Number.parseInt(value, 10),
    )
    .option("--no-kanban", "omit the Kanban-style status summary");
}

interface IndexCommandOptions {
  output?: string;
  title?: string;
  status?: string[] | string;
  upcoming?: number;
  kanban?: boolean;
}

function resolveIndexOptions(command: Command): GenerateIndexOptions {
  const opts = command.opts<IndexCommandOptions>();
  const options: GenerateIndexOptions = {
    includeKanban: opts.kanban !== false,
  };
  if (opts.output) {
    options.outputFileName = opts.output;
  }
  if (opts.title) {
    options.title = opts.title;
  }
  const statusFilter = normalizeStatuses(opts.status);
  if (statusFilter) {
    options.statusFilter = statusFilter;
  }
  const upcomingDays = sanitizeUpcomingDays(opts.upcoming);
  if (upcomingDays !== undefined) {
    options.upcomingDays = upcomingDays;
  }
  return options;
}

const REVIEW_TYPE_VALUES: ReviewType[] = ["scheduled", "adhoc", "contextual"];

function parseReviewType(value?: string): ReviewType | undefined {
  if (!value) return undefined;
  const normalized = value.trim().toLowerCase();
  return REVIEW_TYPE_VALUES.find((entry) => entry === normalized);
}

const REVIEW_OUTCOME_VALUES: ReviewOutcome[] = [
  "keep",
  "revise",
  "retire",
  "supersede",
];

function parseReviewOutcome(value?: string): ReviewOutcome | undefined {
  if (!value) return undefined;
  const normalized = value.trim().toLowerCase();
  return REVIEW_OUTCOME_VALUES.find((entry) => entry === normalized);
}

function normalizeStatuses(
  value?: string[] | string,
): DecisionStatus[] | undefined {
  if (!value) return undefined;
  const values = Array.isArray(value) ? value : [value];
  const flattened = values.flatMap((entry) =>
    entry
      .split(",")
      .map((token) => token.trim().toLowerCase())
      .filter(Boolean),
  );
  const deduped = Array.from(
    new Set(
      flattened.filter((token): token is DecisionStatus =>
        isDecisionStatus(token),
      ),
    ),
  );
  return deduped.length > 0 ? deduped : undefined;
}

function isDecisionStatus(value: string): value is DecisionStatus {
  return [
    "draft",
    "proposed",
    "accepted",
    "deprecated",
    "superseded",
    "rejected",
    "retired",
    "archived",
  ].includes(value);
}

function sanitizeUpcomingDays(value: number | undefined): number | undefined {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return undefined;
  }
  if (value < 0) return 0;
  return Math.floor(value);
}
