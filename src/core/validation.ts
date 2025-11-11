import type { DecisionRecord, ReviewHistoryEntry } from "./models.js";

export type ValidationSeverity = "error" | "warning";

export interface ValidationIssue {
  code:
    | "missing-id"
    | "invalid-status"
    | "duplicate-id"
    | "missing-supersede-link"
    | "dangling-supersedes"
    | "invalid-change-type"
    | "invalid-review-entry";
  recordId: string;
  severity: ValidationSeverity;
  message: string;
  details?: Record<string, unknown>;
}

export interface ValidationContext {
  scope: "repo";
  repoName: string;
}

const VALID_STATUSES = new Set<DecisionRecord["status"]>([
  "draft",
  "proposed",
  "accepted",
  "deprecated",
  "superseded",
  "rejected",
  "retired",
  "archived",
]);

const CHANGE_TYPES = new Set<DecisionRecord["changeType"]>([
  "creation",
  "correction",
  "revision",
  "supersession",
  "retirement",
]);

const REVIEW_TYPES = new Set<ReviewHistoryEntry["type"]>([
  "scheduled",
  "adhoc",
  "contextual",
]);

const REVIEW_OUTCOMES = new Set<ReviewHistoryEntry["outcome"]>([
  "keep",
  "revise",
  "retire",
  "supersede",
]);

export function validateDecisions(
  records: DecisionRecord[],
  _context: ValidationContext,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const seenIds = trackIds(records);

  for (const record of records) {
    issues.push(...collectRecordIssues(record, records));
  }

  issues.push(...collectDuplicateIdIssues(seenIds));
  return issues;
}

function trackIds(records: DecisionRecord[]): Map<string, DecisionRecord[]> {
  const seenIds = new Map<string, DecisionRecord[]>();
  for (const record of records) {
    seenIds.set(record.id, [...(seenIds.get(record.id) ?? []), record]);
  }
  return seenIds;
}

function collectRecordIssues(
  record: DecisionRecord,
  records: DecisionRecord[],
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  issues.push(
    ...validateIdentifier(record),
    ...validateStatus(record),
    ...validateChangeType(record),
    ...validateSupersedeLinks(record, records),
    ...validateReviewHistory(record),
  );
  return issues;
}

function validateIdentifier(record: DecisionRecord): ValidationIssue[] {
  if (record.id && record.id.trim().length > 0) {
    return [];
  }
  return [
    {
      code: "missing-id",
      recordId: record.id ?? "(unknown)",
      severity: "error",
      message: "Decision record is missing an id.",
    },
  ];
}

function validateStatus(record: DecisionRecord): ValidationIssue[] {
  if (VALID_STATUSES.has(record.status)) {
    return [];
  }
  return [
    {
      code: "invalid-status",
      recordId: record.id,
      severity: "error",
      message: `Status "${record.status}" is not recognised.`,
      details: { status: record.status },
    },
  ];
}

function validateChangeType(record: DecisionRecord): ValidationIssue[] {
  if (!CHANGE_TYPES.has(record.changeType)) {
    return [
      {
        code: "invalid-change-type",
        recordId: record.id,
        severity: "error",
        message: `Change type "${record.changeType}" is not recognised.`,
        details: { changeType: record.changeType },
      },
    ];
  }
  if (
    record.changeType === "creation" &&
    record.status !== "draft" &&
    record.status !== "proposed" &&
    record.status !== "accepted"
  ) {
    return [
      {
        code: "invalid-change-type",
        recordId: record.id,
        severity: "error",
        message:
          'Records with changeType "creation" must remain in draft, proposed, or accepted status.',
        details: { status: record.status, changeType: record.changeType },
      },
    ];
  }
  return [];
}

function validateSupersedeLinks(
  record: DecisionRecord,
  records: DecisionRecord[],
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (
    record.status === "superseded" &&
    (!record.supersededBy || record.supersededBy.trim().length === 0)
  ) {
    issues.push({
      code: "missing-supersede-link",
      recordId: record.id,
      severity: "error",
      message:
        "Record marked superseded must include a supersededBy reference.",
    });
  }
  if (
    record.supersedes &&
    !records.some((candidate) => candidate.id === record.supersedes)
  ) {
    issues.push({
      code: "dangling-supersedes",
      recordId: record.id,
      severity: "warning",
      message: `Record supersedes "${record.supersedes}" but it was not found in this repo.`,
      details: { supersedes: record.supersedes },
    });
  }
  return issues;
}

function collectDuplicateIdIssues(
  seenIds: Map<string, DecisionRecord[]>,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  for (const [id, group] of seenIds.entries()) {
    if (group.length > 1) {
      issues.push({
        code: "duplicate-id",
        recordId: id,
        severity: "error",
        message: `Decision id "${id}" appears ${group.length} times in this repo.`,
        details: { occurrences: group.length },
      });
    }
  }
  return issues;
}

function validateReviewHistory(record: DecisionRecord): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const history = record.reviewHistory;

  if (history === undefined) {
    if (record.lastReviewedAt && !isIsoDate(record.lastReviewedAt)) {
      issues.push({
        code: "invalid-review-entry",
        recordId: record.id,
        severity: "warning",
        message: `lastReviewedAt "${record.lastReviewedAt}" is not a valid ISO date (YYYY-MM-DD).`,
        details: { field: "lastReviewedAt" },
      });
    }
    return issues;
  }

  if (!Array.isArray(history)) {
    issues.push({
      code: "invalid-review-entry",
      recordId: record.id,
      severity: "warning",
      message: "reviewHistory must be an array.",
      details: { value: history },
    });
    return issues;
  }

  history.forEach((entry, index) => {
    const problems: string[] = [];
    if (!entry || typeof entry !== "object") {
      problems.push("entry missing or malformed");
    } else {
      if (!isIsoDate(entry.date)) {
        problems.push("invalid date");
      }
      if (!entry.type || !REVIEW_TYPES.has(entry.type)) {
        problems.push("invalid type");
      }
      if (!entry.outcome || !REVIEW_OUTCOMES.has(entry.outcome)) {
        problems.push("invalid outcome");
      }
    }
    if (problems.length > 0) {
      issues.push({
        code: "invalid-review-entry",
        recordId: record.id,
        severity: "warning",
        message: `Review history entry #${index + 1} is invalid: ${problems.join(
          ", ",
        )}.`,
        details: { index, problems },
      });
    }
  });

  if (record.lastReviewedAt && !isIsoDate(record.lastReviewedAt)) {
    issues.push({
      code: "invalid-review-entry",
      recordId: record.id,
      severity: "warning",
      message: `lastReviewedAt "${record.lastReviewedAt}" is not a valid ISO date (YYYY-MM-DD).`,
      details: { field: "lastReviewedAt" },
    });
  }

  return issues;
}

function isIsoDate(value?: string): boolean {
  if (typeof value !== "string") {
    return false;
  }
  const trimmed = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return false;
  }
  const parsed = Date.parse(trimmed);
  return Number.isFinite(parsed);
}
