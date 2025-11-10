import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import matter from "gray-matter";
import type { DecisionRecord, DecisionStatus } from "./models.js";
import {
  saveDecision,
  loadDecision,
  listDecisions,
  getDecisionPath,
} from "./repository.js";
import { generateId } from "./utils.js";
import type { GitMode, RepoContext, ResolveRepoOptions } from "../config.js";
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
  onTemplateWarning?: (message: string) => void;
  gitModeFlag?: GitMode;
  onGitDisabled?: (details: { context: RepoContext }) => void;
}

export interface CreateDecisionOptions extends RepoOptions {
  confidence?: number;
  templatePath?: string;
  envTemplate?: string;
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
    ...(confidence === undefined ? {} : { confidence }),
    changelog: [
      {
        date: today,
        note: "Initial creation",
      },
    ],
  };
  const targetPath = getDecisionPath(context, record);
  if (fs.existsSync(targetPath)) {
    throw new Error(
      `Decision record "${record.id}" already exists at ${targetPath}. Use drctl lifecycle or revision commands to update it.`,
    );
  }
  const template = resolveTemplateBody(record, context, options);
  if (template.templateUsed) {
    record.templateUsed = template.templateUsed;
  }
  const filePath = saveDecision(context, record, template.body);
  return { record, filePath, context };
}

export async function draftDecision(
  id: string,
  options: RepoOptions = {},
): Promise<DecisionWriteResult> {
  const context = ensureContext(options);
  const workingOptions = withContext(options, context);
  const record = loadDecision(context, id);
  const today = new Date().toISOString().slice(0, 10);
  record.status = "draft";
  record.lastEdited = today;
  const changelog = record.changelog ?? [];
  changelog.push({ date: today, note: "Marked as draft" });
  record.changelog = changelog;
  const filePath = saveDecision(context, record);
  await commitLifecycle(context, workingOptions, filePath, "draft", record.id);

  return { record, filePath, context };
}

export async function proposeDecision(
  id: string,
  options: RepoOptions = {},
): Promise<DecisionWriteResult> {
  const context = ensureContext(options);
  const workingOptions = withContext(options, context);
  let record = loadDecision(context, id);

  if (!isProposableStatus(record.status)) {
    throw new Error(
      `Cannot propose decision "${id}" from status "${record.status}". Use the appropriate lifecycle command first.`,
    );
  }

  if (
    record.status === "draft" &&
    !hasChangelogNote(record, "Marked as draft")
  ) {
    await draftDecision(id, workingOptions);
    record = loadDecision(context, id);
  }

  emitTemplateWarnings(context, record, options);

  if (record.status === "proposed") {
    const filePath = getDecisionPath(context, record);
    return { record, filePath, context };
  }

  const today = new Date().toISOString().slice(0, 10);
  record.status = "proposed";
  record.lastEdited = today;
  const changelog = record.changelog ?? [];
  changelog.push({ date: today, note: "Marked as proposed" });
  record.changelog = changelog;
  const filePath = saveDecision(context, record);
  await commitLifecycle(
    context,
    workingOptions,
    filePath,
    "propose",
    record.id,
  );

  return { record, filePath, context };
}

export async function acceptDecision(
  id: string,
  options: RepoOptions = {},
): Promise<DecisionWriteResult> {
  const context = ensureContext(options);
  const workingOptions = withContext(options, context);
  let rec = loadDecision(context, id);
  let warningsHandled = false;

  if (!isAcceptableStatus(rec.status)) {
    throw new Error(
      `Cannot accept decision "${id}" from status "${rec.status}". Use the appropriate lifecycle command first.`,
    );
  }

  if (rec.status === "draft" && !hasChangelogNote(rec, "Marked as draft")) {
    await draftDecision(id, workingOptions);
    rec = loadDecision(context, id);
  }

  if (rec.status === "draft") {
    await proposeDecision(id, workingOptions);
    rec = loadDecision(context, id);
    warningsHandled = true;
  }

  if (!warningsHandled && rec.status !== "accepted") {
    emitTemplateWarnings(context, rec, options);
  }

  if (rec.status === "accepted") {
    const filePath = getDecisionPath(context, rec);
    return { record: rec, filePath, context };
  }

  const today = new Date().toISOString().slice(0, 10);
  rec.status = "accepted";
  rec.lastEdited = today;
  rec.dateAccepted = today;
  const changelog = rec.changelog ?? [];
  changelog.push({ date: today, note: "Marked as accepted" });
  rec.changelog = changelog;
  const filePath = saveDecision(context, rec);
  await commitLifecycle(context, workingOptions, filePath, "accept", rec.id);
  return { record: rec, filePath, context };
}

export async function rejectDecision(
  id: string,
  options: RepoOptions = {},
): Promise<DecisionWriteResult> {
  const context = ensureContext(options);
  const workingOptions = withContext(options, context);
  const rec = loadDecision(context, id);
  const today = new Date().toISOString().slice(0, 10);
  rec.status = "rejected";
  rec.lastEdited = today;
  const changelog = rec.changelog ?? [];
  changelog.push({ date: today, note: "Marked as rejected" });
  rec.changelog = changelog;
  const filePath = saveDecision(context, rec);
  await commitLifecycle(context, workingOptions, filePath, "reject", rec.id);
  return { record: rec, filePath, context };
}

export async function deprecateDecision(
  id: string,
  options: RepoOptions = {},
): Promise<DecisionWriteResult> {
  const context = ensureContext(options);
  const workingOptions = withContext(options, context);
  const rec = loadDecision(context, id);
  const today = new Date().toISOString().slice(0, 10);
  rec.status = "deprecated";
  rec.lastEdited = today;
  const changelog = rec.changelog ?? [];
  changelog.push({ date: today, note: "Marked as deprecated" });
  rec.changelog = changelog;
  const filePath = saveDecision(context, rec);
  await commitLifecycle(context, workingOptions, filePath, "deprecate", rec.id);
  return { record: rec, filePath, context };
}

export async function retireDecision(
  id: string,
  options: RepoOptions = {},
): Promise<DecisionWriteResult> {
  const context = ensureContext(options);
  const workingOptions = withContext(options, context);
  const rec = loadDecision(context, id);
  const today = new Date().toISOString().slice(0, 10);
  rec.status = "retired";
  rec.lastEdited = today;
  rec.changeType = "retirement";
  const changelog = rec.changelog ?? [];
  changelog.push({ date: today, note: "Marked as retired" });
  rec.changelog = changelog;
  const filePath = saveDecision(context, rec);
  await commitLifecycle(context, workingOptions, filePath, "retire", rec.id);
  return { record: rec, filePath, context };
}

export async function supersedeDecision(
  oldId: string,
  newId: string,
  options: RepoOptions = {},
): Promise<SupersedeResult> {
  const context = ensureContext(options);
  const workingOptions = withContext(options, context);
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

  await commitIfEnabled(
    context,
    workingOptions,
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
  const workingOptions = withContext(options, context);
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
  await commitLifecycle(
    context,
    workingOptions,
    filePath,
    "correction",
    record.id,
  );

  return { record, filePath, context };
}

export async function reviseDecision(
  id: string,
  options: ReviseOptions = {},
): Promise<DecisionWriteResult> {
  const context = ensureContext(options);
  const workingOptions = withContext(options, context);
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
  await commitLifecycle(context, workingOptions, filePath, "revise", record.id);

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

function withContext(options: RepoOptions, context: RepoContext): RepoOptions {
  if (options.context === context) {
    return options;
  }
  return { ...options, context };
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
  if (options.gitModeFlag) {
    resolveOptions.gitModeFlag = options.gitModeFlag;
  }
  return resolveRepoContext(resolveOptions);
}

export function resolveContext(options: RepoOptions = {}): RepoContext {
  return ensureContext(options);
}

interface ResolvedTemplate {
  body: string;
  templateUsed?: string;
}

function resolveTemplateBody(
  record: DecisionRecord,
  context: RepoContext,
  options: CreateDecisionOptions,
): ResolvedTemplate {
  const candidates = [
    sanitizeTemplateCandidate(options.templatePath),
    sanitizeTemplateCandidate(
      options.envTemplate ?? process.env.DRCTL_TEMPLATE,
    ),
    sanitizeTemplateCandidate(context.defaultTemplate),
  ];

  for (const candidate of candidates) {
    if (!candidate) continue;
    const resolved = resolveTemplateCandidate(context, candidate);
    if (!resolved) continue;
    if (!fs.existsSync(resolved.absolutePath)) continue;
    try {
      const stats = fs.statSync(resolved.absolutePath);
      if (!stats.isFile()) continue;
    } catch {
      continue;
    }
    try {
      const body = fs.readFileSync(resolved.absolutePath, "utf8");
      const templateUsed = ensureTemplateInRepo(context, resolved, body);
      return { body, templateUsed };
    } catch {
      continue;
    }
  }

  return { body: renderTemplate(record) };
}

function sanitizeTemplateCandidate(
  value: string | null | undefined,
): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length === 0 ? undefined : trimmed;
}

interface TemplateCandidateResolution {
  absolutePath: string;
  templateId: string;
}

function resolveTemplateCandidate(
  context: RepoContext,
  candidate: string,
): TemplateCandidateResolution | undefined {
  const expanded = expandHome(candidate);
  const absolutePath = path.isAbsolute(expanded)
    ? path.normalize(expanded)
    : path.resolve(context.root, expanded);
  const templateId = deriveTemplateId(context.root, candidate, absolutePath);
  return { absolutePath, templateId };
}

function expandHome(input: string): string {
  if (input === "~") {
    return os.homedir();
  }
  if (input.startsWith("~/")) {
    return path.join(os.homedir(), input.slice(2));
  }
  return input;
}

function deriveTemplateId(
  repoRoot: string,
  original: string,
  absolutePath: string,
): string {
  if (!path.isAbsolute(original)) {
    return normalizeToPosix(original);
  }
  const relative = path.relative(repoRoot, absolutePath);
  if (!relative.startsWith("..") && !path.isAbsolute(relative)) {
    return normalizeToPosix(relative);
  }
  return normalizeToPosix(original);
}

function normalizeToPosix(value: string): string {
  return value.split(path.sep).join("/");
}

function ensureTemplateInRepo(
  context: RepoContext,
  resolved: TemplateCandidateResolution,
  body: string,
): string {
  const relative = path.relative(context.root, resolved.absolutePath);
  if (!relative.startsWith("..") && !path.isAbsolute(relative)) {
    return normalizeToPosix(relative);
  }

  const templatesDir = path.join(context.root, "templates");
  fs.mkdirSync(templatesDir, { recursive: true });

  const sourceContent = body;
  const { name, ext } = path.parse(resolved.absolutePath);
  let candidateName = `${name}${ext}`;
  let targetPath = path.join(templatesDir, candidateName);

  if (fs.existsSync(targetPath)) {
    const existing = fs.readFileSync(targetPath, "utf8");
    if (existing === sourceContent) {
      return normalizeToPosix(path.relative(context.root, targetPath));
    }
    let counter = 2;
    while (true) {
      candidateName = `${name}-${counter}${ext}`;
      targetPath = path.join(templatesDir, candidateName);
      if (!fs.existsSync(targetPath)) {
        break;
      }
      const existingCandidate = fs.readFileSync(targetPath, "utf8");
      if (existingCandidate === sourceContent) {
        return normalizeToPosix(path.relative(context.root, targetPath));
      }
      counter += 1;
    }
  }

  fs.writeFileSync(targetPath, sourceContent, "utf8");
  return normalizeToPosix(path.relative(context.root, targetPath));
}

const DEFAULT_PLACEHOLDER_LINES = [
  "_Describe the background and circumstances leading to this decision._",
  "_List the main options or alternatives that were evaluated before making the decision, including why each was accepted or rejected._",
  "_State the decision made clearly and succinctly._",
  "_List the guiding principles or values that influenced this decision._",
  "_Outline the current lifecycle state and any relevant change types._",
  "_Explain the rationale, trade-offs, and considerations behind the decision._",
  "_Specify the immediate next steps or actions following this decision._",
  "_Indicate the confidence level in this decision and any planned reviews._",
  "_Summarise notable updates, revisions, or corrections. Each should have a date and note in YAML frontmatter for traceability._",
];

const DEFAULT_REQUIRED_HEADINGS = [
  "## 🧭 Context",
  "## ⚖️ Options Considered",
  "## 🧠 Decision",
  "## 🪶 Principles",
  "## 🔁 Lifecycle",
  "## 🧩 Reasoning",
  "## 🔄 Next Actions",
  "## 🧠 Confidence",
  "## 🧾 Changelog",
];

const OPTIONS_PLACEHOLDER_REGEX = /\| B\s+\|\s+\|\s+\|\s+\|/;

function emitTemplateWarnings(
  context: RepoContext,
  record: DecisionRecord,
  options: RepoOptions,
): void {
  const warnings = collectTemplateWarnings(context, record);
  if (warnings.length === 0) return;
  const handler =
    typeof options.onTemplateWarning === "function"
      ? options.onTemplateWarning
      : (message: string) => {
          console.warn(`⚠️ ${message}`);
        };
  for (const warning of warnings) {
    handler(`Template hygiene: ${warning}`);
  }
}

function collectTemplateWarnings(
  context: RepoContext,
  record: DecisionRecord,
): string[] {
  const warnings: string[] = [];
  const filePath = getDecisionPath(context, record);
  if (!fs.existsSync(filePath)) {
    return warnings;
  }
  const { content } = matter.read(filePath);

  if (DEFAULT_PLACEHOLDER_LINES.some((line) => content.includes(line))) {
    warnings.push(
      "Placeholder text from the default template is still present.",
    );
  }

  if (!record.templateUsed) {
    const missingHeadings = DEFAULT_REQUIRED_HEADINGS.filter(
      (heading) => !headingExists(content, heading),
    );
    if (missingHeadings.length > 0) {
      warnings.push(
        `Missing default template heading(s): ${missingHeadings.join(", ")}.`,
      );
    }
  }

  if (OPTIONS_PLACEHOLDER_REGEX.test(content)) {
    warnings.push("The options table still contains placeholder rows.");
  }

  return warnings;
}

function headingExists(content: string, heading: string): boolean {
  const pattern = new RegExp(`^${escapeRegExp(heading)}\\s*$`, "m");
  return pattern.test(content);
}

function escapeRegExp(value: string): string {
  return value.replaceAll(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`);
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

function readVisibleEntries(dir: string): fs.Dirent[] {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  return entries.filter((entry) => !shouldSkipEntry(entry));
}

function addDecisionIfPresent(
  filePath: string,
  entry: fs.Dirent,
  results: DecisionWithSource[],
): void {
  if (!isDecisionFileEntry(entry)) return;
  const record = readDecisionFromFile(filePath);
  if (!record) return;
  results.push({ record, filePath });
}

function shouldSkipEntry(entry: fs.Dirent): boolean {
  return entry.name.startsWith(".");
}

function isDecisionFileEntry(entry: fs.Dirent): boolean {
  return (
    entry.isFile() &&
    entry.name.endsWith(".md") &&
    entry.name.startsWith("DR--")
  );
}

function readDecisionFromFile(filePath: string): DecisionRecord | undefined {
  try {
    const { data } = matter.read(filePath);
    if (!data || typeof data !== "object") {
      return undefined;
    }
    return data as DecisionRecord;
  } catch {
    return undefined;
  }
}

function notifyGitDisabled(options: RepoOptions, context: RepoContext): void {
  options.onGitDisabled?.({ context });
}

async function commitIfEnabled(
  context: RepoContext,
  options: RepoOptions,
  paths: string[],
  message: string,
): Promise<void> {
  if (context.gitMode === "disabled") {
    notifyGitDisabled(options, context);
    return;
  }
  if (paths.length === 0) {
    return;
  }
  options.gitClient ??= createGitClient();
  const gitCwd = context.gitRoot ?? context.root;
  await stageAndCommitWithHint(
    context,
    options.gitClient,
    gitCwd,
    paths,
    message,
  );
}

async function commitSingleFile(
  context: RepoContext,
  options: RepoOptions,
  filePath: string,
  message: string,
): Promise<void> {
  await commitIfEnabled(context, options, [filePath], message);
}

function commitLifecycle(
  context: RepoContext,
  options: RepoOptions,
  filePath: string,
  verb: string,
  id: string,
): Promise<void> {
  return commitSingleFile(context, options, filePath, `drctl: ${verb} ${id}`);
}

async function stageAndCommitWithHint(
  context: RepoContext,
  gitClient: GitClient,
  gitCwd: string,
  paths: string[],
  message: string,
) {
  const staged = await getStagedFiles(gitCwd);
  if (staged.length > 0) {
    const list = staged.join(", ");
    throw new Error(
      `Staging area contains unrelated changes in ${gitCwd}: ${list}. Commit or reset them before running drctl.`,
    );
  }
  try {
    await gitClient.stageAndCommit(paths, {
      cwd: gitCwd,
      message,
    });
  } catch (error) {
    if (isNotGitRepoError(error)) {
      const displayRoot = context.gitRoot ?? context.root;
      const hintTarget = context.name
        ? `repo "${context.name}" (${displayRoot})`
        : displayRoot;
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

function hasChangelogNote(record: DecisionRecord, note: string): boolean {
  return (record.changelog ?? []).some((entry) => entry.note === note);
}

function isAcceptableStatus(status: DecisionStatus): boolean {
  return status === "draft" || status === "proposed" || status === "accepted";
}

function isProposableStatus(status: DecisionStatus): boolean {
  return status === "draft" || status === "proposed";
}

export interface DecisionWithSource {
  record: DecisionRecord;
  filePath: string;
}

export function collectDecisions(context: RepoContext): DecisionWithSource[] {
  if (!fs.existsSync(context.root)) return [];
  const results: DecisionWithSource[] = [];
  traverseDecisionDirectories([context.root], results);
  return results;
}

function traverseDecisionDirectories(
  stack: string[],
  results: DecisionWithSource[],
): void {
  while (stack.length > 0) {
    const dir = stack.pop();
    if (!dir) continue;
    for (const entry of readVisibleEntries(dir)) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        stack.push(fullPath);
        continue;
      }
      addDecisionIfPresent(fullPath, entry, results);
    }
  }
}
