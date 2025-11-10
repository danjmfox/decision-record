import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { load as loadYaml } from "js-yaml";
import {
  resolvePath,
  looksLikePath,
  selectFallbackRoot,
} from "./config/path-utils.js";
import { coerceGitMode, resolveGitMode } from "./config/git-mode.js";
import { DiagnosticsCollector } from "./config/diagnostics.js";
import type {
  ConfigDiagnostics,
  GitMode,
  NormalizedConfigLayer,
  NormalizedRepo,
  RawDomainConfig,
  RawDrctlConfig,
  RawRepoConfig,
  RepoContext,
  RepoDefinitionSource,
  RepoResolutionSource,
  ResolveRepoOptions,
} from "./config/types.js";
export type {
  GitMode,
  GitModeSource,
  GitModeOverrideSource,
  RepoDefinitionSource,
  RepoResolutionSource,
  RepoContext,
  RepoDiagnostic,
  ConfigDiagnostics,
  ResolveRepoOptions,
  RawDrctlConfig,
  RawRepoConfig,
  RawDomainConfig,
  NormalizedRepo,
  NormalizedConfigLayer,
} from "./config/types.js";

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
  if (gitResult.mode === "enabled" && gitResult.detectedGitRoot) {
    context.gitRoot = gitResult.detectedGitRoot;
  } else if (context.gitRoot) {
    delete context.gitRoot;
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
