import fs from "fs";
import path from "path";
import type { RepoContext } from "../config.js";
import { listDecisions, getDecisionPath } from "./repository.js";
import type { DecisionRecord } from "./models.js";

export interface GenerateIndexOptions {
  outputFileName?: string;
  includeGeneratedNote?: boolean;
  title?: string;
}

export interface GenerateIndexResult {
  filePath: string;
  markdown: string;
}

export function generateIndex(
  context: RepoContext,
  options: GenerateIndexOptions = {},
): GenerateIndexResult {
  const fileName = options.outputFileName ?? "index.md";
  const filePath = path.join(context.root, fileName);
  const decisions = listDecisions(context);
  const markdown = buildMarkdown(context, decisions, options);
  fs.writeFileSync(filePath, markdown, "utf8");
  return { filePath, markdown };
}

function buildMarkdown(
  context: RepoContext,
  decisions: DecisionRecord[],
  options: GenerateIndexOptions,
): string {
  const title = options.title ?? defaultTitle(context);
  const includeGeneratedNote = options.includeGeneratedNote !== false;

  const grouped = new Map<string, DecisionRecord[]>();
  for (const record of decisions) {
    const domain = record.domain ?? "uncategorised";
    const list = grouped.get(domain) ?? [];
    list.push(record);
    grouped.set(domain, list);
  }

  const domains = Array.from(grouped.keys()).sort((a, b) => a.localeCompare(b));
  const lines: string[] = [];
  lines.push(`# ${title}`);
  lines.push("");
  if (includeGeneratedNote) {
    lines.push(
      `_Generated ${new Date().toISOString().slice(0, 10)} by drctl index_`,
    );
    lines.push("");
  }

  for (const domain of domains) {
    lines.push(`## ${domain}`);
    lines.push("");
    const records = grouped
      .get(domain)
      ?.sort((a, b) => a.id.localeCompare(b.id));
    records?.forEach((record, index) => {
      const rel = relativePath(context, record);
      lines.push(`${index + 1}. [${record.id}](${rel})`);
    });
    lines.push("");
  }

  if (domains.length === 0) {
    lines.push("_(No decisions found.)_");
    lines.push("");
  }

  return lines.join("\n");
}

function defaultTitle(context: RepoContext): string {
  if (context.name) {
    return `${context.name} Decisions`;
  }
  return "Decision Index";
}

function relativePath(context: RepoContext, record: DecisionRecord): string {
  const absolute = getDecisionPath(context, record);
  const relative = path
    .relative(context.root, absolute)
    .split(path.sep)
    .join("/");
  if (relative.startsWith(".")) return relative;
  return `./${relative}`;
}
