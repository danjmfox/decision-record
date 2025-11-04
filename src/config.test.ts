import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  describe,
  expect,
  it,
  afterAll,
  afterEach,
  beforeEach,
  vi,
} from "vitest";
import { resolveRepoContext, diagnoseConfig } from "./config.js";

const tempDirs: string[] = [];
const originalEnvRepo = process.env.DRCTL_REPO;
const restoreSpies: Array<() => void> = [];

function makeTempDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "drctl-config-test-"));
  tempDirs.push(dir);
  return dir;
}

afterEach(() => {
  process.env.DRCTL_REPO = undefined;
  if (originalEnvRepo === undefined) {
    delete process.env.DRCTL_REPO;
  }
  delete process.env.DRCTL_CONFIG;
  delete process.env.TEST_DECISIONS_PATH;
  while (restoreSpies.length > 0) {
    const restore = restoreSpies.pop();
    restore?.();
  }
});

afterAll(() => {
  for (const dir of tempDirs) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
  if (originalEnvRepo === undefined) {
    delete process.env.DRCTL_REPO;
  } else {
    process.env.DRCTL_REPO = originalEnvRepo;
  }
  delete process.env.DRCTL_CONFIG;
});

beforeEach(() => {
  process.env.DRCTL_REPO = undefined;
  delete process.env.DRCTL_REPO;
  delete process.env.DRCTL_CONFIG;
  delete process.env.TEST_DECISIONS_PATH;
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
    template: templates/meta.md
`;
    fs.writeFileSync(path.join(dir, ".drctl.yaml"), config);

    const context = resolveRepoContext({ cwd: dir });

    expect(context.name).toBe("work");
    expect(context.root).toBe(path.resolve(dir, "workspace"));
    expect(context.defaultDomainDir).toBe("domains");
    expect(context.defaultTemplate).toBe("templates/meta.md");
    expect(context.source).toBe("local-config");
  });

  it("selects the only configured repo when no default is specified", () => {
    const dir = makeTempDir();
    const repoRoot = path.join(dir, "solo");
    fs.mkdirSync(repoRoot, { recursive: true });
    const config = `
repos:
  solo:
    path: ./solo
`;
    fs.writeFileSync(path.join(dir, ".drctl.yaml"), config);

    const context = resolveRepoContext({ cwd: dir });

    expect(context.name).toBe("solo");
    expect(context.root).toBe(path.resolve(repoRoot));
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

  it("falls back to the cwd decisions directory when present", () => {
    const dir = makeTempDir();
    const home = makeTempDir();
    const spy = vi.spyOn(os, "homedir");
    spy.mockReturnValue(home);
    restoreSpies.push(() => spy.mockRestore());

    const localDecisions = path.join(dir, "decisions");
    const homeDecisions = path.join(home, "decisions");
    fs.mkdirSync(localDecisions, { recursive: true });
    fs.mkdirSync(homeDecisions, { recursive: true });

    const context = resolveRepoContext({ cwd: dir });

    expect(context.root).toBe(localDecisions);
    expect(context.source).toBe("fallback-cwd");
  });

  it("falls back to the home decisions directory when local workspace is missing", () => {
    const dir = makeTempDir();
    const home = makeTempDir();
    const spy = vi.spyOn(os, "homedir");
    spy.mockReturnValue(home);
    restoreSpies.push(() => spy.mockRestore());

    const homeDecisions = path.join(home, "decisions");
    fs.mkdirSync(homeDecisions, { recursive: true });

    const context = resolveRepoContext({ cwd: dir });

    expect(context.root).toBe(homeDecisions);
    expect(context.source).toBe("fallback-home");
  });

  it("expands env variables and tildes in repo configuration paths", () => {
    const dir = makeTempDir();
    const home = makeTempDir();
    const spy = vi.spyOn(os, "homedir");
    spy.mockReturnValue(home);
    restoreSpies.push(() => spy.mockRestore());

    const envRepo = path.join(dir, "env-decisions");
    fs.mkdirSync(envRepo, { recursive: true });
    process.env.TEST_DECISIONS_PATH = envRepo;

    const config = `
repos:
  env:
    path: \${TEST_DECISIONS_PATH}
  tilde:
    path: ~/decisions-tilde
    domains:
      personal: custom/personal
`;
    fs.writeFileSync(path.join(dir, ".drctl.yaml"), config);

    let context = resolveRepoContext({ cwd: dir, repoFlag: "env" });
    expect(context.root).toBe(envRepo);
    expect(context.source).toBe("cli");

    context = resolveRepoContext({ cwd: dir, repoFlag: "tilde" });
    expect(context.root).toBe(path.join(home, "decisions-tilde"));
    expect(context.domainMap.personal).toBe("custom/personal");
  });

  it("uses an explicit config path when provided", () => {
    const base = makeTempDir();
    const workspace = path.join(base, "repo");
    fs.mkdirSync(workspace, { recursive: true });
    const configPath = path.join(base, "custom-config.yaml");
    fs.writeFileSync(
      configPath,
      `repos:
  demo:
    path: ./repo
`,
    );

    const context = resolveRepoContext({ cwd: makeTempDir(), configPath });

    expect(context.root).toBe(path.resolve(base, "repo"));
    expect(context.name).toBe("demo");
    expect(context.configPath).toBe(configPath);
  });

  it("honours DRCTL_CONFIG when no config path is supplied", () => {
    const base = makeTempDir();
    const workspace = path.join(base, "repo");
    fs.mkdirSync(workspace, { recursive: true });
    const configPath = path.join(base, "env-config.yaml");
    fs.writeFileSync(
      configPath,
      `repos:
  env:
    path: ./repo
`,
    );

    process.env.DRCTL_CONFIG = configPath;

    const context = resolveRepoContext({ cwd: makeTempDir() });

    expect(context.root).toBe(path.resolve(base, "repo"));
    expect(context.name).toBe("env");
    expect(context.configPath).toBe(configPath);
  });
});

describe("diagnoseConfig", () => {
  it("warns when no repositories are configured", () => {
    const dir = makeTempDir();

    const diagnostics = diagnoseConfig({ cwd: dir });

    expect(diagnostics.repos).toHaveLength(0);
    expect(diagnostics.warnings).toContain(
      "No repositories configured. Create a .drctl.yaml to get started.",
    );
    expect(diagnostics.errors).toHaveLength(0);
  });

  it("reports existing repositories without warnings", () => {
    const dir = makeTempDir();
    const repoDir = path.join(dir, "workspace");
    fs.mkdirSync(repoDir, { recursive: true });
    fs.mkdirSync(path.join(repoDir, ".git"));
    const templateFile = path.join(repoDir, "templates", "meta.md");
    fs.mkdirSync(path.dirname(templateFile), { recursive: true });
    fs.writeFileSync(templateFile, "# Template\n", "utf8");
    const config = `defaultRepo: work\nrepos:\n  work:\n    path: ./workspace\n    template: templates/meta.md\n`;
    fs.writeFileSync(path.join(dir, ".drctl.yaml"), config);

    const diagnostics = diagnoseConfig({ cwd: dir });

    expect(diagnostics.defaultRepoName).toBe("work");
    expect(diagnostics.repos).toHaveLength(1);
    expect(diagnostics.repos[0]?.exists).toBe(true);
    expect(diagnostics.repos[0]?.gitInitialized).toBe(true);
    expect(diagnostics.warnings).toHaveLength(0);
  });

  it("warns when repositories point to missing paths", () => {
    const dir = makeTempDir();
    const config = `repos:\n  missing:\n    path: ./missing\n  other:\n    path: ./other\n`;
    fs.writeFileSync(path.join(dir, ".drctl.yaml"), config);
    fs.mkdirSync(path.join(dir, "other"), { recursive: true });

    const diagnostics = diagnoseConfig({ cwd: dir });

    expect(diagnostics.repos).toHaveLength(2);
    expect(
      diagnostics.repos.find((repo) => repo.name === "missing")?.exists,
    ).toBe(false);
    expect(diagnostics.warnings).toContainEqual(
      expect.stringMatching(/Repository "missing"/),
    );
    expect(diagnostics.warnings).toContainEqual(
      expect.stringMatching(/Repository "other" is not a git repository/),
    );
    expect(diagnostics.warnings).toContain(
      "Multiple repositories configured but no defaultRepo specified.",
    );
  });

  it("warns when the configured template file is missing", () => {
    const dir = makeTempDir();
    const repoDir = path.join(dir, "workspace");
    fs.mkdirSync(repoDir, { recursive: true });
    fs.mkdirSync(path.join(repoDir, ".git"));
    const config = `repos:
  work:
    path: ./workspace
    template: templates/meta.md
`;
    fs.writeFileSync(path.join(dir, ".drctl.yaml"), config);

    const diagnostics = diagnoseConfig({ cwd: dir });

    expect(diagnostics.repos[0]?.defaultTemplate).toBe("templates/meta.md");
    expect(diagnostics.warnings).toContainEqual(
      expect.stringMatching(/Template "templates\/meta\.md" not found/i),
    );
  });

  it("warns when the configured template path is outside the repository", () => {
    const dir = makeTempDir();
    const repoDir = path.join(dir, "workspace");
    fs.mkdirSync(repoDir, { recursive: true });
    fs.mkdirSync(path.join(repoDir, ".git"));
    const externalDir = path.join(dir, "external");
    fs.mkdirSync(externalDir, { recursive: true });
    const externalTemplate = path.join(externalDir, "custom.md");
    fs.writeFileSync(externalTemplate, "# External Template\n", "utf8");
    const config = `repos:
  work:
    path: ./workspace
    template: ../external/custom.md
`;
    fs.writeFileSync(path.join(dir, ".drctl.yaml"), config);

    const diagnostics = diagnoseConfig({ cwd: dir });

    expect(diagnostics.warnings).toContainEqual(
      expect.stringMatching(/outside the repo root/i),
    );
  });
});
