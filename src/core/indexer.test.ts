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

function makeRecord(domain: string, slug: string): DecisionRecord {
  const id = `DR--20250101--${domain}--${slug}`;
  return {
    id,
    dateCreated: "2025-01-01",
    version: "1.0",
    status: "draft",
    changeType: "creation",
    domain,
    slug,
    changelog: [],
  };
}

describe("generateIndex", () => {
  it("produces a markdown index grouped by domain", () => {
    const context = makeContext();
    const alphaRecord = makeRecord("alpha", "first");
    const betaRecord = makeRecord("beta", "second");
    const alphaTwoRecord = makeRecord("alpha", "second");

    saveDecision(context, alphaRecord, "# alpha first");
    saveDecision(context, betaRecord, "# beta second");
    saveDecision(context, alphaTwoRecord, "# alpha second");

    const result = generateIndex(context);
    expect(result.filePath).toBe(path.join(context.root, "index.md"));
    expect(fs.existsSync(result.filePath)).toBe(true);

    const content = fs.readFileSync(result.filePath, "utf8");
    expect(content).toContain("# Test Decisions");
    const alphaHeading = content.indexOf("## alpha");
    const betaHeading = content.indexOf("## beta");
    expect(alphaHeading).toBeGreaterThan(-1);
    expect(betaHeading).toBeGreaterThan(-1);
    expect(alphaHeading).toBeLessThan(betaHeading);
    expect(content).toMatch(
      /\[DR--20250101--alpha--first]\(\.\/alpha\/DR--20250101--alpha--first\.md\)/,
    );
    expect(content).toMatch(
      /\[DR--20250101--beta--second]\(\.\/beta\/DR--20250101--beta--second\.md\)/,
    );

    expect(() => generateIndex(context)).not.toThrow();
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
