import { Command } from "commander";
import { describe, expect, it } from "vitest";
import { collectRepoOptions } from "./options.js";

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
});
