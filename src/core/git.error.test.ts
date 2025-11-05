import { afterEach, describe, expect, it, vi } from "vitest";

type ExecCallback = (
  err: Error | null,
  stdout?: string,
  stderr?: string,
) => void;

function mockExecFailure(message: string): void {
  const execMock = vi.fn((...args: unknown[]) => {
    const callback = args.at(-1);
    if (typeof callback === "function") {
      (callback as ExecCallback)(new Error(message), "", "");
    }
  });
  vi.doMock("node:child_process", () => ({
    execFile: execMock,
  }));
}

describe("git error handling", () => {
  afterEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.unmock("node:child_process");
  });

  it("wraps git command failures with contextual messages", async () => {
    mockExecFailure("fatal: boom");
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
    mockExecFailure("fatal: meltdown");
    const { getStagedFiles } = await import("./git.js");
    await expect(getStagedFiles("/repo")).rejects.toThrow(/meltdown/);
  });
});
