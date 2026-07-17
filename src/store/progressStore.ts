import { create } from "zustand";
import { DEFAULT_PROGRESS, type ProgressRecord } from "@/services/progressTypes";

interface ProgressState extends ProgressRecord {
  isLoaded: boolean;
  setProgress: (record: ProgressRecord) => void;
  reset: () => void;
}

export const useProgressStore = create<ProgressState>((set) => ({
  ...DEFAULT_PROGRESS,
  isLoaded: false,
  setProgress: (record) => set({ ...record, isLoaded: true }),
  reset: () => set({ ...DEFAULT_PROGRESS, isLoaded: false }),
}));
