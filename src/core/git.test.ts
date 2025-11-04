import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { describe, it, expect } from "vitest";
import {
  createGitClient,
  getStagedFiles,
  initGitRepo,
  isNotGitRepoError,
} from "./git.js";

function initTempRepo(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "git-util-test-"));
  execFileSync("git", ["init"], { cwd: dir });
  execFileSync("git", ["config", "user.email", "test@example.com"], {
    cwd: dir,
  });
  execFileSync("git", ["config", "user.name", "Test User"], { cwd: dir });
  return dir;
}

describe("git helpers", () => {
  it("stages relative paths and commits", async () => {
    const cwd = initTempRepo();
    const file = path.join(cwd, "README.md");
    fs.writeFileSync(file, "hello", "utf8");

    const client = createGitClient();
    await client.stageAndCommit([file], { cwd, message: "test commit" });

    const log = execFileSync("git", ["log", "--oneline"], {
      cwd,
      encoding: "utf8",
    });
    expect(log).toMatch(/test commit/);
  });

  it("initialises git repo when .git is absent", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "git-util-test-"));
    const initialised = await initGitRepo(dir);
    expect(initialised).toBe(true);
    expect(fs.existsSync(path.join(dir, ".git"))).toBe(true);
  });

  it("skips init when .git already exists", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "git-util-test-"));
    fs.mkdirSync(path.join(dir, ".git"));
    const initialised = await initGitRepo(dir);
    expect(initialised).toBe(false);
  });

  it("parses staged files from git status output", async () => {
    const cwd = initTempRepo();
    const fileA = path.join(cwd, "src/app.ts");
    const fileB = path.join(cwd, "docs/guide.md");
    fs.mkdirSync(path.dirname(fileA), { recursive: true });
    fs.mkdirSync(path.dirname(fileB), { recursive: true });
    fs.writeFileSync(fileA, "const a = 1;", "utf8");
    fs.writeFileSync(fileB, "guide", "utf8");
    execFileSync("git", ["add", "src/app.ts"], { cwd });
    execFileSync("git", ["add", "docs/guide.md"], { cwd });

    const staged = await getStagedFiles(cwd);
    expect(staged).toHaveLength(2);
    expect(staged).toEqual(
      expect.arrayContaining(["src/app.ts", "docs/guide.md"]),
    );
  });

  it("treats missing git repos as having no staged files", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "git-util-test-"));
    await expect(getStagedFiles(dir)).resolves.toEqual([]);
  });

  it("evaluates git repo errors by message", () => {
    expect(isNotGitRepoError(new Error("fatal: not a git repository"))).toBe(
      true,
    );
    expect(
      isNotGitRepoError(
        new Error("fatal: cannot chdir to './.git': No such file or directory"),
      ),
    ).toBe(true);
    expect(isNotGitRepoError(new Error("other failure"))).toBe(false);
  });
});
