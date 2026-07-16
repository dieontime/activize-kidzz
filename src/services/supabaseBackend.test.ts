import type { supabaseBackend as SupabaseBackendType } from "./supabaseBackend";

const rpcMock = vi.fn();

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({ rpc: rpcMock })),
}));

let supabaseBackend: typeof SupabaseBackendType;

beforeAll(async () => {
  vi.stubEnv("VITE_SUPABASE_URL", "https://test.supabase.co");
  vi.stubEnv("VITE_SUPABASE_ANON_KEY", "test-anon");
  ({ supabaseBackend } = await import("./supabaseBackend"));
});

afterAll(() => vi.unstubAllEnvs());

beforeEach(() => rpcMock.mockReset());

describe("supabaseBackend", () => {
  it("checkUsernameAvailable calls rpc_check_username_available", async () => {
    rpcMock.mockResolvedValueOnce({ data: true, error: null });
    const result = await supabaseBackend.checkUsernameAvailable("SpeedyOtter");
    expect(rpcMock).toHaveBeenCalledWith("rpc_check_username_available", { p_username: "SpeedyOtter" });
    expect(result).toBe(true);
  });

  it("signup calls rpc_signup with joined pin and maps the row", async () => {
    rpcMock.mockResolvedValueOnce({
      data: {
        profile_id: "p1", username: "SpeedyOtter", avatar: "avatar_cat",
        age_band: "6-8", recovery_code: "BRAVE-FOX-1234", token: "tok-1",
      },
      error: null,
    });
    const out = await supabaseBackend.signup({
      username: "SpeedyOtter", pin: ["🐱", "⚡", "🍕", "🌈"], avatar: "avatar_cat", age_band: "6-8",
    });
    expect(rpcMock).toHaveBeenCalledWith("rpc_signup", {
      p_username: "SpeedyOtter", p_pin: "🐱⚡🍕🌈", p_avatar: "avatar_cat", p_age_band: "6-8",
    });
    expect(out.profile.id).toBe("p1");
    expect(out.token).toBe("tok-1");
    expect(out.recoveryCode).toBe("BRAVE-FOX-1234");
  });

  it("signup maps a TAKEN error", async () => {
    rpcMock.mockResolvedValue({ data: null, error: { message: 'Username "x" is already taken', hint: "TAKEN" } });
    await expect(
      supabaseBackend.signup({ username: "x", pin: ["a", "b", "c", "d"], avatar: "y", age_band: "6-8" }),
    ).rejects.toMatchObject({ code: "TAKEN" });
  });

  it("signup maps a PROFANITY error", async () => {
    rpcMock.mockResolvedValue({ data: null, error: { message: "Username contains a profanity", hint: "PROFANITY" } });
    await expect(
      supabaseBackend.signup({ username: "badword", pin: ["a", "b", "c", "d"], avatar: "y", age_band: "6-8" }),
    ).rejects.toMatchObject({ code: "PROFANITY" });
  });

  it("login calls rpc_login and maps WRONG_CREDENTIALS", async () => {
    rpcMock.mockResolvedValue({ data: null, error: { message: "Invalid username or PIN", hint: "WRONG_CREDENTIALS" } });
    await expect(supabaseBackend.login("SpeedyOtter", ["🐱", "⚡", "🍕", "🌈"])).rejects.toMatchObject({ code: "WRONG_CREDENTIALS" });
    expect(rpcMock).toHaveBeenCalledWith("rpc_login", { p_username: "SpeedyOtter", p_pin: "🐱⚡🍕🌈" });
  });

  it("login returns the mapped profile and token on success", async () => {
    rpcMock.mockResolvedValueOnce({
      data: [{ profile_id: "p2", username: "BraveComet", avatar: "avatar_dog", age_band: "3-5", token: "tok-2" }],
      error: null,
    });
    const out = await supabaseBackend.login("BraveComet", ["a", "b", "c", "d"]);
    expect(out.profile.id).toBe("p2");
    expect(out.profile.age_band).toBe("3-5");
    expect(out.token).toBe("tok-2");
  });

  it("login maps a LOCKED error", async () => {
    rpcMock.mockResolvedValue({ data: null, error: { message: "Account is locked until 2099-01-01T00:00:00Z", hint: "LOCKED" } });
    await expect(supabaseBackend.login("SpeedyOtter", ["a", "b", "c", "d"])).rejects.toMatchObject({ code: "LOCKED" });
  });

  it("recoverPin calls rpc_recover_pin with joined new pin", async () => {
    rpcMock.mockResolvedValueOnce({ data: { recovery_code: "NEW-CODE-9999" }, error: null });
    const out = await supabaseBackend.recoverPin("SpeedyOtter", "OLD-CODE-1111", ["w", "x", "y", "z"]);
    expect(rpcMock).toHaveBeenCalledWith("rpc_recover_pin", {
      p_username: "SpeedyOtter", p_recovery_code: "OLD-CODE-1111", p_new_pin: "wxyz",
    });
    expect(out.recoveryCode).toBe("NEW-CODE-9999");
  });

  it("recoverPin maps a WRONG_RECOVERY error", async () => {
    rpcMock.mockResolvedValue({ data: null, error: { message: "Username or recovery code is incorrect", hint: "WRONG_RECOVERY" } });
    await expect(
      supabaseBackend.recoverPin("SpeedyOtter", "BAD", ["a", "b", "c", "d"]),
    ).rejects.toMatchObject({ code: "WRONG_RECOVERY" });
  });
});
