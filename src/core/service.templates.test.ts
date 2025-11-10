import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import matter from "gray-matter";
import { describe, expect, it, vi } from "vitest";
import { createDecision, listAll } from "./service.js";
import {
  makeContext,
  setupServiceTestEnv,
  toPosix,
} from "./service.test-helpers.js";

setupServiceTestEnv();

describe("service templates and creation", () => {
  it("creates a decision record and persists markdown", () => {
    const context = makeContext();
    const result = createDecision("personal", "hydrate", {
      context,
      confidence: 0.6,
    });

    expect(result.record.id).toBe("DR--20251030--personal--hydrate");
    expect(result.record.status).toBe("draft");
    expect(result.record.confidence).toBe(0.6);

    const expectedPath = path.join(
      context.root,
      "personal",
      `${result.record.id}.md`,
    );
    expect(fs.existsSync(expectedPath)).toBe(true);
    expect(result.filePath).toBe(expectedPath);

    const stored = listAll(undefined, { context });
    expect(stored).toHaveLength(1);
  });

  it("uses a configured template when creating a decision", () => {
    const context = makeContext();
    context.defaultTemplate = "templates/meta.md";
    const templatePath = path.join(context.root, "templates", "meta.md");
    fs.mkdirSync(path.dirname(templatePath), { recursive: true });
    fs.writeFileSync(
      templatePath,
      [
        "# Custom Template Heading",
        "",
        "## Section",
        "",
        "Fill me in",
        "",
      ].join("\n"),
      "utf8",
    );

    const result = createDecision("meta", "with-template", { context });
    const stored = fs.readFileSync(result.filePath, "utf8");
    expect(stored).toContain("Custom Template Heading");
  });

  it("prefers an explicit template path over defaults", () => {
    const context = makeContext();
    context.defaultTemplate = "templates/default.md";
    const defaultTemplatePath = path.join(
      context.root,
      "templates",
      "default.md",
    );
    fs.mkdirSync(path.dirname(defaultTemplatePath), { recursive: true });
    fs.writeFileSync(defaultTemplatePath, "# Default Template\n", "utf8");
    const externalTemplate = path.join(os.tmpdir(), "custom-template.md");
    fs.writeFileSync(
      externalTemplate,
      ["# External Template", "", "Body content", ""].join("\n"),
      "utf8",
    );

    const result = createDecision("meta", "explicit-template", {
      context,
      templatePath: externalTemplate,
    });

    const parsed = matter.read(result.filePath);
    const expected = path.join(
      context.root,
      "templates",
      path.basename(externalTemplate),
    );
    expect(fs.existsSync(expected)).toBe(true);
    expect(parsed.data.templateUsed).toBe(
      toPosix(path.relative(context.root, expected)),
    );
  });

  it("generates unique filenames when external templates share a name", () => {
    const context = makeContext();
    fs.writeFileSync(path.join(context.root, "first.md"), "# First\n", "utf8");
    fs.writeFileSync(
      path.join(context.root, "second.md"),
      "# Second\n",
      "utf8",
    );

    const first = createDecision("meta", "first-template", {
      context,
      templatePath: path.join(context.root, "first.md"),
    });
    const second = createDecision("meta", "second-template", {
      context,
      templatePath: path.join(context.root, "second.md"),
    });

    const templateA = matter.read(first.filePath).data.templateUsed;
    const templateB = matter.read(second.filePath).data.templateUsed;
    expect(templateA).not.toBe(templateB);
  });

  it("falls back to the env template when provided", () => {
    const context = makeContext();
    const envTemplate = path.join(os.tmpdir(), "env-template.md");
    fs.writeFileSync(
      envTemplate,
      ["# Env Template", "", "Body text", ""].join("\n"),
      "utf8",
    );

    const result = createDecision("meta", "env-template", {
      context,
      envTemplate,
    });

    const parsed = matter.read(result.filePath);
    const expected = path.join(
      context.root,
      "templates",
      path.basename(envTemplate),
    );
    expect(fs.existsSync(expected)).toBe(true);
    expect(parsed.data.templateUsed).toBe(
      toPosix(path.relative(context.root, expected)),
    );
  });

  it("expands home directories when resolving template candidates", () => {
    const context = makeContext();
    const fakeHome = fs.mkdtempSync(path.join(os.tmpdir(), "drctl-home-"));
    const homeSpy = vi.spyOn(os, "homedir").mockReturnValue(fakeHome);
    const homeTemplate = path.join(fakeHome, "home-template.md");
    fs.writeFileSync(homeTemplate, "# Home Template\n", "utf8");
    process.env.DRCTL_TEMPLATE = "~/home-template.md";

    const result = createDecision("meta", "home-template", {
      context,
    });

    const parsed = matter.read(result.filePath);
    const expected = path.join(context.root, "templates", "home-template.md");
    expect(parsed.data.templateUsed).toBe(
      toPosix(path.relative(context.root, expected)),
    );

    delete process.env.DRCTL_TEMPLATE;
    homeSpy.mockRestore();
  });

  it("skips home-directory candidates that are directories", () => {
    const context = makeContext();
    const fakeHome = fs.mkdtempSync(path.join(os.tmpdir(), "drctl-home-dir-"));
    const homeSpy = vi.spyOn(os, "homedir").mockReturnValue(fakeHome);

    context.defaultTemplate = "templates/fallback.md";
    const fallback = path.join(context.root, context.defaultTemplate);
    fs.mkdirSync(path.dirname(fallback), { recursive: true });
    fs.writeFileSync(fallback, "# Fallback Template", "utf8");

    process.env.DRCTL_TEMPLATE = "~";

    const result = createDecision("meta", "skip-home-dir", {
      context,
    });

    const parsed = matter.read(result.filePath);
    expect(parsed.data.templateUsed).toBe(
      toPosix(path.relative(context.root, fallback)),
    );

    delete process.env.DRCTL_TEMPLATE;
    homeSpy.mockRestore();
  });

  it("reuses existing copied templates when external content is unchanged", () => {
    const context = makeContext();
    const external = path.join(os.tmpdir(), "external-template.md");
    fs.writeFileSync(external, "# External Template\n", "utf8");

    const first = createDecision("meta", "first", {
      context,
      templatePath: external,
    });
    const firstParsed = matter.read(first.filePath);
    const expected = path.join(
      context.root,
      "templates",
      path.basename(external),
    );
    expect(firstParsed.data.templateUsed).toBe(
      toPosix(path.relative(context.root, expected)),
    );

    const second = createDecision("meta", "second", {
      context,
      templatePath: external,
    });

    const parsed = matter.read(second.filePath);
    expect(parsed.data.templateUsed).toBe(
      toPosix(path.relative(context.root, expected)),
    );
    expect(
      fs
        .readdirSync(path.join(context.root, "templates"))
        .filter((name) => name.startsWith(path.basename(external))),
    ).toEqual([path.basename(external)]);
  });

  it("skips template candidates that are directories before selecting the next option", () => {
    const context = makeContext();
    const dirTemplate = path.join(context.root, "templates", "dir-template");
    fs.mkdirSync(dirTemplate, { recursive: true });

    const fileTemplate = path.join(
      context.root,
      "templates",
      "file-template.md",
    );
    fs.writeFileSync(fileTemplate, "# File Template", "utf8");

    const result = createDecision("meta", "dir-skip", {
      context,
      templatePath: dirTemplate,
      envTemplate: fileTemplate,
    });

    const parsed = matter.read(result.filePath);
    expect(parsed.data.templateUsed).toBe(
      toPosix(path.relative(context.root, fileTemplate)),
    );
  });

  it("falls back to the default template when custom files cannot be read", () => {
    const context = makeContext();
    const fileTemplate = path.join(
      context.root,
      "templates",
      "file-template.md",
    );
    fs.mkdirSync(path.dirname(fileTemplate), { recursive: true });
    fs.writeFileSync(fileTemplate, "# File Template", "utf8");

    const realRead = fs.readFileSync;
    const readSpy = vi
      .spyOn(fs, "readFileSync")
      .mockImplementationOnce(() => {
        throw new Error("unreadable");
      })
      .mockImplementation(realRead as typeof fs.readFileSync);

    const result = createDecision("meta", "default-fallback", {
      context,
      templatePath: fileTemplate,
    });

    const parsed = matter.read(result.filePath);
    expect(parsed.data.templateUsed).toBeUndefined();
    readSpy.mockRestore();
  });

  it("does not overwrite an existing decision when creating again", () => {
    const context = makeContext();
    createDecision("meta", "dup", { context });

    expect(() => createDecision("meta", "dup", { context })).toThrow(
      /already exists/i,
    );
  });
});
