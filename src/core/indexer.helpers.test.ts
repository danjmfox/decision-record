import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import type { RepoContext } from "../config.js";
import type { DecisionRecord } from "./models.js";
import {
  decorateDecision,
  formatConfidence,
  formatDue,
  formatLineage,
  formatReviewOutcome,
  formatTags,
  escapePipes,
} from "./indexer.helpers.js";

const tempDirs: string[] = [];

function makeContext(): RepoContext {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "drctl-indexer-helpers-"));
  tempDirs.push(root);
  return {
    root,
    source: "cli",
    name: "helpers",
    domainMap: {},
    gitMode: "disabled",
    gitModeSource: "detected",
  };
}

function makeRecord(overrides: Partial<DecisionRecord> = {}): DecisionRecord {
  return {
    id: "DR--20250101--meta--helpers",
    dateCreated: "2025-01-01",
    version: "1.0.0",
    status: "accepted",
    changeType: "creation",
    domain: "meta",
    slug: "helpers",
    changelog: [],
    ...overrides,
  };
}

afterAll(() => {
  for (const dir of tempDirs) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe("indexer helpers", () => {
  it("decorates decisions with heading-derived title and review info", () => {
    const context = makeContext();
    const record = makeRecord({
      lastEdited: "2025-03-01",
      reviewDate: "2025-04-01",
      reviewHistory: [
        {
          date: "2025-02-01",
          type: "scheduled",
          outcome: "keep",
          reviewer: "bot",
          reason: "routine check",
        },
      ],
    });
    const filePath = path.join(context.root, record.domain, `${record.id}.md`);
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(
      filePath,
      ["---", "foo: bar", "---", "# Helper Heading", "Body"].join("\n"),
    );

    const decoration = decorateDecision(context, record);
    expect(decoration.title).toBe("Helper Heading");
    expect(decoration.relativePath).toBe(
      `./${path.join(record.domain, `${record.id}.md`)}`
        .split(path.sep)
        .join("/"),
    );
    expect(decoration.lastActivityLabel).toBe("2025-03-01");
    expect(decoration.reviewDateLabel).toBe("2025-04-01");
    expect(decoration.lastReviewOutcome).toBe("Keep (Scheduled)");
    expect(decoration.reviewHistory).toHaveLength(1);
  });

  it("falls back to slug when no heading is present", () => {
    const context = makeContext();
    const record = makeRecord({
      id: "DR--20250102--meta--slugged",
      slug: "slugged-title",
    });
    const filePath = path.join(context.root, record.domain, `${record.id}.md`);
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, "No heading here");

    const decoration = decorateDecision(context, record);
    expect(decoration.title).toBe("Slugged Title");
  });

  it("formats lineage, confidence, due dates, review outcomes, and escapes pipes", () => {
    const record = makeRecord({
      supersedes: "DR--OLD",
      supersededBy: "DR--NEW",
    });
    expect(formatLineage(record)).toBe(
      "supersedes DR--OLD; superseded by DR--NEW",
    );
    expect(formatConfidence(0.732)).toBe("0.73");
    expect(formatDue(-2)).toBe("overdue by 2d");
    expect(formatDue(0)).toBe("today");
    expect(formatDue(3)).toBe("in 3d");
    expect(formatReviewOutcome(undefined)).toBeUndefined();
    expect(
      formatReviewOutcome({
        date: "2025-01-01",
        type: "adhoc",
        outcome: "revise",
      }),
    ).toBe("Revise (Adhoc)");
    expect(formatTags(["meta", "ops"])).toBe("meta, ops");
    expect(formatTags()).toBe("—");
    expect(escapePipes("a|b|c")).toBe("a\\|b\\|c");
  });
});
