import type { DecisionRecord } from "./models.js";
import { saveDecision, loadDecision, listDecisions } from "./repository.js";
import { generateId } from "./utils.js";
import type { RepoContext, ResolveRepoOptions } from "../config.js";
import { resolveRepoContext } from "../config.js";

export interface DecisionWriteResult {
  record: DecisionRecord;
  filePath: string;
  context: RepoContext;
}

export interface RepoOptions {
  repo?: string;
  envRepo?: string;
  cwd?: string;
  context?: RepoContext;
}

export interface CreateDecisionOptions extends RepoOptions {
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
    version: "1.0",
    status: "proposed",
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

export function acceptDecision(
  id: string,
  options: RepoOptions = {},
): DecisionWriteResult {
  const context = ensureContext(options);
  const rec = loadDecision(context, id);
  const today = new Date().toISOString().slice(0, 10);
  rec.status = "accepted";
  rec.lastEdited = today;
  rec.changelog?.push({ date: today, note: "Marked as accepted" });
  const filePath = saveDecision(context, rec);
  return { record: rec, filePath, context };
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
