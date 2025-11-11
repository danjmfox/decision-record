import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { generateIndex } from "./indexer.js";
import type { RepoContext } from "../config.js";
import type { DecisionRecord } from "./models.js";
import { saveDecision } from "./repository.js";

const tempDirs: string[] = [];

function makeContext(): RepoContext {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "drctl-index-test-"));
  tempDirs.push(root);
  return {
    root,
    source: "cli",
    name: "Test",
    domainMap: {},
    gitMode: "disabled",
    gitModeSource: "detected",
  };
}

afterAll(() => {
  for (const dir of tempDirs) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

function makeRecord(
  domain: string,
  slug: string,
  overrides: Partial<DecisionRecord> = {},
): DecisionRecord {
  const id = `DR--20250101--${domain}--${slug}`;
  return {
    id,
    dateCreated: "2025-01-01",
    version: "1.0.0",
    status: "draft",
    changeType: "creation",
    domain,
    slug,
    changelog: [],
    ...overrides,
  };
}

function isoDateOffset(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

describe("generateIndex", () => {
  it("renders dashboard sections with metadata tables and kanban", () => {
    const context = makeContext();
    const accepted = makeRecord("meta", "index-overview", {
      status: "accepted",
      lastEdited: "2025-02-02",
      dateAccepted: "2025-02-01",
      reviewDate: isoDateOffset(10),
      confidence: 0.87,
      changeType: "correction",
      tags: ["governance"],
      supersedes: "DR--20250101--meta--old-idx",
      sources: ["obsidian://vault/Meetings/2025-10-21"],
      implementedBy: [
        "https://github.com/example/repo/pull/42",
        "policy://runbooks/value-stream",
      ],
      relatedArtifacts: ["incident:INC-42"],
      reviewHistory: [
        {
          date: "2025-02-01",
          type: "scheduled",
          outcome: "keep",
          reviewer: "policy-bot",
          reason: "Quarterly cadence",
        },
      ],
      lastReviewedAt: "2025-02-01",
    });
    const draft = makeRecord("product", "capture", {
      status: "draft",
      reviewDate: isoDateOffset(-5),
      supersededBy: "DR--20250105--product--capture",
    });

    saveDecision(context, accepted, "# Alpha Index Overview");
    saveDecision(context, draft, "# Capture UX");

    const result = generateIndex(context, { includeGeneratedNote: false });
    expect(result.filePath).toBe(path.join(context.root, "index.md"));
    expect(fs.existsSync(result.filePath)).toBe(true);

    const content = result.markdown;
    expect(content).toContain("## Summary");
    expect(content).toContain("| Decisions | 2 |");
    expect(content).toContain("### Recently Changed");
    expect(content).toContain("## Upcoming Reviews");
    expect(content).toMatch(
      /\[Alpha Index Overview]\(\.\/meta\/DR--20250101--meta--index-overview\.md\)/,
    );
    expect(content).toMatch(/governance/);
    expect(content).toContain("| Links (S\/I\/R) | 1 / 2 / 1 |");
    expect(content).toContain("## Domain Catalogues");
    expect(content).toContain("### meta");
    expect(content).toMatch(
      /\[Capture UX]\(\.\/product\/DR--20250101--product--capture\.md\)/,
    );
    expect(content).toContain("supersedes DR--20250101--meta--old-idx");
    expect(content).toContain("superseded by DR--20250105--product--capture");
    expect(content).toContain("## Status Kanban");
    expect(content).toContain("### Accepted");
    expect(content).toContain("### Draft");
    expect(content).toContain("Links: Inputs:1 · Outputs:2 · Context:1");
    expect(content).toContain("overdue");
    expect(content).toContain("Last Outcome");
    expect(() => generateIndex(context)).not.toThrow();
  });

  it("includes review history tables when requested", () => {
    const context = makeContext();
    const record = makeRecord("meta", "history", {
      status: "accepted",
      reviewDate: "2025-12-30",
      reviewHistory: [
        {
          date: "2025-01-15",
          type: "scheduled",
          outcome: "keep",
          reviewer: "bot",
          reason: "aligned",
        },
        {
          date: "2025-03-01",
          type: "adhoc",
          outcome: "revise",
          reviewer: "lead",
          reason: "scope shift",
        },
      ],
    });
    saveDecision(context, record, "# Body");

    const result = generateIndex(context, {
      includeGeneratedNote: false,
      includeReviewDetails: true,
    });

    expect(result.markdown).toContain("## Review History");
    expect(result.markdown).toContain("scope shift");
    expect(result.markdown).toContain("Revise (Adhoc)");
  });

  it("supports status filters and disabling kanban", () => {
    const context = makeContext();
    const accepted = makeRecord("meta", "done", {
      status: "accepted",
      lastEdited: "2025-03-01",
    });
    const rejected = makeRecord("meta", "discarded", {
      status: "rejected",
    });
    saveDecision(context, accepted, "# Completed work");
    saveDecision(context, rejected, "# Rejected work");

    const result = generateIndex(context, {
      includeGeneratedNote: false,
      statusFilter: ["accepted"],
      includeKanban: false,
    });

    expect(result.markdown).toContain("Filtered statuses: `accepted`");
    expect(result.markdown).toContain("| Decisions | 1 / 2 |");
    expect(result.markdown).not.toContain("## Status Kanban");
    expect(result.markdown).toMatch(/\[Completed work]/);
    expect(result.markdown).toContain(
      "_(No review dates within the next 30 days.)_",
    );
  });

  it("creates the repo directory if it does not exist", () => {
    const context = makeContext();
    const record = makeRecord("alpha", "first");
    saveDecision(context, record, "# body");
    fs.rmSync(context.root, { recursive: true, force: true });

    const result = generateIndex(context);
    expect(fs.existsSync(result.filePath)).toBe(true);
  });
});
