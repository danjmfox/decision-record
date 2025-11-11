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
  deprecateDecision,
  reviseDecision,
  retireDecision,
  reviewDecision,
  supersedeDecision,
  collectDecisions,
  resolveContext,
} from "./service.js";
import { makeContext, setupServiceTestEnv } from "./service.test-helpers.js";

setupServiceTestEnv();

describe("service layer", () => {
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

  it("records a review event with defaults and advances review date", async () => {
    const context = makeContext();
    context.reviewPolicy = { defaultType: "scheduled", intervalMonths: 3 };
    const gitClient = {
      stageAndCommit: vi.fn().mockResolvedValue(undefined),
    };
    const creation = createDecision("meta", "pulse-check", { context });

    const reviewed = await reviewDecision(creation.record.id, {
      context,
      gitClient,
      note: "Quarterly check-in",
    });

    expect(reviewed.reviewEntry).toEqual(
      expect.objectContaining({
        type: "scheduled",
        outcome: "keep",
        reason: "Quarterly check-in",
      }),
    );
    expect(reviewed.record.lastReviewedAt).toBe("2025-10-30");
    expect(reviewed.record.reviewHistory).toHaveLength(1);
    expect(reviewed.record.reviewDate).toBe("2026-01-30");

    expect(gitClient.stageAndCommit).toHaveBeenCalledWith([reviewed.filePath], {
      cwd: context.root,
      message: `drctl: review ${creation.record.id}`,
    });
  });

  it("captures explicit review types/outcomes and reviewer overrides", async () => {
    const context = makeContext();
    const gitClient = {
      stageAndCommit: vi.fn().mockResolvedValue(undefined),
    };
    const creation = createDecision("meta", "targeted-review", { context });
    process.env.DRCTL_REVIEWER = "policy-bot";

    try {
      const reviewed = await reviewDecision(creation.record.id, {
        context,
        gitClient,
        reviewType: "adhoc",
        outcome: "revise",
        reviewer: "team-lead",
      });

      expect(reviewed.reviewEntry).toEqual(
        expect.objectContaining({
          type: "adhoc",
          outcome: "revise",
          reviewer: "team-lead",
        }),
      );
      expect(reviewed.record.reviewDate).toBeUndefined();
    } finally {
      delete process.env.DRCTL_REVIEWER;
    }
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
