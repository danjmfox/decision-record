import { execFile } from "child_process";
import { promisify } from "util";
import path from "path";

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
