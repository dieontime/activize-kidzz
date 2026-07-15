import { containsProfanity } from "@/lib/profanity";
import type { Profile, SignupArgs, SignupResult, LoginResult } from "./authTypes";

export type { Profile, SignupArgs, SignupResult, LoginResult };

export class MockBackendError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "MockBackendError";
    this.code = code;
  }
}

interface StoredProfile {
  id: string;
  username: string;
  username_lower: string;
  avatar: string;
  age_band: "3-5" | "6-8";
  pin_hash: string;
  salt: string;
  recovery_hash: string;
  failed_attempts: number;
  locked_until: string | null;
}

const KEY_PROFILES = "mockBackend.profiles";

function readKey<T>(key: string): T[] {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    return JSON.parse(raw) as T[];
  } catch {
    return [];
  }
}

function writeKey<T>(key: string, data: T[]): void {
  localStorage.setItem(key, JSON.stringify(data));
}

const ADJECTIVES = [
  "BRAVE", "COOL", "EPIC", "FAST", "GLAD", "HAPPY", "HUGE", "JOLLY",
  "KIND", "LUSH", "MEGA", "NEON", "PROUD", "QUICK", "RADIANT", "SHARP",
  "SWIFT", "TALL", "ULTRA", "VIVID", "WILD", "ZESTY",
];

const NOUNS = [
  "BEAR", "BIRD", "CAT", "CLOUD", "DRAGON", "EAGLE", "FOX", "FROG",
  "HAWK", "HORSE", "LION", "MOON", "PANDA", "PLANET", "RABBIT", "ROCKET",
  "SHARK", "STAR", "TIGER", "UNICORN", "WOLF", "ZEBRA",
];

function generateRecoveryCode(): string {
  const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)];
  const num = String(Math.floor(Math.random() * 10000)).padStart(4, "0");
  return `${adj}-${noun}-${num}`;
}

async function sha256hex(input: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function hashPin(pin: string[], salt: string): Promise<string> {
  return sha256hex(pin.join("") + salt);
}

async function hashRecovery(code: string, salt: string): Promise<string> {
  return sha256hex(code + salt);
}

function generateSalt(): string {
  const arr = new Uint8Array(16);
  crypto.getRandomValues(arr);
  return Array.from(arr).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function generateToken(profileId: string): string {
  const random = Math.random().toString(36).slice(2);
  return `mock-${profileId}-${random}`;
}

function lockoutDurationMs(failedAttempts: number): number | null {
  if (failedAttempts >= 10) return 24 * 60 * 60 * 1000;
  if (failedAttempts >= 8) return 5 * 60 * 1000;
  if (failedAttempts >= 5) return 1 * 60 * 1000;
  return null;
}

export const mockBackend = {
  reset(): void {
    localStorage.removeItem(KEY_PROFILES);
  },

  async checkUsernameAvailable(username: string): Promise<boolean> {
    const profiles = readKey<StoredProfile>(KEY_PROFILES);
    const lower = username.toLowerCase();
    return !profiles.some((p) => p.username_lower === lower);
  },

  async signup(args: SignupArgs): Promise<SignupResult> {
    const { username, pin, avatar, age_band } = args;

    if (!username || username.length < 3 || username.length > 20) {
      throw new MockBackendError("INVALID", "Username must be 3-20 characters");
    }
    if (!Array.isArray(pin) || pin.length !== 4) {
      throw new MockBackendError("INVALID", "PIN must be exactly 4 emoji icons");
    }
    if (containsProfanity(username)) {
      throw new MockBackendError("PROFANITY", "Username contains a profanity or blocked word");
    }

    const profiles = readKey<StoredProfile>(KEY_PROFILES);
    const lower = username.toLowerCase();
    if (profiles.some((p) => p.username_lower === lower)) {
      throw new MockBackendError("TAKEN", `Username "${username}" is already taken`);
    }

    const id = crypto.randomUUID();
    const salt = generateSalt();
    const pin_hash = await hashPin(pin, salt);
    const recoveryCode = generateRecoveryCode();
    const recovery_hash = await hashRecovery(recoveryCode, salt);

    profiles.push({
      id, username, username_lower: lower, avatar, age_band,
      pin_hash, salt, recovery_hash, failed_attempts: 0, locked_until: null,
    });
    writeKey(KEY_PROFILES, profiles);

    return { profile: { id, username, avatar, age_band }, token: generateToken(id), recoveryCode };
  },

  async login(username: string, pin: string[]): Promise<LoginResult> {
    const profiles = readKey<StoredProfile>(KEY_PROFILES);
    const lower = username.toLowerCase();
    const idx = profiles.findIndex((p) => p.username_lower === lower);

    if (idx === -1) {
      throw new MockBackendError("WRONG_CREDENTIALS", "Invalid username or PIN");
    }
    const stored = profiles[idx];

    if (stored.locked_until) {
      if (new Date(stored.locked_until) > new Date()) {
        throw new MockBackendError("LOCKED", `Account is locked until ${stored.locked_until}`);
      }
      stored.locked_until = null;
      stored.failed_attempts = 0;
    }

    const attemptHash = await hashPin(pin, stored.salt);
    if (attemptHash !== stored.pin_hash) {
      stored.failed_attempts += 1;
      const durationMs = lockoutDurationMs(stored.failed_attempts);
      if (durationMs !== null) stored.locked_until = new Date(Date.now() + durationMs).toISOString();
      writeKey(KEY_PROFILES, profiles);
      throw new MockBackendError("WRONG_CREDENTIALS", "Invalid username or PIN");
    }

    stored.failed_attempts = 0;
    stored.locked_until = null;
    writeKey(KEY_PROFILES, profiles);

    return {
      profile: { id: stored.id, username: stored.username, avatar: stored.avatar, age_band: stored.age_band },
      token: generateToken(stored.id),
    };
  },

  async recoverPin(username: string, recoveryCode: string, newPin: string[]): Promise<{ recoveryCode: string }> {
    const profiles = readKey<StoredProfile>(KEY_PROFILES);
    const lower = username.toLowerCase();
    const idx = profiles.findIndex((p) => p.username_lower === lower);

    if (idx === -1) {
      throw new MockBackendError("WRONG_RECOVERY", "Username or recovery code is incorrect");
    }
    const stored = profiles[idx];

    if (stored.locked_until) {
      if (new Date(stored.locked_until) > new Date()) {
        throw new MockBackendError("LOCKED", `Account is locked until ${stored.locked_until}`);
      }
      stored.locked_until = null;
      stored.failed_attempts = 0;
    }

    const attemptHash = await hashRecovery(recoveryCode, stored.salt);
    if (attemptHash !== stored.recovery_hash) {
      stored.failed_attempts += 1;
      const durationMs = lockoutDurationMs(stored.failed_attempts);
      if (durationMs !== null) stored.locked_until = new Date(Date.now() + durationMs).toISOString();
      writeKey(KEY_PROFILES, profiles);
      throw new MockBackendError("WRONG_RECOVERY", "Username or recovery code is incorrect");
    }

    if (!Array.isArray(newPin) || newPin.length !== 4) {
      throw new MockBackendError("INVALID", "New PIN must be exactly 4 emoji icons");
    }

    const newRecoveryCode = generateRecoveryCode();
    stored.pin_hash = await hashPin(newPin, stored.salt);
    stored.recovery_hash = await hashRecovery(newRecoveryCode, stored.salt);
    stored.failed_attempts = 0;
    stored.locked_until = null;
    writeKey(KEY_PROFILES, profiles);

    return { recoveryCode: newRecoveryCode };
  },
};
