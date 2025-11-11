import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, vi } from "vitest";
import type { RepoContext } from "../config.js";

type SpyLike = { mockRestore: () => void };

export class CliTestEnv {
  private readonly originalArgv = process.argv.slice();
  private readonly originalCwd = process.cwd();
  private tempDirs: string[] = [];
  private spies: SpyLike[] = [];

  createContext(prefix = "drctl-cli-test-"): {
    context: RepoContext;
    tempDir: string;
  } {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
    this.tempDirs.push(tempDir);
    const context: RepoContext = {
      root: tempDir,
      name: "test",
      source: "cli",
      domainMap: {},
      gitMode: "disabled",
      gitModeSource: "detected",
    };
    return { context, tempDir };
  }

  mockStderr(): SpyLike {
    const spy = vi
      .spyOn(process.stderr, "write")
      .mockImplementation(() => true);
    this.spies.push(spy);
    return spy;
  }

  registerSpy(spy: SpyLike): void {
    this.spies.push(spy);
  }

  reset(): void {
    vi.resetModules();
    vi.clearAllMocks();
    process.argv = this.originalArgv.slice();
    process.chdir(this.originalCwd);
    for (const spy of this.spies.splice(0, this.spies.length)) {
      spy.mockRestore();
    }
    for (const dir of this.tempDirs.splice(0, this.tempDirs.length)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }
}

export function setupCliTestEnv(): CliTestEnv {
  const env = new CliTestEnv();
  afterEach(() => {
    env.reset();
  });
  return env;
}
