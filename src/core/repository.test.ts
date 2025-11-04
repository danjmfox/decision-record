import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, afterEach, describe, expect, it } from "vitest";
import { resolveRepoContext } from "../config.js";
import { saveDecision, listDecisions, loadDecision } from "./repository.js";
import type { DecisionRecord } from "./models.js";

const tempDirs: string[] = [];

function makeTempDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "drctl-repo-test-"));
  tempDirs.push(dir);
  return dir;
}

afterEach(() => {
  // Clean up files created during a test so later tests don't see them.
  while (tempDirs.length > 1) {
    const dir = tempDirs.pop();
    if (dir) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }
});

afterAll(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }
});

function createRecord(domain: string, slug: string): DecisionRecord {
  return {
    id: `DR--20250101--${domain}--${slug}`,
    dateCreated: "2025-01-01",
    version: "1.0",
    status: "draft",
    changeType: "creation",
    domain,
    slug,
    changelog: [],
  } as DecisionRecord;
}

describe("repository domain handling", () => {
  it("places records inside defaultDomainDir when no override exists", () => {
    const cwd = makeTempDir();
    const repoRoot = path.join(cwd, "repo");
    fs.mkdirSync(repoRoot, { recursive: true });
    const configPath = path.join(cwd, ".drctl.yaml");
    fs.writeFileSync(
      configPath,
      `repos:\n  work:\n    path: ./repo\n    defaultDomainDir: domains\n`,
    );

    const context = resolveRepoContext({ cwd, repoFlag: "work" });
    const record = createRecord("personal", "hydrate");
    const filePath = saveDecision(context, record, "content");

    expect(filePath).toBe(
      path.join(repoRoot, "domains", "personal", `${record.id}.md`),
    );
    expect(fs.existsSync(path.dirname(filePath))).toBe(true);
    const loaded = loadDecision(context, record.id);
    expect(loaded.domain).toBe("personal");
  });

  it("places records in domain override folders", () => {
    const cwd = makeTempDir();
    const repoRoot = path.join(cwd, "repo");
    fs.mkdirSync(path.join(repoRoot, "custom"), { recursive: true });
    const configPath = path.join(cwd, ".drctl.yaml");
    fs.writeFileSync(
      configPath,
      `repos:\n  work:\n    path: ./repo\n    defaultDomainDir: domains\n    domains:\n      personal: custom/personal\n`,
    );

    const context = resolveRepoContext({ cwd, repoFlag: "work" });
    const record = createRecord("personal", "hydrate");
    const filePath = saveDecision(context, record, "marker");

    expect(filePath).toBe(
      path.join(repoRoot, "custom", "personal", `${record.id}.md`),
    );
    const loaded = loadDecision(context, record.id);
    expect(loaded.domain).toBe("personal");
  });

  it("lists decisions across nested domain directories", () => {
    const cwd = makeTempDir();
    const repoRoot = path.join(cwd, "repo");
    fs.mkdirSync(repoRoot, { recursive: true });
    const configPath = path.join(cwd, ".drctl.yaml");
    fs.writeFileSync(
      configPath,
      `repos:\n  work:\n    path: ./repo\n    defaultDomainDir: domains\n    domains:\n      personal: custom/personal\n      meta: domains/meta\n`,
    );

    const context = resolveRepoContext({ cwd, repoFlag: "work" });
    saveDecision(context, createRecord("personal", "hydrate"), "A");
    saveDecision(context, createRecord("meta", "decision-policy"), "B");

    const decisions = listDecisions(context);
    const ids = decisions.map((r) => r.id).sort((a, b) => a.localeCompare(b));
    expect(ids).toEqual([
      "DR--20250101--meta--decision-policy",
      "DR--20250101--personal--hydrate",
    ]);
  });
});
