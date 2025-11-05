import { Command } from "commander";
import { describe, expect, it } from "vitest";
import { collectRepoOptions, ensureRepoFlagNotUsed } from "./options.js";

describe("collectRepoOptions", () => {
  it("pulls the global --repo option into repo options", () => {
    const program = new Command();
    program.exitOverride();
    program.option("--repo <repo>");
    const sub = program.command("list");
    sub.action(() => {});

    program.parse(["list", "--repo", "home"], {
      from: "user",
    });

    const options = collectRepoOptions(sub);
    expect(options.repo).toBe("home");
    expect(options.cwd).toBeDefined();
  });

  it("captures --config when provided", () => {
    const program = new Command();
    program.exitOverride();
    program.option("--repo <repo>");
    program.option("--config <config>");
    const sub = program.command("list");
    sub.action(() => {});

    program.parse(["list", "--config", "./custom-config"], { from: "user" });

    const options = collectRepoOptions(sub);
    expect(options.configPath).toBe("./custom-config");
  });

  it("falls back to process.cwd when no repo provided", () => {
    const program = new Command();
    program.exitOverride();
    program.option("--repo <repo>");
    program.option("--git");
    program.option("--no-git");
    const sub = program.command("list");
    sub.action(() => {});

    program.parse(["list"], { from: "user" });

    const options = collectRepoOptions(sub);
    expect(options.repo).toBeUndefined();
    expect(options.cwd).toBeDefined();
  });

  it("captures git toggles", () => {
    const program = new Command();
    program.exitOverride();
    program.option("--git");
    program.option("--no-git");
    const sub = program.command("list");
    sub.action(() => {});

    program.parse(["list", "--git"], { from: "user" });
    const enabled = collectRepoOptions(sub);
    expect(enabled.gitModeFlag).toBe("enabled");

    program.parse(["list", "--no-git"], { from: "user" });
    const disabled = collectRepoOptions(sub);
    expect(disabled.gitModeFlag).toBe("disabled");
  });

  it("walks parent chain to resolve git preference", () => {
    const program = new Command();
    program.exitOverride();
    program.option("--git");
    const child = program.command("list");
    child.action(() => {});

    program.parse(["--git", "list"], { from: "user" });

    const options = collectRepoOptions(child);
    expect(options.gitModeFlag).toBe("enabled");
  });

  it("ignores git preference when opts accessor missing", () => {
    const fakeCommand = {
      parent: undefined,
      opts: undefined,
    } as unknown as Command;
    const options = collectRepoOptions(fakeCommand);
    expect(options.gitModeFlag).toBeUndefined();
  });

  it("ignores git preference when opts returns undefined", () => {
    const fakeCommand = {
      parent: undefined,
      opts: () => undefined,
    } as unknown as Command;
    const options = collectRepoOptions(fakeCommand);
    expect(options.gitModeFlag).toBeUndefined();
  });

  it("throws when ensureRepoFlagNotUsed is invoked and --repo is set", () => {
    const program = new Command();
    program.exitOverride();
    program.option("--repo <repo>");
    const sub = program.command("repo");
    sub.action(() => {});

    program.parse(["repo", "--repo", "home"], {
      from: "user",
    });

    expect(() => ensureRepoFlagNotUsed(sub, "repo new")).toThrow(
      /--repo cannot be used with repo new/,
    );
  });

  it("allows ensureRepoFlagNotUsed when flag is absent", () => {
    const program = new Command();
    program.exitOverride();
    program.option("--repo <repo>");
    const sub = program.command("repo");
    sub.action(() => {});

    program.parse(["repo"], { from: "user" });

    expect(() => ensureRepoFlagNotUsed(sub, "repo new")).not.toThrow();
  });
});
