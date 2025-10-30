import fs from "fs";
import os from "os";
import path from "path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { RepoContext } from "../config.js";
import { acceptDecision, createDecision, listAll } from "./service.js";

const tempRoots: string[] = [];

function makeContext(): RepoContext {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "drctl-service-test-"));
  tempRoots.push(root);
  return {
    root,
    domainMap: {},
    source: "cli",
    name: "test",
  };
}

beforeAll(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2025-10-30T12:00:00Z"));
});

afterAll(() => {
  vi.useRealTimers();
  for (const dir of tempRoots) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe("service layer", () => {
  it("creates a decision record and persists markdown", () => {
    const context = makeContext();
    const result = createDecision("personal", "hydrate", {
      context,
      confidence: 0.6,
    });

    expect(result.record.id).toBe("DR--20251030--personal--hydrate");
    expect(result.record.status).toBe("proposed");
    expect(result.record.confidence).toBe(0.6);

    const expectedPath = path.join(
      context.root,
      "personal",
      `${result.record.id}.md`,
    );
    expect(fs.existsSync(expectedPath)).toBe(true);
    expect(result.filePath).toBe(expectedPath);

    const stored = listAll(undefined, { context });
    expect(stored).toHaveLength(1);
    const storedRecord = stored[0];
    expect(storedRecord).toBeDefined();
    expect(storedRecord?.id).toBe(result.record.id);
    expect(storedRecord?.status).toBe("proposed");
  });

  it("accepts an existing decision and reflects new status", () => {
    const context = makeContext();
    const creation = createDecision("personal", "hydrate", { context });

    const accepted = acceptDecision(creation.record.id, { context });
    expect(accepted.record.status).toBe("accepted");
    expect(accepted.record.lastEdited).toBe("2025-10-30");
    expect(accepted.filePath).toBe(creation.filePath);

    const acceptedRecords = listAll("accepted", { context });
    expect(acceptedRecords).toHaveLength(1);
    const acceptedRecord = acceptedRecords[0];
    expect(acceptedRecord).toBeDefined();
    expect(acceptedRecord?.status).toBe("accepted");
  });

  it("uses the full template when creating a record", () => {
    const context = makeContext();
    const result = createDecision("personal", "template-check", {
      context,
    });

    const content = fs.readFileSync(result.filePath, "utf8");
    expect(content).toContain("## 🧭 Context");
    expect(content).toContain("## 🧾 Changelog");
    expect(content).toContain("| Option | Description | Outcome  | Rationale");
    expect(content).not.toContain("{ { id } }");
  });
});
