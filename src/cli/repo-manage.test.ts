import fs from "fs";
import os from "os";
import path from "path";
import { afterAll, afterEach, describe, expect, it, vi } from "vitest";
import { load as loadYaml } from "js-yaml";
import { createRepoEntry } from "./repo-manage.js";

const tempDirs: string[] = [];
const restoreSpies: Array<() => void> = [];

function makeTempDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "drctl-repo-manage-"));
  tempDirs.push(dir);
  return dir;
}

afterEach(() => {
  while (restoreSpies.length > 0) {
    const restore = restoreSpies.pop();
    restore?.();
  }
  delete process.env.DECISIONS_HOME;
});

afterAll(() => {
  for (const dir of tempDirs) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe("createRepoEntry", () => {
  it("creates a new config file when none exists", () => {
    const cwd = makeTempDir();
    const repoPath = "./decisions";
    const result = createRepoEntry({
      cwd,
      name: "home",
      repoPath,
      setDefault: true,
      defaultDomainDir: "domains",
    });

    const configPath = path.join(cwd, ".drctl.yaml");
    expect(result.configPath).toBe(configPath);
    expect(result.repoRoot).toBe(path.resolve(cwd, repoPath));

    const parsed = loadYaml(fs.readFileSync(configPath, "utf8")) as Record<
      string,
      unknown
    >;
    expect(parsed.defaultRepo).toBe("home");
    expect(parsed.repos).toBeDefined();
    const repos = parsed.repos as Record<string, Record<string, unknown>>;
    const homeEntry = repos.home as Record<string, unknown>;
    expect(homeEntry).toBeDefined();
    expect(homeEntry.path).toBe(repoPath);
    expect(homeEntry.defaultDomainDir).toBe("domains");
  });

  it("updates the nearest existing config file", () => {
    const root = makeTempDir();
    const subdir = path.join(root, "work");
    fs.mkdirSync(subdir, { recursive: true });
    const configPath = path.join(root, ".drctl.yaml");
    fs.writeFileSync(
      configPath,
      `defaultRepo: main\nrepos:\n  main:\n    path: ./main\n`,
    );

    const result = createRepoEntry({
      cwd: subdir,
      name: "docs",
      repoPath: "../docs",
    });

    expect(result.configPath).toBe(configPath);
    const parsed = loadYaml(fs.readFileSync(configPath, "utf8")) as Record<
      string,
      unknown
    >;
    const repos = parsed.repos as Record<string, Record<string, unknown>>;
    expect(Object.keys(repos)).toContain("main");
    expect(Object.keys(repos)).toContain("docs");
    expect(parsed.defaultRepo).toBe("main");
  });

  it("resolves env variables and tildes in repo paths", () => {
    const cwd = makeTempDir();
    const home = makeTempDir();
    const spy = vi.spyOn(os, "homedir");
    spy.mockReturnValue(home);
    restoreSpies.push(() => spy.mockRestore());

    process.env.DECISIONS_HOME = path.join(cwd, "home-repo");

    const envResult = createRepoEntry({
      cwd,
      name: "env",
      repoPath: "${DECISIONS_HOME}",
    });
    expect(envResult.repoRoot).toBe(process.env.DECISIONS_HOME);

    const tildeResult = createRepoEntry({
      cwd,
      name: "tilde",
      repoPath: "~/tilde-repo",
    });
    expect(tildeResult.repoRoot).toBe(path.join(home, "tilde-repo"));
  });
});
