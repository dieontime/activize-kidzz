import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { MockBackendError, type SignupArgs, type SignupResult, type LoginResult } from "./mockBackend";

let _client: SupabaseClient | null = null;

function client(): SupabaseClient {
  if (_client) return _client;
  const url = import.meta.env.VITE_SUPABASE_URL;
  const anon = import.meta.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !anon) {
    throw new Error("supabaseBackend: VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY must be set");
  }
  _client = createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } });
  return _client;
}

interface PostgresLikeError {
  message?: string;
  code?: string;
  hint?: string | null;
  details?: string | null;
}

function mapError(err: PostgresLikeError | null | undefined): never {
  const raw = (err?.message ?? "") + " " + (err?.hint ?? "") + " " + (err?.details ?? "");
  const upper = raw.toUpperCase();

  if (upper.includes("LOCKED") || /LOCKED UNTIL/i.test(raw)) {
    throw new MockBackendError("LOCKED", err?.message || "Account is locked");
  }
  if (upper.includes("WRONG_CREDENTIALS") || /INVALID USERNAME OR PIN/i.test(raw)) {
    throw new MockBackendError("WRONG_CREDENTIALS", err?.message || "Invalid username or PIN");
  }
  if (upper.includes("WRONG_RECOVERY")) {
    throw new MockBackendError("WRONG_RECOVERY", err?.message || "Username or recovery code is incorrect");
  }
  if (upper.includes("PROFANITY")) {
    throw new MockBackendError("PROFANITY", err?.message || "Username contains a profanity or blocked word");
  }
  if (upper.includes("TAKEN")) {
    throw new MockBackendError("TAKEN", err?.message || "Username is already taken");
  }
  if (upper.includes("INVALID") || /USERNAME MUST BE/i.test(raw) || /PIN MUST BE/i.test(raw)) {
    throw new MockBackendError("INVALID", err?.message || "Invalid input");
  }
  throw new Error(err?.message || "Unknown error from supabase");
}

export const supabaseBackend = {
  async checkUsernameAvailable(username: string): Promise<boolean> {
    const { data, error } = await client().rpc("rpc_check_username_available", { p_username: username });
    if (error) mapError(error);
    return Boolean(data);
  },

  async signup(args: SignupArgs): Promise<SignupResult> {
    const { username, pin, avatar, age_band } = args;
    const { data, error } = await client().rpc("rpc_signup", {
      p_username: username, p_pin: pin.join(""), p_avatar: avatar, p_age_band: age_band,
    });
    if (error) mapError(error);
    const row = Array.isArray(data) ? data[0] : data;
    if (!row) throw new Error("rpc_signup returned no row");
    return {
      profile: { id: row.profile_id, username: row.username, avatar: row.avatar, age_band: row.age_band },
      token: row.token,
      recoveryCode: row.recovery_code,
    };
  },

  async login(username: string, pin: string[]): Promise<LoginResult> {
    const { data, error } = await client().rpc("rpc_login", { p_username: username, p_pin: pin.join("") });
    if (error) mapError(error);
    const row = Array.isArray(data) ? data[0] : data;
    if (!row) throw new MockBackendError("WRONG_CREDENTIALS", "Invalid username or PIN");
    return {
      profile: { id: row.profile_id, username: row.username, avatar: row.avatar, age_band: row.age_band },
      token: row.token,
    };
  },

  async recoverPin(username: string, recoveryCode: string, newPin: string[]): Promise<{ recoveryCode: string }> {
    const { data, error } = await client().rpc("rpc_recover_pin", {
      p_username: username, p_recovery_code: recoveryCode, p_new_pin: newPin.join(""),
    });
    if (error) mapError(error);
    const row = Array.isArray(data) ? data[0] : data;
    if (!row) throw new Error("rpc_recover_pin returned no row");
    return { recoveryCode: row.recovery_code };
  },
};
