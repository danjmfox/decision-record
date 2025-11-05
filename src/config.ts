import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { load as loadYaml } from "js-yaml";

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
  gitMode: GitMode;
  gitModeSource: GitModeSource;
  gitModeOverrideCleared?: GitModeOverrideSource;
}

export interface RepoDiagnostic {
  name: string;
  root: string;
  definitionSource: RepoDefinitionSource;
  configPath: string;
  domainMap: Record<string, string>;
  defaultDomainDir?: string;
  defaultTemplate?: string;
  exists: boolean;
  gitInitialized: boolean;
  gitMode: GitMode;
  gitModeSource: GitModeSource;
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

interface RawDrctlConfig {
  defaultRepo?: unknown;
  repos?: Record<string, unknown>;
}

interface RawRepoConfig {
  path?: unknown;
  root?: unknown;
  directory?: unknown;
  dir?: unknown;
  domains?: Record<string, unknown>;
  defaultDomainDir?: unknown;
  domainRoot?: unknown;
  template?: unknown;
  git?: unknown;
}

interface RawDomainConfig {
  path?: unknown;
  dir?: unknown;
  directory?: unknown;
}

interface NormalizedRepo {
  name: string;
  root: string;
  domainMap: Record<string, string>;
  defaultDomainDir?: string;
  defaultTemplate?: string;
  gitMode?: GitMode;
  definitionSource: RepoDefinitionSource;
  configPath: string;
}

interface NormalizedConfigLayer {
  defaultRepo?: string;
  repos: Record<string, NormalizedRepo>;
}

const CONFIG_FILENAMES = [".drctl.yaml", ".drctl.yml"];
const GLOBAL_CONFIG_CANDIDATES = [
  ...CONFIG_FILENAMES.map((file) => path.join(os.homedir(), file)),
  ...CONFIG_FILENAMES.map((file) =>
    path.join(
      os.homedir(),
      ".config",
      "drctl",
      file.replace(".drctl", "config"),
    ),
  ),
];

export function resolveRepoContext(
  options: ResolveRepoOptions = {},
): RepoContext {
  const cwd = options.cwd ?? process.cwd();
  const repoFlag = sanitizeString(options.repoFlag);
  const envRepo = sanitizeString(options.envRepo ?? process.env.DRCTL_REPO);
  const explicitConfigPath = sanitizeString(options.configPath);
  const envConfigPath = sanitizeString(process.env.DRCTL_CONFIG);
  const gitFlag = coerceGitMode(options.gitModeFlag ?? null);
  const gitEnv = coerceGitMode(process.env.DRCTL_GIT);

  const { localConfig, globalConfig } = loadConfigLayers(cwd, {
    explicitConfigPath,
    envConfigPath,
  });

  const combinedRepos = combineRepoLayers(globalConfig, localConfig);

  const defaultRepoName =
    localConfig?.defaultRepo ?? globalConfig?.defaultRepo ?? null;

  const requestedRepoName = repoFlag ?? envRepo ?? defaultRepoName ?? null;

  const layersForDefaultSource = collectLayersForDefaultSource(
    localConfig,
    globalConfig,
  );

  const requestedRepoSource = determineRequestedRepoSource(
    repoFlag,
    envRepo,
    defaultRepoName,
    layersForDefaultSource,
  );

  const explicitContext = resolveExplicitRepo({
    requestedRepoName,
    requestedRepoSource,
    combinedRepos,
    cwd,
    repoFlagProvided: repoFlag !== null,
    envRepoProvided: envRepo !== null,
  });
  if (explicitContext) {
    return finalizeContext(explicitContext, { gitFlag, gitEnv });
  }

  const implicitContext = resolveImplicitRepo({
    requestedRepoName,
    combinedRepos,
    requestedRepoSource,
  });
  if (implicitContext) {
    return finalizeContext(implicitContext, { gitFlag, gitEnv });
  }

  return finalizeContext(buildFallbackContext(cwd), { gitFlag, gitEnv });
}

export function resolveConfigPath(input: string, cwd: string): string {
  return resolvePath(input, cwd);
}

export function diagnoseConfig(
  options: { cwd?: string } = {},
): ConfigDiagnostics {
  const cwd = options.cwd ? path.resolve(options.cwd) : process.cwd();
  const layers = loadConfigLayers(cwd);
  const combinedRepos = combineRepoLayers(
    layers.globalConfig,
    layers.localConfig,
  );
  const defaultRepoName =
    layers.localConfig?.defaultRepo ?? layers.globalConfig?.defaultRepo;

  const collector = new DiagnosticsCollector(defaultRepoName);
  collector.collectRepoDiagnostics(combinedRepos.values());
  collector.ensureWarningsForEmptyRepoList();
  collector.ensureWarningsForMissingRepos();
  collector.ensureDefaultRepoWarning();

  const diagnostics: ConfigDiagnostics = collector.toDiagnostics(cwd);
  if (layers.localConfigPath) {
    diagnostics.localConfigPath = layers.localConfigPath;
  }
  if (layers.globalConfigPath) {
    diagnostics.globalConfigPath = layers.globalConfigPath;
  }
  if (defaultRepoName) {
    diagnostics.defaultRepoName = defaultRepoName;
  }
  return diagnostics;
}

export function resolveDomainDir(context: RepoContext, domain: string): string {
  const override = context.domainMap[domain];
  let relative = override;

  if (!relative) {
    if (context.defaultDomainDir) {
      relative = path.join(context.defaultDomainDir, domain);
    } else {
      relative = domain;
    }
  }

  return path.resolve(context.root, relative);
}

interface ContextResolution {
  context: RepoContext;
  repo?: NormalizedRepo;
}

function buildContext(
  repo: NormalizedRepo,
  source: RepoResolutionSource,
): RepoContext {
  const context: RepoContext = {
    root: repo.root,
    name: repo.name,
    source,
    definitionSource: repo.definitionSource,
    configPath: repo.configPath,
    domainMap: repo.domainMap,
    gitMode: "disabled",
    gitModeSource: "detected",
  };
  if (repo.defaultDomainDir) {
    context.defaultDomainDir = repo.defaultDomainDir;
  }
  if (repo.defaultTemplate) {
    context.defaultTemplate = repo.defaultTemplate;
  }
  return context;
}

function collectLayersForDefaultSource(
  localConfig?: NormalizedConfigLayer,
  globalConfig?: NormalizedConfigLayer,
): {
  localConfig?: NormalizedConfigLayer;
  globalConfig?: NormalizedConfigLayer;
} {
  const layers: {
    localConfig?: NormalizedConfigLayer;
    globalConfig?: NormalizedConfigLayer;
  } = {};
  if (localConfig) layers.localConfig = localConfig;
  if (globalConfig) layers.globalConfig = globalConfig;
  return layers;
}

function determineRequestedRepoSource(
  repoFlag: string | null,
  envRepo: string | null,
  defaultRepoName: string | null,
  layersForDefaultSource: {
    localConfig?: NormalizedConfigLayer;
    globalConfig?: NormalizedConfigLayer;
  },
): RepoResolutionSource | undefined {
  if (repoFlag !== null) return "cli";
  if (envRepo !== null) return "env";
  if (defaultRepoName === null) return undefined;
  return determineDefaultSource(defaultRepoName, layersForDefaultSource);
}

function resolveExplicitRepo(options: {
  requestedRepoName: string | null;
  requestedRepoSource: RepoResolutionSource | undefined;
  combinedRepos: Map<string, NormalizedRepo>;
  cwd: string;
  repoFlagProvided: boolean;
  envRepoProvided: boolean;
}): ContextResolution | null {
  const {
    requestedRepoName,
    requestedRepoSource,
    combinedRepos,
    cwd,
    repoFlagProvided,
    envRepoProvided,
  } = options;

  if (!requestedRepoName) return null;

  const repo = combinedRepos.get(requestedRepoName);
  if (repo) {
    return {
      context: buildContext(repo, requestedRepoSource ?? sourceFromRepo(repo)),
      repo,
    };
  }

  if (looksLikePath(requestedRepoName)) {
    return {
      context: {
        root: resolvePath(requestedRepoName, cwd),
        source: requestedRepoSource ?? "cli",
        domainMap: {},
        gitMode: "disabled",
        gitModeSource: "detected",
      },
    };
  }

  if (repoFlagProvided || envRepoProvided) {
    throw new Error(
      `Repository "${requestedRepoName}" not found in configuration`,
    );
  }

  return null;
}

function resolveImplicitRepo(options: {
  requestedRepoName: string | null;
  combinedRepos: Map<string, NormalizedRepo>;
  requestedRepoSource: RepoResolutionSource | undefined;
}): ContextResolution | null {
  const { requestedRepoName, combinedRepos, requestedRepoSource } = options;

  if (requestedRepoName) {
    return null;
  }

  if (combinedRepos.size === 1) {
    const iterator = combinedRepos.values().next();
    if (!iterator.done) {
      const repo = iterator.value;
      return {
        context: buildContext(
          repo,
          requestedRepoSource ?? sourceFromRepo(repo),
        ),
        repo,
      };
    }
  }

  if (combinedRepos.size > 1) {
    const names = [...combinedRepos.keys()].join(", ");
    throw new Error(
      `Multiple repositories configured (${names}). Specify one with --repo or DRCTL_REPO.`,
    );
  }

  return null;
}

function buildFallbackContext(cwd: string): ContextResolution {
  const fallback = selectFallbackRoot(cwd);
  return {
    context: {
      root: fallback.root,
      source: fallback.source,
      domainMap: {},
      gitMode: "disabled",
      gitModeSource: "detected",
    },
  };
}

function finalizeContext(
  resolution: ContextResolution,
  overrides: { gitFlag: GitMode | null; gitEnv: GitMode | null },
): RepoContext {
  const { context, repo } = resolution;
  const gitResult = resolveGitMode({
    root: context.root,
    gitFlag: overrides.gitFlag,
    gitEnv: overrides.gitEnv,
    gitConfig: repo?.gitMode ?? null,
  });
  context.gitMode = gitResult.mode;
  context.gitModeSource = gitResult.source;
  if (gitResult.overrideCleared) {
    context.gitModeOverrideCleared = gitResult.overrideCleared;
  } else if (context.gitModeOverrideCleared) {
    delete context.gitModeOverrideCleared;
  }
  return context;
}

function resolveGitMode(options: {
  root: string;
  gitFlag: GitMode | null;
  gitEnv: GitMode | null;
  gitConfig: GitMode | null;
}): {
  mode: GitMode;
  source: GitModeSource;
  overrideCleared?: GitModeOverrideSource;
} {
  const gitExists = fs.existsSync(path.join(options.root, ".git"));
  const detected: GitMode = gitExists ? "enabled" : "disabled";

  const cascade: Array<{ value: GitMode | null; source: GitModeSource }> = [
    { value: options.gitFlag, source: "cli" },
    { value: options.gitEnv, source: "env" },
    { value: options.gitConfig, source: "config" },
  ];

  for (const entry of cascade) {
    if (!entry.value) continue;
    if (entry.value === "disabled" && gitExists) {
      const overrideSource =
        entry.source === "detected" ? undefined : entry.source;
      if (overrideSource) {
        return {
          mode: "enabled",
          source: "detected",
          overrideCleared: overrideSource,
        };
      }
    }
    return { mode: entry.value, source: entry.source };
  }

  return { mode: detected, source: "detected" };
}

function sourceFromRepo(repo: NormalizedRepo): RepoResolutionSource {
  return repo.definitionSource === "local" ? "local-config" : "global-config";
}

function determineDefaultSource(
  defaultRepoName: string,
  layers: {
    localConfig?: NormalizedConfigLayer;
    globalConfig?: NormalizedConfigLayer;
  },
): RepoResolutionSource | undefined {
  if (layers.localConfig?.repos[defaultRepoName]) {
    return "local-config";
  }
  if (layers.globalConfig?.repos[defaultRepoName]) {
    return "global-config";
  }
  return undefined;
}

function sanitizeString(value: string | null | undefined): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

function coerceGitMode(value: unknown): GitMode | null {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (
      normalized === "enabled" ||
      normalized === "enable" ||
      normalized === "on" ||
      normalized === "true" ||
      normalized === "1" ||
      normalized === "yes"
    ) {
      return "enabled";
    }
    if (
      normalized === "disabled" ||
      normalized === "disable" ||
      normalized === "off" ||
      normalized === "false" ||
      normalized === "0" ||
      normalized === "no"
    ) {
      return "disabled";
    }
    return null;
  }
  if (typeof value === "boolean") {
    return value ? "enabled" : "disabled";
  }
  return null;
}

class DiagnosticsCollector {
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
    const gitInitialized =
      exists && fs.existsSync(path.join(repo.root, ".git"));
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

function findConfigRecursive(startDir: string): string | undefined {
  let current = path.resolve(startDir);
  while (true) {
    const candidate = findConfigAt(current);
    if (candidate) return candidate;
    const parent = path.dirname(current);
    if (parent === current) return undefined;
    current = parent;
  }
}

function findConfigAt(dir: string): string | undefined {
  for (const filename of CONFIG_FILENAMES) {
    const fullPath = path.join(dir, filename);
    if (fs.existsSync(fullPath) && fs.statSync(fullPath).isFile()) {
      return fullPath;
    }
  }
  return undefined;
}

function findFirstExisting(paths: string[]): string | undefined {
  for (const candidate of paths) {
    if (!candidate) continue;
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
      return candidate;
    }
  }
  return undefined;
}

function loadConfigLayer(
  filePath: string,
  source: RepoDefinitionSource,
): NormalizedConfigLayer {
  const raw = parseConfigFile(filePath);
  const repos: Record<string, NormalizedRepo> = {};

  const rawRepos = raw.repos ?? {};
  for (const [name, value] of Object.entries(rawRepos)) {
    const normalized = normalizeRepoConfig(
      name,
      value,
      path.dirname(filePath),
      filePath,
      source,
    );
    if (normalized) {
      repos[name] = normalized;
    }
  }

  const defaultRepo =
    typeof raw.defaultRepo === "string" && raw.defaultRepo.trim().length > 0
      ? raw.defaultRepo.trim()
      : undefined;

  const layer: NormalizedConfigLayer = { repos };
  if (defaultRepo) {
    layer.defaultRepo = defaultRepo;
  }
  return layer;
}

function parseConfigFile(filePath: string): RawDrctlConfig {
  const content = fs.readFileSync(filePath, "utf8");
  const parsed = loadYaml(content);
  if (!parsed || typeof parsed !== "object") {
    return {};
  }
  return parsed as RawDrctlConfig;
}

function normalizeRepoConfig(
  name: string,
  value: unknown,
  baseDir: string,
  configPath: string,
  source: RepoDefinitionSource,
): NormalizedRepo | undefined {
  if (!value || typeof value !== "object") return undefined;
  const raw = value as RawRepoConfig;
  const pathCandidate =
    firstString(raw.path) ??
    firstString(raw.root) ??
    firstString(raw.directory) ??
    firstString(raw.dir);
  if (!pathCandidate) return undefined;

  const root = resolvePath(pathCandidate, baseDir);
  const domainMap: Record<string, string> = {};

  if (raw.domains && typeof raw.domains === "object") {
    for (const [domain, domainValue] of Object.entries(raw.domains)) {
      const normalizedDomainPath = normalizeDomainPath(domainValue);
      if (normalizedDomainPath) {
        domainMap[domain] = normalizedDomainPath;
      }
    }
  }

  const defaultDomainDir =
    firstString(raw.defaultDomainDir) ?? firstString(raw.domainRoot);
  const defaultTemplate = firstString(raw.template);

  const normalized: NormalizedRepo = {
    name,
    root,
    domainMap,
    definitionSource: source,
    configPath,
  };
  if (defaultDomainDir) {
    normalized.defaultDomainDir = defaultDomainDir;
  }
  if (defaultTemplate) {
    normalized.defaultTemplate = defaultTemplate;
  }
  const configGitMode = coerceGitMode(raw.git);
  if (configGitMode) {
    normalized.gitMode = configGitMode;
  }
  return normalized;
}

function normalizeDomainPath(domainValue: unknown): string | undefined {
  if (typeof domainValue === "string") {
    return domainValue;
  }
  if (domainValue && typeof domainValue === "object") {
    const raw = domainValue as RawDomainConfig;
    return (
      firstString(raw.path) ??
      firstString(raw.dir) ??
      firstString(raw.directory) ??
      undefined
    );
  }
  return undefined;
}

function firstString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : undefined;
}

function resolvePath(p: string, baseDir: string): string {
  const envExpanded = expandEnvVars(p);
  const withHome = expandTilde(envExpanded);
  const normalized = withHome.replaceAll("\\", path.sep);
  if (path.isAbsolute(normalized)) {
    return path.normalize(normalized);
  }
  return path.resolve(baseDir, normalized);
}

/**
 * Replaces environment variables in a string with their values.
 * Supports both ${VARIABLE_NAME} and $VARIABLE_NAME formats.
 * If the variable is not set, it will be replaced with an empty string.
 * @param input The string to replace environment variables in.
 * @returns The string with environment variables replaced.
 */
function expandEnvVars(input: string): string {
  let result = "";
  let index = 0;
  while (index < input.length) {
    const char = input.charAt(index);
    if (char !== "$") {
      result += char;
      index += 1;
      continue;
    }

    const nextIndex = index + 1;
    if (nextIndex >= input.length) {
      result += char;
      index += 1;
      continue;
    }

    const nextChar = input.charAt(nextIndex);
    if (nextChar === "{") {
      const endBrace = input.indexOf("}", nextIndex + 1);
      if (endBrace === -1 || endBrace === nextIndex + 1) {
        result += char;
        index += 1;
        continue;
      }
      const key = input.slice(nextIndex + 1, endBrace);
      result += process.env[key] ?? "";
      index = endBrace + 1;
      continue;
    }

    if (!isEnvVarStart(nextChar)) {
      result += char;
      index += 1;
      continue;
    }

    let cursor = nextIndex + 1;
    while (cursor < input.length && isEnvVarChar(input.charAt(cursor))) {
      cursor += 1;
    }
    const key = input.slice(nextIndex, cursor);
    result += process.env[key] ?? "";
    index = cursor;
  }
  return result;
}

function isEnvVarStart(char: string): boolean {
  return (
    (char >= "A" && char <= "Z") || (char >= "a" && char <= "z") || char === "_"
  );
}

function isEnvVarChar(char: string): boolean {
  return isEnvVarStart(char) || (char >= "0" && char <= "9");
}

function resolveTemplatePath(repoRoot: string, templatePath: string): string {
  const expanded = expandTilde(expandEnvVars(templatePath));
  if (path.isAbsolute(expanded)) {
    return path.normalize(expanded);
  }
  return path.resolve(repoRoot, expanded);
}

function expandTilde(input: string): string {
  if (input === "~") {
    return os.homedir();
  }
  if (input.startsWith("~/")) {
    return path.join(os.homedir(), input.slice(2));
  }
  return input;
}

function looksLikePath(input: string): boolean {
  return (
    input.includes("/") ||
    input.includes("\\") ||
    input.startsWith(".") ||
    input.startsWith("~") ||
    /^[A-Za-z]:/.test(input)
  );
}

function selectFallbackRoot(cwd: string): {
  root: string;
  source: RepoResolutionSource;
} {
  const localDir = path.resolve(cwd, "decisions");
  const homeDir = path.join(os.homedir(), "decisions");

  const localExists = fs.existsSync(localDir);
  const homeExists = fs.existsSync(homeDir);

  if (localExists || !homeExists) {
    return { root: localDir, source: "fallback-cwd" };
  }
  return { root: homeDir, source: "fallback-home" };
}

function loadConfigLayers(
  cwd: string,
  overrides: {
    explicitConfigPath?: string | null;
    envConfigPath?: string | null;
  } = {},
): {
  localConfigPath?: string;
  localConfig?: NormalizedConfigLayer;
  globalConfigPath?: string;
  globalConfig?: NormalizedConfigLayer;
} {
  const resolvedExplicit =
    overrides.explicitConfigPath !== undefined &&
    overrides.explicitConfigPath !== null
      ? resolveConfigPath(overrides.explicitConfigPath, cwd)
      : undefined;
  const resolvedEnv =
    !resolvedExplicit && overrides.envConfigPath
      ? resolveConfigPath(overrides.envConfigPath, cwd)
      : undefined;

  const localConfigPath =
    resolvedExplicit ?? resolvedEnv ?? findConfigRecursive(cwd);
  const localConfig =
    localConfigPath && fs.existsSync(localConfigPath)
      ? loadConfigLayer(localConfigPath, "local")
      : undefined;

  const globalConfigPath =
    resolvedExplicit || resolvedEnv
      ? undefined
      : findFirstExisting(GLOBAL_CONFIG_CANDIDATES);
  const globalConfig = globalConfigPath
    ? loadConfigLayer(globalConfigPath, "global")
    : undefined;

  const result: {
    localConfigPath?: string;
    localConfig?: NormalizedConfigLayer;
    globalConfigPath?: string;
    globalConfig?: NormalizedConfigLayer;
  } = {};

  if (localConfigPath) {
    result.localConfigPath = localConfigPath;
  }
  if (localConfig) {
    result.localConfig = localConfig;
  }
  if (globalConfigPath) {
    result.globalConfigPath = globalConfigPath;
  }
  if (globalConfig) {
    result.globalConfig = globalConfig;
  }

  return result;
}

function combineRepoLayers(
  globalConfig?: NormalizedConfigLayer,
  localConfig?: NormalizedConfigLayer,
): Map<string, NormalizedRepo> {
  const combined = new Map<string, NormalizedRepo>();
  if (globalConfig) {
    for (const repo of Object.values(globalConfig.repos)) {
      combined.set(repo.name, repo);
    }
  }
  if (localConfig) {
    for (const repo of Object.values(localConfig.repos)) {
      combined.set(repo.name, repo);
    }
  }
  return combined;
}
