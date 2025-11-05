import type { DecisionRecord } from "./models.js";

export type ValidationSeverity = "error" | "warning";

export interface ValidationIssue {
  code:
    | "missing-id"
    | "invalid-status"
    | "duplicate-id"
    | "missing-supersede-link"
    | "dangling-supersedes"
    | "invalid-change-type";
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
    record.status !== "proposed"
  ) {
    return [
      {
        code: "invalid-change-type",
        recordId: record.id,
        severity: "error",
        message:
          'Records with changeType "creation" should remain in draft/proposed status.',
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
