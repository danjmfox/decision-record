import fs from "fs";
import os from "os";
import path from "path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("cli repo new", () => {
  const originalArgv = process.argv.slice();
  let exitSpy: ReturnType<typeof vi.spyOn> | undefined;
  let consoleSpy: ReturnType<typeof vi.spyOn> | undefined;

  beforeEach(() => {
    vi.resetModules();
    exitSpy = vi.spyOn(process, "exit").mockImplementation(
      // eslint-disable-next-line @typescript-eslint/no-empty-function
      (() => {}) as never,
    );
    consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    if (exitSpy) {
      exitSpy.mockRestore();
    }
    if (consoleSpy) {
      consoleSpy.mockRestore();
    }
    process.exitCode = 0;
    process.argv = originalArgv.slice();
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

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringMatching(/--repo cannot be used with repo new/),
    );
    expect(process.exitCode).toBe(1);
  });
});
