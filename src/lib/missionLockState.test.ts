import { describe, it, expect } from "vitest";
import { missionLockState } from "./missionLockState";

describe("missionLockState", () => {
  it("marks a mission before the current node as completed", () => {
    expect(missionLockState(1, 2, "2026-07-17", "2026-07-17")).toBe("completed");
  });

  it("marks the mission at the current node as current when not yet done today", () => {
    expect(missionLockState(2, 2, "2026-07-16", "2026-07-17")).toBe("current");
  });

  it("marks the mission at the current node as current for a fresh profile with no completions", () => {
    expect(missionLockState(1, 1, null, "2026-07-17")).toBe("current");
  });

  it("marks the mission at the current node as locked once it was already completed today", () => {
    expect(missionLockState(2, 2, "2026-07-17", "2026-07-17")).toBe("locked");
  });

  it("marks a mission after the current node as locked", () => {
    expect(missionLockState(3, 2, "2026-07-16", "2026-07-17")).toBe("locked");
  });
});
