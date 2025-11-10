import type { RepoContext } from "../config.js";
import {
  createGitClient,
  getStagedFiles,
  isNotGitRepoError,
  type GitClient,
} from "./git.js";
import type { RepoOptions } from "./service-types.js";

export async function commitLifecycle(
  context: RepoContext,
  options: RepoOptions,
  filePath: string,
  verb: string,
  id: string,
): Promise<void> {
  await commitIfEnabled(context, options, [filePath], `drctl: ${verb} ${id}`);
}

export async function commitBatch(
  context: RepoContext,
  options: RepoOptions,
  paths: string[],
  message: string,
): Promise<void> {
  await commitIfEnabled(context, options, paths, message);
}

async function commitIfEnabled(
  context: RepoContext,
  options: RepoOptions,
  paths: string[],
  message: string,
): Promise<void> {
  if (context.gitMode === "disabled") {
    options.onGitDisabled?.({ context });
    return;
  }
  if (paths.length === 0) return;
  options.gitClient ??= createGitClient();
  const gitCwd = context.gitRoot ?? context.root;
  await stageAndCommitWithHint(
    context,
    options.gitClient,
    gitCwd,
    paths,
    message,
  );
}

async function stageAndCommitWithHint(
  context: RepoContext,
  gitClient: GitClient,
  gitCwd: string,
  paths: string[],
  message: string,
) {
  const staged = await getStagedFiles(gitCwd);
  if (staged.length > 0) {
    const list = staged.join(", ");
    throw new Error(
      `Staging area contains unrelated changes in ${gitCwd}: ${list}. Commit or reset them before running drctl.`,
    );
  }
  try {
    await gitClient.stageAndCommit(paths, { cwd: gitCwd, message });
  } catch (error) {
    if (isNotGitRepoError(error)) {
      const displayRoot = context.gitRoot ?? context.root;
      const label = context.name
        ? `repo "${context.name}" (${displayRoot})`
        : displayRoot;
      const bootstrap = context.name
        ? `drctl repo bootstrap ${context.name}`
        : "git init";
      const hintMessage =
        error instanceof Error ? error.message : String(error);
      throw new Error(
        `${hintMessage}\n💡 Hint: initialise git in ${label} via "${bootstrap}" before running this command again.`,
      );
    }
    throw error;
  }
}
