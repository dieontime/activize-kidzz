import { useProgressStore } from "./progressStore";

describe("useProgressStore", () => {
  afterEach(() => useProgressStore.getState().reset());

  it("starts with the default zeroed progress", () => {
    const state = useProgressStore.getState();
    expect(state.world).toBe(0);
    expect(state.node).toBe(1);
    expect(state.streakCount).toBe(0);
    expect(state.longestStreak).toBe(0);
    expect(state.lastCompletedDate).toBeNull();
    expect(state.isLoaded).toBe(false);
    expect(state.earnedBadgeIds).toEqual([]);
    expect(state.newlyEarnedBadgeIds).toEqual([]);
  });

  it("setProgress replaces the record and marks isLoaded true", () => {
    useProgressStore.getState().setProgress({
      world: 0, node: 3, streakCount: 2, longestStreak: 5, lastCompletedDate: "2026-07-17", totalMissionsCompleted: 4,
    });
    const state = useProgressStore.getState();
    expect(state.node).toBe(3);
    expect(state.streakCount).toBe(2);
    expect(state.longestStreak).toBe(5);
    expect(state.lastCompletedDate).toBe("2026-07-17");
    expect(state.isLoaded).toBe(true);
  });

  it("reset returns to the default zeroed state", () => {
    useProgressStore.getState().setProgress({
      world: 0, node: 3, streakCount: 2, longestStreak: 5, lastCompletedDate: "2026-07-17", totalMissionsCompleted: 4,
    });
    useProgressStore.getState().awardBadges(["badge-streak-3"]);
    useProgressStore.getState().reset();
    const state = useProgressStore.getState();
    expect(state.node).toBe(1);
    expect(state.isLoaded).toBe(false);
    expect(state.earnedBadgeIds).toEqual([]);
    expect(state.newlyEarnedBadgeIds).toEqual([]);
  });

  it("setEarnedBadgeIds replaces the persisted badge id list", () => {
    useProgressStore.getState().setEarnedBadgeIds(["badge-streak-3", "badge-streak-7"]);
    expect(useProgressStore.getState().earnedBadgeIds).toEqual(["badge-streak-3", "badge-streak-7"]);
  });

  it("awardBadges appends to earnedBadgeIds and replaces newlyEarnedBadgeIds", () => {
    useProgressStore.getState().setEarnedBadgeIds(["badge-streak-3"]);
    useProgressStore.getState().awardBadges(["badge-streak-7"]);
    const state = useProgressStore.getState();
    expect(state.earnedBadgeIds).toEqual(["badge-streak-3", "badge-streak-7"]);
    expect(state.newlyEarnedBadgeIds).toEqual(["badge-streak-7"]);
  });

  it("awardBadges with an empty list clears newlyEarnedBadgeIds without changing earnedBadgeIds", () => {
    useProgressStore.getState().setEarnedBadgeIds(["badge-streak-3"]);
    useProgressStore.getState().awardBadges(["badge-streak-7"]);
    useProgressStore.getState().awardBadges([]);
    const state = useProgressStore.getState();
    expect(state.earnedBadgeIds).toEqual(["badge-streak-3", "badge-streak-7"]);
    expect(state.newlyEarnedBadgeIds).toEqual([]);
  });
});
