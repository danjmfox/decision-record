import type { DecisionRecord } from "./models.js";
import { saveDecision, loadDecision, listDecisions } from "./repository.js";
import { generateId } from "./utils.js";
import type { RepoContext, ResolveRepoOptions } from "../config.js";
import { resolveRepoContext } from "../config.js";

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
): DecisionRecord {
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
  saveDecision(
    context,
    record,
    `# ${record.id}\n\n## 🧭 Context\n\n## ⚖️ Options Considered\n\n## 🧠 Decision\n`,
  );
  return record;
}

export function acceptDecision(
  id: string,
  options: RepoOptions = {},
): DecisionRecord {
  const context = ensureContext(options);
  const rec = loadDecision(context, id);
  const today = new Date().toISOString().slice(0, 10);
  rec.status = "accepted";
  rec.lastEdited = today;
  rec.changelog?.push({ date: today, note: "Marked as accepted" });
  saveDecision(context, rec);
  return rec;
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
