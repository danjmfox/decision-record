import fs from "fs";
import os from "os";
import path from "path";
import { dump as dumpYaml, load as loadYaml } from "js-yaml";
import { resolveConfigPath } from "../config.js";

const CONFIG_FILENAMES = [".drctl.yaml", ".drctl.yml"];

export interface CreateRepoEntryOptions {
  cwd: string;
  name: string;
  repoPath: string;
  setDefault?: boolean;
  defaultDomainDir?: string;
  configPath?: string;
}

export interface CreateRepoEntryResult {
  configPath: string;
  repoRoot: string;
}

export interface SwitchDefaultRepoOptions {
  cwd: string;
  name: string;
  configPath?: string;
}

export interface SwitchDefaultRepoResult {
  configPath: string;
  defaultRepo: string;
}

export function createRepoEntry(
  options: CreateRepoEntryOptions,
): CreateRepoEntryResult {
  const { cwd, name, repoPath, setDefault, defaultDomainDir } = options;
  const explicitConfigInput = sanitizeConfigInput(options.configPath);
  const explicitConfigPath = explicitConfigInput
    ? resolveConfigPath(explicitConfigInput, cwd)
    : undefined;
  const envConfigInput =
    explicitConfigPath === undefined
      ? sanitizeConfigInput(process.env.DRCTL_CONFIG)
      : undefined;
  const resolvedEnvConfigPath = envConfigInput
    ? resolveConfigPath(envConfigInput, cwd)
    : undefined;
  const configPath =
    explicitConfigPath ??
    resolvedEnvConfigPath ??
    findNearestConfig(cwd) ??
    path.join(cwd, ".drctl.yaml");
  const configDir = path.dirname(configPath);

  const config = loadConfigFile(configPath);
  const repos = ensureRepoMap(config.repos);
  const normalizedNewRoot = resolveRepoPath(repoPath, configDir);

  for (const [alias, existing] of Object.entries(repos)) {
    if (alias === name) continue;
    const existingPath = getRepoPath(existing);
    if (!existingPath) continue;
    const normalizedExisting = resolveRepoPath(existingPath, configDir);
    if (
      path.normalize(normalizedExisting) === path.normalize(normalizedNewRoot)
    ) {
      throw new Error(
        `Repository path "${normalizedNewRoot}" is already configured as "${alias}". Use the existing alias "${alias}" or remove it before creating another entry.`,
      );
    }
  }

  config.repos = repos;

  const entry: Record<string, unknown> = { path: repoPath };
  if (defaultDomainDir) {
    entry.defaultDomainDir = defaultDomainDir;
  }
  repos[name] = entry;

  if (setDefault) {
    config.defaultRepo = name;
  }

  const yaml = dumpYaml(config, { noRefs: true, lineWidth: 100 });
  fs.mkdirSync(path.dirname(configPath), { recursive: true });
  fs.writeFileSync(configPath, yaml);

  return { configPath, repoRoot: normalizedNewRoot };
}

export function switchDefaultRepo(
  options: SwitchDefaultRepoOptions,
): SwitchDefaultRepoResult {
  const { cwd, name } = options;
  const explicitConfigInput = sanitizeConfigInput(options.configPath);
  const explicitConfigPath = explicitConfigInput
    ? resolveConfigPath(explicitConfigInput, cwd)
    : undefined;
  const envConfigInput =
    explicitConfigPath === undefined
      ? sanitizeConfigInput(process.env.DRCTL_CONFIG)
      : undefined;
  const resolvedEnvConfigPath = envConfigInput
    ? resolveConfigPath(envConfigInput, cwd)
    : undefined;
  const configPath =
    explicitConfigPath ?? resolvedEnvConfigPath ?? findNearestConfig(cwd);
  if (!configPath) {
    throw new Error(
      "No .drctl.yaml file found. Run 'drctl repo new' to create one first.",
    );
  }
  const config = loadConfigFile(configPath);
  const repos = ensureRepoMap(config.repos);
  config.repos = repos;

  if (!repos[name]) {
    const available = Object.keys(repos);
    const hint = available.length > 0 ? available.join(", ") : "(none)";
    throw new Error(
      `Repository "${name}" not found. Available repos: ${hint}.`,
    );
  }

  config.defaultRepo = name;
  const yaml = dumpYaml(config, { noRefs: true, lineWidth: 100 });
  fs.writeFileSync(configPath, yaml);

  return { configPath, defaultRepo: name };
}

function loadConfigFile(configPath: string): Record<string, unknown> {
  if (!fs.existsSync(configPath)) {
    return {};
  }
  const content = fs.readFileSync(configPath, "utf8");
  const parsed = loadYaml(content);
  if (!parsed || typeof parsed !== "object") {
    return {};
  }
  return { ...(parsed as Record<string, unknown>) };
}

function getRepoPath(entry: Record<string, unknown>): string | undefined {
  const pathCandidates = [entry.path, entry.root, entry.directory, entry.dir];
  for (const candidate of pathCandidates) {
    if (typeof candidate === "string" && candidate.trim().length > 0) {
      return candidate;
    }
  }
  return undefined;
}

function ensureRepoMap(
  value: unknown,
): Record<string, Record<string, unknown>> {
  const normalized: Record<string, Record<string, unknown>> = {};
  const candidate =
    value && typeof value === "object" && !Array.isArray(value)
      ? extractFlatRepoDefinition(value as Record<string, unknown>)
      : null;

  if (candidate) {
    normalized[candidate.name] = candidate.entry;
  }

  if (value && typeof value === "object" && !Array.isArray(value)) {
    for (const [key, entryValue] of Object.entries(
      value as Record<string, unknown>,
    )) {
      if (
        candidate &&
        (key === "name" ||
          key === "path" ||
          key === "defaultDomainDir" ||
          key === "domains")
      ) {
        continue;
      }
      if (entryValue && typeof entryValue === "object") {
        normalized[key] = { ...(entryValue as Record<string, unknown>) };
      } else if (typeof entryValue === "string") {
        normalized[key] = { path: entryValue };
      }
    }
  }

  return normalized;
}

function extractFlatRepoDefinition(
  value: Record<string, unknown>,
): { name: string; entry: Record<string, unknown> } | null {
  if (typeof value.name !== "string" || typeof value.path !== "string") {
    return null;
  }

  const allowedKeys = new Set(["name", "path", "defaultDomainDir", "domains"]);
  const extraKeys = Object.keys(value).filter((key) => !allowedKeys.has(key));
  if (extraKeys.length > 0) {
    return null;
  }

  const entry: Record<string, unknown> = { path: value.path };
  if (typeof value.defaultDomainDir === "string") {
    entry.defaultDomainDir = value.defaultDomainDir;
  }
  if (value.domains && typeof value.domains === "object") {
    entry.domains = value.domains;
  }

  return {
    name: value.name,
    entry,
  };
}

function findNearestConfig(startDir: string): string | undefined {
  let current = path.resolve(startDir);
  while (true) {
    for (const filename of CONFIG_FILENAMES) {
      const candidate = path.join(current, filename);
      if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
        return candidate;
      }
    }
    const parent = path.dirname(current);
    if (parent === current) {
      return undefined;
    }
    current = parent;
  }
}

function resolveRepoPath(repoPath: string, baseDir: string): string {
  const expandedEnv = expandEnvVars(repoPath);
  const expandedTilde = expandTilde(expandedEnv);
  const normalized = expandedTilde.replace(/\\/g, path.sep);
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

function expandTilde(input: string): string {
  if (input === "~") {
    return os.homedir();
  }
  if (input.startsWith("~/")) {
    return path.join(os.homedir(), input.slice(2));
  }
  return input;
}

function sanitizeConfigInput(
  value: string | null | undefined,
): string | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}
