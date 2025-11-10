import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import matter from "gray-matter";
import { describe, expect, it, vi } from "vitest";
import * as configModule from "../config.js";
import type { RepoContext } from "../config.js";
import {
  acceptDecision,
  correctionDecision,
  createDecision,
  draftDecision,
  proposeDecision,
  listAll,
  rejectDecision,
  deprecateDecision,
  reviseDecision,
  retireDecision,
  supersedeDecision,
  collectDecisions,
  resolveContext,
} from "./service.js";
import * as gitModule from "./git.js";
import { makeContext, setupServiceTestEnv } from "./service.test-helpers.js";

setupServiceTestEnv();

describe("service layer", () => {
  it("skips git operations when the repo opts out of git", async () => {
    const context = makeContext();
    context.gitMode = "disabled";
    const gitClient = {
      stageAndCommit: vi.fn().mockResolvedValue(undefined),
    };

    const creation = createDecision("meta", "git-optional", { context });

    const draft = await draftDecision(creation.record.id, {
      context,
      gitClient,
    });
    expect(draft.record.status).toBe("draft");

    const proposed = await proposeDecision(creation.record.id, {
      context,
      gitClient,
    });
    expect(proposed.record.status).toBe("proposed");

    const accepted = await acceptDecision(creation.record.id, {
      context,
      gitClient,
    });
    expect(accepted.record.status).toBe("accepted");

    expect(gitClient.stageAndCommit).not.toHaveBeenCalled();
    const stored = matter.read(creation.filePath);
    expect(stored.data.status).toBe("accepted");
    expect(stored.data.changelog).toEqual(
      expect.arrayContaining([
        { date: "2025-10-30", note: "Marked as draft" },
        { date: "2025-10-30", note: "Marked as proposed" },
        { date: "2025-10-30", note: "Marked as accepted" },
      ]),
    );
  });

  it("accepts an existing decision, updates changelog, and commits via git", async () => {
    const context = makeContext();
    const gitClient = {
      stageAndCommit: vi.fn().mockResolvedValue(undefined),
    };
    const creation = createDecision("personal", "hydrate", { context });

    const accepted = await acceptDecision(creation.record.id, {
      context,
      gitClient,
    });
    expect(accepted.record.status).toBe("accepted");
    expect(accepted.record.lastEdited).toBe("2025-10-30");
    expect(accepted.record.dateAccepted).toBe("2025-10-30");
    expect(accepted.filePath).toBe(creation.filePath);
    expect(accepted.record.changelog).toEqual(
      expect.arrayContaining([
        {
          date: "2025-10-30",
          note: "Marked as draft",
        },
        {
          date: "2025-10-30",
          note: "Marked as proposed",
        },
        {
          date: "2025-10-30",
          note: "Marked as accepted",
        },
      ]),
    );

    const storedFrontmatter = matter.read(creation.filePath);
    expect(storedFrontmatter.data.status).toBe("accepted");
    expect(storedFrontmatter.data.dateAccepted).toBe("2025-10-30");

    expect(gitClient.stageAndCommit).toHaveBeenNthCalledWith(
      1,
      [creation.filePath],
      {
        cwd: context.root,
        message: `drctl: draft ${creation.record.id}`,
      },
    );
    expect(gitClient.stageAndCommit).toHaveBeenNthCalledWith(
      2,
      [creation.filePath],
      {
        cwd: context.root,
        message: `drctl: propose ${creation.record.id}`,
      },
    );
    expect(gitClient.stageAndCommit).toHaveBeenNthCalledWith(
      3,
      [creation.filePath],
      {
        cwd: context.root,
        message: `drctl: accept ${creation.record.id}`,
      },
    );

    const acceptedRecords = listAll("accepted", { context });
    expect(acceptedRecords).toHaveLength(1);
    const acceptedRecord = acceptedRecords[0];
    expect(acceptedRecord).toBeDefined();
    expect(acceptedRecord?.status).toBe("accepted");
  });

  it("accepts a proposed decision without replaying earlier transitions", async () => {
    const context = makeContext();
    const gitClient = {
      stageAndCommit: vi.fn().mockResolvedValue(undefined),
    };
    const creation = createDecision("personal", "hydrate-2", { context });
    await proposeDecision(creation.record.id, { context, gitClient });
    gitClient.stageAndCommit.mockClear();

    const accepted = await acceptDecision(creation.record.id, {
      context,
      gitClient,
    });

    expect(accepted.record.status).toBe("accepted");
    expect(gitClient.stageAndCommit).toHaveBeenCalledTimes(1);
    expect(gitClient.stageAndCommit).toHaveBeenCalledWith([creation.filePath], {
      cwd: context.root,
      message: `drctl: accept ${creation.record.id}`,
    });
  });

  it("fails when attempting to accept an incompatible status", async () => {
    const context = makeContext();
    const gitClient = {
      stageAndCommit: vi.fn().mockResolvedValue(undefined),
    };
    const creation = createDecision("personal", "reject-then-accept", {
      context,
    });
    await rejectDecision(creation.record.id, { context, gitClient });

    await expect(
      acceptDecision(creation.record.id, { context, gitClient }),
    ).rejects.toThrow(/Cannot accept decision/);
  });

  it("returns early when the decision is already accepted", async () => {
    const context = makeContext();
    const gitClient = {
      stageAndCommit: vi.fn().mockResolvedValue(undefined),
    };
    const creation = createDecision("personal", "hydrate-repeat", {
      context,
    });

    await acceptDecision(creation.record.id, { context, gitClient });
    gitClient.stageAndCommit.mockClear();

    const result = await acceptDecision(creation.record.id, {
      context,
      gitClient,
    });

    expect(result.record.status).toBe("accepted");
    expect(gitClient.stageAndCommit).not.toHaveBeenCalled();
  });

  it("uses the full template when creating a record", () => {
    const context = makeContext();
    const result = createDecision("personal", "template-check", {
      context,
    });

    const content = fs.readFileSync(result.filePath, "utf8");
    expect(content).toContain("## 🧭 Context");
    expect(content).toContain("## 🧾 Changelog");
    expect(content).toContain("| Option | Description | Outcome  | Rationale");
    expect(content).not.toContain("{ { id } }");
  });

  it("marks a decision as draft and commits via git", async () => {
    const context = makeContext();
    const gitClient = {
      stageAndCommit: vi.fn().mockResolvedValue(undefined),
    };
    const creation = createDecision("personal", "hydrate", { context });

    const result = await draftDecision(creation.record.id, {
      context,
      gitClient,
    });

    expect(result.record.status).toBe("draft");
    expect(result.record.lastEdited).toBe("2025-10-30");
    expect(result.record.changelog?.at(-1)).toEqual({
      date: "2025-10-30",
      note: "Marked as draft",
    });

    expect(gitClient.stageAndCommit).toHaveBeenCalledWith([result.filePath], {
      cwd: context.root,
      message: `drctl: draft ${creation.record.id}`,
    });
  });

  it("marks a decision as proposed", async () => {
    const context = makeContext();
    const gitClient = {
      stageAndCommit: vi.fn().mockResolvedValue(undefined),
    };
    const creation = createDecision("personal", "hydrate", { context });

    const result = await proposeDecision(creation.record.id, {
      context,
      gitClient,
    });

    expect(result.record.status).toBe("proposed");
    expect(result.record.lastEdited).toBe("2025-10-30");
    expect(result.record.changelog).toEqual(
      expect.arrayContaining([
        { date: "2025-10-30", note: "Marked as draft" },
        { date: "2025-10-30", note: "Marked as proposed" },
      ]),
    );

    expect(gitClient.stageAndCommit).toHaveBeenCalledWith([result.filePath], {
      cwd: context.root,
      message: `drctl: propose ${creation.record.id}`,
    });
  });

  it("emits a warning when proposing with placeholder content", async () => {
    const context = makeContext();
    const gitClient = {
      stageAndCommit: vi.fn().mockResolvedValue(undefined),
    };
    const creation = createDecision("meta", "placeholder-warning", { context });
    const warnings: string[] = [];

    await proposeDecision(creation.record.id, {
      context,
      gitClient,
      onTemplateWarning: (message) => {
        warnings.push(message);
      },
    });

    expect(warnings).not.toHaveLength(0);
    expect(warnings[0]).toMatch(/Template hygiene/i);
  });

  it("does not warn when placeholder content is removed before proposing", async () => {
    const context = makeContext();
    const gitClient = {
      stageAndCommit: vi.fn().mockResolvedValue(undefined),
    };
    const creation = createDecision("meta", "placeholder-cleared", {
      context,
    });
    const parsed = matter.read(creation.filePath);
    const sanitized = parsed.content
      .replaceAll(/^_.*_$/gm, "Completed section.")
      .replaceAll(
        /\| B\s+\|\s+\|\s+\|\s+\|/g,
        "| B | Option B | Rejected | Provided rationale |",
      );
    const rewritten = matter.stringify(sanitized, parsed.data);
    fs.writeFileSync(creation.filePath, rewritten, "utf8");
    const warnings: string[] = [];

    await proposeDecision(creation.record.id, {
      context,
      gitClient,
      onTemplateWarning: (message) => {
        warnings.push(message);
      },
    });

    expect(warnings).toHaveLength(0);
  });

  it("warns when required headings are missing for default template records", async () => {
    const context = makeContext();
    const gitClient = {
      stageAndCommit: vi.fn().mockResolvedValue(undefined),
    };
    const creation = createDecision("meta", "missing-heading", { context });
    const parsed = matter.read(creation.filePath);
    const withoutHeading = parsed.content.replace("## 🧾 Changelog\n\n", "");
    fs.writeFileSync(
      creation.filePath,
      matter.stringify(withoutHeading, parsed.data),
    );
    const warnings: string[] = [];

    await proposeDecision(creation.record.id, {
      context,
      gitClient,
      onTemplateWarning: (message) => warnings.push(message),
    });

    expect(
      warnings.some((message) =>
        message.includes("Missing default template heading"),
      ),
    ).toBe(true);
  });

  it("does not warn about headings when a custom template is used", async () => {
    const context = makeContext();
    const externalTemplate = path.join(os.tmpdir(), "custom-minimal.md");
    fs.writeFileSync(externalTemplate, "# Custom Template\nBody", "utf8");

    const creation = createDecision("meta", "custom-template", {
      context,
      templatePath: externalTemplate,
    });
    const warnings: string[] = [];

    await proposeDecision(creation.record.id, {
      context,
      gitClient: {
        stageAndCommit: vi.fn().mockResolvedValue(undefined),
      },
      onTemplateWarning: (message) => warnings.push(message),
    });

    expect(warnings).toHaveLength(0);
  });

  it("detects placeholder rows in the options table", async () => {
    const context = makeContext();
    const gitClient = {
      stageAndCommit: vi.fn().mockResolvedValue(undefined),
    };
    const creation = createDecision("meta", "placeholder-table", { context });
    const parsed = matter.read(creation.filePath);
    const withoutGuidance = parsed.content.replaceAll(/^_.*_$/gm, "");
    const contentWithPlaceholder = `${withoutGuidance}\n| B |     |     |     |`;
    fs.writeFileSync(
      creation.filePath,
      matter.stringify(contentWithPlaceholder, parsed.data),
    );
    const warnings: string[] = [];

    await proposeDecision(creation.record.id, {
      context,
      gitClient,
      onTemplateWarning: (message) => warnings.push(message),
    });

    expect(warnings).toContain(
      "Template hygiene: The options table still contains placeholder rows.",
    );
  });

  it("continues to the next candidate when stat inspection fails", () => {
    const context = makeContext();
    const envTemplatePath = path.join(
      context.root,
      "templates",
      "env-template.md",
    );
    fs.mkdirSync(path.dirname(envTemplatePath), { recursive: true });
    fs.writeFileSync(envTemplatePath, "# Env Template", "utf8");

    const statSpy = vi
      .spyOn(fs, "statSync")
      .mockImplementationOnce(() => {
        throw new Error("stat failure");
      })
      .mockImplementation(fs.statSync as (path: fs.PathLike) => fs.Stats);

    const result = createDecision("meta", "stat-fallback", {
      context,
      templatePath: path.join(context.root, "missing-template.md"),
      envTemplate: envTemplatePath,
    });

    const parsed = matter.read(result.filePath);
    expect(parsed.data.templateUsed).toBeUndefined();
    statSpy.mockRestore();
  });

  it("returns early when the decision is already proposed", async () => {
    const context = makeContext();
    const gitClient = {
      stageAndCommit: vi.fn().mockResolvedValue(undefined),
    };
    const creation = createDecision("personal", "hydrate-proposed", {
      context,
    });

    await proposeDecision(creation.record.id, { context, gitClient });
    gitClient.stageAndCommit.mockClear();

    const result = await proposeDecision(creation.record.id, {
      context,
      gitClient,
    });

    expect(result.record.status).toBe("proposed");
    expect(gitClient.stageAndCommit).not.toHaveBeenCalled();
  });

  it("backfills the draft state before proposing when the note is missing", async () => {
    const context = makeContext();
    const gitClient = {
      stageAndCommit: vi.fn().mockResolvedValue(undefined),
    };
    const creation = createDecision("personal", "hydrate-missing", { context });

    const parsed = matter.read(creation.filePath);
    parsed.data.changelog = (parsed.data.changelog ?? []).filter(
      (entry: { note?: string }) => entry.note !== "Marked as draft",
    );
    fs.writeFileSync(
      creation.filePath,
      matter.stringify(parsed.content, parsed.data),
    );

    const result = await proposeDecision(creation.record.id, {
      context,
      gitClient,
    });

    expect(result.record.status).toBe("proposed");
    expect(gitClient.stageAndCommit).toHaveBeenNthCalledWith(
      1,
      [creation.filePath],
      {
        cwd: context.root,
        message: `drctl: draft ${creation.record.id}`,
      },
    );
    expect(gitClient.stageAndCommit).toHaveBeenNthCalledWith(
      2,
      [creation.filePath],
      {
        cwd: context.root,
        message: `drctl: propose ${creation.record.id}`,
      },
    );
  });
  it("does not replay draft when it already exists", async () => {
    const context = makeContext();
    const gitClient = {
      stageAndCommit: vi.fn().mockResolvedValue(undefined),
    };
    const creation = createDecision("personal", "hydrate-draft", { context });
    await draftDecision(creation.record.id, { context, gitClient });
    gitClient.stageAndCommit.mockClear();

    const result = await proposeDecision(creation.record.id, {
      context,
      gitClient,
    });

    expect(result.record.status).toBe("proposed");
    expect(gitClient.stageAndCommit).toHaveBeenCalledTimes(1);
    expect(gitClient.stageAndCommit).toHaveBeenCalledWith([result.filePath], {
      cwd: context.root,
      message: `drctl: propose ${creation.record.id}`,
    });
  });

  it("fails to propose when status is incompatible", async () => {
    const context = makeContext();
    const gitClient = {
      stageAndCommit: vi.fn().mockResolvedValue(undefined),
    };
    const creation = createDecision("personal", "reject-before-propose", {
      context,
    });
    await rejectDecision(creation.record.id, { context, gitClient });

    await expect(
      proposeDecision(creation.record.id, { context, gitClient }),
    ).rejects.toThrow(/Cannot propose/);
  });

  it("fails when unrelated files are staged", async () => {
    const context = makeContext();
    const gitClient = {
      stageAndCommit: vi.fn().mockResolvedValue(undefined),
    };
    const creation = createDecision("meta", "staging-warning", { context });
    const stagedSpy = vi
      .spyOn(gitModule, "getStagedFiles")
      .mockResolvedValue(["app.js", "README.md"]);

    await expect(
      draftDecision(creation.record.id, { context, gitClient }),
    ).rejects.toThrow(/Staging area contains unrelated changes/);
    expect(gitClient.stageAndCommit).not.toHaveBeenCalled();
    stagedSpy.mockRestore();
  });

  it("fails to accept when unrelated files are staged", async () => {
    const context = makeContext();
    const gitClient = {
      stageAndCommit: vi.fn().mockResolvedValue(undefined),
    };
    const creation = createDecision("meta", "accept-staging-warning", {
      context,
    });
    const stagedSpy = vi
      .spyOn(gitModule, "getStagedFiles")
      .mockResolvedValue(["docs.md"]);

    await expect(
      acceptDecision(creation.record.id, { context, gitClient }),
    ).rejects.toThrow(/Staging area contains unrelated changes/);
    expect(gitClient.stageAndCommit).not.toHaveBeenCalled();
    stagedSpy.mockRestore();
  });

  it("rejects a decision and commits via git", async () => {
    const context = makeContext();
    const gitClient = {
      stageAndCommit: vi.fn().mockResolvedValue(undefined),
    };
    const creation = createDecision("personal", "hydrate", { context });

    const result = await rejectDecision(creation.record.id, {
      context,
      gitClient,
    });

    expect(result.record.status).toBe("rejected");
    expect(result.record.lastEdited).toBe("2025-10-30");
    expect(result.record.changelog?.at(-1)).toEqual({
      date: "2025-10-30",
      note: "Marked as rejected",
    });

    const stored = matter.read(result.filePath);
    expect(stored.data.status).toBe("rejected");
    expect(stored.content).toContain("## 🧭 Context");

    expect(gitClient.stageAndCommit).toHaveBeenCalledWith([result.filePath], {
      cwd: context.root,
      message: `drctl: reject ${creation.record.id}`,
    });
  });

  it("applies a correction with a patch version bump", async () => {
    const context = makeContext();
    const gitClient = {
      stageAndCommit: vi.fn().mockResolvedValue(undefined),
    };
    const creation = createDecision("meta", "typo-fix", { context });

    const corrected = await correctionDecision(creation.record.id, {
      context,
      gitClient,
      note: "Fixed typo in principles",
    });

    expect(corrected.record.version).toBe("1.0.1");
    expect(corrected.record.lastEdited).toBe("2025-10-30");
    expect(corrected.record.changeType).toBe("correction");
    expect(corrected.record.changelog?.at(-1)).toEqual({
      date: "2025-10-30",
      note: "Fixed typo in principles",
    });

    const frontmatter = matter.read(corrected.filePath);
    expect(frontmatter.data.version).toBe("1.0.1");

    expect(gitClient.stageAndCommit).toHaveBeenCalledWith(
      [corrected.filePath],
      {
        cwd: context.root,
        message: `drctl: correction ${creation.record.id}`,
      },
    );
  });

  it("commits from the git root when the repository root is nested", async () => {
    const gitRoot = fs.mkdtempSync(path.join(os.tmpdir(), "drctl-gitroot-"));
    const nested = path.join(gitRoot, "decisions");
    fs.mkdirSync(nested, { recursive: true });

    const context: RepoContext = {
      root: nested,
      domainMap: {},
      source: "cli",
      name: "nested",
      gitMode: "enabled",
      gitModeSource: "detected",
      gitRoot,
    };

    const gitClient = {
      stageAndCommit: vi.fn().mockResolvedValue(undefined),
    };

    const creation = createDecision("meta", "nested-case", { context });

    const accepted = await acceptDecision(creation.record.id, {
      context,
      gitClient,
    });

    expect(gitClient.stageAndCommit).toHaveBeenCalledWith([accepted.filePath], {
      cwd: gitRoot,
      message: `drctl: accept ${creation.record.id}`,
    });
  });

  it("applies a revision with a minor version bump and metadata update", async () => {
    const context = makeContext();
    const gitClient = {
      stageAndCommit: vi.fn().mockResolvedValue(undefined),
    };
    const creation = createDecision("meta", "confidence-update", {
      context,
      confidence: 0.4,
    });

    const revised = await reviseDecision(creation.record.id, {
      context,
      gitClient,
      note: "Raised confidence after adoption",
      confidence: 0.7,
    });

    expect(revised.record.version).toBe("1.1.0");
    expect(revised.record.lastEdited).toBe("2025-10-30");
    expect(revised.record.changeType).toBe("revision");
    expect(revised.record.confidence).toBe(0.7);
    expect(revised.record.changelog?.at(-1)).toEqual({
      date: "2025-10-30",
      note: "Raised confidence after adoption",
    });

    const frontmatter = matter.read(revised.filePath);
    expect(frontmatter.data.version).toBe("1.1.0");
    expect(frontmatter.data.confidence).toBe(0.7);

    expect(gitClient.stageAndCommit).toHaveBeenCalledWith([revised.filePath], {
      cwd: context.root,
      message: `drctl: revise ${creation.record.id}`,
    });
  });

  it("deprecates a decision and commits via git", async () => {
    const context = makeContext();
    const gitClient = {
      stageAndCommit: vi.fn().mockResolvedValue(undefined),
    };
    const creation = createDecision("meta", "deprecate-test", { context });

    const result = await deprecateDecision(creation.record.id, {
      context,
      gitClient,
    });

    expect(result.record.status).toBe("deprecated");
    expect(result.record.lastEdited).toBe("2025-10-30");
    expect(result.record.changelog?.at(-1)).toEqual({
      date: "2025-10-30",
      note: "Marked as deprecated",
    });

    const stored = matter.read(result.filePath);
    expect(stored.data.status).toBe("deprecated");
    expect(stored.content).toContain("## 🧭 Context");

    expect(gitClient.stageAndCommit).toHaveBeenCalledWith([result.filePath], {
      cwd: context.root,
      message: `drctl: deprecate ${creation.record.id}`,
    });
  });

  it("retires a decision and commits via git", async () => {
    const context = makeContext();
    const gitClient = {
      stageAndCommit: vi.fn().mockResolvedValue(undefined),
    };
    const creation = createDecision("meta", "retire-test", { context });
    const filePath = creation.filePath;
    fs.writeFileSync(
      filePath,
      matter.stringify("# Body\n\nPersist me", {
        ...creation.record,
      }),
    );

    const result = await retireDecision(creation.record.id, {
      context,
      gitClient,
    });

    expect(result.record.status).toBe("retired");
    expect(result.record.changeType).toBe("retirement");
    expect(result.record.lastEdited).toBe("2025-10-30");
    expect(result.record.changelog?.at(-1)).toEqual({
      date: "2025-10-30",
      note: "Marked as retired",
    });

    const stored = matter.read(result.filePath);
    expect(stored.data.status).toBe("retired");
    expect(stored.data.changeType).toBe("retirement");
    expect(stored.content).toContain("Persist me");

    expect(gitClient.stageAndCommit).toHaveBeenCalledWith([result.filePath], {
      cwd: context.root,
      message: `drctl: retire ${creation.record.id}`,
    });
  });

  it("supersedes a decision, linking the replacement, and commits via git", async () => {
    const context = makeContext();
    const gitClient = {
      stageAndCommit: vi.fn().mockResolvedValue(undefined),
    };
    const oldDecision = createDecision("meta", "old-decision", { context });
    const newDecision = createDecision("meta", "new-direction", { context });

    const result = await supersedeDecision(
      oldDecision.record.id,
      newDecision.record.id,
      {
        context,
        gitClient,
      },
    );

    expect(result.record.status).toBe("superseded");
    expect(result.record.lastEdited).toBe("2025-10-30");
    expect(result.record.supersededBy).toBe(newDecision.record.id);
    expect(result.record.changelog?.at(-1)).toEqual({
      date: "2025-10-30",
      note: `Superseded by ${newDecision.record.id}`,
    });

    const storedOld = matter.read(result.filePath);
    expect(storedOld.data.status).toBe("superseded");
    expect(storedOld.data.supersededBy).toBe(newDecision.record.id);
    expect(storedOld.content).toContain("## 🧭 Context");

    expect(result.newRecord.supersedes).toBe(oldDecision.record.id);
    expect(result.newRecord.changelog?.at(-1)).toEqual({
      date: "2025-10-30",
      note: `Supersedes ${oldDecision.record.id}`,
    });

    const storedNew = matter.read(result.newFilePath);
    expect(storedNew.data.supersedes).toBe(oldDecision.record.id);

    expect(gitClient.stageAndCommit).toHaveBeenCalledWith(
      [result.filePath, result.newFilePath],
      {
        cwd: context.root,
        message: `drctl: supersede ${oldDecision.record.id} -> ${newDecision.record.id}`,
      },
    );
  });

  it("preserves markdown body when lifecycle updates occur", async () => {
    const context = makeContext();
    const gitClient = {
      stageAndCommit: vi.fn().mockResolvedValue(undefined),
    };
    const creation = createDecision("meta", "keep-body", { context });
    const before = matter.read(creation.filePath);
    expect(before.content).toContain("## 🧭 Context");

    await draftDecision(creation.record.id, { context, gitClient });

    const after = matter.read(creation.filePath);
    expect(after.content).toContain("## 🧭 Context");
    expect(after.data.status).toBe("draft");
  });

  it("suggests repo bootstrap when git repo is missing", async () => {
    const context = makeContext();
    const gitClient = {
      stageAndCommit: vi
        .fn()
        .mockRejectedValue(
          new Error(
            "Git command failed: git add test\nfatal: not a git repository (or any of the parent directories): .git",
          ),
        ),
    };
    const creation = createDecision("personal", "hydrate", { context });

    await expect(
      draftDecision(creation.record.id, { context, gitClient }),
    ).rejects.toThrow(/drctl repo bootstrap test/);
  });

  it("rethrows unexpected git errors from lifecycle commands", async () => {
    const context = makeContext();
    const gitClient = {
      stageAndCommit: vi
        .fn()
        .mockRejectedValue(new Error("Git command failed: git add foo\nboom")),
    };
    const creation = createDecision("meta", "draft-error", { context });

    await expect(
      draftDecision(creation.record.id, { context, gitClient }),
    ).rejects.toThrow(/boom/);
  });

  it("resolves context using provided configPath", () => {
    const mockRoot = path.join(os.tmpdir(), "drctl-service-mock-root");
    const mockConfigPath = path.join(os.tmpdir(), "drctl-config-path");
    const spy = vi.spyOn(configModule, "resolveRepoContext").mockReturnValue({
      root: mockRoot,
      domainMap: {},
      source: "cli",
    } as RepoContext);

    const context = resolveContext({ configPath: mockConfigPath });

    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({ configPath: mockConfigPath }),
    );
    expect(context.root).toBe(mockRoot);
    spy.mockRestore();
  });

  it("collects decisions with source paths", () => {
    const context = makeContext();
    const first = createDecision("meta", "first", { context });
    const second = createDecision("meta", "second", { context });

    const collected = collectDecisions(context);
    expect(collected.map((entry) => entry.record.id)).toEqual(
      expect.arrayContaining([first.record.id, second.record.id]),
    );
    for (const entry of collected) {
      expect(fs.existsSync(entry.filePath)).toBe(true);
      expect(entry.record).toHaveProperty("status");
    }
  });

  it("ignores template and index markdown files when collecting decisions", () => {
    const context = makeContext();
    const created = createDecision("meta", "record", { context });
    const indexPath = path.join(context.root, "index.md");
    fs.writeFileSync(indexPath, "# Index\n");
    const templatePath = path.join(context.root, "decision-record-template.md");
    fs.writeFileSync(
      templatePath,
      [
        "---",
        'id: "{{ id }}"',
        'status: "{{ status }}"',
        "---",
        "",
        "# Template",
      ].join("\n"),
      "utf8",
    );

    const collected = collectDecisions(context);

    expect(collected).toEqual([
      expect.objectContaining({
        record: expect.objectContaining(created.record),
      }),
    ]);
  });
});
