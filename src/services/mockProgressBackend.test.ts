import { mockProgressBackend } from "./mockProgressBackend";

describe("mockProgressBackend", () => {
  beforeEach(() => mockProgressBackend.reset());

  it("returns the default record when no progress exists for a profile", async () => {
    const record = await mockProgressBackend.loadProgress("profile-1");
    expect(record).toEqual({ world: 0, node: 1, streakCount: 0, longestStreak: 0, lastCompletedDate: null });
  });

  it("saveProgress persists and loadProgress returns the saved record", async () => {
    await mockProgressBackend.saveProgress("profile-1", {
      world: 0, node: 2, streakCount: 1, longestStreak: 1, lastCompletedDate: "2026-07-17",
    });
    const record = await mockProgressBackend.loadProgress("profile-1");
    expect(record).toEqual({ world: 0, node: 2, streakCount: 1, longestStreak: 1, lastCompletedDate: "2026-07-17" });
  });

  it("keeps progress isolated per profile", async () => {
    await mockProgressBackend.saveProgress("profile-1", {
      world: 0, node: 2, streakCount: 1, longestStreak: 1, lastCompletedDate: "2026-07-17",
    });
    const other = await mockProgressBackend.loadProgress("profile-2");
    expect(other.node).toBe(1);
  });

  it("insertCompletion does not throw and does not affect loadProgress", async () => {
    await expect(
      mockProgressBackend.insertCompletion("profile-1", "mission-001", 4),
    ).resolves.toBeUndefined();
    const record = await mockProgressBackend.loadProgress("profile-1");
    expect(record.node).toBe(1);
  });
});
