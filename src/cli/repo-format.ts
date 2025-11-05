import path from "node:path";
import type { RepoContext } from "../config.js";

export function formatRepoContext(context: RepoContext): string[] {
  const lines: string[] = [];
  const label = context.name ?? "(unnamed)";
  const normalizedRoot = path.normalize(context.root);
  lines.push(
    `📁 Repo: ${label} (${normalizedRoot})`,
    `   Source: ${context.source}`,
    `   Definition: ${context.definitionSource ?? "n/a"}`,
    `   Config: ${context.configPath ?? "n/a"}`,
  );

  const gitMode = context.gitMode === "enabled" ? "enabled" : "disabled";
  const gitSourceLabel =
    context.gitModeSource === "detected" ? "auto" : context.gitModeSource;
  lines.push(`   Git: ${gitMode} (${gitSourceLabel})`);
  if (context.gitModeOverrideCleared) {
    lines.push(
      `   Git note: ignored ${context.gitModeOverrideCleared} disable (git repo detected)`,
    );
  }

  const defaultDomain = context.defaultDomainDir ?? "<domain>";
  lines.push(`   Default domain dir: ${defaultDomain}`);
  const defaultTemplate = context.defaultTemplate ?? "(internal default)";
  lines.push(`   Default template: ${defaultTemplate}`);

  const domains = Object.entries(context.domainMap);
  if (domains.length === 0) {
    lines.push("   Domain overrides: none");
  } else {
    lines.push("   Domain overrides:");
    for (const [domain, dir] of domains) {
      lines.push(`     - ${domain} -> ${dir}`);
    }
  }

  if (context.source === "fallback-home" || context.source === "fallback-cwd") {
    lines.push(
      `\n`,
      "   Note: No .drctl.yaml found. Create one to configure multiple decision repos.",
    );
  }

  return lines;
}
