import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import type {
  DecisionRecord,
  DecisionStatus,
  ReviewHistoryEntry,
  ReviewOutcome,
  ReviewType,
} from "./models.js";
import {
  saveDecision,
  loadDecision,
  listDecisions,
  getDecisionPath,
} from "./repository.js";
import { generateId } from "./utils.js";
import type { RepoContext, ResolveRepoOptions } from "../config.js";
import { resolveRepoContext } from "../config.js";
import { bumpVersion } from "./versioning.js";
import type {
  CreateDecisionOptions,
  RepoOptions,
  CorrectionOptions,
  ReviseOptions,
  ReviewOptions,
} from "./service-types.js";
import { commitLifecycle, commitBatch } from "./git-helpers.js";
import { resolveTemplateBody, emitTemplateWarnings } from "./templates.js";
export type {
  RepoOptions,
  CreateDecisionOptions,
  CorrectionOptions,
  ReviseOptions,
} from "./service-types.js";

export interface DecisionWriteResult {
  record: DecisionRecord;
  filePath: string;
  context: RepoContext;
}

export interface SupersedeResult extends DecisionWriteResult {
  newRecord: DecisionRecord;
  newFilePath: string;
}

export interface ReviewDecisionResult extends DecisionWriteResult {
  reviewEntry: ReviewHistoryEntry;
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
    status: "new",
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
  let record = await ensureDraftedStatus(id, workingOptions);

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
  let rec = await ensureDraftedStatus(id, workingOptions);
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
  appendReviewMetadata(rec, context, {
    reviewType: "adhoc",
    outcome: "retire",
  });
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
  appendReviewMetadata(oldRecord, context, {
    reviewType: "adhoc",
    outcome: "supersede",
    note: `Superseded by ${newId}`,
  });

  newRecord.supersedes = oldId;
  newRecord.lastEdited = today;
  newRecord.changeType = "supersession";
  const newChangelog = newRecord.changelog ?? [];
  newChangelog.push({ date: today, note: `Supersedes ${oldId}` });
  newRecord.changelog = newChangelog;

  const oldFilePath = saveDecision(context, oldRecord);
  const newFilePath = saveDecision(context, newRecord);

  await commitBatch(
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
  appendReviewMetadata(record, context, {
    reviewType: "adhoc",
    outcome: "revise",
    note: options.note,
  });

  const filePath = saveDecision(context, record);
  await commitLifecycle(context, workingOptions, filePath, "revise", record.id);

  return { record, filePath, context };
}

export async function reviewDecision(
  id: string,
  options: ReviewOptions = {},
): Promise<ReviewDecisionResult> {
  const context = ensureContext(options);
  const workingOptions = withContext(options, context);
  const record = loadDecision(context, id);
  const reviewEntry = appendReviewMetadata(record, context, {
    reviewType: options.reviewType,
    outcome: options.outcome,
    note: options.note,
    reviewer: options.reviewer,
  });

  const filePath = saveDecision(context, record);
  await commitLifecycle(context, workingOptions, filePath, "review", record.id);
  return { record, filePath, context, reviewEntry };
}

export function listAll(
  status?: string,
  options: RepoOptions = {},
): DecisionRecord[] {
  const context = ensureContext(options);
  const all = listDecisions(context);
  return status ? all.filter((r) => r.status === status) : all;
}

function withContext(
  options: RepoOptions,
  context: RepoContext,
): RepoOptions & { context: RepoContext } {
  if (options.context === context) {
    return options as RepoOptions & { context: RepoContext };
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

interface ReviewMetadataOverrides {
  reviewType?: ReviewType | undefined;
  outcome?: ReviewOutcome | undefined;
  note?: string | undefined;
  reviewer?: string | undefined;
}

function appendReviewMetadata(
  record: DecisionRecord,
  context: RepoContext,
  overrides: ReviewMetadataOverrides = {},
): ReviewHistoryEntry {
  const today = currentIsoDate();
  const reviewEntry: ReviewHistoryEntry = {
    date: today,
    type: resolveReviewTypeOption(overrides.reviewType, context.reviewPolicy),
    outcome: resolveReviewOutcomeOption(overrides.outcome),
  };
  const reviewer = resolveReviewer(overrides.reviewer);
  if (reviewer) {
    reviewEntry.reviewer = reviewer;
  }
  const note = sanitizeOptionalString(overrides.note);
  if (note) {
    reviewEntry.reason = note;
  }
  const history = record.reviewHistory ? [...record.reviewHistory] : [];
  history.push(reviewEntry);
  record.reviewHistory = history;
  record.lastReviewedAt = today;
  const nextReview = computeNextReviewDate(
    today,
    reviewEntry.outcome,
    context.reviewPolicy,
  );
  if (nextReview) {
    record.reviewDate = nextReview;
  }
  return reviewEntry;
}

const DEFAULT_REVIEW_TYPE: ReviewType = "scheduled";
const DEFAULT_REVIEW_OUTCOME: ReviewOutcome = "keep";

function resolveReviewTypeOption(
  explicit: ReviewType | undefined,
  policy?: RepoContext["reviewPolicy"],
): ReviewType {
  if (explicit) return explicit;
  if (policy?.defaultType) return policy.defaultType;
  return DEFAULT_REVIEW_TYPE;
}

function resolveReviewOutcomeOption(
  explicit: ReviewOutcome | undefined,
): ReviewOutcome {
  return explicit ?? DEFAULT_REVIEW_OUTCOME;
}

function computeNextReviewDate(
  currentDate: string,
  outcome: ReviewOutcome,
  policy?: RepoContext["reviewPolicy"],
): string | undefined {
  const months = policy?.intervalMonths;
  if (!months || !Number.isFinite(months) || months <= 0) {
    return undefined;
  }
  if (outcome === "retire" || outcome === "supersede") {
    return undefined;
  }
  return addMonths(currentDate, months);
}

function addMonths(dateString: string, months: number): string {
  const date = new Date(`${dateString}T00:00:00Z`);
  const copy = new Date(date.getTime());
  copy.setUTCMonth(copy.getUTCMonth() + months);
  return copy.toISOString().slice(0, 10);
}

function resolveReviewer(override?: string): string | undefined {
  const candidates = [
    override,
    process.env.DRCTL_REVIEWER,
    process.env.GIT_AUTHOR_NAME,
    process.env.GIT_COMMITTER_NAME,
    process.env.USER,
    process.env.USERNAME,
  ];
  for (const candidate of candidates) {
    const sanitized = sanitizeOptionalString(candidate);
    if (sanitized) {
      return sanitized;
    }
  }
  return undefined;
}

function sanitizeOptionalString(value?: string | null): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function currentIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
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

function hasChangelogNote(record: DecisionRecord, note: string): boolean {
  return (record.changelog ?? []).some((entry) => entry.note === note);
}

async function ensureDraftedStatus(
  id: string,
  options: RepoOptions & { context: RepoContext },
): Promise<DecisionRecord> {
  let record = loadDecision(options.context, id);
  if (record.status !== "new") {
    return record;
  }
  await draftDecision(id, options);
  return loadDecision(options.context, id);
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
