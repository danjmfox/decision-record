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

const VALID_STATUSES: DecisionRecord["status"][] = [
  "draft",
  "proposed",
  "accepted",
  "deprecated",
  "superseded",
  "rejected",
  "retired",
  "archived",
];

const CHANGE_TYPES: DecisionRecord["changeType"][] = [
  "creation",
  "correction",
  "revision",
  "supersession",
  "retirement",
];

export function validateDecisions(
  records: DecisionRecord[],
  _context: ValidationContext,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const seenIds = new Map<string, DecisionRecord[]>();

  for (const record of records) {
    seenIds.set(record.id, [...(seenIds.get(record.id) ?? []), record]);

    if (!record.id || record.id.trim().length === 0) {
      issues.push({
        code: "missing-id",
        recordId: record.id ?? "(unknown)",
        severity: "error",
        message: "Decision record is missing an id.",
      });
    }

    if (!VALID_STATUSES.includes(record.status)) {
      issues.push({
        code: "invalid-status",
        recordId: record.id,
        severity: "error",
        message: `Status "${record.status}" is not recognised.`,
        details: { status: record.status },
      });
    }

    if (!CHANGE_TYPES.includes(record.changeType)) {
      issues.push({
        code: "invalid-change-type",
        recordId: record.id,
        severity: "error",
        message: `Change type "${record.changeType}" is not recognised.`,
        details: { changeType: record.changeType },
      });
    } else if (
      record.changeType === "creation" &&
      record.status !== "draft" &&
      record.status !== "proposed"
    ) {
      issues.push({
        code: "invalid-change-type",
        recordId: record.id,
        severity: "error",
        message:
          'Records with changeType "creation" should remain in draft/proposed status.',
        details: { status: record.status, changeType: record.changeType },
      });
    }

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
  }

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
