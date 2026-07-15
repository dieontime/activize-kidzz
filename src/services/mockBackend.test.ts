import { mockBackend, MockBackendError } from "./mockBackend";

describe("mockBackend", () => {
  beforeEach(() => mockBackend.reset());

  it("checkUsernameAvailable is true for an unused name", async () => {
    expect(await mockBackend.checkUsernameAvailable("SpeedyOtter")).toBe(true);
  });

  it("signup creates a profile and returns a recovery code", async () => {
    const result = await mockBackend.signup({
      username: "SpeedyOtter", pin: ["🐱", "⚡", "🍕", "🌈"], avatar: "avatar_cat", age_band: "6-8",
    });
    expect(result.profile.username).toBe("SpeedyOtter");
    expect(result.profile.age_band).toBe("6-8");
    expect(result.token).toMatch(/^mock-/);
    expect(result.recoveryCode).toMatch(/^[A-Z]+-[A-Z]+-\d{4}$/);
  });

  it("signup rejects a username shorter than 3 characters", async () => {
    await expect(
      mockBackend.signup({ username: "ab", pin: ["🐱", "⚡", "🍕", "🌈"], avatar: "avatar_cat", age_band: "6-8" }),
    ).rejects.toThrow(MockBackendError);
  });

  it("signup rejects a profane username", async () => {
    await expect(
      mockBackend.signup({ username: "ShitHead", pin: ["🐱", "⚡", "🍕", "🌈"], avatar: "avatar_cat", age_band: "6-8" }),
    ).rejects.toMatchObject({ code: "PROFANITY" });
  });

  it("signup rejects a username that is already taken (case-insensitive)", async () => {
    await mockBackend.signup({ username: "SpeedyOtter", pin: ["🐱", "⚡", "🍕", "🌈"], avatar: "avatar_cat", age_band: "6-8" });
    await expect(
      mockBackend.signup({ username: "speedyotter", pin: ["🐶", "🌟", "🍔", "🌙"], avatar: "avatar_dog", age_band: "6-8" }),
    ).rejects.toMatchObject({ code: "TAKEN" });
  });

  it("checkUsernameAvailable is false once a name is taken", async () => {
    await mockBackend.signup({ username: "SpeedyOtter", pin: ["🐱", "⚡", "🍕", "🌈"], avatar: "avatar_cat", age_band: "6-8" });
    expect(await mockBackend.checkUsernameAvailable("SpeedyOtter")).toBe(false);
  });

  it("login succeeds with the right PIN", async () => {
    await mockBackend.signup({ username: "SpeedyOtter", pin: ["🐱", "⚡", "🍕", "🌈"], avatar: "avatar_cat", age_band: "6-8" });
    const result = await mockBackend.login("SpeedyOtter", ["🐱", "⚡", "🍕", "🌈"]);
    expect(result.profile.username).toBe("SpeedyOtter");
    expect(result.token).toMatch(/^mock-/);
  });

  it("login fails with the wrong PIN, using a generic error", async () => {
    await mockBackend.signup({ username: "SpeedyOtter", pin: ["🐱", "⚡", "🍕", "🌈"], avatar: "avatar_cat", age_band: "6-8" });
    await expect(mockBackend.login("SpeedyOtter", ["🐶", "🌟", "🍔", "🌙"])).rejects.toMatchObject({ code: "WRONG_CREDENTIALS" });
  });

  it("login fails for an unknown username with the same generic error (no enumeration)", async () => {
    await expect(mockBackend.login("NobodyHome", ["🐱", "⚡", "🍕", "🌈"])).rejects.toMatchObject({ code: "WRONG_CREDENTIALS" });
  });

  it("locks the account after 5 failed login attempts", async () => {
    await mockBackend.signup({ username: "SpeedyOtter", pin: ["🐱", "⚡", "🍕", "🌈"], avatar: "avatar_cat", age_band: "6-8" });
    for (let i = 0; i < 5; i++) {
      await expect(mockBackend.login("SpeedyOtter", ["🐶", "🌟", "🍔", "🌙"])).rejects.toThrow();
    }
    await expect(mockBackend.login("SpeedyOtter", ["🐱", "⚡", "🍕", "🌈"])).rejects.toMatchObject({ code: "LOCKED" });
  });

  it("recoverPin rotates the PIN and issues a new recovery code", async () => {
    const { recoveryCode } = await mockBackend.signup({
      username: "SpeedyOtter", pin: ["🐱", "⚡", "🍕", "🌈"], avatar: "avatar_cat", age_band: "6-8",
    });
    const result = await mockBackend.recoverPin("SpeedyOtter", recoveryCode, ["🐶", "🌟", "🍔", "🌙"]);
    expect(result.recoveryCode).toMatch(/^[A-Z]+-[A-Z]+-\d{4}$/);
    expect(result.recoveryCode).not.toBe(recoveryCode);
    const login = await mockBackend.login("SpeedyOtter", ["🐶", "🌟", "🍔", "🌙"]);
    expect(login.profile.username).toBe("SpeedyOtter");
  });

  it("recoverPin fails with the wrong code, using a generic error", async () => {
    await mockBackend.signup({ username: "SpeedyOtter", pin: ["🐱", "⚡", "🍕", "🌈"], avatar: "avatar_cat", age_band: "6-8" });
    await expect(
      mockBackend.recoverPin("SpeedyOtter", "WRONG-CODE-0000", ["🐶", "🌟", "🍔", "🌙"]),
    ).rejects.toMatchObject({ code: "WRONG_RECOVERY" });
  });
});
