import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { extractDomainFromId, generateId } from "./utils.js";

beforeAll(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2025-10-30T08:00:00Z"));
});

afterAll(() => {
  vi.useRealTimers();
});

describe("utils", () => {
  it("generates deterministic IDs using the current date", () => {
    const id = generateId("personal", "hydrate");
    expect(id).toBe("DR--20251030--personal--hydrate");
  });

  it("extracts the domain segment from an ID", () => {
    expect(extractDomainFromId("DR--20251030--personal--hydrate")).toBe(
      "personal",
    );
    expect(extractDomainFromId("invalid")).toBeNull();
  });
});
