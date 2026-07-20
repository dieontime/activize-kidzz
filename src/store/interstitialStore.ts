import { create } from "zustand";

interface InterstitialStoreState {
  pending: boolean;
  setPending: (pending: boolean) => void;
  reset: () => void;
}

export const useInterstitialStore = create<InterstitialStoreState>((set) => ({
  pending: false,
  setPending: (pending) => set({ pending }),
  reset: () => set({ pending: false }),
}));
