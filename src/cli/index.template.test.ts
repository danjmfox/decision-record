import fs from "fs";
import os from "os";
import path from "path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { RepoContext } from "../config.js";

const originalArgv = process.argv.slice();
const originalCwd = process.cwd();
const tempDirs: string[] = [];

function registerTemp(dir: string): void {
  tempDirs.push(dir);
}

function makeContext(root: string): RepoContext {
  return {
    root,
    name: "demo",
    source: "cli",
    definitionSource: "local",
    configPath: path.join(root, ".drctl.yaml"),
    domainMap: {},
    defaultDomainDir: "domains",
    defaultTemplate: "templates/meta.md",
  };
}

function buildDecisionResult(context: RepoContext, id: string) {
  const filePath = path.join(
    context.root,
    context.defaultDomainDir ?? "",
    `${id}.md`,
  );
  return {
    record: {
      id,
      status: "draft",
      changeType: "creation",
      domain: "meta",
      slug: "custom",
      dateCreated: "2025-01-01",
      version: "1.0.0",
      changelog: [],
    },
    filePath,
    context,
  };
}

beforeEach(() => {
  vi.resetModules();
});

afterEach(() => {
  process.argv = originalArgv.slice();
  process.chdir(originalCwd);
  delete process.env.DRCTL_TEMPLATE;
  process.exitCode = 0;
  vi.restoreAllMocks();
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }
});

function mockResolveContext(context: RepoContext) {
  vi.doMock("../core/service.js", () => ({
    createDecision: vi.fn(),
    correctionDecision: vi.fn(),
    draftDecision: vi.fn(),
    proposeDecision: vi.fn(),
    acceptDecision: vi.fn(),
    rejectDecision: vi.fn(),
    deprecateDecision: vi.fn(),
    retireDecision: vi.fn(),
    supersedeDecision: vi.fn(),
    reviseDecision: vi.fn(),
    listAll: vi.fn().mockReturnValue([]),
    resolveContext: vi.fn().mockReturnValue(context),
  }));
}

describe("cli template-aware flows", () => {
  it("passes template options to createDecision and reports template provenance", async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "drctl-cli-new-"));
    registerTemp(tempDir);
    const context = makeContext(tempDir);

    const createDecision = vi.fn().mockReturnValue({
      ...buildDecisionResult(context, "DR--20250101--meta--custom"),
      record: {
        id: "DR--20250101--meta--custom",
        status: "draft",
        changeType: "creation",
        domain: "meta",
        slug: "custom",
        dateCreated: "2025-01-01",
        version: "1.0.0",
        changelog: [],
        templateUsed: "templates/meta.md",
      },
    });

    vi.doMock("../core/service.js", () => ({
      createDecision,
      correctionDecision: vi.fn(),
      draftDecision: vi.fn(),
      proposeDecision: vi.fn(),
      acceptDecision: vi.fn(),
      rejectDecision: vi.fn(),
      deprecateDecision: vi.fn(),
      retireDecision: vi.fn(),
      supersedeDecision: vi.fn(),
      reviseDecision: vi.fn(),
      listAll: vi.fn().mockReturnValue([]),
      resolveContext: vi.fn().mockReturnValue(context),
    }));

    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    process.chdir(tempDir);
    process.env.DRCTL_TEMPLATE = " env-template.md ";
    process.argv = [
      "node",
      "drctl",
      "new",
      "meta",
      "custom",
      "--template",
      "custom.md",
      "--confidence",
      "0.7",
    ];

    await import("./index.js");

    expect(createDecision).toHaveBeenCalledTimes(1);
    const [, , options] = createDecision.mock.calls[0] ?? [];
    expect(options).toMatchObject({
      templatePath: "custom.md",
      envTemplate: " env-template.md ",
      confidence: 0.7,
    });
    const logMessages = logSpy.mock.calls.map((call) => String(call[0] ?? ""));
    expect(
      logMessages.some((message) => message.includes("🧩 Template:")),
    ).toBe(true);
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it("logs the resolved repo including default template when running template-aware commands", async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "drctl-cli-index-"));
    registerTemp(tempDir);
    const context = makeContext(tempDir);

    mockResolveContext(context);

    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    process.chdir(tempDir);
    process.argv = ["node", "drctl", "index"];

    await import("./index.js");

    const output = logSpy.mock.calls.map((call) => String(call[0] ?? ""));
    expect(
      output.some((line) =>
        line.includes("Default template: templates/meta.md"),
      ),
    ).toBe(true);
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it("lists decisions with formatted output", async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "drctl-cli-list-"));
    registerTemp(tempDir);
    const context = makeContext(tempDir);

    vi.doMock("../core/service.js", () => ({
      createDecision: vi.fn(),
      correctionDecision: vi.fn(),
      draftDecision: vi.fn(),
      proposeDecision: vi.fn(),
      acceptDecision: vi.fn(),
      rejectDecision: vi.fn(),
      deprecateDecision: vi.fn(),
      retireDecision: vi.fn(),
      supersedeDecision: vi.fn(),
      reviseDecision: vi.fn(),
      listAll: vi.fn().mockReturnValue([
        {
          id: "DR--20250101--meta--list",
          status: "draft",
          domain: "meta",
        },
      ]),
      resolveContext: vi.fn().mockReturnValue(context),
    }));

    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    process.chdir(tempDir);
    process.argv = ["node", "drctl", "list"];

    await import("./index.js");

    const output = logSpy.mock.calls.map((call) => String(call[0] ?? ""));
    expect(
      output.some(
        (line) =>
          line.includes("DR--20250101--meta--list") && line.includes("draft"),
      ),
    ).toBe(true);
  });

  it("surfaces template hygiene warnings during proposal", async () => {
    const tempDir = fs.mkdtempSync(
      path.join(os.tmpdir(), "drctl-cli-propose-"),
    );
    registerTemp(tempDir);
    const context = makeContext(tempDir);

    const proposeDecision = vi
      .fn()
      .mockImplementation(
        async (
          _id: string,
          options: { onTemplateWarning?: (message: string) => void },
        ) => {
          options.onTemplateWarning?.("Template hygiene: placeholder detected");
          return {
            ...buildDecisionResult(context, "DR--20250101--meta--placeholder"),
            record: {
              id: "DR--20250101--meta--placeholder",
              status: "proposed",
              changeType: "creation",
              domain: "meta",
              slug: "placeholder",
              dateCreated: "2025-01-01",
              version: "1.0.0",
              changelog: [],
            },
          };
        },
      );

    vi.doMock("../core/service.js", () => ({
      createDecision: vi.fn(),
      correctionDecision: vi.fn(),
      draftDecision: vi.fn(),
      proposeDecision,
      acceptDecision: vi.fn(),
      rejectDecision: vi.fn(),
      deprecateDecision: vi.fn(),
      retireDecision: vi.fn(),
      supersedeDecision: vi.fn(),
      reviseDecision: vi.fn(),
      listAll: vi.fn().mockReturnValue([]),
      resolveContext: vi.fn().mockReturnValue(context),
    }));

    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    process.chdir(tempDir);
    process.argv = [
      "node",
      "drctl",
      "propose",
      "DR--20250101--meta--placeholder",
    ];

    await import("./index.js");

    expect(proposeDecision).toHaveBeenCalledTimes(1);
    expect(
      warnSpy.mock.calls.some((call) =>
        String(call[0]).includes("Template hygiene"),
      ),
    ).toBe(true);
    expect(
      logSpy.mock.calls.some((call) =>
        String(call[0] ?? "").includes("proposed"),
      ),
    ).toBe(true);
  });

  it("reuses existing onTemplateWarning handlers during acceptance", async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "drctl-cli-accept-"));
    registerTemp(tempDir);
    const context = makeContext(tempDir);
    const handler = vi.fn();

    vi.doMock("./options.js", async () => {
      const actual =
        await vi.importActual<typeof import("./options.js")>("./options.js");
      return {
        ...actual,
        collectRepoOptions: vi.fn(() => ({
          cwd: tempDir,
          onTemplateWarning: handler,
        })),
      };
    });

    const acceptDecision = vi
      .fn()
      .mockImplementation(
        async (
          _id: string,
          options: { onTemplateWarning?: (message: string) => void },
        ) => {
          options.onTemplateWarning?.("Handled by repo options");
          return {
            ...buildDecisionResult(context, "DR--20250101--meta--approved"),
            record: {
              id: "DR--20250101--meta--approved",
              status: "accepted",
              changeType: "creation",
              domain: "meta",
              slug: "approved",
              dateCreated: "2025-01-01",
              version: "1.0.0",
              changelog: [],
            },
          };
        },
      );

    vi.doMock("../core/service.js", () => ({
      createDecision: vi.fn(),
      correctionDecision: vi.fn(),
      draftDecision: vi.fn(),
      proposeDecision: vi.fn(),
      acceptDecision,
      rejectDecision: vi.fn(),
      deprecateDecision: vi.fn(),
      retireDecision: vi.fn(),
      supersedeDecision: vi.fn(),
      reviseDecision: vi.fn(),
      listAll: vi.fn().mockReturnValue([]),
      resolveContext: vi.fn().mockReturnValue(context),
    }));

    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    process.chdir(tempDir);
    process.argv = ["node", "drctl", "accept", "DR--20250101--meta--approved"];

    await import("./index.js");

    expect(acceptDecision).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith("Handled by repo options");
    expect(warnSpy).not.toHaveBeenCalled();
    expect(
      logSpy.mock.calls.some((call) =>
        String(call[0] ?? "").includes("marked as accepted"),
      ),
    ).toBe(true);
  });

  it("fails index generation when the resolved repo root is missing", async () => {
    const missingRoot = path.join(os.tmpdir(), "drctl-missing-root");
    const context = makeContext(missingRoot);
    const generateIndex = vi.fn();

    vi.doMock("../core/service.js", () => ({
      createDecision: vi.fn(),
      correctionDecision: vi.fn(),
      draftDecision: vi.fn(),
      proposeDecision: vi.fn(),
      acceptDecision: vi.fn(),
      rejectDecision: vi.fn(),
      deprecateDecision: vi.fn(),
      retireDecision: vi.fn(),
      supersedeDecision: vi.fn(),
      reviseDecision: vi.fn(),
      listAll: vi.fn().mockReturnValue([]),
      resolveContext: vi.fn().mockReturnValue(context),
    }));

    vi.doMock("../core/indexer.js", () => ({
      generateIndex,
    }));

    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    process.argv = ["node", "drctl", "index"];

    await import("./index.js");

    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining(`Repo root "${context.root}" does not exist`),
    );
    expect(generateIndex).not.toHaveBeenCalled();
    expect(process.exitCode).toBe(1);
  });
});
