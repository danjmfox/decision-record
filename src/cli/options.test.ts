import { Command } from "commander";
import { describe, expect, it } from "vitest";
import { collectRepoOptions, ensureRepoFlagNotUsed } from "./options.js";
import { describe, expect, it, vi } from "vitest";

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

  it("falls back to process.cwd when no repo provided", () => {
    const program = new Command();
    program.exitOverride();
    program.option("--repo <repo>");
    const sub = program.command("list");
    sub.action(() => {});

    program.parse(["list"], { from: "user" });

    const options = collectRepoOptions(sub);
    expect(options.repo).toBeUndefined();
    expect(options.cwd).toBeDefined();
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
