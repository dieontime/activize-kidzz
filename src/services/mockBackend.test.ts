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

  it("keeps counting failed attempts across an expired lock instead of resetting to 0", async () => {
    // Isolates the exact regression: failed_attempts must survive a lock's
    // expiry so the ladder can escalate (1min -> 5min -> 24h). If expiry
    // wrongly reset the counter to 0, the very next wrong attempt would
    // land back at count=1 (no lock, per lockoutDurationMs) instead of
    // count=6 (still >=5, so it re-locks) -- these two scenarios are only
    // distinguishable by what the *following* call sees, so this test
    // checks exactly that.
    vi.useFakeTimers();
    try {
      await mockBackend.signup({ username: "SpeedyOtter", pin: ["🐱", "⚡", "🍕", "🌈"], avatar: "avatar_cat", age_band: "6-8" });
      const wrong = () => mockBackend.login("SpeedyOtter", ["🐶", "🌟", "🍔", "🌙"]);

      // 5 wrong attempts: the 5th sets a 1-minute lock but still reports
      // WRONG_CREDENTIALS for itself (the lock blocks the *next* call).
      for (let i = 0; i < 5; i++) await expect(wrong()).rejects.toMatchObject({ code: "WRONG_CREDENTIALS" });
      await expect(wrong()).rejects.toMatchObject({ code: "LOCKED" });

      // Advance past the 1-minute lock and submit one more wrong attempt.
      vi.advanceTimersByTime(60_000 + 1);
      await expect(wrong()).rejects.toMatchObject({ code: "WRONG_CREDENTIALS" });

      // The very next call must be LOCKED again immediately (no further
      // time advance): with the fix this is attempt 6 (still >=5, so
      // lockout_interval re-locks it); with the bug this would be attempt
      // 1 (reset to 0, then incremented), which sets no lock at all.
      await expect(wrong()).rejects.toMatchObject({ code: "LOCKED" });
    } finally {
      vi.useRealTimers();
    }
  });

  it("reaches the 5-minute and 24-hour lockout tiers once failed_attempts is high enough", async () => {
    // Seeds failed_attempts directly (rather than looping through dozens of
    // real wrong-attempt/expire cycles) to test the tier boundaries in
    // lockoutDurationMs precisely and quickly.
    vi.useFakeTimers();
    try {
      await mockBackend.signup({ username: "SpeedyOtter", pin: ["🐱", "⚡", "🍕", "🌈"], avatar: "avatar_cat", age_band: "6-8" });
      const wrong = () => mockBackend.login("SpeedyOtter", ["🐶", "🌟", "🍔", "🌙"]);

      const seedFailedAttempts = (count: number) => {
        const profiles = JSON.parse(window.localStorage.getItem("mockBackend.profiles")!);
        profiles[0].failed_attempts = count;
        profiles[0].locked_until = null;
        window.localStorage.setItem("mockBackend.profiles", JSON.stringify(profiles));
      };

      // Attempt 8 must hit the 5-minute tier, and a 1-minute wait must not clear it.
      seedFailedAttempts(7);
      await expect(wrong()).rejects.toMatchObject({ code: "WRONG_CREDENTIALS" }); // consumes attempt 8, sets the lock
      await expect(wrong()).rejects.toMatchObject({ code: "LOCKED" });
      vi.advanceTimersByTime(60_000 + 1);
      await expect(wrong()).rejects.toMatchObject({ code: "LOCKED" }); // still locked after only 1 minute

      // Attempt 10 must hit the 24-hour tier, and a 5-minute wait must not clear it.
      // (seedFailedAttempts also clears locked_until, so no prior lock to wait out.)
      seedFailedAttempts(9);
      await expect(wrong()).rejects.toMatchObject({ code: "WRONG_CREDENTIALS" }); // consumes attempt 10, sets the 24h lock
      await expect(wrong()).rejects.toMatchObject({ code: "LOCKED" });
      vi.advanceTimersByTime(5 * 60_000 + 1);
      await expect(wrong()).rejects.toMatchObject({ code: "LOCKED" }); // still locked after only 5 more minutes

      // Only after the full 24 hours does the account unlock again.
      vi.advanceTimersByTime(24 * 60 * 60_000 + 1);
      await expect(mockBackend.login("SpeedyOtter", ["🐱", "⚡", "🍕", "🌈"])).resolves.toMatchObject({
        profile: { username: "SpeedyOtter" },
      });
    } finally {
      vi.useRealTimers();
    }
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
