import { describe, it, expect } from "vitest";
import type { DecisionRecord, ReviewHistoryEntry } from "./models.js";
import { validateDecisions, type ValidationIssue } from "./validation.js";

const base: DecisionRecord = {
  id: "DR--20250101--meta--base",
  dateCreated: "2025-01-01",
  version: "1.0.0",
  status: "draft",
  changeType: "creation",
  domain: "meta",
  slug: "base",
  changelog: [{ date: "2025-01-01", note: "Initial creation" }],
};

function issues(records: DecisionRecord[]): ValidationIssue[] {
  return validateDecisions(records, { scope: "repo", repoName: "demo" });
}

describe("governance validation (per-repo)", () => {
  it("flags missing required fields", () => {
    const invalid = { ...base, id: "", status: "" as DecisionRecord["status"] };
    const result = issues([invalid]);
    expect(result).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "missing-id",
          severity: "error",
        }),
        expect.objectContaining({
          code: "invalid-status",
          severity: "error",
        }),
      ]),
    );
  });

  it("flags invalid supersede linkage", () => {
    const oldRec: DecisionRecord = {
      ...base,
      id: "DR--20240101--meta--old",
      status: "superseded",
      changeType: "supersession",
      supersededBy: null,
    };
    const newRec: DecisionRecord = {
      ...base,
      id: "DR--20240102--meta--new",
      status: "accepted",
      changeType: "supersession",
      supersedes: "DR--20240101--meta--old",
    };
    const broken: DecisionRecord = {
      ...newRec,
      supersedes: "DR--99999999--meta--missing",
    };
    const result = issues([oldRec, broken]);
    expect(result).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "missing-supersede-link",
          recordId: "DR--20240101--meta--old",
        }),
        expect.objectContaining({
          code: "dangling-supersedes",
          recordId: "DR--20240102--meta--new",
        }),
      ]),
    );
  });

  it("flags duplicate decision IDs", () => {
    const dupA: DecisionRecord = { ...base, id: "DR--20240101--meta--dup" };
    const dupB: DecisionRecord = { ...base, id: "DR--20240101--meta--dup" };
    const result = issues([dupA, dupB]);
    expect(result).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "duplicate-id",
          severity: "error",
          recordId: "DR--20240101--meta--dup",
        }),
      ]),
    );
  });

  it("flags unknown change types", () => {
    const invalid: DecisionRecord = {
      ...base,
      id: "DR--20240101--meta--bad-change-type",
      changeType: "unknown" as DecisionRecord["changeType"],
    };
    const result = issues([invalid]);
    expect(result).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "invalid-change-type",
          recordId: "DR--20240101--meta--bad-change-type",
        }),
      ]),
    );
  });

  it("allows creation change type after acceptance", () => {
    const accepted: DecisionRecord = {
      ...base,
      id: "DR--20240101--meta--accepted",
      status: "accepted",
      changeType: "creation",
    };
    const result = issues([accepted]);
    expect(result).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "invalid-change-type" }),
      ]),
    );
  });

  it("rejects creation change type once deprecated", () => {
    const deprecated: DecisionRecord = {
      ...base,
      id: "DR--20240101--meta--deprecated",
      status: "deprecated",
      changeType: "creation",
    };
    const result = issues([deprecated]);
    expect(result).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "invalid-change-type",
          recordId: "DR--20240101--meta--deprecated",
        }),
      ]),
    );
  });

  it("warns when review history entries are invalid", () => {
    const withInvalidHistory: DecisionRecord = {
      ...base,
      id: "DR--20240101--meta--bad-review-history",
      reviewHistory: [
        {
          date: "not-a-date",
          type: "foo" as ReviewHistoryEntry["type"],
          outcome: "bar" as ReviewHistoryEntry["outcome"],
        },
      ],
    };
    const result = issues([withInvalidHistory]);
    expect(result).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "invalid-review-entry",
          severity: "warning",
          recordId: "DR--20240101--meta--bad-review-history",
        }),
      ]),
    );
  });

  it("warns when lastReviewedAt uses invalid format", () => {
    const invalidLastReviewed: DecisionRecord = {
      ...base,
      id: "DR--20240101--meta--bad-last-review",
      lastReviewedAt: "Jan 01 2025",
    };
    const result = issues([invalidLastReviewed]);
    expect(result).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "invalid-review-entry",
          severity: "warning",
          recordId: "DR--20240101--meta--bad-last-review",
        }),
      ]),
    );
  });

  it("validates link metadata collections", () => {
    const record: DecisionRecord = {
      ...base,
      id: "DR--20240101--meta--links",
      sources: ["", "obsidian://vault/Meetings/2025-10-21"],
      implementedBy: "not-an-array" as unknown as string[],
      relatedArtifacts: ["", "incident:INC-42"],
    };
    const result = issues([record]);
    const linkIssues = result.filter(
      (issue) => issue.code === "invalid-link-entry",
    );
    expect(linkIssues.length).toBeGreaterThanOrEqual(2);
    expect(linkIssues[0]).toEqual(
      expect.objectContaining({
        severity: "warning",
        recordId: "DR--20240101--meta--links",
      }),
    );
  });
});
