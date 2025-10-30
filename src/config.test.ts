import fs from "fs";
import os from "os";
import path from "path";
import {
  describe,
  expect,
  it,
  afterAll,
  afterEach,
  beforeEach,
  vi,
} from "vitest";
import { resolveRepoContext } from "./config.js";

const tempDirs: string[] = [];
const originalEnvRepo = process.env.DRCTL_REPO;
let homedirSpy: ReturnType<typeof vi.spyOn> | null = null;

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
  delete process.env.TEST_DECISIONS_PATH;
  if (homedirSpy) {
    homedirSpy.mockRestore();
    homedirSpy = null;
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
});

beforeEach(() => {
  process.env.DRCTL_REPO = undefined;
  delete process.env.DRCTL_REPO;
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

  it("falls back to the cwd decisions directory when present", () => {
    const dir = makeTempDir();
    const home = makeTempDir();
    homedirSpy = vi.spyOn(os, "homedir").mockReturnValue(home);

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
    homedirSpy = vi.spyOn(os, "homedir").mockReturnValue(home);

    const homeDecisions = path.join(home, "decisions");
    fs.mkdirSync(homeDecisions, { recursive: true });

    const context = resolveRepoContext({ cwd: dir });

    expect(context.root).toBe(homeDecisions);
    expect(context.source).toBe("fallback-home");
  });

  it("expands env variables and tildes in repo configuration paths", () => {
    const dir = makeTempDir();
    const home = makeTempDir();
    homedirSpy = vi.spyOn(os, "homedir").mockReturnValue(home);

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
});
