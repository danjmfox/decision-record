import fs from "fs";
import path from "path";
import matter from "gray-matter";
import type { DecisionRecord } from "./models.js";
import { DECISION_ROOT } from "../config.js";

export function getDecisionPath(record: DecisionRecord): string {
  return path.join(DECISION_ROOT, `${record.id}.md`);
}

export function saveDecision(record: DecisionRecord, content = ""): string {
  fs.mkdirSync(DECISION_ROOT, { recursive: true });
  const filePath = getDecisionPath(record);
  const md = matter.stringify(content, record);
  fs.writeFileSync(filePath, md);
  return filePath;
}

export function loadDecision(id: string): DecisionRecord {
  const filePath = path.join(DECISION_ROOT, `${id}.md`);
  const { data } = matter.read(filePath);
  return data as DecisionRecord;
}

export function listDecisions(): DecisionRecord[] {
  if (!fs.existsSync(DECISION_ROOT)) return [];
  return fs
    .readdirSync(DECISION_ROOT)
    .filter((f) => f.endsWith(".md"))
    .map((f) => {
      const { data } = matter.read(path.join(DECISION_ROOT, f));
      return data as DecisionRecord;
    });
}
