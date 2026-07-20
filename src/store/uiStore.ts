import { create } from "zustand";

export type Screen = "map" | "mission" | "reward" | "trophyShelf";

interface UiState {
  screen: Screen;
  activeMissionId: string | null;
  goToMap: () => void;
  startMission: (missionId: string) => void;
  goToReward: () => void;
  goToTrophyShelf: () => void;
}

export const useUiStore = create<UiState>((set) => ({
  screen: "map",
  activeMissionId: null,
  goToMap: () => set({ screen: "map", activeMissionId: null }),
  startMission: (missionId) => set({ screen: "mission", activeMissionId: missionId }),
  goToReward: () => set({ screen: "reward" }),
  goToTrophyShelf: () => set({ screen: "trophyShelf" }),
}));
