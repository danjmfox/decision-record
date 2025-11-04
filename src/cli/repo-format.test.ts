import path from "node:path";
import { describe, expect, it } from "vitest";
import type { RepoContext } from "../config.js";
import { formatRepoContext } from "./repo-format.js";

const NOTE =
  "   Note: No .drctl.yaml found. Create one to configure multiple decision repos.";

describe("formatRepoContext", () => {
  it("includes config details and domain overrides", () => {
    const context: RepoContext = {
      name: "home",
      root: path.join("/tmp", "home-decisions"),
      source: "local-config",
      definitionSource: "local",
      configPath: "/configs/.drctl.yaml",
      defaultDomainDir: "domains",
      defaultTemplate: "templates/meta.md",
      domainMap: {
        personal: "domains/personal",
        work: "domains/work",
      },
    };

    const lines = formatRepoContext(context);

    expect(lines).toEqual([
      `📁 Repo: home (${path.normalize(context.root)})`,
      "   Source: local-config",
      "   Definition: local",
      "   Config: /configs/.drctl.yaml",
      "   Default domain dir: domains",
      "   Default template: templates/meta.md",
      "   Domain overrides:",
      "     - personal -> domains/personal",
      "     - work -> domains/work",
    ]);
  });

  it("falls back gracefully when optional fields are missing", () => {
    const context: RepoContext = {
      root: path.join("/tmp", "workspace"),
      source: "cli",
      domainMap: {},
    };

    const lines = formatRepoContext(context);

    expect(lines).toEqual([
      `📁 Repo: (unnamed) (${path.normalize(context.root)})`,
      "   Source: cli",
      "   Definition: n/a",
      "   Config: n/a",
      "   Default domain dir: <domain>",
      "   Default template: (internal default)",
      "   Domain overrides: none",
    ]);
    expect(lines).not.toContain(NOTE);
  });

  it("appends the missing-config note for fallback sources", () => {
    const context: RepoContext = {
      root: path.join("/tmp", "decisions"),
      source: "fallback-home",
      domainMap: {},
    };

    const lines = formatRepoContext(context);
    expect(lines.at(-1)).toBe(NOTE);
  });
});
