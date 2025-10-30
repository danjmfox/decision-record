import fs from "fs";
import os from "os";
import path from "path";
import { describe, expect, it, afterAll } from "vitest";
import { resolveRepoContext } from "./config.js";

const tempDirs: string[] = [];

function makeTempDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "drctl-config-test-"));
  tempDirs.push(dir);
  return dir;
}

afterAll(() => {
  for (const dir of tempDirs) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe("resolveRepoContext", () => {
  it("loads repository definitions from local .drctl.yaml", () => {
    const dir = makeTempDir();
    const repoRoot = path.join(dir, "workspace");
    fs.mkdirSync(repoRoot, { recursive: true });
    const config = `
defaultRepo: work
repos:
  work:
    path: ./workspace
    defaultDomainDir: domains
`;
    fs.writeFileSync(path.join(dir, ".drctl.yaml"), config);

    const context = resolveRepoContext({ cwd: dir });

    expect(context.name).toBe("work");
    expect(context.root).toBe(path.resolve(dir, "workspace"));
    expect(context.defaultDomainDir).toBe("domains");
    expect(context.source).toBe("local-config");
  });

  it("prefers CLI path strings when provided", () => {
    const dir = makeTempDir();
    const repoPath = path.join(dir, "custom");

    const context = resolveRepoContext({
      repoFlag: repoPath,
      cwd: dir,
    });

    expect(context.root).toBe(path.resolve(repoPath));
    expect(context.name).toBeUndefined();
    expect(context.source).toBe("cli");
  });

  it("throws when multiple repos exist without explicit selection", () => {
    const dir = makeTempDir();
    const config = `
repos:
  work:
    path: ./work
  home:
    path: ./home
`;
    fs.writeFileSync(path.join(dir, ".drctl.yaml"), config);

    expect(() => resolveRepoContext({ cwd: dir })).toThrow(
      /Multiple repositories configured/,
    );
  });
});
