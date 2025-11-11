import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { setupCliTestEnv } from "./test-helpers.js";

describe("correction command aliases", () => {
  const env = setupCliTestEnv();

  it("routes `drctl correct` to the correction handler", async () => {
    const { context, tempDir } = env.createContext("drctl-correct-alias-");

    const correctionSpy = vi.fn().mockResolvedValue({
      record: {
        id: "DR--20250101--meta--alias",
        version: "1.0.1",
        status: "draft",
        changeType: "correction",
        domain: "meta",
        slug: "alias",
      },
      filePath: path.join(tempDir, "meta", "DR--20250101--meta--alias.md"),
      context,
    });

    vi.doMock("../core/service.js", () => ({
      acceptDecision: vi.fn(),
      correctionDecision: correctionSpy,
      createDecision: vi.fn(),
      draftDecision: vi.fn(),
      proposeDecision: vi.fn(),
      listAll: vi.fn().mockReturnValue([]),
      rejectDecision: vi.fn(),
      deprecateDecision: vi.fn(),
      retireDecision: vi.fn(),
      supersedeDecision: vi.fn(),
      reviseDecision: vi.fn(),
      resolveContext: vi.fn().mockReturnValue(context),
    }));

    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    env.registerSpy(logSpy);
    env.mockStderr();
    process.argv = [
      "node",
      "drctl",
      "correct",
      "DR--20250101--meta--alias",
      "--note",
      "Alias test",
    ];

    await import("./index.js");

    expect(correctionSpy).toHaveBeenCalledTimes(1);
    const [idArg, optionsArg] = correctionSpy.mock.calls[0] ?? [];
    expect(idArg).toBe("DR--20250101--meta--alias");
    expect(optionsArg?.note).toBe("Alias test");
    expect(optionsArg?.context).toEqual(context);

    // env reset restores spies
  });
});
