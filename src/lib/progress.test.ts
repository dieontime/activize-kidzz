import { useAuthStore } from "@/store/authStore";
import { useProgressStore } from "@/store/progressStore";
import { mockProgressBackend } from "@/services/mockProgressBackend";
import { progressBackend } from "@/services/progressBackend";
import { loadProgress, recordMissionCompletion } from "./progress";

const PROFILE = { id: "profile-1", username: "SpeedyOtter", avatar: "avatar_cat", age_band: "6-8" as const };

describe("lib/progress", () => {
  beforeEach(() => {
    mockProgressBackend.reset();
    useProgressStore.getState().reset();
    useAuthStore.setState({ activeProfile: PROFILE });
  });

  afterEach(() => {
    vi.useRealTimers();
    useAuthStore.getState().logout();
  });

  describe("loadProgress", () => {
    it("populates the progress store from the backend's default record for a new profile", async () => {
      await loadProgress(PROFILE.id);
      const state = useProgressStore.getState();
      expect(state.node).toBe(1);
      expect(state.isLoaded).toBe(true);
    });

    it("populates earnedBadgeIds from the backend", async () => {
      await mockProgressBackend.insertEarnedBadge(PROFILE.id, "badge-streak-3");
      await loadProgress(PROFILE.id);
      expect(useProgressStore.getState().earnedBadgeIds).toEqual(["badge-streak-3"]);
    });
  });

  describe("recordMissionCompletion", () => {
    it("does nothing if no profile is active", async () => {
      useAuthStore.setState({ activeProfile: null });
      await recordMissionCompletion("mission-001", 1, 4);
      expect(useProgressStore.getState().node).toBe(1);
    });

    it("ignores a replay of a mission that isn't the current node", async () => {
      await loadProgress(PROFILE.id);
      await recordMissionCompletion("mission-001", 1, 4); // node 1 -> 2
      expect(useProgressStore.getState().node).toBe(2);

      await recordMissionCompletion("mission-001", 1, 4); // replaying node 1 again
      expect(useProgressStore.getState().node).toBe(2); // unchanged
    });

    it("starts a 1-day streak on the first-ever completion", async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-07-17T12:00:00.000Z"));
      await loadProgress(PROFILE.id);
      await recordMissionCompletion("mission-001", 1, 4);
      const state = useProgressStore.getState();
      expect(state.streakCount).toBe(1);
      expect(state.longestStreak).toBe(1);
      expect(state.lastCompletedDate).toBe("2026-07-17");
      expect(state.node).toBe(2);
    });

    it("increments the streak when the previous completion was yesterday", async () => {
      await mockProgressBackend.saveProgress(PROFILE.id, {
        world: 0, node: 2, streakCount: 3, longestStreak: 3, lastCompletedDate: "2026-07-16", totalMissionsCompleted: 5,
      });
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-07-17T12:00:00.000Z"));
      await loadProgress(PROFILE.id);
      await recordMissionCompletion("mission-002", 2, 4);
      const state = useProgressStore.getState();
      expect(state.streakCount).toBe(4);
      expect(state.longestStreak).toBe(4);
    });

    it("resets the streak to 1 after a gap longer than a day", async () => {
      await mockProgressBackend.saveProgress(PROFILE.id, {
        world: 0, node: 2, streakCount: 5, longestStreak: 5, lastCompletedDate: "2026-07-10", totalMissionsCompleted: 8,
      });
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-07-17T12:00:00.000Z"));
      await loadProgress(PROFILE.id);
      await recordMissionCompletion("mission-002", 2, 4);
      const state = useProgressStore.getState();
      expect(state.streakCount).toBe(1);
      expect(state.longestStreak).toBe(5); // longest streak is never reduced
    });

    it("persists the new record to the backend so a reload sees it", async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-07-17T12:00:00.000Z"));
      await loadProgress(PROFILE.id);
      await recordMissionCompletion("mission-001", 1, 4);

      useProgressStore.getState().reset();
      await loadProgress(PROFILE.id);
      expect(useProgressStore.getState().node).toBe(2);
    });

    it("swallows a backend error and leaves the store unchanged (no failure, no losing)", async () => {
      await loadProgress(PROFILE.id);
      const before = useProgressStore.getState();

      const saveSpy = vi.spyOn(progressBackend, "saveProgress").mockRejectedValueOnce(new Error("network down"));

      await expect(recordMissionCompletion("mission-001", 1, 4)).resolves.toBeUndefined();

      const after = useProgressStore.getState();
      expect(after.node).toBe(before.node);
      expect(after.streakCount).toBe(before.streakCount);
      expect(after.lastCompletedDate).toBe(before.lastCompletedDate);

      saveSpy.mockRestore();
    });

    it("increments totalMissionsCompleted on each completion", async () => {
      await loadProgress(PROFILE.id);
      await recordMissionCompletion("mission-001", 1, 4);
      expect(useProgressStore.getState().totalMissionsCompleted).toBe(1);
    });
  });
});
