import { afterEach, describe, expect, it, vi } from "vitest";

describe("git error handling", () => {
  afterEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.unmock("node:child_process");
  });

  it("wraps git command failures with contextual messages", async () => {
    const execMock = vi.fn((...args: unknown[]) => {
      const callback = args[args.length - 1] as unknown;
      if (typeof callback === "function") {
        (
          callback as (
            err: Error | null,
            stdout?: string,
            stderr?: string,
          ) => void
        )(new Error("fatal: boom"), "", "");
      }
    });
    vi.doMock("node:child_process", () => ({
      execFile: execMock,
    }));

    const { createGitClient } = await import("./git.js");
    const client = createGitClient();

    await expect(
      client.stageAndCommit(["/repo/decisions/meta.md"], {
        cwd: "/repo",
        message: "test",
      }),
    ).rejects.toThrow(/Git command failed: git add/);
  });

  it("rethrows unexpected status errors from git", async () => {
    const execMock = vi.fn((...args: unknown[]) => {
      const callback = args[args.length - 1] as unknown;
      if (typeof callback === "function") {
        (
          callback as (
            err: Error | null,
            stdout?: string,
            stderr?: string,
          ) => void
        )(new Error("fatal: meltdown"), "", "");
      }
    });
    vi.doMock("node:child_process", () => ({
      execFile: execMock,
    }));

    const { getStagedFiles } = await import("./git.js");
    await expect(getStagedFiles("/repo")).rejects.toThrow(/meltdown/);
  });
});
