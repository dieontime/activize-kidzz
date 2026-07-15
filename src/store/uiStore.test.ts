import { useUiStore } from "./uiStore";

describe("uiStore", () => {
  beforeEach(() => useUiStore.getState().goToMap());

  it("starts on the map", () => {
    expect(useUiStore.getState().screen).toBe("map");
  });

  it("startMission moves to the mission screen and records the id", () => {
    useUiStore.getState().startMission("mission-001");
    expect(useUiStore.getState().screen).toBe("mission");
    expect(useUiStore.getState().activeMissionId).toBe("mission-001");
  });

  it("goToReward moves to the reward screen", () => {
    useUiStore.getState().startMission("mission-001");
    useUiStore.getState().goToReward();
    expect(useUiStore.getState().screen).toBe("reward");
  });
});
