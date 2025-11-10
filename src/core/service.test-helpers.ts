import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, vi } from "vitest";
import type { RepoContext } from "../config.js";

const tempRoots: string[] = [];
let consoleWarnSpy: ReturnType<typeof vi.spyOn> | undefined;

export function makeContext(): RepoContext {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "drctl-service-test-"));
  tempRoots.push(root);
  return {
    root,
    domainMap: {},
    source: "cli",
    name: "test",
    gitMode: "enabled",
    gitModeSource: "detected",
  };
}

export function toPosix(value: string): string {
  return value.split(path.sep).join("/");
}

export function setupServiceTestEnv(): void {
  beforeAll(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-10-30T12:00:00Z"));
    consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterAll(() => {
    vi.useRealTimers();
    consoleWarnSpy?.mockRestore();
    for (const dir of tempRoots) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
}
