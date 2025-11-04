import fs from "fs";
import os from "os";
import path from "path";
import { load as loadYaml } from "js-yaml";

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

  const { localConfig, globalConfig } = loadConfigLayers(cwd, {
    explicitConfigPath,
    envConfigPath,
  });

  const combinedRepos = combineRepoLayers(globalConfig, localConfig);

  const defaultRepoName =
    localConfig?.defaultRepo ?? globalConfig?.defaultRepo ?? null;

  const requestedRepoName = repoFlag ?? envRepo ?? defaultRepoName ?? null;

  const layersForDefaultSource: {
    localConfig?: NormalizedConfigLayer;
    globalConfig?: NormalizedConfigLayer;
  } = {};
  if (localConfig) {
    layersForDefaultSource.localConfig = localConfig;
  }
  if (globalConfig) {
    layersForDefaultSource.globalConfig = globalConfig;
  }

  const requestedRepoSource =
    repoFlag !== null
      ? "cli"
      : envRepo !== null
        ? "env"
        : defaultRepoName !== null
          ? determineDefaultSource(defaultRepoName, layersForDefaultSource)
          : undefined;

  if (requestedRepoName) {
    const repo = combinedRepos.get(requestedRepoName);
    if (repo) {
      return buildContext(repo, requestedRepoSource ?? sourceFromRepo(repo));
    }

    if (looksLikePath(requestedRepoName)) {
      return {
        root: resolvePath(requestedRepoName, cwd),
        source: requestedRepoSource ?? "cli",
        domainMap: {},
      };
    }

    if (repoFlag !== null || envRepo !== null) {
      throw new Error(
        `Repository "${requestedRepoName}" not found in configuration`,
      );
    }
  }

  if (!requestedRepoName && combinedRepos.size === 1) {
    const iterator = combinedRepos.values().next();
    if (!iterator.done) {
      const repo = iterator.value;
      return buildContext(repo, requestedRepoSource ?? sourceFromRepo(repo));
    }
  }

  if (!requestedRepoName && combinedRepos.size > 1) {
    const names = [...combinedRepos.keys()].join(", ");
    throw new Error(
      `Multiple repositories configured (${names}). Specify one with --repo or DRCTL_REPO.`,
    );
  }

  const fallback = selectFallbackRoot(cwd);
  return {
    root: fallback.root,
    source: fallback.source,
    domainMap: {},
  };
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

  const warnings: string[] = [];
  const errors: string[] = [];
  const repos: RepoDiagnostic[] = [];
  for (const repo of combinedRepos.values()) {
    const exists = fs.existsSync(repo.root);
    const gitInitialized =
      exists && fs.existsSync(path.join(repo.root, ".git"));
    const templateAbsolute =
      repo.defaultTemplate && exists
        ? resolveTemplatePath(repo.root, repo.defaultTemplate)
        : undefined;
    const templateRelative =
      templateAbsolute !== undefined
        ? path.relative(repo.root, templateAbsolute)
        : undefined;
    repos.push({
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
    });
    if (repo.defaultTemplate && exists) {
      if (!templateAbsolute || !fs.existsSync(templateAbsolute)) {
        warnings.push(
          `Template "${repo.defaultTemplate}" not found for repository "${repo.name}".`,
        );
      } else if (
        templateRelative &&
        (templateRelative.startsWith("..") || path.isAbsolute(templateRelative))
      ) {
        warnings.push(
          `Template "${repo.defaultTemplate}" for repository "${repo.name}" is outside the repo root (${templateAbsolute}).`,
        );
      }
    }
  }

  if (repos.length === 0) {
    warnings.push(
      "No repositories configured. Create a .drctl.yaml to get started.",
    );
  }

  for (const repo of repos) {
    if (!repo.exists) {
      warnings.push(
        `Repository "${repo.name}" points to missing path: ${repo.root}`,
      );
    } else if (!repo.gitInitialized) {
      warnings.push(
        `Repository "${repo.name}" is not a git repository. Run "drctl repo bootstrap ${repo.name}" to initialise git.`,
      );
    }
  }

  if (repos.length > 1 && !defaultRepoName) {
    warnings.push(
      "Multiple repositories configured but no defaultRepo specified.",
    );
  }

  const diagnostics: ConfigDiagnostics = {
    cwd,
    repos,
    warnings,
    errors,
  };
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
  };
  if (repo.defaultDomainDir) {
    context.defaultDomainDir = repo.defaultDomainDir;
  }
  if (repo.defaultTemplate) {
    context.defaultTemplate = repo.defaultTemplate;
  }
  return context;
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
  const normalized = withHome.replace(/\\/g, path.sep);
  if (path.isAbsolute(normalized)) {
    return path.normalize(normalized);
  }
  return path.resolve(baseDir, normalized);
}

function expandEnvVars(input: string): string {
  return input.replace(
    /\$\{([^}]+)\}|\$([A-Za-z_][A-Za-z0-9_]*)/g,
    (_, group1, group2) => {
      const key = group1 ?? group2;
      if (!key) return "";
      return process.env[key] ?? "";
    },
  );
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
