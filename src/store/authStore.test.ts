import { addKnownProfile } from "@/lib/knownProfiles";

describe("authStore", () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.resetModules();
  });

  it("boots to 'login' when no profiles are known on this TV", async () => {
    const { useAuthStore } = await import("./authStore");
    expect(useAuthStore.getState().authScreen).toBe("login");
  });

  it("boots to 'profilePicker' when a profile is already known on this TV", async () => {
    addKnownProfile({ profileId: "p1", username: "SpeedyOtter", avatar: "avatar_cat" });
    const { useAuthStore } = await import("./authStore");
    expect(useAuthStore.getState().authScreen).toBe("profilePicker");
  });

  it("setAuthScreen changes the active auth screen", async () => {
    const { useAuthStore } = await import("./authStore");
    useAuthStore.getState().setAuthScreen("signup");
    expect(useAuthStore.getState().authScreen).toBe("signup");
  });

  it("login sets activeProfile and token without changing authScreen", async () => {
    const { useAuthStore } = await import("./authStore");
    useAuthStore.getState().setAuthScreen("signup");
    useAuthStore.getState().login("tok-1", { id: "p1", username: "SpeedyOtter", avatar: "avatar_cat", age_band: "6-8" });
    expect(useAuthStore.getState().activeProfile).toEqual({ id: "p1", username: "SpeedyOtter", avatar: "avatar_cat", age_band: "6-8" });
    expect(useAuthStore.getState().token).toBe("tok-1");
    expect(useAuthStore.getState().authScreen).toBe("signup");
  });

  it("completeAuthFlow sets authScreen to null", async () => {
    const { useAuthStore } = await import("./authStore");
    useAuthStore.getState().completeAuthFlow();
    expect(useAuthStore.getState().authScreen).toBeNull();
  });

  it("logout clears the profile/token and resets to login", async () => {
    const { useAuthStore } = await import("./authStore");
    useAuthStore.getState().login("tok-1", { id: "p1", username: "SpeedyOtter", avatar: "avatar_cat", age_band: "6-8" });
    useAuthStore.getState().completeAuthFlow();
    useAuthStore.getState().logout();
    expect(useAuthStore.getState().activeProfile).toBeNull();
    expect(useAuthStore.getState().token).toBeNull();
    expect(useAuthStore.getState().authScreen).toBe("login");
  });
});
