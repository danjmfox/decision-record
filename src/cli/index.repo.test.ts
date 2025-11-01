import fs from "fs";
import os from "os";
import path from "path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("cli index commands", () => {
  const originalArgv = process.argv.slice();
  const originalCwd = process.cwd();
  let exitSpy: ReturnType<typeof vi.spyOn> | undefined;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn> | undefined;
  let consoleWarnSpy: ReturnType<typeof vi.spyOn> | undefined;
  let consoleLogSpy: ReturnType<typeof vi.spyOn> | undefined;

  beforeEach(() => {
    vi.resetModules();
    exitSpy = vi.spyOn(process, "exit").mockImplementation(
      // eslint-disable-next-line @typescript-eslint/no-empty-function
      (() => {}) as never,
    );
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});
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
    process.exitCode = 0;
    process.argv = originalArgv.slice();
    process.chdir(originalCwd);
    vi.resetModules();
  });

  it("rejects --repo flag usage", async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "drctl-cli-test-"));
    process.argv = [
      "node",
      "drctl",
      "repo",
      "new",
      "--repo",
      "foo",
      "alias",
      tempDir,
    ];

    await import("./index.js");

    expect(consoleErrorSpy).toHaveBeenCalledWith(
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
`,
    );
    process.chdir(tempDir);
    process.argv = ["node", "drctl", "config", "check"];

    await import("./index.js");

    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringMatching(/Working directory/),
    );
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      expect.stringMatching(/Repository "missing"/),
    );
    expect(process.exitCode).toBe(0);

    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("bootstraps git repos for configured alias", async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "drctl-cli-test-"));
    const repoDir = path.join(tempDir, "workspace");
    fs.mkdirSync(repoDir, { recursive: true });
    fs.writeFileSync(
      path.join(tempDir, ".drctl.yaml"),
      `repos:\n  work:\n    path: ./workspace\n`,
    );

    process.chdir(tempDir);
    process.argv = ["node", "drctl", "repo", "bootstrap", "work"];

    await import("./index.js");

    const logCalls = consoleLogSpy.mock.calls.map((call) => call[0]);
    expect(logCalls.some((msg) => /Initialised git repository/.test(msg))).toBe(
      true,
    );
    expect(fs.existsSync(path.join(repoDir, ".git"))).toBe(true);

    fs.rmSync(tempDir, { recursive: true, force: true });
  });
});
