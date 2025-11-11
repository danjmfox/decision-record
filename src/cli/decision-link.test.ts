import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

describe("decision link command", () => {
  const originalArgv = process.argv.slice();
  const originalCwd = process.cwd();
  const tempDirs: string[] = [];
  let stderrSpy: ReturnType<typeof vi.spyOn> | undefined;

  afterEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    process.argv = originalArgv.slice();
    process.chdir(originalCwd);
    for (const dir of tempDirs.splice(0, tempDirs.length)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
    stderrSpy?.mockRestore();
    stderrSpy = undefined;
  });

  it("passes link additions and removals to the service layer", async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "drctl-link-"));
    tempDirs.push(tempDir);

    const context = {
      root: tempDir,
      name: "work",
      source: "cli" as const,
      domainMap: {},
      gitMode: "disabled" as const,
      gitModeSource: "detected" as const,
    };

    const linkSpy = vi.fn().mockResolvedValue({
      record: {
        id: "DR--20250101--meta--value-stream-links",
        version: "1.0.1",
        status: "draft",
        changeType: "revision",
        domain: "meta",
        slug: "value-stream-links",
      },
      filePath: path.join(
        tempDir,
        "meta",
        "DR--20250101--meta--value-stream-links.md",
      ),
      context,
    });

    vi.doMock("../core/service.js", () => ({
      acceptDecision: vi.fn(),
      correctionDecision: vi.fn(),
      createDecision: vi.fn(),
      deprecateDecision: vi.fn(),
      draftDecision: vi.fn(),
      linkDecision: linkSpy,
      listAll: vi.fn().mockReturnValue([]),
      proposeDecision: vi.fn(),
      rejectDecision: vi.fn(),
      retireDecision: vi.fn(),
      reviewDecision: vi.fn(),
      reviseDecision: vi.fn(),
      supersedeDecision: vi.fn(),
      resolveContext: vi.fn().mockReturnValue(context),
    }));

    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    stderrSpy = vi
      .spyOn(process.stderr, "write")
      .mockImplementation(() => true);

    process.argv = [
      "node",
      "drctl",
      "decision",
      "link",
      "DR--20250101--meta--value-stream-links",
      "--source",
      "obsidian://vault/Meetings/2025-10-21",
      "--impl",
      "https://github.com/example/repo/pull/42",
      "--related",
      "incident:INC-42",
      "--remove",
      "source:obsidian://vault/Meetings/2025-10-20",
      "--remove",
      "related:dashboard:decisions",
      "--skip-version",
      "--note",
      "Documented links",
    ];

    await import("./index.js");

    expect(linkSpy).toHaveBeenCalledTimes(1);
    const [idArg, optionsArg] = linkSpy.mock.calls[0] ?? [];
    expect(idArg).toBe("DR--20250101--meta--value-stream-links");
    expect(optionsArg?.add).toEqual({
      sources: ["obsidian://vault/Meetings/2025-10-21"],
      implementedBy: ["https://github.com/example/repo/pull/42"],
      relatedArtifacts: ["incident:INC-42"],
    });
    expect(optionsArg?.remove).toEqual({
      sources: ["obsidian://vault/Meetings/2025-10-20"],
      relatedArtifacts: ["dashboard:decisions"],
    });
    expect(optionsArg?.skipVersion).toBe(true);
    expect(optionsArg?.note).toBe("Documented links");
    expect(optionsArg?.context).toEqual(context);

    logSpy.mockRestore();
  });
});
