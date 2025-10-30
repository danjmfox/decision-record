import type { DecisionRecord } from "./models.js";
import { saveDecision, loadDecision, listDecisions } from "./repository.js";
import { bumpVersion } from "./versioning.js";
import { generateId } from "./utils.js";

export function createDecision(
  domain: string,
  slug: string,
  confidence?: number
): DecisionRecord {
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
    record,
    `# ${record.id}\n\n## 🧭 Context\n\n## ⚖️ Options Considered\n\n## 🧠 Decision\n`
  );
  return record;
}

export function acceptDecision(id: string): DecisionRecord {
  const rec = loadDecision(id);
  const today = new Date().toISOString().slice(0, 10);
  rec.status = "accepted";
  rec.lastEdited = today;
  rec.changelog?.push({ date: today, note: "Marked as accepted" });
  saveDecision(rec);
  return rec;
}

export function listAll(status?: string): DecisionRecord[] {
  const all = listDecisions();
  return status ? all.filter((r) => r.status === status) : all;
}
