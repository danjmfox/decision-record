import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, afterEach, describe, expect, it, vi } from "vitest";
import { load as loadYaml } from "js-yaml";
import { createRepoEntry, switchDefaultRepo } from "./repo-manage.js";
import { resolveRepoContext } from "../config.js";

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
  delete process.env.DRCTL_CONFIG;
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

  it("writes repo entries as nested objects keyed by alias", () => {
    const cwd = makeTempDir();
    const repoPath = "./decisions";
    createRepoEntry({
      cwd,
      name: "home",
      repoPath,
    });

    const configPath = path.join(cwd, ".drctl.yaml");
    const content = fs.readFileSync(configPath, "utf8");
    const parsed = loadYaml(content) as Record<string, unknown>;
    const repos = parsed.repos as Record<string, unknown>;

    expect(repos).toBeTruthy();
    expect(repos).toMatchObject({
      home: {
        path: repoPath,
      },
    });

    expect(content).not.toMatch(/repos:\s*path:/);
  });

  it("produces a config that resolveRepoContext can load", () => {
    const cwd = makeTempDir();
    const repoDir = path.join(cwd, "test-workspace");
    fs.mkdirSync(repoDir, { recursive: true });

    createRepoEntry({
      cwd,
      name: "work",
      repoPath: "./test-workspace",
      setDefault: true,
    });

    const context = resolveRepoContext({ cwd });

    expect(context.name).toBe("work");
    expect(context.root).toBe(path.resolve(repoDir));
    expect(context.source).toBe("local-config");
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

  it("writes to an explicit config path when provided", () => {
    const cwd = makeTempDir();
    const configBase = makeTempDir();
    const configPath = path.join(configBase, "custom.yaml");

    const result = createRepoEntry({
      cwd,
      name: "demo",
      repoPath: "./repo",
      configPath,
    });

    expect(result.configPath).toBe(configPath);
    const parsed = loadYaml(fs.readFileSync(configPath, "utf8")) as Record<
      string,
      unknown
    >;
    const repos = parsed.repos as Record<string, Record<string, unknown>>;
    expect(repos?.demo?.path).toBe("./repo");
  });

  it("throws when another alias already targets the same path", () => {
    const cwd = makeTempDir();
    createRepoEntry({
      cwd,
      name: "work",
      repoPath: "./workspace",
    });

    expect(() =>
      createRepoEntry({
        cwd,
        name: "docs",
        repoPath: "./workspace",
      }),
    ).toThrow(/already configured/i);
  });

  it("handles legacy flat repo definitions without duplicating keys", () => {
    const cwd = makeTempDir();
    const configPath = path.join(cwd, ".drctl.yaml");
    fs.writeFileSync(
      configPath,
      `repos:
  name: legacy
  path: ./legacy
`,
    );

    createRepoEntry({
      cwd,
      name: "work",
      repoPath: "./work",
    });

    const parsed = loadYaml(fs.readFileSync(configPath, "utf8")) as Record<
      string,
      Record<string, unknown>
    >;
    const repos = parsed.repos as Record<string, { path?: string }>;
    expect(Object.keys(repos ?? {})).toEqual(
      expect.arrayContaining(["legacy", "work"]),
    );
    expect(repos?.legacy?.path).toBe("./legacy");
    expect(repos?.work?.path).toBe("./work");
  });

  it("ignores existing entries without a path when checking duplicates", () => {
    const cwd = makeTempDir();
    const configPath = path.join(cwd, ".drctl.yaml");
    fs.writeFileSync(
      configPath,
      `repos:\n  metadata:\n    domains:\n      meta: meta\n`,
    );

    expect(() =>
      createRepoEntry({
        cwd,
        name: "docs",
        repoPath: "./docs",
      }),
    ).not.toThrow();

    const parsed = loadYaml(fs.readFileSync(configPath, "utf8")) as Record<
      string,
      Record<string, unknown>
    >;
    const repos =
      (parsed.repos as Record<string, { path?: string }> | undefined) ?? {};
    expect(repos.docs?.path).toBe("./docs");
  });

  it("treats non-object existing configs as empty", () => {
    const cwd = makeTempDir();
    const configPath = path.join(cwd, ".drctl.yaml");
    fs.writeFileSync(configPath, `- "not-an-object"\n- 42\n`);

    expect(() =>
      createRepoEntry({
        cwd,
        name: "docs",
        repoPath: "./docs",
      }),
    ).not.toThrow();

    const parsed = loadYaml(fs.readFileSync(configPath, "utf8")) as Record<
      string,
      Record<string, unknown>
    >;
    const repos =
      (parsed.repos as Record<string, { path?: string }> | undefined) ?? {};
    expect(repos.docs?.path).toBe("./docs");
  });
});

describe("switchDefaultRepo", () => {
  it("updates defaultRepo when alias exists", () => {
    const cwd = makeTempDir();
    fs.writeFileSync(
      path.join(cwd, ".drctl.yaml"),
      `defaultRepo: work\nrepos:\n  work:\n    path: ./work\n  home:\n    path: ./home\n`,
    );

    const result = switchDefaultRepo({ cwd, name: "home" });

    expect(result.defaultRepo).toBe("home");
    const parsed = loadYaml(
      fs.readFileSync(path.join(cwd, ".drctl.yaml"), "utf8"),
    ) as Record<string, unknown>;
    expect(parsed.defaultRepo).toBe("home");
  });

  it("honours an explicit config path", () => {
    const cwd = makeTempDir();
    const configDir = makeTempDir();
    const configPath = path.join(configDir, "shared.yaml");
    fs.writeFileSync(
      configPath,
      `defaultRepo: work\nrepos:\n  work:\n    path: ./work\n  home:\n    path: ./home\n`,
    );

    const result = switchDefaultRepo({ cwd, name: "home", configPath });

    expect(result.configPath).toBe(configPath);
    expect(result.defaultRepo).toBe("home");
    const parsed = loadYaml(fs.readFileSync(configPath, "utf8")) as Record<
      string,
      unknown
    >;
    expect(parsed.defaultRepo).toBe("home");
  });

  it("uses DRCTL_CONFIG when no explicit config path is provided", () => {
    const cwd = makeTempDir();
    const configDir = makeTempDir();
    const configPath = path.join(configDir, "env-config.yaml");
    fs.writeFileSync(
      configPath,
      `defaultRepo: work\nrepos:\n  work:\n    path: ./work\n  home:\n    path: ./home\n`,
    );

    process.env.DRCTL_CONFIG = configPath;

    const result = switchDefaultRepo({ cwd, name: "home" });

    expect(result.configPath).toBe(configPath);
    expect(result.defaultRepo).toBe("home");
    const parsed = loadYaml(fs.readFileSync(configPath, "utf8")) as Record<
      string,
      unknown
    >;
    expect(parsed.defaultRepo).toBe("home");
  });

  it("throws when alias is missing", () => {
    const cwd = makeTempDir();
    fs.writeFileSync(
      path.join(cwd, ".drctl.yaml"),
      `repos:\n  work:\n    path: ./work\n`,
    );

    expect(() => switchDefaultRepo({ cwd, name: "missing" })).toThrow(
      /not found/i,
    );
  });

  it("throws when no config file is found", () => {
    const cwd = makeTempDir();
    expect(() => switchDefaultRepo({ cwd, name: "any" })).toThrow(
      /No \.drctl\.yaml file found/i,
    );
  });
});
