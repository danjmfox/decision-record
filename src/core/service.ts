import type { DecisionRecord } from "./models.js";
import { saveDecision, loadDecision, listDecisions } from "./repository.js";
import { generateId } from "./utils.js";
import type { RepoContext, ResolveRepoOptions } from "../config.js";
import { resolveRepoContext } from "../config.js";
import {
  createGitClient,
  getStagedFiles,
  isNotGitRepoError,
  type GitClient,
} from "./git.js";
import { bumpVersion } from "./versioning.js";

export interface DecisionWriteResult {
  record: DecisionRecord;
  filePath: string;
  context: RepoContext;
}

export interface SupersedeResult extends DecisionWriteResult {
  newRecord: DecisionRecord;
  newFilePath: string;
}

export interface RepoOptions {
  repo?: string;
  envRepo?: string;
  cwd?: string;
  context?: RepoContext;
  gitClient?: GitClient;
  configPath?: string;
}

export interface CreateDecisionOptions extends RepoOptions {
  confidence?: number;
}

export interface CorrectionOptions extends RepoOptions {
  note?: string;
}

export interface ReviseOptions extends RepoOptions {
  note?: string;
  confidence?: number;
}

export function createDecision(
  domain: string,
  slug: string,
  options: CreateDecisionOptions = {},
): DecisionWriteResult {
  const { confidence } = options;
  const context = ensureContext(options);
  const today = new Date().toISOString().slice(0, 10);
  const record: DecisionRecord = {
    id: generateId(domain, slug),
    dateCreated: today,
    version: "1.0.0",
    status: "draft",
    changeType: "creation",
    domain,
    slug,
    ...(confidence !== undefined ? { confidence } : {}),
    changelog: [
      {
        date: today,
        note: "Initial creation",
      },
    ],
  };
  const filePath = saveDecision(context, record, renderTemplate(record));
  return { record, filePath, context };
}

export async function draftDecision(
  id: string,
  options: RepoOptions = {},
): Promise<DecisionWriteResult> {
  const context = ensureContext(options);
  const record = loadDecision(context, id);
  const today = new Date().toISOString().slice(0, 10);
  record.status = "draft";
  record.lastEdited = today;
  const changelog = record.changelog ?? [];
  changelog.push({ date: today, note: "Marked as draft" });
  record.changelog = changelog;
  const filePath = saveDecision(context, record);
  const gitClient = options.gitClient ?? createGitClient();
  await stageAndCommitWithHint(
    context,
    gitClient,
    [filePath],
    `drctl: draft ${record.id}`,
  );

  return { record, filePath, context };
}

export async function proposeDecision(
  id: string,
  options: RepoOptions = {},
): Promise<DecisionWriteResult> {
  const context = ensureContext(options);
  const record = loadDecision(context, id);
  const today = new Date().toISOString().slice(0, 10);
  record.status = "proposed";
  record.lastEdited = today;
  const changelog = record.changelog ?? [];
  changelog.push({ date: today, note: "Marked as proposed" });
  record.changelog = changelog;
  const filePath = saveDecision(context, record);
  const gitClient = options.gitClient ?? createGitClient();
  await stageAndCommitWithHint(
    context,
    gitClient,
    [filePath],
    `drctl: propose ${record.id}`,
  );

  return { record, filePath, context };
}

export async function acceptDecision(
  id: string,
  options: RepoOptions = {},
): Promise<DecisionWriteResult> {
  const context = ensureContext(options);
  const rec = loadDecision(context, id);
  const today = new Date().toISOString().slice(0, 10);
  rec.status = "accepted";
  rec.lastEdited = today;
  rec.dateAccepted = today;
  const changelog = rec.changelog ?? [];
  changelog.push({ date: today, note: "Marked as accepted" });
  rec.changelog = changelog;
  const filePath = saveDecision(context, rec);
  const gitClient = options.gitClient ?? createGitClient();
  await stageAndCommitWithHint(
    context,
    gitClient,
    [filePath],
    `drctl: accept ${rec.id}`,
  );
  return { record: rec, filePath, context };
}

export async function rejectDecision(
  id: string,
  options: RepoOptions = {},
): Promise<DecisionWriteResult> {
  const context = ensureContext(options);
  const rec = loadDecision(context, id);
  const today = new Date().toISOString().slice(0, 10);
  rec.status = "rejected";
  rec.lastEdited = today;
  const changelog = rec.changelog ?? [];
  changelog.push({ date: today, note: "Marked as rejected" });
  rec.changelog = changelog;
  const filePath = saveDecision(context, rec);
  const gitClient = options.gitClient ?? createGitClient();
  await stageAndCommitWithHint(
    context,
    gitClient,
    [filePath],
    `drctl: reject ${rec.id}`,
  );
  return { record: rec, filePath, context };
}

export async function deprecateDecision(
  id: string,
  options: RepoOptions = {},
): Promise<DecisionWriteResult> {
  const context = ensureContext(options);
  const rec = loadDecision(context, id);
  const today = new Date().toISOString().slice(0, 10);
  rec.status = "deprecated";
  rec.lastEdited = today;
  const changelog = rec.changelog ?? [];
  changelog.push({ date: today, note: "Marked as deprecated" });
  rec.changelog = changelog;
  const filePath = saveDecision(context, rec);
  const gitClient = options.gitClient ?? createGitClient();
  await stageAndCommitWithHint(
    context,
    gitClient,
    [filePath],
    `drctl: deprecate ${rec.id}`,
  );
  return { record: rec, filePath, context };
}

export async function supersedeDecision(
  oldId: string,
  newId: string,
  options: RepoOptions = {},
): Promise<SupersedeResult> {
  const context = ensureContext(options);
  const oldRecord = loadDecision(context, oldId);
  const newRecord = loadDecision(context, newId);
  const today = new Date().toISOString().slice(0, 10);

  oldRecord.status = "superseded";
  oldRecord.lastEdited = today;
  oldRecord.supersededBy = newId;
  const oldChangelog = oldRecord.changelog ?? [];
  oldChangelog.push({ date: today, note: `Superseded by ${newId}` });
  oldRecord.changelog = oldChangelog;

  newRecord.supersedes = oldId;
  newRecord.lastEdited = today;
  newRecord.changeType = "supersession";
  const newChangelog = newRecord.changelog ?? [];
  newChangelog.push({ date: today, note: `Supersedes ${oldId}` });
  newRecord.changelog = newChangelog;

  const oldFilePath = saveDecision(context, oldRecord);
  const newFilePath = saveDecision(context, newRecord);

  const gitClient = options.gitClient ?? createGitClient();
  await stageAndCommitWithHint(
    context,
    gitClient,
    [oldFilePath, newFilePath],
    `drctl: supersede ${oldId} -> ${newId}`,
  );

  return {
    record: oldRecord,
    filePath: oldFilePath,
    context,
    newRecord,
    newFilePath,
  };
}

export async function correctionDecision(
  id: string,
  options: CorrectionOptions = {},
): Promise<DecisionWriteResult> {
  const context = ensureContext(options);
  const record = loadDecision(context, id);
  const today = new Date().toISOString().slice(0, 10);

  record.version = bumpVersion(record.version, "patch");
  record.lastEdited = today;
  record.changeType = "correction";
  const changelog = record.changelog ?? [];
  changelog.push({
    date: today,
    note: options.note ?? "Minor correction",
  });
  record.changelog = changelog;

  const filePath = saveDecision(context, record);
  const gitClient = options.gitClient ?? createGitClient();
  await stageAndCommitWithHint(
    context,
    gitClient,
    [filePath],
    `drctl: correction ${record.id}`,
  );

  return { record, filePath, context };
}

export async function reviseDecision(
  id: string,
  options: ReviseOptions = {},
): Promise<DecisionWriteResult> {
  const context = ensureContext(options);
  const record = loadDecision(context, id);
  const today = new Date().toISOString().slice(0, 10);

  record.version = bumpVersion(record.version, "minor");
  record.lastEdited = today;
  record.changeType = "revision";
  if (options.confidence !== undefined) {
    record.confidence = options.confidence;
  }

  const changelog = record.changelog ?? [];
  changelog.push({
    date: today,
    note: options.note ?? "Revision",
  });
  record.changelog = changelog;

  const filePath = saveDecision(context, record);
  const gitClient = options.gitClient ?? createGitClient();
  await stageAndCommitWithHint(
    context,
    gitClient,
    [filePath],
    `drctl: revise ${record.id}`,
  );

  return { record, filePath, context };
}

export function listAll(
  status?: string,
  options: RepoOptions = {},
): DecisionRecord[] {
  const context = ensureContext(options);
  const all = listDecisions(context);
  return status ? all.filter((r) => r.status === status) : all;
}

function ensureContext(options: RepoOptions): RepoContext {
  if (options.context) return options.context;
  const resolveOptions: ResolveRepoOptions = {
    repoFlag: options.repo ?? null,
    envRepo: options.envRepo ?? null,
  };
  if (options.cwd) {
    resolveOptions.cwd = options.cwd;
  }
  if (options.configPath) {
    resolveOptions.configPath = options.configPath;
  }
  return resolveRepoContext(resolveOptions);
}

export function resolveContext(options: RepoOptions = {}): RepoContext {
  return ensureContext(options);
}

function renderTemplate(record: DecisionRecord): string {
  return [
    `# ${record.id}`,
    "",
    "## 🧭 Context",
    "",
    "_Describe the background and circumstances leading to this decision._",
    "",
    "## ⚖️ Options Considered",
    "",
    "_List the main options or alternatives that were evaluated before making the decision, including why each was accepted or rejected._",
    "",
    "| Option | Description | Outcome  | Rationale                      |",
    "| ------ | ----------- | -------- | ------------------------------ |",
    "| A      | Do nothing  | Rejected | Insufficient long-term clarity |",
    "| B      |             |          |                                |",
    "",
    "## 🧠 Decision",
    "",
    "_State the decision made clearly and succinctly._",
    "",
    "## 🪶 Principles",
    "",
    "_List the guiding principles or values that influenced this decision._",
    "",
    "## 🔁 Lifecycle",
    "",
    "_Outline the current lifecycle state and any relevant change types._",
    "",
    "## 🧩 Reasoning",
    "",
    "_Explain the rationale, trade-offs, and considerations behind the decision._",
    "",
    "## 🔄 Next Actions",
    "",
    "_Specify the immediate next steps or actions following this decision._",
    "",
    "## 🧠 Confidence",
    "",
    "_Indicate the confidence level in this decision and any planned reviews._",
    "",
    "## 🧾 Changelog",
    "",
    "_Summarise notable updates, revisions, or corrections. Each should have a date and note in YAML frontmatter for traceability._",
    "",
  ].join("\n");
}

async function stageAndCommitWithHint(
  context: RepoContext,
  gitClient: GitClient,
  paths: string[],
  message: string,
) {
  const staged = await getStagedFiles(context.root);
  if (staged.length > 0) {
    const list = staged.join(", ");
    throw new Error(
      `Staging area contains unrelated changes in ${context.root}: ${list}. Commit or reset them before running drctl.`,
    );
  }
  try {
    await gitClient.stageAndCommit(paths, {
      cwd: context.root,
      message,
    });
  } catch (error) {
    if (isNotGitRepoError(error)) {
      const hintTarget = context.name
        ? `repo "${context.name}" (${context.root})`
        : context.root;
      const bootstrap = context.name
        ? `drctl repo bootstrap ${context.name}`
        : `git init`;
      const hintMessage =
        error instanceof Error ? error.message : String(error);
      throw new Error(
        `${hintMessage}\n💡 Hint: initialise git in ${hintTarget} via "${bootstrap}" before running this command again.`,
      );
    }
    throw error;
  }
}
