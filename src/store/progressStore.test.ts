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
  });

  it("setProgress replaces the record and marks isLoaded true", () => {
    useProgressStore.getState().setProgress({
      world: 0, node: 3, streakCount: 2, longestStreak: 5, lastCompletedDate: "2026-07-17",
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
      world: 0, node: 3, streakCount: 2, longestStreak: 5, lastCompletedDate: "2026-07-17",
    });
    useProgressStore.getState().reset();
    const state = useProgressStore.getState();
    expect(state.node).toBe(1);
    expect(state.isLoaded).toBe(false);
  });
});
