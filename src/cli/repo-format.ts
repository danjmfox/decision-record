import path from "path";
import type { RepoContext } from "../config.js";

export function formatRepoContext(context: RepoContext): string[] {
  const lines: string[] = [];
  const label = context.name ?? "(unnamed)";
  const normalizedRoot = path.normalize(context.root);
  lines.push(`📁 Repo: ${label} (${normalizedRoot})`);

  lines.push(`   Source: ${context.source}`);
  lines.push(`   Definition: ${context.definitionSource ?? "n/a"}`);
  lines.push(`   Config: ${context.configPath ?? "n/a"}`);

  const defaultDomain = context.defaultDomainDir ?? "<domain>";
  lines.push(`   Default domain dir: ${defaultDomain}`);

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
    lines.push(`\n`);
    lines.push(
      "   Note: No .drctl.yaml found. Create one to configure multiple decision repos.",
    );
  }

  return lines;
}
