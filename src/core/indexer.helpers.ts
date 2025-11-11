import fs from "node:fs";
import path from "node:path";
import type { RepoContext } from "../config.js";
import type { DecisionRecord, ReviewHistoryEntry } from "./models.js";
import { getDecisionPath } from "./repository.js";

export interface DecoratedDecision {
  record: DecisionRecord;
  title: string;
  relativePath: string;
  lastActivityLabel: string;
  lastActivityDate?: Date;
  reviewDateLabel?: string;
  reviewDate?: Date;
  lastReviewEntry?: ReviewHistoryEntry;
  lastReviewOutcome?: string;
  reviewHistory?: ReviewHistoryEntry[];
}

export function decorateDecision(
  context: RepoContext,
  record: DecisionRecord,
): DecoratedDecision {
  const filePath = getDecisionPath(context, record);
  const relative = relativePath(context, record);
  const title = deriveTitle(record, filePath);
  const { label: lastActivityLabel, date: lastActivityDate } =
    deriveLastActivity(record);
  const review = deriveReviewDate(record);
  const lastReview = deriveLastReview(record);
  const decoration: DecoratedDecision = {
    record,
    title,
    relativePath: relative,
    lastActivityLabel,
  };
  if (Array.isArray(record.reviewHistory)) {
    decoration.reviewHistory = [...record.reviewHistory];
  }
  if (lastActivityDate) {
    decoration.lastActivityDate = lastActivityDate;
  }
  if (review?.label) {
    decoration.reviewDateLabel = review.label;
  }
  if (review?.date) {
    decoration.reviewDate = review.date;
  }
  if (lastReview.entry) {
    decoration.lastReviewEntry = lastReview.entry;
    const outcome = formatReviewOutcome(lastReview.entry);
    if (outcome) {
      decoration.lastReviewOutcome = outcome;
    }
  }
  return decoration;
}

export function formatConfidence(
  value: number | undefined,
): string | undefined {
  if (value === undefined || Number.isNaN(value)) {
    return undefined;
  }
  return Number.isInteger(value) ? value.toString() : value.toFixed(2);
}

export function formatTags(tags?: string[]): string {
  if (!tags || tags.length === 0) return "—";
  return tags.join(", ");
}

export function formatLineage(record: DecisionRecord): string {
  const notes: string[] = [];
  if (record.supersedes) {
    notes.push(`supersedes ${record.supersedes}`);
  }
  if (record.supersededBy) {
    notes.push(`superseded by ${record.supersededBy}`);
  }
  return notes.length > 0 ? notes.join("; ") : "—";
}

export function formatDue(diffDays?: number): string {
  if (diffDays === undefined) return "—";
  if (diffDays < 0) {
    return `overdue by ${Math.abs(diffDays)}d`;
  }
  if (diffDays === 0) return "today";
  return `in ${diffDays}d`;
}

export function linkFor(entry: DecoratedDecision): string {
  return `[${entry.title}](${entry.relativePath})`;
}

export function formatReviewOutcome(
  entry?: ReviewHistoryEntry,
): string | undefined {
  if (!entry) return undefined;
  const outcomeLabel = capitalize(entry.outcome);
  if (!outcomeLabel) return undefined;
  const typeLabel = formatReviewType(entry.type);
  return typeLabel ? `${outcomeLabel} (${typeLabel})` : outcomeLabel;
}

export function formatReviewType(
  type?: ReviewHistoryEntry["type"],
): string | undefined {
  if (!type) return undefined;
  return capitalize(type);
}

export function escapePipes(value: string): string {
  return value.replaceAll("\\", "\\\\").replaceAll("|", "\\|");
}

function relativePath(context: RepoContext, record: DecisionRecord): string {
  const domainDir = record.domain ? record.domain : "";
  const target = path.join(domainDir, `${record.id}.md`);
  return `./${path
    .relative(context.root, path.join(context.root, target))
    .split(path.sep)
    .join("/")}`;
}

function deriveLastActivity(record: DecisionRecord): {
  label: string;
  date?: Date;
} {
  const candidates = [
    record.lastEdited,
    record.dateAccepted,
    record.dateCreated,
  ];
  for (const value of candidates) {
    const date = parseDate(value);
    if (value && date) {
      return { label: value, date };
    }
  }
  return { label: "—" };
}

function deriveReviewDate(
  record: DecisionRecord,
): { label: string; date?: Date } | undefined {
  if (!record.reviewDate) return undefined;
  const parsed = parseDate(record.reviewDate);
  if (!parsed) {
    return undefined;
  }
  return { label: record.reviewDate, date: parsed };
}

interface LastReviewResult {
  entry?: ReviewHistoryEntry;
  label?: string;
}

function deriveLastReview(record: DecisionRecord): LastReviewResult {
  if (Array.isArray(record.reviewHistory) && record.reviewHistory.length > 0) {
    const entry = record.reviewHistory.at(-1);
    if (entry) {
      return { entry, label: entry.date };
    }
  }
  if (record.lastReviewedAt) {
    return { label: record.lastReviewedAt };
  }
  return {};
}

function deriveTitle(record: DecisionRecord, filePath: string): string {
  const frontmatterSource = record as unknown as { title?: unknown };
  if (typeof frontmatterSource.title === "string") {
    const trimmed = frontmatterSource.title.trim();
    if (trimmed) {
      return trimmed;
    }
  }
  const heading = extractHeading(filePath);
  if (heading) {
    return heading;
  }
  if (record.slug) {
    return slugToTitle(record.slug);
  }
  return record.id;
}

function extractHeading(filePath: string): string | undefined {
  try {
    const content = fs.readFileSync(filePath, "utf8");
    const lines = content.split(/\r?\n/);
    let inFrontmatter = false;
    let frontmatterSeen = false;
    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!frontmatterSeen && line === "---") {
        inFrontmatter = !inFrontmatter;
        if (!inFrontmatter) {
          frontmatterSeen = true;
        }
        continue;
      }
      if (inFrontmatter) continue;
      if (line.startsWith("# ")) {
        return line.replace(/^#\s+/, "").trim();
      }
    }
    return undefined;
  } catch {
    return undefined;
  }
}

function slugToTitle(slug: string): string {
  return slug
    .split(/[-_]/g)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");
}

export function parseDate(value?: string): Date | undefined {
  if (!value) return undefined;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? undefined : new Date(parsed);
}

function capitalize(value?: string): string | undefined {
  if (!value) return undefined;
  return value.slice(0, 1).toUpperCase() + value.slice(1);
}
