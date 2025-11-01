import fs from "fs";
import path from "path";
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
  if (body === undefined) {
    body = "";
  }
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
  const stack: Array<{ dir: string; domain?: string }> = [
    { dir: context.root },
  ];

  while (stack.length > 0) {
    const current = stack.pop();
    if (!current) continue;
    const { dir, domain } = current;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name.startsWith(".")) continue;
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        stack.push(domain ? { dir: fullPath, domain } : { dir: fullPath });
        continue;
      }
      if (!entry.isFile() || !entry.name.endsWith(".md")) continue;
      try {
        const { data } = matter.read(fullPath);
        if (data && typeof data === "object") {
          const record = data as DecisionRecord;
          if (!record.domain && domain) {
            record.domain = domain;
          }
          records.push(record);
        }
      } catch (error) {
        // Skip files that fail to parse; they are not treated as decision records.
      }
    }
  }

  return records;
}
