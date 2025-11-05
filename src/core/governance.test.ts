import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import matter from "gray-matter";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { RepoContext } from "../config.js";
import { createDecision } from "./service.js";
import { validateRepository } from "./governance.js";

const tempRoots: string[] = [];

function makeContext(): RepoContext {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "drctl-governance-test-"));
  tempRoots.push(root);
  return {
    root,
    domainMap: {},
    source: "cli",
    name: "test",
  };
}

beforeAll(() => {
  // Keep generated IDs deterministic in assertions.
  const fixed = new Date("2025-10-30T12:00:00Z");
  vi.useFakeTimers();
  vi.setSystemTime(fixed);
});

afterAll(() => {
  vi.useRealTimers();
  for (const dir of tempRoots) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe("validateRepository", () => {
  it("includes file paths alongside validation issues", () => {
    const context = makeContext();
    const deprecated = createDecision("meta", "deprecated", { context });
    const replacement = createDecision("meta", "replacement", { context });

    const deprecatedMatter = matter.read(deprecated.filePath);
    deprecatedMatter.data.status = "superseded";
    deprecatedMatter.data.changeType = "supersession";
    delete deprecatedMatter.data.supersededBy;
    fs.writeFileSync(
      deprecated.filePath,
      matter.stringify(deprecatedMatter.content, deprecatedMatter.data),
    );

    const replacementMatter = matter.read(replacement.filePath);
    replacementMatter.data.status = "accepted";
    replacementMatter.data.changeType = "supersession";
    replacementMatter.data.supersedes = "DR--99999999--meta--missing";
    fs.writeFileSync(
      replacement.filePath,
      matter.stringify(replacementMatter.content, replacementMatter.data),
    );

    const results = validateRepository(context);
    expect(results).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "missing-supersede-link",
          recordId: deprecated.record.id,
          filePath: deprecated.filePath,
        }),
        expect.objectContaining({
          code: "dangling-supersedes",
          recordId: replacement.record.id,
          filePath: replacement.filePath,
        }),
      ]),
    );
  });
});
