import { signup, login, recoverPin, checkUsernameAvailable } from "./auth";
import { useAuthStore } from "@/store/authStore";
import { mockBackend } from "@/services/mockBackend";

describe("auth", () => {
  beforeEach(() => {
    mockBackend.reset();
    useAuthStore.getState().logout();
  });

  it("checkUsernameAvailable passes through to the backend", async () => {
    expect(await checkUsernameAvailable("SpeedyOtter")).toBe(true);
  });

  it("signup logs the new profile into useAuthStore", async () => {
    const { profile, recoveryCode } = await signup({
      username: "SpeedyOtter", pin: ["🐱", "⚡", "🍕", "🌈"], avatar: "avatar_cat", age_band: "6-8",
    });
    expect(profile.username).toBe("SpeedyOtter");
    expect(recoveryCode).toMatch(/^[A-Z]+-[A-Z]+-\d{4}$/);
    expect(useAuthStore.getState().activeProfile?.username).toBe("SpeedyOtter");
    expect(useAuthStore.getState().token).not.toBeNull();
  });

  it("signup does not change authScreen (caller decides when to hand off)", async () => {
    useAuthStore.getState().setAuthScreen("signup");
    await signup({ username: "SpeedyOtter", pin: ["🐱", "⚡", "🍕", "🌈"], avatar: "avatar_cat", age_band: "6-8" });
    expect(useAuthStore.getState().authScreen).toBe("signup");
  });

  it("login logs the profile into useAuthStore", async () => {
    await signup({ username: "SpeedyOtter", pin: ["🐱", "⚡", "🍕", "🌈"], avatar: "avatar_cat", age_band: "6-8" });
    useAuthStore.getState().logout();
    const profile = await login("SpeedyOtter", ["🐱", "⚡", "🍕", "🌈"]);
    expect(profile.username).toBe("SpeedyOtter");
    expect(useAuthStore.getState().activeProfile?.username).toBe("SpeedyOtter");
  });

  it("recoverPin does not touch useAuthStore at all", async () => {
    const { recoveryCode } = await signup({
      username: "SpeedyOtter", pin: ["🐱", "⚡", "🍕", "🌈"], avatar: "avatar_cat", age_band: "6-8",
    });
    useAuthStore.getState().logout();
    await recoverPin("SpeedyOtter", recoveryCode, ["🐶", "🌟", "🍔", "🌙"]);
    expect(useAuthStore.getState().activeProfile).toBeNull();
  });
});
