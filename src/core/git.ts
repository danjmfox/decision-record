import fs from "node:fs";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export interface StageAndCommitOptions {
  cwd: string;
  message: string;
  allowEmpty?: boolean;
}

export interface GitClient {
  stageAndCommit(
    paths: string[],
    options: StageAndCommitOptions,
  ): Promise<void>;
}

export function createGitClient(): GitClient {
  return {
    async stageAndCommit(paths: string[], options: StageAndCommitOptions) {
      if (paths.length === 0) {
        return;
      }

      const relativePaths = paths.map((filePath) => {
        const relative = path.relative(options.cwd, filePath);
        return relative.length === 0 ? "." : relative;
      });

      await runGit(["add", ...relativePaths], options.cwd);

      const commitArgs = ["commit", "-m", options.message];
      if (options.allowEmpty) {
        commitArgs.push("--allow-empty");
      }
      await runGit(commitArgs, options.cwd);
    },
  };
}

export async function initGitRepo(cwd: string): Promise<boolean> {
  const gitDir = path.join(cwd, ".git");
  if (fs.existsSync(gitDir)) {
    return false;
  }
  await runGit(["init"], cwd);
  return true;
}

export function isNotGitRepoError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const message = error.message.toLowerCase();
  return (
    message.includes("not a git repository") ||
    (message.includes("no such file or directory") && message.includes(".git"))
  );
}

export async function getStagedFiles(cwd: string): Promise<string[]> {
  try {
    const { stdout } = await execFileAsync("git", ["status", "--porcelain"], {
      cwd,
    });
    return stdout
      .split("\n")
      .map((line) => line.trimEnd())
      .filter((line) => line.length >= 3)
      .map((line) => {
        const status = line.slice(0, 2);
        const indexStatus = status[0] ?? " ";
        const workTreeStatus = status[1] ?? " ";
        const path = line.slice(3).trim();
        return { indexStatus, workTreeStatus, path };
      })
      .filter(
        ({ indexStatus, path }) =>
          path.length > 0 && indexStatus !== " " && indexStatus !== "?",
      )
      .map(({ path }) => path);
  } catch (error) {
    if (isNotGitRepoError(error)) {
      return [];
    }
    throw error;
  }
}

async function runGit(args: string[], cwd: string): Promise<void> {
  try {
    await execFileAsync("git", args, { cwd });
  } catch (error) {
    const description = args.join(" ");
    const message =
      error instanceof Error ? error.message : "Unknown git error";
    throw new Error(`Git command failed: git ${description}\n${message}`);
  }
}
