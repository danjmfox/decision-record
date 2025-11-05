import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import type { DecisionRecord } from "./models.js";
import type { RepoContext } from "../config.js";
import { resolveDomainDir } from "../config.js";
import { extractDomainFromId } from "./utils.js";

export function getDecisionPath(
  context: RepoContext,
  record: DecisionRecord,
): string {
  const domainDir = resolveDomainDir(context, record.domain);
  return path.join(domainDir, `${record.id}.md`);
}

export function saveDecision(
  context: RepoContext,
  record: DecisionRecord,
  content?: string,
): string {
  const domainDir = resolveDomainDir(context, record.domain);
  fs.mkdirSync(domainDir, { recursive: true });
  const filePath = getDecisionPath(context, record);
  let body = content;
  if (body === undefined && fs.existsSync(filePath)) {
    const existing = matter.read(filePath);
    body = existing.content;
  }
  body ??= "";
  const md = matter.stringify(body, record);
  fs.writeFileSync(filePath, md);
  return filePath;
}

export function loadDecision(
  context: RepoContext,
  id: string,
  domain?: string,
): DecisionRecord {
  const domainFromId = domain ?? extractDomainFromId(id);
  if (!domainFromId) {
    throw new Error(
      `Unable to determine domain for record "${id}". Ensure the identifier includes the domain segment (DR--YYYYMMDD--<domain>--<slug>).`,
    );
  }
  const filePath = path.join(
    resolveDomainDir(context, domainFromId),
    `${id}.md`,
  );
  if (!fs.existsSync(filePath)) {
    throw new Error(`Decision record "${id}" not found at ${filePath}`);
  }
  const { data } = matter.read(filePath);
  return data as DecisionRecord;
}

export function listDecisions(context: RepoContext): DecisionRecord[] {
  if (!fs.existsSync(context.root)) return [];
  const records: DecisionRecord[] = [];
  traverseDirectory({ dir: context.root }, context, records);
  return records;
}

function traverseDirectory(
  current: { dir: string; domain?: string },
  context: RepoContext,
  records: DecisionRecord[],
): void {
  const stack: Array<{ dir: string; domain?: string }> = [current];
  while (stack.length > 0) {
    const next = stack.pop();
    if (!next) continue;
    processDirectory(next, context, records, stack);
  }
}

function processDirectory(
  current: { dir: string; domain?: string },
  context: RepoContext,
  records: DecisionRecord[],
  stack: Array<{ dir: string; domain?: string }>,
): void {
  const entries = fs.readdirSync(current.dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name.startsWith(".")) continue;
    const fullPath = path.join(current.dir, entry.name);
    if (entry.isDirectory()) {
      stack.push(
        current.domain
          ? { dir: fullPath, domain: current.domain }
          : { dir: fullPath },
      );
      continue;
    }
    if (!entry.isFile() || !entry.name.endsWith(".md")) continue;
    addDecisionFromFile(fullPath, current.domain, records);
  }
}

function addDecisionFromFile(
  filePath: string,
  inheritedDomain: string | undefined,
  records: DecisionRecord[],
): void {
  try {
    const { data } = matter.read(filePath);
    if (!data || typeof data !== "object") return;
    const record = data as DecisionRecord;
    if (!record.domain && inheritedDomain) {
      record.domain = inheritedDomain;
    }
    records.push(record);
  } catch {
    // Skip files that fail to parse; they are not treated as decision records.
  }
}
