import { useAuthStore } from "@/store/authStore";
import { useProgressStore } from "@/store/progressStore";
import { mockProgressBackend } from "@/services/mockProgressBackend";
import { progressBackend } from "@/services/progressBackend";
import { evaluateAndAwardBadges } from "./badges";
import type { Badge } from "@/content/types";

const PROFILE = { id: "profile-1", username: "SpeedyOtter", avatar: "avatar_cat", age_band: "6-8" as const };

const streakBadge: Badge = { id: "badge-streak-3", name: "3-Day Streak", emoji: "🔥", rule: { kind: "streak", value: 3 } };
const worldBadge: Badge = {
  id: "badge-world-complete-jungle",
  name: "Jungle Explorer",
  emoji: "🏆",
  rule: { kind: "world_complete", worldId: "world-jungle" },
};

describe("evaluateAndAwardBadges", () => {
  beforeEach(() => {
    mockProgressBackend.reset();
    useProgressStore.getState().reset();
    useAuthStore.setState({ activeProfile: PROFILE });
  });

  afterEach(() => useAuthStore.getState().logout());

  it("does nothing if no profile is active", async () => {
    useAuthStore.setState({ activeProfile: null });
    const result = await evaluateAndAwardBadges([streakBadge], { worldId: "world-jungle", totalMissionsInWorld: 1 });
    expect(result).toEqual([]);
  });

  it("awards a badge whose rule newly evaluates true", async () => {
    useProgressStore.getState().setProgress({
      world: 0, node: 1, streakCount: 3, longestStreak: 3, lastCompletedDate: "2026-07-17", totalMissionsCompleted: 3,
    });
    const result = await evaluateAndAwardBadges([streakBadge], { worldId: "world-jungle", totalMissionsInWorld: 1 });
    expect(result.map((b) => b.id)).toEqual(["badge-streak-3"]);
    expect(useProgressStore.getState().earnedBadgeIds).toEqual(["badge-streak-3"]);
    expect(useProgressStore.getState().newlyEarnedBadgeIds).toEqual(["badge-streak-3"]);
  });

  it("does not re-award a badge that's already earned", async () => {
    useProgressStore.getState().setProgress({
      world: 0, node: 1, streakCount: 3, longestStreak: 3, lastCompletedDate: "2026-07-17", totalMissionsCompleted: 3,
    });
    useProgressStore.getState().setEarnedBadgeIds(["badge-streak-3"]);
    const result = await evaluateAndAwardBadges([streakBadge], { worldId: "world-jungle", totalMissionsInWorld: 1 });
    expect(result).toEqual([]);
    expect(useProgressStore.getState().newlyEarnedBadgeIds).toEqual([]);
  });

  it("persists the award via progressBackend.insertEarnedBadge", async () => {
    useProgressStore.getState().setProgress({
      world: 0, node: 1, streakCount: 3, longestStreak: 3, lastCompletedDate: "2026-07-17", totalMissionsCompleted: 3,
    });
    await evaluateAndAwardBadges([streakBadge], { worldId: "world-jungle", totalMissionsInWorld: 1 });
    const persisted = await mockProgressBackend.loadEarnedBadges(PROFILE.id);
    expect(persisted).toEqual(["badge-streak-3"]);
  });

  it("evaluates world_complete against the given world context", async () => {
    useProgressStore.getState().setProgress({
      world: 0, node: 2, streakCount: 0, longestStreak: 0, lastCompletedDate: "2026-07-17", totalMissionsCompleted: 1,
    });
    const result = await evaluateAndAwardBadges([worldBadge], { worldId: "world-jungle", totalMissionsInWorld: 1 });
    expect(result.map((b) => b.id)).toEqual(["badge-world-complete-jungle"]);
  });

  it("leaves newlyEarnedBadgeIds empty when nothing qualifies", async () => {
    const result = await evaluateAndAwardBadges([streakBadge, worldBadge], { worldId: "world-jungle", totalMissionsInWorld: 5 });
    expect(result).toEqual([]);
    expect(useProgressStore.getState().newlyEarnedBadgeIds).toEqual([]);
  });

  it("swallows a backend error and returns an empty list (no failure, no losing)", async () => {
    useProgressStore.getState().setProgress({
      world: 0, node: 1, streakCount: 3, longestStreak: 3, lastCompletedDate: "2026-07-17", totalMissionsCompleted: 3,
    });
    const insertSpy = vi.spyOn(progressBackend, "insertEarnedBadge").mockRejectedValueOnce(new Error("network down"));
    const result = await evaluateAndAwardBadges([streakBadge], { worldId: "world-jungle", totalMissionsInWorld: 1 });
    expect(result).toEqual([]);
    expect(useProgressStore.getState().earnedBadgeIds).toEqual([]); // not marked earned -- self-heals next completion
    insertSpy.mockRestore();
  });
});
