import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { load as loadYaml } from "js-yaml";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MockInstance } from "vitest";
import { saveDecision } from "../core/repository.js";
import type { ConfigDiagnostics, RepoContext } from "../config.js";
import type { DecisionRecord } from "../core/models.js";

function stringify(value: unknown): string {
  if (typeof value === "string") return value;
  if (value === undefined || value === null) return "";
  if (value instanceof Error) {
    return value.message || value.name;
  }
  if (typeof value === "object") {
    try {
      return JSON.stringify(value);
    } catch {
      return "[unserialisable value]";
    }
  }
  if (
    typeof value === "number" ||
    typeof value === "boolean" ||
    typeof value === "bigint"
  ) {
    return value.toString();
  }
  if (typeof value === "symbol") {
    return value.toString();
  }
  return "";
}

describe("cli index commands", () => {
  const originalArgv = process.argv.slice();
  const originalCwd = process.cwd();
  let exitSpy: any;
  let consoleErrorSpy: any;
  let consoleWarnSpy: any;
  let consoleLogSpy: any;
  let stderrSpy: MockInstance | undefined;

  beforeEach(() => {
    vi.resetModules();
    exitSpy = vi.spyOn(process, "exit").mockImplementation(
      // eslint-disable-next-line @typescript-eslint/no-empty-function
      (() => {}) as never,
    );
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    stderrSpy = vi
      .spyOn(process.stderr, "write")
      .mockImplementation(() => true);
  });

  afterEach(() => {
    if (exitSpy) {
      exitSpy.mockRestore();
    }
    if (consoleErrorSpy) {
      consoleErrorSpy.mockRestore();
    }
    if (consoleWarnSpy) {
      consoleWarnSpy.mockRestore();
    }
    if (consoleLogSpy) {
      consoleLogSpy.mockRestore();
    }
    stderrSpy?.mockRestore();
    stderrSpy = undefined;
    process.exitCode = 0;
    process.argv = originalArgv.slice();
    process.chdir(originalCwd);
    delete process.env.DRCTL_CONFIG;
    vi.resetModules();
  });

  function getLogSpy(): any {
    if (!consoleLogSpy) {
      throw new Error("console.log spy not initialised");
    }
    return consoleLogSpy;
  }

  function collectLogLines(): string[] {
    return getLogSpy().mock.calls.map((call: unknown[]) => stringify(call[0]));
  }

  type DiagnosticsOverrides = Partial<ConfigDiagnostics>;

  async function runReportDiagnosticsTest(
    overrides: DiagnosticsOverrides,
    verify: (result: boolean) => void,
  ): Promise<void> {
    const safeCwd = fs.mkdtempSync(path.join(os.tmpdir(), "drctl-config-"));
    const diagnostics: ConfigDiagnostics = {
      cwd: safeCwd,
      warnings: [],
      errors: [],
      repos: [],
      ...overrides,
    };

    process.env.DRCTL_SKIP_PARSE = "1";
    try {
      const module = (await import("./index.js")) as {
        reportConfigDiagnostics: (diagnostics: ConfigDiagnostics) => boolean;
      };
      const helper = module.reportConfigDiagnostics;
      const result = helper(diagnostics);
      verify(result);
    } finally {
      delete process.env.DRCTL_SKIP_PARSE;
      fs.rmSync(safeCwd, { recursive: true, force: true });
    }
  }

  type ConfigSandboxOptions = {
    repoFolder?: string;
    createRepoDir?: boolean;
    initGit?: "repo" | "root";
  };

  function createConfigSandbox(
    config: string,
    options: ConfigSandboxOptions = {},
  ): { tempDir: string; repoDir: string } {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "drctl-cli-test-"));
    const repoFolder = options.repoFolder ?? "workspace";
    const repoDir = path.join(tempDir, repoFolder);
    if (options.createRepoDir !== false) {
      fs.mkdirSync(repoDir, { recursive: true });
    }
    if (options.initGit === "repo") {
      fs.mkdirSync(path.join(repoDir, ".git"), { recursive: true });
    } else if (options.initGit === "root") {
      fs.mkdirSync(path.join(tempDir, ".git"), { recursive: true });
    }
    fs.writeFileSync(path.join(tempDir, ".drctl.yaml"), config);
    return { tempDir, repoDir };
  }

  const BASIC_WORKSPACE_CONFIG = `repos:
  work:
    path: ./workspace
`;

  function createWorkspaceRepo(options: { gitAtRoot?: boolean } = {}) {
    return createConfigSandbox(BASIC_WORKSPACE_CONFIG, {
      initGit: options.gitAtRoot ? "root" : "repo",
    });
  }

  async function runCli(tempDir: string, args: string[]): Promise<string[]> {
    process.chdir(tempDir);
    process.argv = ["node", "drctl", ...args];
    await import("./index.js");
    return collectLogLines();
  }

  it("rejects --repo flag usage", async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "drctl-cli-test-"));
    await runCli(tempDir, ["repo", "new", "--repo", "foo", "alias", tempDir]);

    const errorSpy = consoleErrorSpy;
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringMatching(/--repo cannot be used with repo new/),
    );
    expect(process.exitCode).toBe(1);

    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("prints diagnostics for config check", async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "drctl-cli-test-"));
    fs.writeFileSync(
      path.join(tempDir, ".drctl.yaml"),
      `repos:
  missing:
    path: ./missing
  present:
    path: ./present
    template: templates/meta.md
    defaultDomainDir: domains
    git: disabled
`,
    );
    fs.mkdirSync(path.join(tempDir, "present"), { recursive: true });
    await runCli(tempDir, ["config", "check"]);

    const logSpy = getLogSpy();
    expect(logSpy).toHaveBeenCalledWith(
      expect.stringMatching(/Working directory/),
    );
    expect(logSpy).toHaveBeenCalledWith(
      expect.stringMatching(/Template: templates\/meta\.md/),
    );
    const gitLines = collectLogLines().filter((line: string) =>
      line.includes("git: disabled"),
    );
    expect(gitLines.length).toBeGreaterThan(0);
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      expect.stringMatching(/Repository "missing"/),
    );
    expect(process.exitCode).toBe(0);

    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("exits with code 1 when config check reports errors", async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "drctl-cli-test-"));
    vi.doMock("../config.js", async () => {
      const actual =
        await vi.importActual<typeof import("../config.js")>("../config.js");
      return {
        ...actual,
        diagnoseConfig: () => ({
          cwd: tempDir,
          warnings: [],
          errors: ["Config broken"],
          repos: [],
        }),
      };
    });

    await runCli(tempDir, ["config", "check"]);

    expect(process.exitCode).toBe(1);
    vi.doUnmock("../config.js");
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("includes git root details when repositories are initialised", async () => {
    const { tempDir } = createWorkspaceRepo();
    const logLines = await runCli(tempDir, ["config", "check"]);
    expect(logLines.some((line: string) => line.includes("Git root:"))).toBe(
      true,
    );

    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("reports git initialisation status in config check", async () => {
    const { tempDir } = createWorkspaceRepo();
    const logs = (await runCli(tempDir, ["config", "check"])).join("\n");
    expect(logs).toMatch(/git: initialised/);

    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("notes inherited git roots when repo show runs inside a parent git repo", async () => {
    const { tempDir } = createWorkspaceRepo({ gitAtRoot: true });
    const logLines = await runCli(tempDir, ["repo", "show", "--repo", "work"]);
    expect(
      logLines.some(
        (line: string) =>
          line.includes("Git root:") && line.trim().endsWith("(inherited)"),
      ),
    ).toBe(true);

    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("prints an empty repository summary when none are configured", async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "drctl-cli-test-"));
    const logLines = await runCli(tempDir, ["config", "check"]);
    expect(logLines).toContain("📚 Repositories: none");

    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("allows repo new with domain dir and default flag", async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "drctl-cli-test-"));
    await runCli(tempDir, [
      "repo",
      "new",
      "demo",
      "./workspace",
      "--domain-dir",
      "domains",
      "--default",
    ]);

    const logLines = collectLogLines();
    expect(
      logLines.some((line: string) => line.includes("Domain directory")),
    ).toBe(true);
    expect(
      logLines.some((line: string) => line.includes("Marked as default repo")),
    ).toBe(true);

    const config = loadYaml(
      fs.readFileSync(path.join(tempDir, ".drctl.yaml"), "utf8"),
    ) as Record<string, any>;
    expect(config.defaultRepo).toBe("demo");
    expect(config.repos.demo.defaultDomainDir).toBe("domains");

    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("mentions config overrides in repo help output", async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "drctl-cli-test-"));
    const stdoutSpy = vi
      .spyOn(process.stdout, "write")
      .mockImplementation(() => true);
    await runCli(tempDir, ["repo", "--help"]);

    const output = stdoutSpy.mock.calls
      .map((call: unknown[]) => stringify(call[0]))
      .join("");
    expect(output).toMatch(/--config/);
    expect(output).toMatch(/DRCTL_CONFIG/);

    stdoutSpy.mockRestore();
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("bootstraps git repos for configured alias", async () => {
    const { tempDir, repoDir } = createConfigSandbox(BASIC_WORKSPACE_CONFIG);

    await runCli(tempDir, ["repo", "bootstrap", "work"]);

    const logMessages = collectLogLines();
    expect(
      logMessages.some((msg: string) => /Initialised git repository/.test(msg)),
    ).toBe(true);
    expect(fs.existsSync(path.join(repoDir, ".git"))).toBe(true);

    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("skips repo bootstrap when git is already initialised", async () => {
    const { tempDir } = createConfigSandbox(BASIC_WORKSPACE_CONFIG, {
      initGit: "repo",
    });

    await runCli(tempDir, ["repo", "bootstrap", "work"]);

    expect(
      collectLogLines().some((line: string) =>
        line.includes("Git already initialised"),
      ),
    ).toBe(true);

    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("bootstraps git repos using an explicit --config override", async () => {
    const configDir = fs.mkdtempSync(path.join(os.tmpdir(), "drctl-cli-test-"));
    const otherCwd = fs.mkdtempSync(path.join(os.tmpdir(), "drctl-cli-test-"));
    const repoDir = path.join(configDir, "workspace");
    fs.mkdirSync(repoDir, { recursive: true });
    const configPath = path.join(configDir, "shared.yaml");
    fs.writeFileSync(configPath, `repos:\n  shared:\n    path: ./workspace\n`);

    await runCli(otherCwd, [
      "--config",
      configPath,
      "repo",
      "bootstrap",
      "shared",
    ]);

    expect(fs.existsSync(path.join(repoDir, ".git"))).toBe(true);

    fs.rmSync(configDir, { recursive: true, force: true });
    fs.rmSync(otherCwd, { recursive: true, force: true });
  });

  it("switches the default repository", async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "drctl-cli-test-"));
    fs.writeFileSync(
      path.join(tempDir, ".drctl.yaml"),
      `defaultRepo: work\nrepos:\n  work:\n    path: ./work\n  home:\n    path: ./home\n`,
    );

    await runCli(tempDir, ["repo", "switch", "home"]);

    const logMessages = collectLogLines();
    expect(
      logMessages.some((msg: string) => /Default repo.*home/.test(msg)),
    ).toBe(true);
    const parsed = loadYaml(
      fs.readFileSync(path.join(tempDir, ".drctl.yaml"), "utf8"),
    ) as Record<string, unknown>;
    expect(parsed.defaultRepo).toBe("home");

    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("switches the default repository using an explicit --config override", async () => {
    const configDir = fs.mkdtempSync(path.join(os.tmpdir(), "drctl-cli-test-"));
    const otherCwd = fs.mkdtempSync(path.join(os.tmpdir(), "drctl-cli-test-"));
    const configPath = path.join(configDir, "shared.yaml");
    fs.writeFileSync(
      configPath,
      `defaultRepo: work\nrepos:\n  work:\n    path: ./work\n  home:\n    path: ./home\n`,
    );

    await runCli(otherCwd, ["--config", configPath, "repo", "switch", "home"]);

    const parsed = loadYaml(fs.readFileSync(configPath, "utf8")) as Record<
      string,
      unknown
    >;
    expect(parsed.defaultRepo).toBe("home");

    fs.rmSync(configDir, { recursive: true, force: true });
    fs.rmSync(otherCwd, { recursive: true, force: true });
  });

  it("validates governance issues and reports errors", async () => {
    const { tempDir, repoDir } = createConfigSandbox(
      `defaultRepo: work
repos:
  work:
    path: ./workspace
`,
    );

    const context: RepoContext = {
      root: repoDir,
      source: "cli",
      name: "work",
      domainMap: {},
      gitMode: "disabled",
      gitModeSource: "detected",
    };

    const badRecord: DecisionRecord = {
      id: "DR--20240101--meta--broken",
      dateCreated: "2024-01-01",
      version: "1.0.0",
      status: "superseded",
      changeType: "supersession",
      domain: "meta",
      slug: "broken",
      changelog: [{ date: "2024-01-01", note: "Initial" }],
    };
    saveDecision(context, badRecord, "Body");

    await runCli(tempDir, ["governance", "validate"]);

    const logs = collectLogLines();
    expect(logs.join("\n")).toMatch(/Governance validation/);
    expect(logs.join("\n")).toMatch(/missing-supersede-link/);
    expect(process.exitCode).toBe(1);

    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("fails governance validation when repo root is missing", async () => {
    const { tempDir } = createConfigSandbox(
      `defaultRepo: ghost
repos:
  ghost:
    path: ./workspace
`,
      { createRepoDir: false },
    );

    await runCli(tempDir, ["governance", "validate"]);

    const errorSpy = consoleErrorSpy;
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringMatching(/does not exist/),
    );
    expect(process.exitCode).toBe(1);

    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("prints success message when governance validation passes", async () => {
    const { tempDir } = createConfigSandbox(
      `defaultRepo: ok
repos:
  ok:
    path: ./workspace
`,
    );

    await runCli(tempDir, ["governance", "validate"]);

    expect(getLogSpy()).toHaveBeenCalledWith(
      expect.stringMatching(/Governance validation passed/),
    );
    expect(process.exitCode).toBe(0);

    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("logs a git-disabled hint once during lifecycle commands", async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "drctl-cli-test-"));
    const configPath = path.join(tempDir, ".drctl.yaml");
    fs.writeFileSync(
      configPath,
      `repos:
  sandbox:
    path: ./decisions
    git: disabled
defaultRepo: sandbox
`,
    );
    fs.mkdirSync(path.join(tempDir, "decisions"), { recursive: true });

    const { resolveRepoContext } = await import("../config.js");
    const context = resolveRepoContext({
      cwd: tempDir,
      configPath,
    });
    const record: DecisionRecord = {
      id: "DR--20300101--meta--gitless",
      dateCreated: "2030-01-01",
      version: "1.0.0",
      status: "draft",
      changeType: "creation",
      domain: "meta",
      slug: "gitless",
      changelog: [{ date: "2030-01-01", note: "Initial creation" }],
    };
    saveDecision(context, record, "# body");

    await runCli(tempDir, [
      "--config",
      configPath,
      "--no-git",
      "draft",
      record.id,
    ]);

    const gitHints = collectLogLines().filter((line: string) =>
      line.includes("Git disabled"),
    );
    expect(gitHints).toHaveLength(1);

    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("supports json output for governance validation", async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "drctl-cli-test-"));
    const repoDir = path.join(tempDir, "workspace");
    fs.mkdirSync(repoDir, { recursive: true });
    fs.writeFileSync(
      path.join(tempDir, ".drctl.yaml"),
      `defaultRepo: work\nrepos:\n  work:\n    path: ./workspace\n`,
    );

    const context: RepoContext = {
      root: repoDir,
      source: "cli",
      name: "work",
      domainMap: {},
      gitMode: "disabled",
      gitModeSource: "detected",
    };

    const invalid: DecisionRecord = {
      id: "DR--20240101--meta--bad",
      dateCreated: "2024-01-01",
      version: "1.0.0",
      status: "superseded",
      changeType: "supersession",
      domain: "meta",
      slug: "bad",
      changelog: [{ date: "2024-01-01", note: "Initial" }],
    };
    saveDecision(context, invalid, "# body");

    await runCli(tempDir, ["governance", "validate", "--json"]);

    const outputCalls = collectLogLines();
    const jsonPayload = outputCalls.find((msg: string) =>
      msg.trim().startsWith("{"),
    );
    expect(jsonPayload).toBeDefined();
    const parsed = JSON.parse(jsonPayload ?? "{}");
    expect(parsed.issues).toBeInstanceOf(Array);
    expect(parsed.issues.length).toBeGreaterThan(0);
    expect(parsed.issues[0]).toHaveProperty("code");
    expect(process.exitCode).toBe(1);

    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("reports config errors via reportConfigDiagnostics helper", async () => {
    await runReportDiagnosticsTest(
      { errors: ["Repository paths invalid."] },
      (result) => {
        expect(result).toBe(true);
        expect(consoleErrorSpy).toHaveBeenCalledWith(
          expect.stringMatching(/Repository paths invalid/),
        );
      },
    );
  });

  it("reports warnings via reportConfigDiagnostics helper", async () => {
    await runReportDiagnosticsTest(
      { warnings: ["Repository missing git init."] },
      (result) => {
        expect(result).toBe(false);
        expect(consoleWarnSpy).toHaveBeenCalledWith(
          expect.stringMatching(/Repository missing git init/),
        );
      },
    );
  });

  it("confirms success when reportConfigDiagnostics has no warnings or errors", async () => {
    await runReportDiagnosticsTest({}, (result) => {
      expect(result).toBe(false);
      expect(consoleLogSpy).toHaveBeenCalledWith(
        "✅ Configuration looks good.",
      );
    });
  });

  it("generates an index for the default repository", async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "drctl-cli-test-"));
    const repoDir = path.join(tempDir, "workspace");
    fs.mkdirSync(repoDir, { recursive: true });
    fs.writeFileSync(
      path.join(tempDir, ".drctl.yaml"),
      `defaultRepo: work\nrepos:\n  work:\n    path: ./workspace\n`,
    );

    const context: RepoContext = {
      root: repoDir,
      name: "work",
      source: "cli",
      domainMap: {},
      gitMode: "disabled",
      gitModeSource: "detected",
    };

    const makeRecord = (domain: string, slug: string): DecisionRecord => ({
      id: `DR--20250101--${domain}--${slug}`,
      dateCreated: "2025-01-01",
      version: "1.0",
      status: "draft",
      changeType: "creation",
      domain,
      slug,
      changelog: [],
    });

    saveDecision(context, makeRecord("alpha", "first"), "# alpha first");
    saveDecision(context, makeRecord("beta", "second"), "# beta second");

    await runCli(tempDir, ["index"]);

    const logCalls = collectLogLines();
    expect(logCalls.some((msg) => /Generated index:/i.test(msg))).toBe(true);
    const indexPath = path.join(repoDir, "index.md");
    expect(fs.existsSync(indexPath)).toBe(true);
    const markdown = fs.readFileSync(indexPath, "utf8");
    expect(markdown).toContain("## Summary");
    expect(markdown).toContain("## Domain Catalogues");
    expect(markdown).toContain("### alpha");
    expect(markdown).toContain("### beta");

    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("echoes domain dir and default flags when creating repo entries", async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "drctl-cli-test-"));
    const repoDir = path.join(tempDir, "workspace");
    await runCli(tempDir, [
      "repo",
      "new",
      "work",
      repoDir,
      "--domain-dir",
      "domains",
      "--default",
    ]);

    const logs = collectLogLines().join("\n");
    expect(logs).toMatch(/Domain directory: domains/);
    expect(logs).toMatch(/Marked as default repo/);
    expect(fs.existsSync(path.join(tempDir, ".drctl.yaml"))).toBe(true);

    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("reports when repo bootstrap finds an existing git repository", async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "drctl-cli-test-"));
    const repoDir = path.join(tempDir, "workspace");
    fs.mkdirSync(path.join(repoDir, ".git"), { recursive: true });
    fs.writeFileSync(
      path.join(tempDir, ".drctl.yaml"),
      `repos:\n  work:\n    path: ./workspace\n`,
    );
    const gitModule = await import("../core/git.js");
    const initSpy = vi.spyOn(gitModule, "initGitRepo");

    const logs = await runCli(tempDir, ["repo", "bootstrap", "work"]);

    expect(initSpy).not.toHaveBeenCalled();
    expect(logs.some((line) => /already initialised/.test(line))).toBe(true);

    initSpy.mockRestore();
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("reports missing repo root when running index", async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "drctl-cli-test-"));
    fs.writeFileSync(
      path.join(tempDir, ".drctl.yaml"),
      `defaultRepo: ghost\nrepos:\n  ghost:\n    path: ./workspace\n`,
    );

    await runCli(tempDir, ["index"]);

    const errorSpy = consoleErrorSpy;
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringMatching(/does not exist/),
    );
    expect(process.exitCode).toBe(1);

    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("writes repo entries to a specified config via --config", async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "drctl-cli-test-"));
    const configPath = path.join(tempDir, "custom.yaml");
    fs.writeFileSync(configPath, "repos:\n");
    await runCli(tempDir, [
      "--config",
      configPath,
      "repo",
      "new",
      "alias",
      "./repo",
    ]);

    const parsed = loadYaml(fs.readFileSync(configPath, "utf8")) as Record<
      string,
      unknown
    >;
    const repos = parsed.repos as Record<string, unknown>;
    expect(Object.keys(repos ?? {})).toContain("alias");
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("rejects repo new when another alias already uses the same path", async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "drctl-cli-test-"));
    fs.writeFileSync(
      path.join(tempDir, ".drctl.yaml"),
      `repos:\n  work:\n    path: ./workspace\n`,
    );
    await runCli(tempDir, ["repo", "new", "docs", "./workspace"]);

    expect(process.exitCode).toBe(1);
    const errorSpy = consoleErrorSpy;
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringMatching(/Use the existing alias "work"/),
    );

    const parsed = loadYaml(
      fs.readFileSync(path.join(tempDir, ".drctl.yaml"), "utf8"),
    ) as Record<string, unknown>;
    const repos = parsed.repos as Record<string, Record<string, unknown>>;
    expect(Object.keys(repos)).toEqual(["work"]);

    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("uses DRCTL_CONFIG when --config is omitted", async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "drctl-cli-test-"));
    const configPath = path.join(tempDir, "env-config.yaml");
    fs.writeFileSync(configPath, "repos:\n");
    process.env.DRCTL_CONFIG = configPath;
    await runCli(tempDir, ["repo", "new", "alias", "./repo"]);

    const parsed = loadYaml(fs.readFileSync(configPath, "utf8")) as Record<
      string,
      unknown
    >;
    const repos = parsed.repos as Record<string, unknown>;
    expect(Object.keys(repos ?? {})).toContain("alias");
    fs.rmSync(tempDir, { recursive: true, force: true });
  });
});
