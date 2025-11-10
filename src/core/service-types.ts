import type { GitMode, RepoContext } from "../config.js";
import type { GitClient } from "./git.js";

export interface RepoOptions {
  repo?: string;
  envRepo?: string;
  cwd?: string;
  context?: RepoContext;
  gitClient?: GitClient;
  configPath?: string;
  onTemplateWarning?: (message: string) => void;
  gitModeFlag?: GitMode;
  onGitDisabled?: (details: { context: RepoContext }) => void;
}

export interface CreateDecisionOptions extends RepoOptions {
  confidence?: number;
  templatePath?: string;
  envTemplate?: string;
}

export interface CorrectionOptions extends RepoOptions {
  note?: string;
}

export interface ReviseOptions extends RepoOptions {
  note?: string;
  confidence?: number;
}
