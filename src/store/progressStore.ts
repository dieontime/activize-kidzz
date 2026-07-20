import { create } from "zustand";
import { DEFAULT_PROGRESS, type ProgressRecord } from "@/services/progressTypes";

interface ProgressState extends ProgressRecord {
  isLoaded: boolean;
  earnedBadgeIds: string[];
  newlyEarnedBadgeIds: string[];
  setProgress: (record: ProgressRecord) => void;
  reset: () => void;
  setEarnedBadgeIds: (ids: string[]) => void;
  awardBadges: (newlyEarnedIds: string[]) => void;
}

export const useProgressStore = create<ProgressState>((set) => ({
  ...DEFAULT_PROGRESS,
  isLoaded: false,
  earnedBadgeIds: [],
  newlyEarnedBadgeIds: [],
  setProgress: (record) => set({ ...record, isLoaded: true }),
  reset: () => set({ ...DEFAULT_PROGRESS, isLoaded: false, earnedBadgeIds: [], newlyEarnedBadgeIds: [] }),
  setEarnedBadgeIds: (ids) => set({ earnedBadgeIds: ids }),
  awardBadges: (newlyEarnedIds) =>
    set((s) => ({
      earnedBadgeIds: [...s.earnedBadgeIds, ...newlyEarnedIds],
      newlyEarnedBadgeIds: newlyEarnedIds,
    })),
}));
