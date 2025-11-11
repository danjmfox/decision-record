import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { RepoContext } from "../config.js";

const originalArgv = process.argv.slice();
const originalCwd = process.cwd();
const tempDirs: string[] = [];
let stderrSpy: ReturnType<typeof vi.spyOn> | undefined;

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
    gitMode: "disabled",
    gitModeSource: "detected",
  };
}

function createTempContext(prefix: string): {
  tempDir: string;
  context: RepoContext;
} {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  registerTemp(tempDir);
  return { tempDir, context: makeContext(tempDir) };
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

async function runCli(tempDir: string, args: string[]): Promise<void> {
  process.chdir(tempDir);
  process.argv = ["node", "drctl", ...args];
  await import("./index.js");
}

function spyConsole() {
  const log = vi.spyOn(console, "log").mockImplementation(() => {});
  const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  const error = vi.spyOn(console, "error").mockImplementation(() => {});
  return { log, warn, error };
}

type ConsoleSpy = ReturnType<typeof spyConsole>["log"];

function collectOutput(spy: ConsoleSpy): string[] {
  const calls = spy.mock.calls as Array<[unknown, ...unknown[]]>;
  return calls.map(([first]) => String(first ?? ""));
}

beforeEach(() => {
  vi.resetModules();
  stderrSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
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
  stderrSpy?.mockRestore();
  stderrSpy = undefined;
});

function mockService(
  context: RepoContext,
  overrides: Partial<
    Record<keyof ReturnType<typeof buildDefaultServiceMocks>, unknown>
  > = {},
) {
  const mocks = buildDefaultServiceMocks(context);
  Object.assign(mocks, overrides);
  vi.doMock("../core/service.js", () => mocks);
  return mocks;
}

function buildDefaultServiceMocks(context: RepoContext) {
  return {
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
    reviewDecision: vi.fn(),
    listAll: vi.fn().mockReturnValue([]),
    resolveContext: vi.fn().mockReturnValue(context),
  };
}

describe("cli template-aware flows", () => {
  it("passes template options to createDecision and reports template provenance", async () => {
    const { tempDir, context } = createTempContext("drctl-cli-new-");

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

    mockService(context, { createDecision });

    const { log: logSpy, warn: warnSpy } = spyConsole();

    process.env.DRCTL_TEMPLATE = " env-template.md ";
    await runCli(tempDir, [
      "decision",
      "new",
      "meta",
      "custom",
      "--template",
      "custom.md",
      "--confidence",
      "0.7",
    ]);

    expect(createDecision).toHaveBeenCalledTimes(1);
    const [, , options] = createDecision.mock.calls[0] ?? [];
    expect(options).toMatchObject({
      templatePath: "custom.md",
      envTemplate: " env-template.md ",
      confidence: 0.7,
    });
    const logMessages = collectOutput(logSpy);
    expect(
      logMessages.some((message) => message.includes("🧩 Template:")),
    ).toBe(true);
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it("warns when using the legacy top-level new command", async () => {
    const { tempDir, context } = createTempContext("drctl-cli-legacy-new-");

    const createDecision = vi
      .fn()
      .mockReturnValue(
        buildDecisionResult(context, "DR--20250101--meta--legacy"),
      );

    mockService(context, { createDecision });

    const { warn: warnSpy } = spyConsole();

    await runCli(tempDir, ["new", "meta", "legacy"]);

    expect(createDecision).toHaveBeenCalledTimes(1);
    const warningMessages = collectOutput(warnSpy);
    expect(
      warningMessages.some((message) => message.includes("drctl decision new")),
    ).toBe(true);
  });

  it("routes decision review with metadata overrides", async () => {
    const { tempDir, context } = createTempContext("drctl-cli-review-");
    const recordId = "DR--20250101--meta--review-me";
    const baseResult = buildDecisionResult(context, recordId);
    const reviewDecision = vi.fn().mockResolvedValue({
      ...baseResult,
      record: {
        ...baseResult.record,
        reviewDate: "2025-12-30",
      },
      reviewEntry: {
        date: "2025-10-30",
        type: "adhoc",
        outcome: "revise",
        reviewer: "cli-user",
        reason: "Adjustment",
      },
    });
    mockService(context, { reviewDecision });
    const { log: logSpy } = spyConsole();

    await runCli(tempDir, [
      "decision",
      "review",
      recordId,
      "--type",
      "adhoc",
      "--outcome",
      "revise",
      "--note",
      "Adjustment",
      "--reviewer",
      "cli-user",
    ]);

    expect(reviewDecision).toHaveBeenCalledWith(
      recordId,
      expect.objectContaining({
        reviewType: "adhoc",
        outcome: "revise",
        note: "Adjustment",
        reviewer: "cli-user",
      }),
    );
    const logs = collectOutput(logSpy);
    expect(logs.some((line) => line.includes("Next review"))).toBe(true);
  });

  it("routes decision revise with note and confidence options", async () => {
    const { tempDir, context } = createTempContext("drctl-cli-revise-");
    const recordId = "DR--20250101--meta--revise";
    const reviseDecision = vi.fn().mockResolvedValue({
      ...buildDecisionResult(context, recordId),
      record: {
        ...buildDecisionResult(context, recordId).record,
        version: "1.1.0",
      },
    });

    mockService(context, { reviseDecision });
    const { log: logSpy } = spyConsole();

    await runCli(tempDir, [
      "decision",
      "revise",
      recordId,
      "--note",
      "Bumped confidence",
      "--confidence",
      "0.9",
    ]);

    expect(reviseDecision).toHaveBeenCalledWith(
      recordId,
      expect.objectContaining({
        note: "Bumped confidence",
        confidence: 0.9,
      }),
    );
    const logs = collectOutput(logSpy);
    expect(logs.some((entry) => entry.includes("📝"))).toBe(true);
    expect(logs.some((entry) => entry.includes("Review: adhoc → revise"))).toBe(
      true,
    );
  });

  it("routes decision propose and surfaces template warnings", async () => {
    const { tempDir, context } = createTempContext("drctl-cli-propose-");
    const recordId = "DR--20250101--meta--proposal";
    const proposeDecision = vi.fn().mockImplementation(async (_, options) => {
      options.onTemplateWarning?.("Template missing");
      return {
        ...buildDecisionResult(context, recordId),
        record: {
          ...buildDecisionResult(context, recordId).record,
          status: "proposed",
        },
      };
    });

    mockService(context, { proposeDecision });
    const { log: logSpy, warn: warnSpy } = spyConsole();

    await runCli(tempDir, ["decision", "propose", recordId]);

    expect(proposeDecision).toHaveBeenCalled();
    expect(collectOutput(logSpy).some((entry) => entry.includes("📤"))).toBe(
      true,
    );
    expect(
      collectOutput(warnSpy).some((entry) =>
        entry.includes("Template missing"),
      ),
    ).toBe(true);
  });

  it.each([
    {
      name: "draft",
      command: ["decision", "draft", "DR--20250101--meta--draft"],
      serviceKey: "draftDecision",
      symbol: "✏️",
    },
    {
      name: "accept",
      command: ["decision", "accept", "DR--20250101--meta--accept"],
      serviceKey: "acceptDecision",
      symbol: "✅",
      warningMessage: "Accept template mismatch",
    },
    {
      name: "reject",
      command: ["decision", "reject", "DR--20250101--meta--reject"],
      serviceKey: "rejectDecision",
      symbol: "🚫",
    },
    {
      name: "deprecate",
      command: ["decision", "deprecate", "DR--20250101--meta--deprecate"],
      serviceKey: "deprecateDecision",
      symbol: "⚠️",
    },
    {
      name: "retire",
      command: ["decision", "retire", "DR--20250101--meta--retire"],
      serviceKey: "retireDecision",
      symbol: "🪦",
    },
  ] as const)(
    "routes decision $name command to the service layer",
    async ({ command, serviceKey, symbol, warningMessage }) => {
      const { tempDir, context } = createTempContext(
        `drctl-cli-${serviceKey}-`,
      );
      const recordId = command.at(-1) ?? "DR--UNKNOWN";
      const result = {
        ...buildDecisionResult(context, recordId),
        record: {
          ...buildDecisionResult(context, recordId).record,
          status: "custom",
        },
      };
      const serviceMock = vi.fn().mockImplementation(async (_id, options) => {
        if (warningMessage) {
          options?.onTemplateWarning?.(warningMessage);
        }
        return result;
      });
      mockService(context, { [serviceKey]: serviceMock });
      const { log: logSpy, warn: warnSpy } = spyConsole();

      await runCli(tempDir, ["decision", ...command.slice(1)]);

      expect(serviceMock).toHaveBeenCalledWith(recordId, expect.anything());
      expect(
        collectOutput(logSpy).some((entry) => entry.includes(symbol)),
      ).toBe(true);
      if (serviceKey === "retireDecision") {
        expect(
          collectOutput(logSpy).some((entry) =>
            entry.includes("Review: adhoc → retire"),
          ),
        ).toBe(true);
      }
      if (warningMessage) {
        expect(
          collectOutput(warnSpy).some((entry) =>
            entry.includes(warningMessage),
          ),
        ).toBe(true);
      }
    },
  );

  it("routes decision supersede and logs both file paths", async () => {
    const { tempDir, context } = createTempContext("drctl-cli-supersede-");
    const supersedeDecision = vi.fn().mockResolvedValue({
      record: {
        ...buildDecisionResult(context, "DR--OLD").record,
        id: "DR--OLD",
      },
      newRecord: {
        ...buildDecisionResult(context, "DR--NEW").record,
        id: "DR--NEW",
      },
      filePath: path.join(context.root, "old.md"),
      newFilePath: path.join(context.root, "new.md"),
    });

    mockService(context, { supersedeDecision });
    const { log: logSpy } = spyConsole();

    await runCli(tempDir, ["decision", "supersede", "DR--OLD", "DR--NEW"]);

    expect(supersedeDecision).toHaveBeenCalledWith(
      "DR--OLD",
      "DR--NEW",
      expect.anything(),
    );
    const logs = collectOutput(logSpy);
    expect(logs.some((entry) => entry.includes("🔁"))).toBe(true);
    expect(logs.some((entry) => entry.includes("Updated:"))).toBe(true);
    expect(
      logs.some((entry) => entry.includes("Review: adhoc → supersede")),
    ).toBe(true);
  });

  it("supports legacy revise command with confidence overrides", async () => {
    const { tempDir, context } = createTempContext("drctl-cli-legacy-revise-");
    const recordId = "DR--20250101--meta--legacy-revise";
    const reviseDecision = vi
      .fn()
      .mockResolvedValue(buildDecisionResult(context, recordId));

    mockService(context, { reviseDecision });
    const { warn: warnSpy } = spyConsole();

    await runCli(tempDir, [
      "revise",
      recordId,
      "--confidence",
      "0.55",
      "--note",
      "legacy",
    ]);

    expect(reviseDecision).toHaveBeenCalledWith(
      recordId,
      expect.objectContaining({
        confidence: 0.55,
        note: "legacy",
      }),
    );
    expect(
      collectOutput(warnSpy).some((message) =>
        message.includes("drctl decision revise"),
      ),
    ).toBe(true);
  });

  it("honours confidence overrides on the legacy new command", async () => {
    const { tempDir, context } = createTempContext(
      "drctl-cli-legacy-new-conf-",
    );
    const createDecision = vi
      .fn()
      .mockReturnValue(
        buildDecisionResult(context, "DR--20250101--meta--legacy"),
      );

    mockService(context, { createDecision });

    await runCli(tempDir, ["new", "meta", "legacy", "--confidence", "0.42"]);

    expect(createDecision).toHaveBeenCalledWith(
      "meta",
      "legacy",
      expect.objectContaining({ confidence: 0.42 }),
    );
  });

  it("logs the resolved repo including default template when running template-aware commands", async () => {
    const { tempDir, context } = createTempContext("drctl-cli-index-");

    mockService(context);

    const { log: logSpy, warn: warnSpy } = spyConsole();

    await runCli(tempDir, ["index"]);

    const output = collectOutput(logSpy);
    expect(
      output.some((line) =>
        line.includes("Default template: templates/meta.md"),
      ),
    ).toBe(true);
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it("lists decisions with formatted output", async () => {
    const { tempDir, context } = createTempContext("drctl-cli-list-");

    mockService(context, {
      listAll: vi.fn().mockReturnValue([
        {
          id: "DR--20250101--meta--list",
          status: "draft",
          domain: "meta",
        },
      ]),
    });

    const { log: logSpy } = spyConsole();

    await runCli(tempDir, ["decision", "list"]);

    const output = collectOutput(logSpy);
    expect(
      output.some(
        (line) =>
          line.includes("DR--20250101--meta--list") && line.includes("draft"),
      ),
    ).toBe(true);
  });

  it("surfaces template hygiene warnings during proposal", async () => {
    const { tempDir, context } = createTempContext("drctl-cli-propose-");

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

    mockService(context, { proposeDecision });

    const { log: logSpy, warn: warnSpy } = spyConsole();

    await runCli(tempDir, [
      "decision",
      "propose",
      "DR--20250101--meta--placeholder",
    ]);

    expect(proposeDecision).toHaveBeenCalledTimes(1);
    expect(
      collectOutput(warnSpy).some((message) =>
        message.includes("Template hygiene"),
      ),
    ).toBe(true);
    expect(
      collectOutput(logSpy).some((message) => message.includes("proposed")),
    ).toBe(true);
  });

  it("reuses existing onTemplateWarning handlers during acceptance", async () => {
    const { tempDir, context } = createTempContext("drctl-cli-accept-");
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

    mockService(context, { acceptDecision });

    const { log: logSpy, warn: warnSpy } = spyConsole();

    await runCli(tempDir, [
      "decision",
      "accept",
      "DR--20250101--meta--approved",
    ]);

    expect(acceptDecision).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith("Handled by repo options");
    expect(warnSpy).not.toHaveBeenCalled();
    expect(
      collectOutput(logSpy).some((message) =>
        message.includes("marked as accepted"),
      ),
    ).toBe(true);
  });

  it("fails index generation when the resolved repo root is missing", async () => {
    const missingRoot = path.join(os.tmpdir(), "drctl-missing-root");
    const context = makeContext(missingRoot);
    const generateIndex = vi.fn();

    mockService(context);

    vi.doMock("../core/indexer.js", () => ({
      generateIndex,
    }));

    const { error: errorSpy } = spyConsole();

    await runCli(process.cwd(), ["index"]);

    expect(collectOutput(errorSpy)).toEqual(
      expect.arrayContaining([
        expect.stringContaining(`Repo root "${context.root}" does not exist`),
      ]),
    );
    expect(generateIndex).not.toHaveBeenCalled();
    expect(process.exitCode).toBe(1);
  });

  it("suppresses duplicate legacy command warnings", async () => {
    process.env.DRCTL_SKIP_PARSE = "1";
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const module = await import("./index.js");
    const hooks = (
      module as unknown as {
        __legacyWarningTest: {
          emitLegacyDecisionWarning: (legacy: string, target: string) => void;
          legacyDecisionWarningsShown: Set<string>;
        };
      }
    ).__legacyWarningTest;

    hooks.legacyDecisionWarningsShown.clear();
    hooks.emitLegacyDecisionWarning("legacy", "drctl decision legacy");
    hooks.emitLegacyDecisionWarning("legacy", "drctl decision legacy");
    expect(warnSpy).toHaveBeenCalledTimes(1);

    hooks.legacyDecisionWarningsShown.clear();
    warnSpy.mockRestore();
    delete process.env.DRCTL_SKIP_PARSE;
  });
});
