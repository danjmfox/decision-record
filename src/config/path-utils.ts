import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { RepoResolutionSource } from "./types.js";

export function resolvePath(p: string, baseDir: string): string {
  const envExpanded = expandEnvVars(p);
  const withHome = expandTilde(envExpanded);
  const normalized = withHome.replaceAll("\\", path.sep);
  if (path.isAbsolute(normalized)) {
    return path.normalize(normalized);
  }
  return path.resolve(baseDir, normalized);
}

export function expandEnvVars(input: string): string {
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

export function expandTilde(input: string): string {
  if (input === "~") {
    return os.homedir();
  }
  if (input.startsWith("~/")) {
    return path.join(os.homedir(), input.slice(2));
  }
  return input;
}

export function looksLikePath(input: string): boolean {
  return (
    input.includes("/") ||
    input.includes("\\") ||
    input.startsWith(".") ||
    input.startsWith("~") ||
    /^[A-Za-z]:/.test(input)
  );
}

export function selectFallbackRoot(cwd: string): {
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

export function resolveTemplatePath(
  repoRoot: string,
  templatePath: string,
): string {
  const expanded = expandTilde(expandEnvVars(templatePath));
  if (path.isAbsolute(expanded)) {
    return path.normalize(expanded);
  }
  return path.resolve(repoRoot, expanded);
}
