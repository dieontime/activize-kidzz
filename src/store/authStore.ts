import { create } from "zustand";
import type { Profile } from "@/services/authTypes";
import { getKnownProfiles } from "@/lib/knownProfiles";
import { useProgressStore } from "@/store/progressStore";

export type AuthScreen = "profilePicker" | "login" | "signup" | "recovery" | null;

interface AuthState {
  authScreen: AuthScreen;
  activeProfile: Profile | null;
  token: string | null;
  setAuthScreen: (screen: AuthScreen) => void;
  login: (token: string, profile: Profile) => void;
  completeAuthFlow: () => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  authScreen: getKnownProfiles().length > 0 ? "profilePicker" : "login",
  activeProfile: null,
  token: null,
  setAuthScreen: (screen) => set({ authScreen: screen }),
  login: (token, profile) => set({ token, activeProfile: profile }),
  completeAuthFlow: () => set({ authScreen: null }),
  logout: () => {
    useProgressStore.getState().reset();
    set({ token: null, activeProfile: null, authScreen: "login" });
  },
}));
