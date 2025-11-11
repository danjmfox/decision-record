import fs from "node:fs";
import path from "node:path";
import type { RepoContext } from "../config.js";
import { listDecisions } from "./repository.js";
import type { DecisionRecord, DecisionStatus } from "./models.js";
import {
  decorateDecision,
  type DecoratedDecision,
  formatConfidence,
  formatDue,
  formatLineage,
  formatReviewOutcome,
  formatReviewType,
  formatTags,
  linkFor,
  escapePipes,
  parseDate,
} from "./indexer.helpers.js";

const STATUS_ORDER: DecisionStatus[] = [
  "new",
  "draft",
  "proposed",
  "accepted",
  "deprecated",
  "superseded",
  "rejected",
  "retired",
  "archived",
];

const DEFAULT_UPCOMING_WINDOW_DAYS = 30;
const DEFAULT_RECENT_LIMIT = 5;

export interface GenerateIndexOptions {
  outputFileName?: string;
  includeGeneratedNote?: boolean;
  title?: string;
  includeKanban?: boolean;
  statusFilter?: DecisionStatus[];
  upcomingDays?: number;
  recentLimit?: number;
  includeReviewDetails?: boolean;
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
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
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
  const upcomingWindow =
    typeof options.upcomingDays === "number" && options.upcomingDays >= 0
      ? options.upcomingDays
      : DEFAULT_UPCOMING_WINDOW_DAYS;
  const recentLimit =
    typeof options.recentLimit === "number" && options.recentLimit > 0
      ? Math.floor(options.recentLimit)
      : DEFAULT_RECENT_LIMIT;

  const validRecords = decisions.filter(isDecisionRecord);
  const statusFilter = buildStatusFilter(options.statusFilter);
  const filteredRecords = statusFilter
    ? validRecords.filter((record) => statusFilter.has(record.status))
    : validRecords;
  const decorated = filteredRecords.map((record) =>
    decorateDecision(context, record),
  );

  const lines: string[] = [];
  lines.push(`# ${title}`, "");
  if (includeGeneratedNote) {
    lines.push(
      `_Generated ${new Date().toISOString().slice(0, 10)} by drctl index_`,
      "",
    );
  }
  if (statusFilter) {
    lines.push(
      `> Filtered statuses: ${Array.from(statusFilter)
        .map((status) => `\`${status}\``)
        .join(", ")}`,
      "",
    );
  }

  const sections: string[][] = [
    renderSummarySection(decorated, validRecords.length, recentLimit),
  ];

  if (decorated.length === 0) {
    sections.push(["_(No decisions match the current filters.)_", ""]);
  } else {
    sections.push(
      renderUpcomingReviewsSection(decorated, upcomingWindow),
      renderDomainCatalogueSection(decorated),
    );
    if (options.includeReviewDetails) {
      sections.push(renderReviewHistorySection(decorated));
    }
    if (options.includeKanban !== false) {
      sections.push(renderKanbanSection(decorated));
    }
  }

  for (const section of sections) {
    lines.push(...section);
  }

  return lines.join("\n");
}

function renderSummarySection(
  records: DecoratedDecision[],
  totalRecords: number,
  recentLimit: number,
): string[] {
  const domainCount = new Set(records.map((item) => item.record.domain)).size;
  const summary: string[] = [
    "## Summary",
    "",
    "| Metric | Value |",
    "| --- | --- |",
    records.length === totalRecords
      ? `| Decisions | ${records.length} |`
      : `| Decisions | ${records.length} / ${totalRecords} |`,
    `| Domains | ${domainCount} |`,
    "",
    "### Status Counts",
    "",
    "| Status | Count |",
    "| --- | --- |",
  ];

  const counts = countStatuses(records.map((item) => item.record));
  summary.push(
    ...STATUS_ORDER.map(
      (status) => `| ${status} | ${counts.get(status) ?? 0} |`,
    ),
    "",
    "### Recently Changed",
    "",
  );

  if (records.length === 0) {
    summary.push("_(No recent changes.)_", "");
    return summary;
  }

  summary.push(
    "| Decision | Status | Last Updated | Version | Domain |",
    "| --- | --- | --- | --- | --- |",
  );
  const recent = [...records]
    .sort((a, b) => compareDatesDesc(a.lastActivityDate, b.lastActivityDate))
    .slice(0, recentLimit);
  for (const entry of recent) {
    summary.push(
      `| ${linkFor(entry)} | ${entry.record.status} | ${
        entry.lastActivityLabel
      } | ${entry.record.version} | ${entry.record.domain} |`,
    );
  }
  summary.push("");
  return summary;
}

function renderUpcomingReviewsSection(
  records: DecoratedDecision[],
  upcomingWindow: number,
): string[] {
  const now = new Date();
  const upcoming = records
    .filter((entry) => entry.reviewDate)
    .filter((entry) => {
      if (!entry.reviewDate) return false;
      const diffDays = daysBetween(now, entry.reviewDate);
      if (diffDays < 0) return true;
      return diffDays <= upcomingWindow;
    })
    .sort((a, b) => compareDatesAsc(a.reviewDate, b.reviewDate));

  const section: string[] = [];
  section.push("## Upcoming Reviews", "");
  if (upcoming.length === 0) {
    section.push(
      `_(No review dates within the next ${upcomingWindow} days.)_`,
      "",
    );
    return section;
  }

  section.push(
    "| Decision | Domain | Status | Next Review | Last Outcome | Confidence | Due |",
    "| --- | --- | --- | --- | --- | --- | --- |",
  );
  const today = new Date();
  for (const entry of upcoming) {
    const diffDays = entry.reviewDate
      ? daysBetween(today, entry.reviewDate)
      : undefined;
    section.push(
      `| ${linkFor(entry)} | ${entry.record.domain} | ${
        entry.record.status
      } | ${entry.reviewDateLabel ?? "—"} | ${
        entry.lastReviewOutcome ?? "—"
      } | ${formatConfidence(entry.record.confidence) ?? "—"} | ${formatDue(
        diffDays,
      )} |`,
    );
  }
  section.push("");
  return section;
}

function renderDomainCatalogueSection(records: DecoratedDecision[]): string[] {
  const grouped = new Map<string, DecoratedDecision[]>();
  for (const entry of records) {
    const domain = entry.record.domain ?? "uncategorised";
    const list = grouped.get(domain) ?? [];
    list.push(entry);
    grouped.set(domain, list);
  }

  const domains = Array.from(grouped.keys()).sort((a, b) => a.localeCompare(b));
  const section: string[] = [];
  section.push("## Domain Catalogues", "");

  for (const domain of domains) {
    section.push(`### ${domain}`, "");
    const entries = grouped.get(domain) ?? [];
    if (entries.length === 0) {
      section.push("_(No decisions in this domain.)_", "");
      continue;
    }
    entries.sort((a, b) =>
      compareDatesDesc(
        parseDate(a.record.dateCreated),
        parseDate(b.record.dateCreated),
      ),
    );
    section.push(
      "| Decision | Status | Version | Change | Accepted/Created | Last Edited | Next Review | Last Outcome | Confidence | Tags | Lineage |",
      "| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |",
    );
    for (const entry of entries) {
      section.push(
        [
          `| ${linkFor(entry)}<br><code>${entry.record.id}</code>`,
          entry.record.status,
          entry.record.version,
          entry.record.changeType,
          entry.record.dateAccepted ?? entry.record.dateCreated ?? "—",
          entry.record.lastEdited ?? "—",
          entry.reviewDateLabel ?? "—",
          entry.lastReviewOutcome ?? "—",
          formatConfidence(entry.record.confidence) ?? "—",
          formatTags(entry.record.tags),
          formatLineage(entry.record),
        ].join(" | ") + " |",
      );
    }
    section.push("");
  }

  return section;
}

function renderKanbanSection(records: DecoratedDecision[]): string[] {
  const columns: Array<{ label: string; statuses: DecisionStatus[] }> = [
    { label: "Draft", statuses: ["draft"] },
    { label: "Proposed", statuses: ["proposed"] },
    { label: "Accepted", statuses: ["accepted"] },
    { label: "Deprecated", statuses: ["deprecated"] },
    { label: "Superseded", statuses: ["superseded"] },
    { label: "Rejected", statuses: ["rejected"] },
    { label: "Retired / Archived", statuses: ["retired", "archived"] },
  ];

  const section: string[] = [];
  section.push("## Status Kanban", "");

  for (const column of columns) {
    section.push(`### ${column.label}`, "");
    const entries = records
      .filter((entry) => column.statuses.includes(entry.record.status))
      .sort((a, b) =>
        compareDatesAsc(
          parseDate(a.record.dateCreated),
          parseDate(b.record.dateCreated),
        ),
      );
    if (entries.length === 0) {
      section.push("- _None_");
    } else {
      for (const entry of entries) {
        section.push(
          `- ${linkFor(entry)} — ${entry.record.domain} (v${
            entry.record.version
          }, updated ${entry.lastActivityLabel ?? "—"})`,
        );
      }
    }
    section.push("");
  }

  return section;
}

function renderReviewHistorySection(records: DecoratedDecision[]): string[] {
  const withHistory = records.filter(
    (entry) => (entry.reviewHistory?.length ?? 0) > 0,
  );
  const section: string[] = [];
  section.push("## Review History", "");
  if (withHistory.length === 0) {
    section.push("_(No review events recorded.)_", "");
    return section;
  }
  for (const entry of withHistory) {
    section.push(`### ${entry.title}`, "");
    section.push(
      "| Date | Outcome | Type | Reviewer | Note |",
      "| --- | --- | --- | --- | --- |",
    );
    const history = [...(entry.reviewHistory ?? [])].reverse();
    for (const item of history) {
      section.push(
        `| ${item.date ?? "—"} | ${
          formatReviewOutcome(item) ?? "—"
        } | ${formatReviewType(item.type) ?? "—"} | ${
          item.reviewer ?? "—"
        } | ${item.reason ? escapePipes(item.reason) : "—"} |`,
      );
    }
    section.push("");
  }
  return section;
}

function countStatuses(records: DecisionRecord[]): Map<DecisionStatus, number> {
  const counts = new Map<DecisionStatus, number>();
  for (const record of records) {
    const current = counts.get(record.status) ?? 0;
    counts.set(record.status, current + 1);
  }
  return counts;
}

function buildStatusFilter(
  statuses?: DecisionStatus[],
): Set<DecisionStatus> | null {
  if (!statuses || statuses.length === 0) {
    return null;
  }
  const valid = statuses.filter((value): value is DecisionStatus =>
    STATUS_ORDER.includes(value),
  );
  if (valid.length === 0) {
    return null;
  }
  return new Set(valid);
}

function isDecisionRecord(record: DecisionRecord): record is DecisionRecord & {
  id: string;
  domain: string;
} {
  return (
    typeof record === "object" &&
    typeof record.id === "string" &&
    record.id.startsWith("DR--") &&
    typeof record.domain === "string" &&
    record.domain.length > 0
  );
}

function daysBetween(from: Date, to: Date): number {
  const diff = Math.floor(
    (to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24),
  );
  return diff;
}

function compareDatesDesc(a?: Date, b?: Date): number {
  if (a && b) {
    return b.getTime() - a.getTime();
  }
  if (a) return -1;
  if (b) return 1;
  return 0;
}

function compareDatesAsc(a?: Date, b?: Date): number {
  if (a && b) {
    return a.getTime() - b.getTime();
  }
  if (a) return -1;
  if (b) return 1;
  return 0;
}

function defaultTitle(context: RepoContext): string {
  if (context.name) {
    return `${context.name} Decisions`;
  }
  return "Decision Index";
}
