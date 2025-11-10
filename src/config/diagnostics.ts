import fs from "node:fs";
import path from "node:path";
import type {
  ConfigDiagnostics,
  NormalizedRepo,
  RepoDiagnostic,
} from "./types.js";
import { resolveGitMode } from "./git-mode.js";
import { resolveTemplatePath } from "./path-utils.js";
import { findGitRoot } from "./git-mode.js";

export class DiagnosticsCollector {
  private readonly warnings: string[] = [];
  private readonly errors: string[] = [];
  private readonly repos: RepoDiagnostic[] = [];

  constructor(private readonly defaultRepoName: string | undefined | null) {}

  collectRepoDiagnostics(repos: Iterable<NormalizedRepo>): void {
    for (const repo of repos) {
      this.addRepoDiagnostic(repo);
    }
  }

  ensureWarningsForEmptyRepoList(): void {
    if (this.repos.length === 0) {
      this.warnings.push(
        "No repositories configured. Create a .drctl.yaml to get started.",
      );
    }
  }

  ensureWarningsForMissingRepos(): void {
    for (const repo of this.repos) {
      if (!repo.exists) {
        this.warnings.push(
          `Repository "${repo.name}" points to missing path: ${repo.root}`,
        );
      } else if (!repo.gitInitialized && repo.gitModeSource === "detected") {
        this.warnings.push(
          `Repository "${repo.name}" is not a git repository. Run "drctl repo bootstrap ${repo.name}" to initialise git.`,
        );
      }
    }
  }

  ensureDefaultRepoWarning(): void {
    if (this.repos.length > 1 && !this.defaultRepoName) {
      this.warnings.push(
        "Multiple repositories configured but no defaultRepo specified.",
      );
    }
  }

  toDiagnostics(cwd: string): ConfigDiagnostics {
    return {
      cwd,
      warnings: this.warnings,
      errors: this.errors,
      repos: this.repos,
    };
  }

  private addRepoDiagnostic(repo: NormalizedRepo): void {
    const exists = fs.existsSync(repo.root);
    const detectedGitRoot = exists ? findGitRoot(repo.root) : undefined;
    const gitInitialized = Boolean(detectedGitRoot);
    const gitResolution = resolveGitMode({
      root: repo.root,
      gitFlag: null,
      gitEnv: null,
      gitConfig: repo.gitMode ?? null,
    });
    const templateAbsolute =
      repo.defaultTemplate && exists
        ? resolveTemplatePath(repo.root, repo.defaultTemplate)
        : undefined;
    const templateRelative =
      templateAbsolute === undefined
        ? undefined
        : path.relative(repo.root, templateAbsolute);

    this.repos.push({
      name: repo.name,
      root: repo.root,
      definitionSource: repo.definitionSource,
      configPath: repo.configPath,
      domainMap: repo.domainMap,
      ...(repo.defaultDomainDir
        ? { defaultDomainDir: repo.defaultDomainDir }
        : {}),
      ...(repo.defaultTemplate
        ? { defaultTemplate: repo.defaultTemplate }
        : {}),
      exists,
      gitInitialized,
      gitMode: gitResolution.mode,
      gitModeSource: gitResolution.source,
      ...((gitResolution.detectedGitRoot ?? detectedGitRoot)
        ? { gitRoot: gitResolution.detectedGitRoot ?? detectedGitRoot }
        : {}),
    });

    if (repo.defaultTemplate && exists) {
      this.ensureTemplateWarnings(repo, templateAbsolute, templateRelative);
    }
  }

  private ensureTemplateWarnings(
    repo: NormalizedRepo,
    templateAbsolute: string | undefined,
    templateRelative: string | undefined,
  ): void {
    if (!templateAbsolute || !fs.existsSync(templateAbsolute)) {
      this.warnings.push(
        `Template "${repo.defaultTemplate}" not found for repository "${repo.name}".`,
      );
      return;
    }
    if (
      templateRelative &&
      (templateRelative.startsWith("..") || path.isAbsolute(templateRelative))
    ) {
      this.warnings.push(
        `Template "${repo.defaultTemplate}" for repository "${repo.name}" is outside the repo root (${templateAbsolute}).`,
      );
    }
  }
}
