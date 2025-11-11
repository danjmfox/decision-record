export type GitMode = "enabled" | "disabled";
export type GitModeSource = "cli" | "env" | "config" | "detected";
export type GitModeOverrideSource = Exclude<GitModeSource, "detected">;

export type RepoDefinitionSource = "local" | "global";

export type RepoResolutionSource =
  | "cli"
  | "env"
  | "local-config"
  | "global-config"
  | "fallback-cwd"
  | "fallback-home";

export interface RepoContext {
  root: string;
  name?: string;
  source: RepoResolutionSource;
  definitionSource?: RepoDefinitionSource;
  configPath?: string;
  domainMap: Record<string, string>;
  defaultDomainDir?: string;
  defaultTemplate?: string;
  reviewPolicy?: ReviewPolicyConfig;
  gitMode: GitMode;
  gitModeSource: GitModeSource;
  gitModeOverrideCleared?: GitModeOverrideSource;
  gitRoot?: string | undefined;
}

export interface RepoDiagnostic {
  name: string;
  root: string;
  definitionSource: RepoDefinitionSource;
  configPath: string;
  domainMap: Record<string, string>;
  defaultDomainDir?: string;
  defaultTemplate?: string;
  reviewPolicy?: ReviewPolicyConfig;
  exists: boolean;
  gitInitialized: boolean;
  gitMode: GitMode;
  gitModeSource: GitModeSource;
  gitRoot?: string | undefined;
}

export interface ConfigDiagnostics {
  cwd: string;
  localConfigPath?: string;
  globalConfigPath?: string;
  defaultRepoName?: string;
  repos: RepoDiagnostic[];
  warnings: string[];
  errors: string[];
}

export interface ResolveRepoOptions {
  repoFlag?: string | null;
  envRepo?: string | null;
  cwd?: string;
  configPath?: string | null;
  gitModeFlag?: GitMode | null;
}

export interface RawDrctlConfig {
  defaultRepo?: unknown;
  repos?: Record<string, unknown>;
}

export interface RawRepoConfig {
  path?: unknown;
  root?: unknown;
  directory?: unknown;
  dir?: unknown;
  domains?: Record<string, unknown>;
  defaultDomainDir?: unknown;
  domainRoot?: unknown;
  template?: unknown;
  git?: unknown;
  reviewPolicy?: unknown;
  review_policy?: unknown;
}

export interface RawDomainConfig {
  path?: unknown;
  dir?: unknown;
  directory?: unknown;
}

export interface NormalizedRepo {
  name: string;
  root: string;
  domainMap: Record<string, string>;
  defaultDomainDir?: string;
  defaultTemplate?: string;
  reviewPolicy?: ReviewPolicyConfig;
  gitMode?: GitMode;
  definitionSource: RepoDefinitionSource;
  configPath: string;
}

export interface NormalizedConfigLayer {
  defaultRepo?: string;
  repos: Record<string, NormalizedRepo>;
}

export type ReviewPolicyType = "scheduled" | "adhoc" | "contextual";

export interface ReviewPolicyConfig {
  defaultType?: ReviewPolicyType;
  intervalMonths?: number;
  warnBeforeDays?: number;
}
