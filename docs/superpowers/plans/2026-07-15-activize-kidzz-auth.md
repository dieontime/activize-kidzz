# Activize Kidzz — Plan 2: Auth Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Port the proven kid-auth system from `dieontime/kids-quiz-claude` (username + 4-emoji PIN + parent-held recovery code, backed by `SECURITY DEFINER` Postgres RPCs) into Activize Kidzz, adapted for D-pad-only navigation and a multi-kid shared-TV "Profile Picker," and gate the existing Plan 1 gameplay flow behind it.

**Architecture:** A new `useAuthStore` (Zustand) tracks which auth screen is active and the logged-in profile; `App.tsx` renders auth screens while `authScreen !== null` and the existing JourneyMap/MissionPlayer/RewardScreen flow once it's `null`. Auth logic (`lib/auth.ts`, `services/{backend,mockBackend,supabaseBackend}.ts`) is ported near-verbatim — only the auth-relevant methods, not the reference's quiz-specific ones. Screens (`EmojiPinKeypad`, `AvatarPicker`, `SignupWizard`, `LoginScreen`, `RecoveryScreen`) are ported and adapted: `react-router-dom` removed (this app has no router), `BigButton` replaced with the existing `FocusableButton`, `framer-motion` dropped (deferred to a later visual-design pass), `age_band` values renamed. A new `ProfilePicker` screen (not from the reference) and a `knownProfiles` localStorage cache implement the "remembered device" convenience. A real Supabase migration creates the `profiles` table and auth RPCs, applied via `supabase db push` against the already-linked project.

**Tech Stack:** Existing Plan 1 stack (Vite, React, TS, Zustand, Zod, `@noriginmedia/norigin-spatial-navigation`, Vitest + RTL) plus `@supabase/supabase-js` (new).

## Global Constraints

- **D-pad only.** Every interactive element focusable; default focus lands on the primary action. `initNavigation()` must run before any `autoFocus`'d element mounts (proven necessary in Plan 1).
- **No router.** This app has no URL-based navigation ("URLs are meaningless on a TV") — all `react-router-dom` usage in ported files is replaced with `useAuthStore`/`useUiStore` state transitions.
- **Content/logic is data-driven; auth logic is a straight port.** Reuse `dieontime/kids-quiz-claude`'s auth mechanism verbatim at the logic layer wherever possible — only the auth-relevant methods (not its quiz-specific ones), with `age_band` renamed from `'5-6'|'7-9'` to `'3-5'|'6-8'`.
- **No Supabase Auth (`auth.users`/JWT).** Kid identity is a custom `profiles` row; credential validation happens entirely inside `SECURITY DEFINER` Postgres RPCs, which are the real security boundary, not RLS.
- **`profiles` RLS is default-deny** — no anon/authenticated policy at all. Only the RPCs (which bypass RLS by design) touch this table. Stricter than the reference implementation's temporary permissive policy.
- **No session token persists across app restarts.** The `knownProfiles` cache (username + avatar only, no token) is what lets the Profile Picker skip re-typing a username; every launch re-authenticates for real via the PIN.
- **Testing:** Vitest + RTL, black-box; automated tests use `mockBackend` only (no real network/Supabase); es2019 target, light bundle. TDD, DRY, YAGNI.
- **Visual polish deferred.** `framer-motion` animations, `PlayfulBackground`, and any hover/scale styling are NOT part of this plan — a dedicated `/frontend-design` pass follows this plan, before Plan 3.

---

### Task 1: Add `@supabase/supabase-js` and env-var scaffolding

**Files:**
- Modify: `package.json`, `package-lock.json` (via `npm install`)
- Modify: `.gitignore`
- Create: `.env.example`

**Interfaces:**
- Consumes: nothing.
- Produces: `@supabase/supabase-js`'s `createClient` available for Task 6. `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` documented as the env vars `services/backend.ts` (Task 6) switches on.

- [ ] **Step 1: Install the dependency**

Run: `npm install @supabase/supabase-js`

- [ ] **Step 2: Add `.env.example`**

```
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

- [ ] **Step 3: Gitignore local env files**

Add to `.gitignore` (append, don't remove existing lines):
```
.env
.env.local
```

- [ ] **Step 4: Verify install and typecheck**

Run: `npm run build`
Expected: succeeds (no code references `@supabase/supabase-js` yet, so this just confirms the install didn't break anything).

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json .gitignore .env.example
git commit -m "chore: add @supabase/supabase-js and env-var scaffolding"
```

---

### Task 2: Known-profiles-on-this-TV cache

**Files:**
- Create: `src/lib/knownProfiles.ts`, `src/lib/knownProfiles.test.ts`

**Interfaces:**
- Consumes: `localStorage` (browser API).
- Produces: `interface KnownProfile { profileId: string; username: string; avatar: string }`, `getKnownProfiles(): KnownProfile[]`, `addKnownProfile(profile: KnownProfile): void` (upserts by `profileId`).

- [ ] **Step 1: Write the failing test**

```typescript
// src/lib/knownProfiles.test.ts
import { getKnownProfiles, addKnownProfile } from "./knownProfiles";

describe("knownProfiles", () => {
  beforeEach(() => window.localStorage.clear());

  it("returns an empty list when nothing is cached", () => {
    expect(getKnownProfiles()).toEqual([]);
  });

  it("returns [] when the cached value is corrupted JSON", () => {
    window.localStorage.setItem("activize:knownProfiles", "not-json{");
    expect(getKnownProfiles()).toEqual([]);
  });

  it("adds a profile and reflects it in getKnownProfiles", () => {
    addKnownProfile({ profileId: "p1", username: "SpeedyOtter", avatar: "avatar_cat" });
    expect(getKnownProfiles()).toEqual([{ profileId: "p1", username: "SpeedyOtter", avatar: "avatar_cat" }]);
  });

  it("upserts by profileId instead of duplicating", () => {
    addKnownProfile({ profileId: "p1", username: "SpeedyOtter", avatar: "avatar_cat" });
    addKnownProfile({ profileId: "p1", username: "SpeedyOtter", avatar: "avatar_dog" });
    expect(getKnownProfiles()).toEqual([{ profileId: "p1", username: "SpeedyOtter", avatar: "avatar_dog" }]);
  });

  it("keeps multiple distinct profiles", () => {
    addKnownProfile({ profileId: "p1", username: "SpeedyOtter", avatar: "avatar_cat" });
    addKnownProfile({ profileId: "p2", username: "BraveComet", avatar: "avatar_dog" });
    expect(getKnownProfiles()).toHaveLength(2);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/lib/knownProfiles.test.ts`
Expected: FAIL — cannot resolve `./knownProfiles`.

- [ ] **Step 3: Implement**

```typescript
// src/lib/knownProfiles.ts
export interface KnownProfile {
  profileId: string;
  username: string;
  avatar: string;
}

const KEY = "activize:knownProfiles";

export function getKnownProfiles(): KnownProfile[] {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    return JSON.parse(raw) as KnownProfile[];
  } catch {
    return [];
  }
}

export function addKnownProfile(profile: KnownProfile): void {
  const others = getKnownProfiles().filter((p) => p.profileId !== profile.profileId);
  window.localStorage.setItem(KEY, JSON.stringify([...others, profile]));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/lib/knownProfiles.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/knownProfiles.ts src/lib/knownProfiles.test.ts
git commit -m "feat: known-profiles-on-this-TV cache"
```

---

### Task 3: Shared auth types + auth state store (`useAuthStore`)

**Files:**
- Create: `src/services/authTypes.ts`, `src/store/authStore.ts`, `src/store/authStore.test.ts`

**Interfaces:**
- Consumes: `getKnownProfiles` (Task 2, decides initial screen).
- Produces: `src/services/authTypes.ts` exports `interface Profile { id: string; username: string; avatar: string; age_band: "3-5" | "6-8" }`, `interface SignupArgs { username: string; pin: string[]; avatar: string; age_band: "3-5" | "6-8" }`, `interface SignupResult { profile: Profile; token: string; recoveryCode: string }`, `interface LoginResult { profile: Profile; token: string }` — the **single canonical source** for these shapes; Task 5 (`mockBackend.ts`) and everything downstream imports from here, nothing redefines them. `AuthScreen = "profilePicker" | "login" | "signup" | "recovery" | null` (`null` means "in the main app, not the auth flow"). `useAuthStore` state `{ authScreen, activeProfile: Profile | null, token: string | null }` and actions `setAuthScreen(screen)`, `login(token, profile)` (sets `activeProfile`/`token`, does **not** change `authScreen`), `completeAuthFlow()` (sets `authScreen: null` — called explicitly once a screen is ready to hand off to the main app), `logout()`.

- [ ] **Step 1: Write the failing test**

```typescript
// src/store/authStore.test.ts
import { getKnownProfiles, addKnownProfile } from "@/lib/knownProfiles";

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
```

Note: each test uses a fresh dynamic `import("./authStore")` after `vi.resetModules()` because the store's *initial* `authScreen` is computed once at module-load time from `getKnownProfiles()` — the only way to test both boot conditions is to reset and re-import between them (same technique the reference repo's own `supabaseBackend.test.ts` uses for env-dependent module state).

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/store/authStore.test.ts`
Expected: FAIL — cannot resolve `./authStore`.

- [ ] **Step 3: Implement**

```typescript
// src/services/authTypes.ts
export interface Profile {
  id: string;
  username: string;
  avatar: string;
  age_band: "3-5" | "6-8";
}

export interface SignupArgs {
  username: string;
  pin: string[];
  avatar: string;
  age_band: "3-5" | "6-8";
}

export interface SignupResult {
  profile: Profile;
  token: string;
  recoveryCode: string;
}

export interface LoginResult {
  profile: Profile;
  token: string;
}
```

```typescript
// src/store/authStore.ts
import { create } from "zustand";
import type { Profile } from "@/services/authTypes";
import { getKnownProfiles } from "@/lib/knownProfiles";

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
  logout: () => set({ token: null, activeProfile: null, authScreen: "login" }),
}));
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/store/authStore.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/services/authTypes.ts src/store/authStore.ts src/store/authStore.test.ts
git commit -m "feat: shared auth types and auth state store"
```

---

### Task 4: Port `profanity.ts` and `usernameSuggestor.ts`

**Files:**
- Create: `src/lib/profanity.ts`, `src/lib/usernameSuggestor.ts`, `src/lib/profanity.test.ts`, `src/lib/usernameSuggestor.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `containsProfanity(input: string): boolean`, `suggestUsernames(base: string, count: number): string[]`.

- [ ] **Step 1: Write the failing tests**

```typescript
// src/lib/profanity.test.ts
import { containsProfanity } from "./profanity";

describe("containsProfanity", () => {
  it("returns false for an empty or null-ish input", () => {
    expect(containsProfanity("")).toBe(false);
  });

  it("blocks an exact blocked word", () => {
    expect(containsProfanity("shit")).toBe(true);
  });

  it("blocks a blocked word inside a CamelCase compound", () => {
    expect(containsProfanity("SuperHellBoy")).toBe(true);
  });

  it("does not flag legitimate names that contain blocked substrings", () => {
    expect(containsProfanity("Cassidy")).toBe(false);
    expect(containsProfanity("grasshopper")).toBe(false);
    expect(containsProfanity("hello")).toBe(false);
    expect(containsProfanity("Michelle")).toBe(false);
  });
});
```

```typescript
// src/lib/usernameSuggestor.test.ts
import { suggestUsernames } from "./usernameSuggestor";

describe("suggestUsernames", () => {
  it("returns the requested count of suggestions", () => {
    expect(suggestUsernames("Otter", 3)).toHaveLength(3);
  });

  it("returns unique suggestions", () => {
    const suggestions = suggestUsernames("Otter", 5);
    expect(new Set(suggestions).size).toBe(5);
  });

  it("strips a trailing number from the base before suggesting", () => {
    const suggestions = suggestUsernames("Otter42", 3);
    for (const s of suggestions) {
      expect(s.startsWith("Otter")).toBe(true);
      expect(s).not.toMatch(/^Otter42/);
    }
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- src/lib/profanity.test.ts src/lib/usernameSuggestor.test.ts`
Expected: FAIL — cannot resolve `./profanity` / `./usernameSuggestor`.

- [ ] **Step 3: Implement (ported verbatim from `dieontime/kids-quiz-claude`)**

```typescript
// src/lib/profanity.ts
const BLOCKED = new Set([
  "ass", "damn", "hell", "crap", "shit", "fuck", "bitch", "piss",
  "butt", "sex", "porn", "kill", "nazi", "dick", "cock", "tit",
]);

export function containsProfanity(input: string): boolean {
  if (!input) return false;
  for (const token of tokenize(input)) {
    if (BLOCKED.has(token.toLowerCase())) return true;
  }
  return false;
}

function tokenize(input: string): string[] {
  const parts = input.split(/[^a-zA-Z]+/).filter(Boolean);
  const tokens: string[] = [];
  for (const part of parts) {
    let current = "";
    for (let i = 0; i < part.length; i++) {
      const c = part[i];
      const prev = i > 0 ? part[i - 1] : "";
      if (i > 0 && /[a-z]/.test(prev) && /[A-Z]/.test(c)) {
        if (current) tokens.push(current);
        current = c;
      } else {
        current += c;
      }
    }
    if (current) tokens.push(current);
  }
  return tokens;
}
```

```typescript
// src/lib/usernameSuggestor.ts
export function suggestUsernames(base: string, count: number): string[] {
  const stripped = base.replace(/\d+$/, "");
  const used = new Set<string>();
  const out: string[] = [];
  while (out.length < count) {
    const n = Math.floor(Math.random() * 99) + 1;
    const candidate = `${stripped}${n}`;
    if (!used.has(candidate)) {
      used.add(candidate);
      out.push(candidate);
    }
  }
  return out;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- src/lib/profanity.test.ts src/lib/usernameSuggestor.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/profanity.ts src/lib/usernameSuggestor.ts src/lib/profanity.test.ts src/lib/usernameSuggestor.test.ts
git commit -m "feat: port profanity filter and username suggestor"
```

---

### Task 5: Port `mockBackend.ts` (auth-only, age_band renamed)

**Files:**
- Create: `src/services/mockBackend.ts`, `src/services/mockBackend.test.ts`

**Interfaces:**
- Consumes: `containsProfanity` (Task 4); `Profile`, `SignupArgs`, `SignupResult`, `LoginResult` (Task 3's `src/services/authTypes.ts` — the canonical source, not redefined here).
- Produces: `class MockBackendError extends Error { code: string }`, `mockBackend: { reset(), checkUsernameAvailable(username), signup(args), login(username, pin), recoverPin(username, recoveryCode, newPin) }`.

**Note:** the reference's `mockBackend.ts` also has quiz-specific methods (`logAnswered`, `recordQuiz`, `getProgress`, etc.) tied to tables this app doesn't have (`answered_questions`, `quiz_history`, `module_progress`). This port includes **only** the auth-relevant subset — Plan 3 will define its own methods for this app's actual gameplay tables (`progress`/`mission_completions`/`earned_badges`), not a port of these.

- [ ] **Step 1: Write the failing tests**

```typescript
// src/services/mockBackend.test.ts
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- src/services/mockBackend.test.ts`
Expected: FAIL — cannot resolve `./mockBackend`.

- [ ] **Step 3: Implement (ported from `dieontime/kids-quiz-claude`'s `src/services/mockBackend.ts`, trimmed to auth-only, `age_band` renamed)**

```typescript
// src/services/mockBackend.ts
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- src/services/mockBackend.test.ts`
Expected: PASS (13 tests). This suite legitimately takes longer than earlier ones (real SHA-256 hashing per call, plus a 5-iteration lockout test) — that's expected, not a hang.

- [ ] **Step 5: Commit**

```bash
git add src/services/mockBackend.ts src/services/mockBackend.test.ts
git commit -m "feat: port mock auth backend (age_band renamed, auth-only)"
```

---

### Task 6: Port `backend.ts` and `supabaseBackend.ts` (auth-only)

**Files:**
- Create: `src/services/backend.ts`, `src/services/supabaseBackend.ts`, `src/services/supabaseBackend.test.ts`

**Interfaces:**
- Consumes: `Profile`, `SignupArgs`, `SignupResult`, `LoginResult`, `MockBackendError` (Task 5); `@supabase/supabase-js`'s `createClient` (Task 1).
- Produces: `backend: { checkUsernameAvailable, signup, login, recoverPin }` (an alias for `mockBackend` or `supabaseBackend` depending on env vars), `backendKind: "supabase" | "mock"`, `supabaseBackend` (same shape, real RPC calls).

**Note:** the reference's `supabaseBackend.ts` also has quiz-specific methods tied to tables this app doesn't have — this port includes only `checkUsernameAvailable`, `signup`, `login`, `recoverPin`, and the `mapError`/`client()` helpers they need.

- [ ] **Step 1: Write the failing test**

```typescript
// src/services/supabaseBackend.test.ts
import { MockBackendError } from "./mockBackend";
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/services/supabaseBackend.test.ts`
Expected: FAIL — cannot resolve `./supabaseBackend`.

- [ ] **Step 3: Implement**

```typescript
// src/services/supabaseBackend.ts
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
```

```typescript
// src/services/backend.ts
import { mockBackend } from "./mockBackend";
import { supabaseBackend } from "./supabaseBackend";

const HAS_SUPABASE_CONFIG = Boolean(
  import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY,
);

export const backend = HAS_SUPABASE_CONFIG ? supabaseBackend : mockBackend;
export const backendKind: "supabase" | "mock" = HAS_SUPABASE_CONFIG ? "supabase" : "mock";
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/services/supabaseBackend.test.ts`
Expected: PASS (9 tests).

- [ ] **Step 5: Commit**

```bash
git add src/services/backend.ts src/services/supabaseBackend.ts src/services/supabaseBackend.test.ts
git commit -m "feat: port real and mock/supabase backend switch (auth-only)"
```

---

### Task 7: Port `auth.ts` (adapted to `useAuthStore`)

**Files:**
- Create: `src/lib/auth.ts`, `src/lib/auth.test.ts`

**Interfaces:**
- Consumes: `backend` (Task 6); `useAuthStore` (Task 3); `Profile`, `SignupArgs` (Task 5).
- Produces: `signup(args: SignupArgs): Promise<{ profile: Profile; recoveryCode: string }>`, `login(username: string, pin: string[]): Promise<Profile>`, `recoverPin(username: string, recoveryCode: string, newPin: string[]): Promise<{ recoveryCode: string }>`, `checkUsernameAvailable(username: string): Promise<boolean>`.

**Adaptation from the reference:** the original calls `useProfileStore.getState().login(token, profile)` (a router-based session store this app doesn't have). This port calls `useAuthStore.getState().login(token, profile)` instead — same call shape, this app's own store.

- [ ] **Step 1: Write the failing test**

```typescript
// src/lib/auth.test.ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/lib/auth.test.ts`
Expected: FAIL — cannot resolve `./auth`.

- [ ] **Step 3: Implement**

```typescript
// src/lib/auth.ts
import type { Profile, SignupArgs } from "@/services/mockBackend";
import { backend } from "@/services/backend";
import { useAuthStore } from "@/store/authStore";

export type { Profile, SignupArgs };

export async function signup(args: SignupArgs): Promise<{ profile: Profile; recoveryCode: string }> {
  const { profile, token, recoveryCode } = await backend.signup(args);
  useAuthStore.getState().login(token, profile);
  return { profile, recoveryCode };
}

export async function login(username: string, pin: string[]): Promise<Profile> {
  const { profile, token } = await backend.login(username, pin);
  useAuthStore.getState().login(token, profile);
  return profile;
}

export async function recoverPin(
  username: string,
  recoveryCode: string,
  newPin: string[],
): Promise<{ recoveryCode: string }> {
  return backend.recoverPin(username, recoveryCode, newPin);
}

export async function checkUsernameAvailable(username: string): Promise<boolean> {
  return backend.checkUsernameAvailable(username);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/lib/auth.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/auth.ts src/lib/auth.test.ts
git commit -m "feat: port auth facade wired to useAuthStore"
```

---

### Task 8: Grid-layout test helper (shared by Tasks 9 and 10)

**Files:**
- Create: `src/testUtils/mockGridLayout.ts`

**Interfaces:**
- Consumes: nothing (pure test utility, uses `vi` from Vitest globals).
- Produces: `mockGridLayout(getIndex: (el: Element) => number | null, cols: number): () => void` — installs a `getBoundingClientRect` mock on `Element.prototype` that returns a computed grid position for elements `getIndex` resolves to a number, and returns the *real* rect otherwise. Returns a restore function.

**Why this exists:** jsdom does not run a real layout engine — every element's `getBoundingClientRect()` returns all-zero by default. The spatial-nav library's arrow-key navigation is geometric (computed from real on-screen positions), so testing genuine grid adjacency requires faking realistic positions. Installing the mock on `Element.prototype` *before* rendering (not on individual nodes after) ensures it's in place regardless of whether the library measures at mount-time or at arrow-press-time.

- [ ] **Step 1: Implement directly (no separate TDD cycle — this is test infrastructure, not app behavior; it's exercised indirectly by Tasks 9-10's own tests)**

```typescript
// src/testUtils/mockGridLayout.ts
export function mockGridLayout(getIndex: (el: Element) => number | null, cols: number, cellSize = 100): () => void {
  const original = Element.prototype.getBoundingClientRect;
  const spy = vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(function (this: Element) {
    const index = getIndex(this);
    if (index === null) return original.call(this);
    const row = Math.floor(index / cols);
    const col = index % cols;
    const left = col * cellSize;
    const top = row * cellSize;
    return {
      left, top, right: left + cellSize, bottom: top + cellSize,
      width: cellSize, height: cellSize, x: left, y: top,
      toJSON() { return this; },
    } as DOMRect;
  });
  return () => spy.mockRestore();
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: clean (no test yet exercises this directly — Tasks 9 and 10 do).

- [ ] **Step 3: Commit**

```bash
git add src/testUtils/mockGridLayout.ts
git commit -m "test: add grid-layout mock helper for spatial-nav tests"
```

---

### Task 9: Port `EmojiPinKeypad` (adapted for D-pad)

**Files:**
- Create: `src/components/EmojiPinKeypad.tsx`, `src/components/EmojiPinKeypad.test.tsx`

**Interfaces:**
- Consumes: `FocusableButton` (Plan 1 Task 4); `initNavigation` (Plan 1 Task 4); `mockGridLayout` (Task 8).
- Produces: `PIN_ICONS` (12-emoji tuple), `type PinIcon`, `PIN_LENGTH = 4`, `EmojiPinKeypad({ onComplete: (pin: PinIcon[]) => void })`.

**Adaptations from the reference:** `framer-motion`'s `motion.button`/`whileTap` dropped (deferred to the visual-design pass); each button becomes a `FocusableButton`; the first emoji gets `autoFocus` (the reference has no D-pad concept, so no default focus target existed).

- [ ] **Step 1: Write the failing tests**

```tsx
// src/components/EmojiPinKeypad.test.tsx
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { EmojiPinKeypad, PIN_ICONS } from "./EmojiPinKeypad";
import { initNavigation } from "@/navigation/initNavigation";
import { mockGridLayout } from "@/testUtils/mockGridLayout";

beforeAll(() => initNavigation());

describe("EmojiPinKeypad", () => {
  it("renders all 12 emoji plus Clear and Done", () => {
    render(<EmojiPinKeypad onComplete={() => {}} />);
    for (const icon of PIN_ICONS) {
      expect(screen.getByRole("button", { name: icon })).toBeInTheDocument();
    }
    expect(screen.getByRole("button", { name: /clear/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /done/i })).toBeInTheDocument();
  });

  it("completes with the 4 tapped icons in order", async () => {
    const user = userEvent.setup();
    const onComplete = vi.fn();
    render(<EmojiPinKeypad onComplete={onComplete} />);
    await user.click(screen.getByRole("button", { name: PIN_ICONS[0] }));
    await user.click(screen.getByRole("button", { name: PIN_ICONS[1] }));
    await user.click(screen.getByRole("button", { name: PIN_ICONS[2] }));
    await user.click(screen.getByRole("button", { name: PIN_ICONS[3] }));
    await user.click(screen.getByRole("button", { name: /done/i }));
    expect(onComplete).toHaveBeenCalledWith([PIN_ICONS[0], PIN_ICONS[1], PIN_ICONS[2], PIN_ICONS[3]]);
  });

  it("ignores a 5th tap once 4 icons are entered", async () => {
    const user = userEvent.setup();
    const onComplete = vi.fn();
    render(<EmojiPinKeypad onComplete={onComplete} />);
    for (let i = 0; i < 5; i++) await user.click(screen.getByRole("button", { name: PIN_ICONS[i % PIN_ICONS.length] }));
    await user.click(screen.getByRole("button", { name: /done/i }));
    expect(onComplete).toHaveBeenCalledWith([PIN_ICONS[0], PIN_ICONS[1], PIN_ICONS[2], PIN_ICONS[3]]);
  });

  it("Clear resets the entered pin", async () => {
    const user = userEvent.setup();
    const onComplete = vi.fn();
    render(<EmojiPinKeypad onComplete={onComplete} />);
    await user.click(screen.getByRole("button", { name: PIN_ICONS[0] }));
    await user.click(screen.getByRole("button", { name: /clear/i }));
    await user.click(screen.getByRole("button", { name: PIN_ICONS[1] }));
    await user.click(screen.getByRole("button", { name: PIN_ICONS[2] }));
    await user.click(screen.getByRole("button", { name: PIN_ICONS[3] }));
    await user.click(screen.getByRole("button", { name: PIN_ICONS[0] }));
    await user.click(screen.getByRole("button", { name: /done/i }));
    expect(onComplete).toHaveBeenCalledWith([PIN_ICONS[1], PIN_ICONS[2], PIN_ICONS[3], PIN_ICONS[0]]);
  });

  it("Done does nothing until 4 icons are entered", async () => {
    const user = userEvent.setup();
    const onComplete = vi.fn();
    render(<EmojiPinKeypad onComplete={onComplete} />);
    await user.click(screen.getByRole("button", { name: PIN_ICONS[0] }));
    await user.click(screen.getByRole("button", { name: /done/i }));
    expect(onComplete).not.toHaveBeenCalled();
  });

  it("puts D-pad focus on the first icon by default", async () => {
    render(<EmojiPinKeypad onComplete={() => {}} />);
    await waitFor(() => expect(screen.getByRole("button", { name: PIN_ICONS[0] })).toHaveAttribute("data-focused", "true"));
  });

  it("ArrowRight moves D-pad focus to the geometrically-next icon in the grid", async () => {
    const restore = mockGridLayout((el) => {
      const label = el.getAttribute?.("aria-label") ?? el.textContent;
      const index = PIN_ICONS.findIndex((icon) => icon === label);
      return index === -1 ? null : index;
    }, 4);

    render(<EmojiPinKeypad onComplete={() => {}} />);
    await waitFor(() => expect(screen.getByRole("button", { name: PIN_ICONS[0] })).toHaveAttribute("data-focused", "true"));

    fireEvent.keyDown(window, { keyCode: 39, code: "ArrowRight", key: "ArrowRight" });

    await waitFor(() => expect(screen.getByRole("button", { name: PIN_ICONS[1] })).toHaveAttribute("data-focused", "true"));
    expect(screen.getByRole("button", { name: PIN_ICONS[0] })).toHaveAttribute("data-focused", "false");

    restore();
  });
});
```

Note: the `getIndex` lookup in the arrow-key test matches by `aria-label` first, falling back to `textContent` — a `FocusableButton`'s rendered text *is* the emoji character, so `el.textContent` naturally equals `PIN_ICONS[i]` for each icon button, giving each a distinct grid index automatically; Clear/Done fall through to `null` (real, zeroed rect — irrelevant to this specific assertion).

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- src/components/EmojiPinKeypad.test.tsx`
Expected: FAIL — cannot resolve `./EmojiPinKeypad`.

- [ ] **Step 3: Implement**

```tsx
// src/components/EmojiPinKeypad.tsx
import { useState } from "react";
import { FocusableButton } from "@/components/FocusableButton";

export const PIN_ICONS = ["🐱", "🐶", "🐰", "🐼", "⚡", "🌈", "🌟", "🌙", "🍕", "🍔", "🍩", "🍎"] as const;
export type PinIcon = (typeof PIN_ICONS)[number];
export const PIN_LENGTH = 4;

interface Props {
  onComplete: (pin: PinIcon[]) => void;
}

export function EmojiPinKeypad({ onComplete }: Props) {
  const [entered, setEntered] = useState<PinIcon[]>([]);

  const tap = (icon: PinIcon) => {
    if (entered.length >= PIN_LENGTH) return;
    setEntered([...entered, icon]);
  };

  const clear = () => setEntered([]);
  const done = () => {
    if (entered.length === PIN_LENGTH) onComplete(entered);
  };

  return (
    <div>
      <div role="group" aria-label="pin icons">
        {PIN_ICONS.map((icon, index) => (
          <FocusableButton key={icon} focusKey={`pin-icon-${icon}`} autoFocus={index === 0} onPress={() => tap(icon)}>
            {icon}
          </FocusableButton>
        ))}
      </div>
      <div aria-label="entered pin">
        {Array.from({ length: PIN_LENGTH }).map((_, i) => (
          <span key={i}>{entered[i] ?? ""}</span>
        ))}
      </div>
      <div>
        <FocusableButton onPress={clear}>Clear</FocusableButton>
        <FocusableButton onPress={done}>Done</FocusableButton>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- src/components/EmojiPinKeypad.test.tsx`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/EmojiPinKeypad.tsx src/components/EmojiPinKeypad.test.tsx
git commit -m "feat: port EmojiPinKeypad with D-pad grid navigation"
```

---

### Task 10: Port `AvatarPicker` (adapted for D-pad)

**Files:**
- Create: `src/components/AvatarPicker.tsx`, `src/components/AvatarPicker.test.tsx`

**Interfaces:**
- Consumes: `FocusableButton`, `initNavigation` (Plan 1 Task 4); `mockGridLayout` (Task 8).
- Produces: `AVATARS` (12-avatar tuple), `type AvatarId`, `AVATAR_EMOJI: Record<AvatarId, string>`, `avatarEmoji(id: string | null | undefined): string`, `AvatarPicker({ onPick: (a: AvatarId) => void; selected?: AvatarId })`.

**Adaptations from the reference:** `framer-motion` dropped (`whileTap`/`whileHover` — the latter is meaningless with no pointer); each avatar becomes a `FocusableButton`, first one `autoFocus`. The `selected === a` ring-highlight styling is visual-only and deferred to the design pass, but the underlying `selected` prop and comparison logic are kept (it's just not styled yet).

- [ ] **Step 1: Write the failing tests**

```tsx
// src/components/AvatarPicker.test.tsx
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AvatarPicker, AVATARS, AVATAR_EMOJI, avatarEmoji } from "./AvatarPicker";
import { initNavigation } from "@/navigation/initNavigation";
import { mockGridLayout } from "@/testUtils/mockGridLayout";

beforeAll(() => initNavigation());

describe("AvatarPicker", () => {
  it("renders all 12 avatars", () => {
    render(<AvatarPicker onPick={() => {}} />);
    for (const id of AVATARS) {
      expect(screen.getByRole("button", { name: AVATAR_EMOJI[id] })).toBeInTheDocument();
    }
  });

  it("calls onPick with the chosen avatar id", async () => {
    const user = userEvent.setup();
    const onPick = vi.fn();
    render(<AvatarPicker onPick={onPick} />);
    await user.click(screen.getByRole("button", { name: AVATAR_EMOJI[AVATARS[2]] }));
    expect(onPick).toHaveBeenCalledWith(AVATARS[2]);
  });

  it("puts D-pad focus on the first avatar by default", async () => {
    render(<AvatarPicker onPick={() => {}} />);
    await waitFor(() => expect(screen.getByRole("button", { name: AVATAR_EMOJI[AVATARS[0]] })).toHaveAttribute("data-focused", "true"));
  });

  it("ArrowDown moves D-pad focus to the avatar directly below in the grid", async () => {
    const restore = mockGridLayout((el) => {
      const label = el.textContent;
      const index = AVATARS.findIndex((id) => AVATAR_EMOJI[id] === label);
      return index === -1 ? null : index;
    }, 4);

    render(<AvatarPicker onPick={() => {}} />);
    await waitFor(() => expect(screen.getByRole("button", { name: AVATAR_EMOJI[AVATARS[0]] })).toHaveAttribute("data-focused", "true"));

    fireEvent.keyDown(window, { keyCode: 40, code: "ArrowDown", key: "ArrowDown" });

    await waitFor(() => expect(screen.getByRole("button", { name: AVATAR_EMOJI[AVATARS[4]] })).toHaveAttribute("data-focused", "true"));

    restore();
  });
});

describe("avatarEmoji", () => {
  it("returns the emoji for a known avatar id", () => {
    expect(avatarEmoji(AVATARS[0])).toBe(AVATAR_EMOJI[AVATARS[0]]);
  });

  it("returns a placeholder for null/undefined/unknown", () => {
    expect(avatarEmoji(null)).toBe("👤");
    expect(avatarEmoji(undefined)).toBe("👤");
    expect(avatarEmoji("not-a-real-avatar")).toBe("👤");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- src/components/AvatarPicker.test.tsx`
Expected: FAIL — cannot resolve `./AvatarPicker`.

- [ ] **Step 3: Implement**

```tsx
// src/components/AvatarPicker.tsx
import { FocusableButton } from "@/components/FocusableButton";

export const AVATARS = [
  "avatar_cat", "avatar_dog", "avatar_fox", "avatar_owl",
  "avatar_robot", "avatar_unicorn", "avatar_dragon", "avatar_dino",
  "avatar_panda", "avatar_lion", "avatar_bear", "avatar_frog",
] as const;

export type AvatarId = (typeof AVATARS)[number];

export const AVATAR_EMOJI: Record<AvatarId, string> = {
  avatar_cat: "🐱", avatar_dog: "🐶", avatar_fox: "🦊", avatar_owl: "🦉",
  avatar_robot: "🤖", avatar_unicorn: "🦄", avatar_dragon: "🐲", avatar_dino: "🦖",
  avatar_panda: "🐼", avatar_lion: "🦁", avatar_bear: "🐻", avatar_frog: "🐸",
};

export function avatarEmoji(id: string | null | undefined): string {
  if (!id) return "👤";
  return (AVATAR_EMOJI as Record<string, string>)[id] ?? "👤";
}

interface Props {
  onPick: (a: AvatarId) => void;
  selected?: AvatarId;
}

export function AvatarPicker({ onPick, selected }: Props) {
  return (
    <div role="group" aria-label="avatars">
      {AVATARS.map((a, index) => (
        <FocusableButton key={a} focusKey={`avatar-${a}`} autoFocus={index === 0} onPress={() => onPick(a)}>
          {AVATAR_EMOJI[a]}
        </FocusableButton>
      ))}
    </div>
  );
}
```

Note: `selected` is accepted for API compatibility with the reference and Task 12's `SignupWizard` usage, but has no visual treatment yet (deferred to the design pass) — it's not read inside this component body, which is intentional for now, not a bug.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- src/components/AvatarPicker.test.tsx`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/AvatarPicker.tsx src/components/AvatarPicker.test.tsx
git commit -m "feat: port AvatarPicker with D-pad grid navigation"
```

---

### Task 11: Port `SignupWizard` (adapted: no router, no PlayfulBackground, FocusableButton, age_band renamed)

**Files:**
- Create: `src/screens/SignupWizard.tsx`, `src/screens/SignupWizard.test.tsx`

**Interfaces:**
- Consumes: `EmojiPinKeypad`, `PinIcon` (Task 9); `AvatarPicker`, `AvatarId` (Task 10); `containsProfanity` (Task 4); `suggestUsernames` (Task 4); `signup`, `checkUsernameAvailable` (Task 7); `FocusableButton` (Plan 1 Task 4); `useAuthStore` (Task 3).
- Produces: `SignupWizard()` — a 5-step flow (username → pin → avatar → band → recovery) rendered as its own screen component, with no props.

**Adaptation — recovery-code timing (important):** `signup()` sets `useAuthStore`'s `activeProfile`/`token` as soon as it resolves (matching the reference), but must **not** hand off to the main app until the parent has seen and dismissed the recovery code. This is why `completeAuthFlow()` is a separate, explicit action (Task 3) — `App.tsx` (Task 14) gates on `authScreen === null`, not on `activeProfile !== null`, specifically so this screen can keep rendering the recovery-code step even after `signup()` has already logged the profile in.

- [ ] **Step 1: Write the failing tests**

```tsx
// src/screens/SignupWizard.test.tsx
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SignupWizard } from "./SignupWizard";
import { PIN_ICONS } from "@/components/EmojiPinKeypad";
import { AVATARS, AVATAR_EMOJI } from "@/components/AvatarPicker";
import { useAuthStore } from "@/store/authStore";
import { mockBackend } from "@/services/mockBackend";
import { initNavigation } from "@/navigation/initNavigation";

beforeAll(() => initNavigation());
beforeEach(() => {
  mockBackend.reset();
  useAuthStore.getState().logout();
  useAuthStore.getState().setAuthScreen("signup");
});

async function fillUsernameStep(user: ReturnType<typeof userEvent.setup>, name: string) {
  await user.type(screen.getByPlaceholderText(/silly name/i), name);
  await user.click(screen.getByRole("button", { name: /next/i }));
}

async function fillPinStep(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: PIN_ICONS[0] }));
  await user.click(screen.getByRole("button", { name: PIN_ICONS[1] }));
  await user.click(screen.getByRole("button", { name: PIN_ICONS[2] }));
  await user.click(screen.getByRole("button", { name: PIN_ICONS[3] }));
  await user.click(screen.getByRole("button", { name: /done/i }));
}

describe("SignupWizard", () => {
  it("walks through username -> pin -> avatar -> band -> recovery and logs the profile in", async () => {
    const user = userEvent.setup();
    render(<SignupWizard />);

    await fillUsernameStep(user, "SpeedyOtter");
    await fillPinStep(user);
    await waitFor(() => expect(screen.getByRole("button", { name: AVATAR_EMOJI[AVATARS[0]] })).toBeInTheDocument());
    await user.click(screen.getByRole("button", { name: AVATAR_EMOJI[AVATARS[0]] }));
    await user.click(screen.getByRole("button", { name: /next/i }));

    await waitFor(() => expect(screen.getByRole("button", { name: "3-5" })).toBeInTheDocument());
    await user.click(screen.getByRole("button", { name: "6-8" }));

    await waitFor(() => expect(screen.getByText(/save this code/i)).toBeInTheDocument());
    expect(useAuthStore.getState().activeProfile?.username).toBe("SpeedyOtter");
    expect(useAuthStore.getState().activeProfile?.age_band).toBe("6-8");

    // authScreen must NOT have advanced past 'signup' yet — the parent hasn't dismissed the code.
    expect(useAuthStore.getState().authScreen).toBe("signup");

    await user.click(screen.getByRole("button", { name: /ok, got it/i }));
    expect(useAuthStore.getState().authScreen).toBeNull();
  });

  it("shows an error and suggestions when the username is taken", async () => {
    await mockBackend.signup({ username: "SpeedyOtter", pin: ["🐱", "⚡", "🍕", "🌈"], avatar: "avatar_cat", age_band: "6-8" });
    const user = userEvent.setup();
    render(<SignupWizard />);
    await fillUsernameStep(user, "SpeedyOtter");
    expect(await screen.findByText(/already taken/i)).toBeInTheDocument();
  });

  it("shows an error for a profane username", async () => {
    const user = userEvent.setup();
    render(<SignupWizard />);
    await fillUsernameStep(user, "SuperHellBoy");
    expect(await screen.findByText(/try another name/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- src/screens/SignupWizard.test.tsx`
Expected: FAIL — cannot resolve `./SignupWizard`.

- [ ] **Step 3: Implement**

```tsx
// src/screens/SignupWizard.tsx
import { useState } from "react";
import { EmojiPinKeypad, type PinIcon } from "@/components/EmojiPinKeypad";
import { AvatarPicker, type AvatarId } from "@/components/AvatarPicker";
import { containsProfanity } from "@/lib/profanity";
import { suggestUsernames } from "@/lib/usernameSuggestor";
import { signup, checkUsernameAvailable } from "@/lib/auth";
import { FocusableButton } from "@/components/FocusableButton";
import { useAuthStore } from "@/store/authStore";

type Step = "username" | "pin" | "avatar" | "band" | "recovery";

export function SignupWizard() {
  const completeAuthFlow = useAuthStore((s) => s.completeAuthFlow);
  const [step, setStep] = useState<Step>("username");
  const [username, setUsername] = useState("");
  const [usernameError, setUsernameError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [pin, setPin] = useState<PinIcon[]>([]);
  const [avatar, setAvatar] = useState<AvatarId | null>(null);
  const [recoveryCode, setRecoveryCode] = useState<string | null>(null);

  const goUsername = async () => {
    if (username.length < 3) {
      setUsernameError("Pick at least 3 letters");
      return;
    }
    if (containsProfanity(username)) {
      setUsernameError("Try another name");
      setSuggestions(suggestUsernames(username, 3));
      return;
    }
    const ok = await checkUsernameAvailable(username);
    if (!ok) {
      setUsernameError("That name is already taken");
      setSuggestions(suggestUsernames(username, 3));
      return;
    }
    setUsernameError(null);
    setSuggestions([]);
    setStep("pin");
  };

  const goPinDone = (icons: PinIcon[]) => {
    setPin(icons);
    setStep("avatar");
  };

  const goAvatar = () => {
    if (avatar) setStep("band");
  };

  const goBand = async (band: "3-5" | "6-8") => {
    if (!avatar) return;
    const result = await signup({ username, pin, avatar, age_band: band });
    setRecoveryCode(result.recoveryCode);
    setStep("recovery");
  };

  if (step === "recovery" && recoveryCode) {
    return (
      <div>
        <h2>Save this code!</h2>
        <p>Show it to a parent. If you forget your PIN, this gets you back in.</p>
        <div>{recoveryCode}</div>
        <FocusableButton autoFocus onPress={completeAuthFlow}>OK, got it</FocusableButton>
      </div>
    );
  }

  return (
    <div>
      {step === "username" && (
        <>
          <h2>Pick a silly name!</h2>
          <input
            placeholder="Your silly name"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
          {usernameError && <p>{usernameError}</p>}
          {suggestions.length > 0 && (
            <div>
              {suggestions.map((s) => (
                <FocusableButton key={s} onPress={() => { setUsername(s); setSuggestions([]); setUsernameError(null); }}>
                  {s}
                </FocusableButton>
              ))}
            </div>
          )}
          <FocusableButton autoFocus onPress={goUsername}>Next</FocusableButton>
        </>
      )}
      {step === "pin" && (
        <>
          <h2>Pick 4 icons for your PIN</h2>
          <EmojiPinKeypad onComplete={goPinDone} />
        </>
      )}
      {step === "avatar" && (
        <>
          <h2>Pick your face!</h2>
          <AvatarPicker onPick={setAvatar} selected={avatar ?? undefined} />
          <FocusableButton focusKey="avatar-next" onPress={goAvatar}>Next</FocusableButton>
        </>
      )}
      {step === "band" && (
        <>
          <h2>How old are you?</h2>
          <div>
            <FocusableButton autoFocus onPress={() => goBand("3-5")}>3-5</FocusableButton>
            <FocusableButton onPress={() => goBand("6-8")}>6-8</FocusableButton>
          </div>
        </>
      )}
    </div>
  );
}
```

Note: the "Next" button on the avatar step deliberately does **not** carry `autoFocus` (an avatar option already has it, matching Task 10's default) — giving two `autoFocus` elements on the same screen is undefined behavior for the spatial-nav library. Same reasoning applies throughout: exactly one `autoFocus` per rendered step.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- src/screens/SignupWizard.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/screens/SignupWizard.tsx src/screens/SignupWizard.test.tsx
git commit -m "feat: port SignupWizard (no router, FocusableButton, age_band renamed)"
```

---

### Task 12: Port `LoginScreen` (adapted: no router, no PlayfulBackground, FocusableButton nav)

**Files:**
- Create: `src/screens/LoginScreen.tsx`, `src/screens/LoginScreen.test.tsx`

**Interfaces:**
- Consumes: `EmojiPinKeypad`, `PinIcon` (Task 9); `login` (Task 7); `FocusableButton` (Plan 1 Task 4); `useAuthStore` (Task 3).
- Produces: `LoginScreen()` — no props.

**Adaptation:** `useNavigate()`/`nav('/dashboard')` is replaced with `useAuthStore`'s `completeAuthFlow()`. The reference's `<Link to="/signup">`/`<Link to="/recovery">` text links become `FocusableButton`s calling `setAuthScreen("signup")`/`setAuthScreen("recovery")` — they're navigation actions and must be D-pad focusable, not just styled to look like links.

- [ ] **Step 1: Write the failing tests**

```tsx
// src/screens/LoginScreen.test.tsx
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LoginScreen } from "./LoginScreen";
import { PIN_ICONS } from "@/components/EmojiPinKeypad";
import { useAuthStore } from "@/store/authStore";
import { mockBackend } from "@/services/mockBackend";
import { initNavigation } from "@/navigation/initNavigation";

beforeAll(() => initNavigation());
beforeEach(async () => {
  mockBackend.reset();
  useAuthStore.getState().logout();
  await mockBackend.signup({ username: "SpeedyOtter", pin: ["🐱", "⚡", "🍕", "🌈"], avatar: "avatar_cat", age_band: "6-8" });
});

describe("LoginScreen", () => {
  it("does not show the PIN pad until at least 3 characters are typed", async () => {
    const user = userEvent.setup();
    render(<LoginScreen />);
    expect(screen.queryByRole("button", { name: PIN_ICONS[0] })).not.toBeInTheDocument();
    await user.type(screen.getByPlaceholderText(/silly name/i), "Sp");
    expect(screen.queryByRole("button", { name: PIN_ICONS[0] })).not.toBeInTheDocument();
    await user.type(screen.getByPlaceholderText(/silly name/i), "e");
    expect(screen.getByRole("button", { name: PIN_ICONS[0] })).toBeInTheDocument();
  });

  it("logs in with the correct username and PIN, completing the auth flow", async () => {
    const user = userEvent.setup();
    render(<LoginScreen />);
    await user.type(screen.getByPlaceholderText(/silly name/i), "SpeedyOtter");
    await user.click(screen.getByRole("button", { name: PIN_ICONS[0] }));
    await user.click(screen.getByRole("button", { name: PIN_ICONS[1] }));
    await user.click(screen.getByRole("button", { name: PIN_ICONS[2] }));
    await user.click(screen.getByRole("button", { name: PIN_ICONS[3] }));
    await user.click(screen.getByRole("button", { name: /done/i }));
    await waitFor(() => expect(useAuthStore.getState().authScreen).toBeNull());
    expect(useAuthStore.getState().activeProfile?.username).toBe("SpeedyOtter");
  });

  it("shows an error on the wrong PIN and does not complete the auth flow", async () => {
    const user = userEvent.setup();
    render(<LoginScreen />);
    await user.type(screen.getByPlaceholderText(/silly name/i), "SpeedyOtter");
    await user.click(screen.getByRole("button", { name: PIN_ICONS[4] }));
    await user.click(screen.getByRole("button", { name: PIN_ICONS[5] }));
    await user.click(screen.getByRole("button", { name: PIN_ICONS[6] }));
    await user.click(screen.getByRole("button", { name: PIN_ICONS[7] }));
    await user.click(screen.getByRole("button", { name: /done/i }));
    expect(await screen.findByText(/invalid username or pin/i)).toBeInTheDocument();
    expect(useAuthStore.getState().authScreen).toBe("login");
  });

  it("'Make a new player' navigates to signup", async () => {
    const user = userEvent.setup();
    render(<LoginScreen />);
    await user.click(screen.getByRole("button", { name: /make a new player/i }));
    expect(useAuthStore.getState().authScreen).toBe("signup");
  });

  it("'Forgot PIN?' navigates to recovery", async () => {
    const user = userEvent.setup();
    render(<LoginScreen />);
    await user.click(screen.getByRole("button", { name: /forgot pin/i }));
    expect(useAuthStore.getState().authScreen).toBe("recovery");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- src/screens/LoginScreen.test.tsx`
Expected: FAIL — cannot resolve `./LoginScreen`.

- [ ] **Step 3: Implement**

```tsx
// src/screens/LoginScreen.tsx
import { useState } from "react";
import { EmojiPinKeypad, type PinIcon } from "@/components/EmojiPinKeypad";
import { login } from "@/lib/auth";
import { FocusableButton } from "@/components/FocusableButton";
import { useAuthStore } from "@/store/authStore";

export function LoginScreen() {
  const completeAuthFlow = useAuthStore((s) => s.completeAuthFlow);
  const setAuthScreen = useAuthStore((s) => s.setAuthScreen);
  const [username, setUsername] = useState("");
  const [error, setError] = useState<string | null>(null);

  const onPinDone = async (pin: PinIcon[]) => {
    try {
      await login(username, pin);
      completeAuthFlow();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    }
  };

  return (
    <div>
      <h1>Welcome back!</h1>
      <input
        placeholder="Your silly name"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
      />
      {username.length >= 3 && <EmojiPinKeypad onComplete={onPinDone} />}
      {error && <p>{error}</p>}
      <div>
        <FocusableButton onPress={() => setAuthScreen("signup")}>Make a new player</FocusableButton>
        <FocusableButton onPress={() => setAuthScreen("recovery")}>Forgot PIN?</FocusableButton>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- src/screens/LoginScreen.test.tsx`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/screens/LoginScreen.tsx src/screens/LoginScreen.test.tsx
git commit -m "feat: port LoginScreen (no router, FocusableButton nav)"
```

---

### Task 13: Port `RecoveryScreen` (adapted: no router, no PlayfulBackground, FocusableButton)

**Files:**
- Create: `src/screens/RecoveryScreen.tsx`, `src/screens/RecoveryScreen.test.tsx`

**Interfaces:**
- Consumes: `EmojiPinKeypad`, `PinIcon` (Task 9); `recoverPin` (Task 7); `FocusableButton` (Plan 1 Task 4); `useAuthStore` (Task 3).
- Produces: `RecoveryScreen()` — no props.

**Adaptation:** recovery never sets `activeProfile` (matches the reference — `recoverPin()` only rotates credentials, it doesn't log anyone in). The final "OK, log in" button calls `useAuthStore`'s `setAuthScreen("login")` (not `completeAuthFlow`), sending the parent back to re-authenticate with the new PIN — exactly the reference's own `nav('/login')` behavior, just without a router.

- [ ] **Step 1: Write the failing tests**

```tsx
// src/screens/RecoveryScreen.test.tsx
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RecoveryScreen } from "./RecoveryScreen";
import { PIN_ICONS } from "@/components/EmojiPinKeypad";
import { useAuthStore } from "@/store/authStore";
import { mockBackend } from "@/services/mockBackend";
import { initNavigation } from "@/navigation/initNavigation";

beforeAll(() => initNavigation());

describe("RecoveryScreen", () => {
  let recoveryCode: string;

  beforeEach(async () => {
    mockBackend.reset();
    useAuthStore.getState().logout();
    useAuthStore.getState().setAuthScreen("recovery");
    const result = await mockBackend.signup({
      username: "SpeedyOtter", pin: ["🐱", "⚡", "🍕", "🌈"], avatar: "avatar_cat", age_band: "6-8",
    });
    recoveryCode = result.recoveryCode;
  });

  it("resets the PIN with the correct username and recovery code, then shows a new code", async () => {
    const user = userEvent.setup();
    render(<RecoveryScreen />);
    await user.type(screen.getByPlaceholderText(/silly name/i), "SpeedyOtter");
    await user.type(screen.getByPlaceholderText(/recovery code/i), recoveryCode);
    await user.click(screen.getByRole("button", { name: /next/i }));

    await waitFor(() => expect(screen.getByRole("button", { name: PIN_ICONS[0] })).toBeInTheDocument());
    await user.click(screen.getByRole("button", { name: PIN_ICONS[4] }));
    await user.click(screen.getByRole("button", { name: PIN_ICONS[5] }));
    await user.click(screen.getByRole("button", { name: PIN_ICONS[6] }));
    await user.click(screen.getByRole("button", { name: PIN_ICONS[7] }));
    await user.click(screen.getByRole("button", { name: /done/i }));

    expect(await screen.findByText(/all set/i)).toBeInTheDocument();
    expect(useAuthStore.getState().activeProfile).toBeNull();

    await user.click(screen.getByRole("button", { name: /ok, log in/i }));
    expect(useAuthStore.getState().authScreen).toBe("login");
  });

  it("shows an error and returns to the credentials step on a wrong recovery code", async () => {
    const user = userEvent.setup();
    render(<RecoveryScreen />);
    await user.type(screen.getByPlaceholderText(/silly name/i), "SpeedyOtter");
    await user.type(screen.getByPlaceholderText(/recovery code/i), "WRONG-CODE-0000");
    await user.click(screen.getByRole("button", { name: /next/i }));

    await waitFor(() => expect(screen.getByRole("button", { name: PIN_ICONS[0] })).toBeInTheDocument());
    await user.click(screen.getByRole("button", { name: PIN_ICONS[0] }));
    await user.click(screen.getByRole("button", { name: PIN_ICONS[1] }));
    await user.click(screen.getByRole("button", { name: PIN_ICONS[2] }));
    await user.click(screen.getByRole("button", { name: PIN_ICONS[3] }));
    await user.click(screen.getByRole("button", { name: /done/i }));

    expect(await screen.findByText(/incorrect/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/silly name/i)).toBeInTheDocument();
  });

  it("'Back to login' returns to the login screen without recovering", async () => {
    const user = userEvent.setup();
    render(<RecoveryScreen />);
    await user.click(screen.getByRole("button", { name: /back to login/i }));
    expect(useAuthStore.getState().authScreen).toBe("login");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- src/screens/RecoveryScreen.test.tsx`
Expected: FAIL — cannot resolve `./RecoveryScreen`.

- [ ] **Step 3: Implement**

```tsx
// src/screens/RecoveryScreen.tsx
import { useState } from "react";
import { EmojiPinKeypad, type PinIcon } from "@/components/EmojiPinKeypad";
import { recoverPin } from "@/lib/auth";
import { FocusableButton } from "@/components/FocusableButton";
import { useAuthStore } from "@/store/authStore";

type Stage = "creds" | "newpin" | "done";

export function RecoveryScreen() {
  const setAuthScreen = useAuthStore((s) => s.setAuthScreen);
  const [stage, setStage] = useState<Stage>("creds");
  const [username, setUsername] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [newRecovery, setNewRecovery] = useState<string | null>(null);

  const submitNewPin = async (pin: PinIcon[]) => {
    try {
      const result = await recoverPin(username, code, pin);
      setNewRecovery(result.recoveryCode);
      setStage("done");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Recovery failed");
      setStage("creds");
    }
  };

  if (stage === "creds") {
    return (
      <div>
        <h1>Forgot your PIN?</h1>
        <input
          placeholder="Your silly name"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />
        <input
          placeholder="Recovery code (PURPLE-FROG-1234)"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
        />
        {error && <p>{error}</p>}
        <FocusableButton autoFocus onPress={() => setStage("newpin")}>Next</FocusableButton>
        <FocusableButton onPress={() => setAuthScreen("login")}>Back to login</FocusableButton>
      </div>
    );
  }
  if (stage === "newpin") {
    return (
      <div>
        <h2>Pick a new PIN</h2>
        <EmojiPinKeypad onComplete={submitNewPin} />
        <FocusableButton onPress={() => setStage("creds")}>Back</FocusableButton>
      </div>
    );
  }
  return (
    <div>
      <h2>All set!</h2>
      <p>Your new recovery code:</p>
      <div>{newRecovery}</div>
      <p>Show this to a parent. The old code no longer works.</p>
      <FocusableButton autoFocus onPress={() => setAuthScreen("login")}>OK, log in</FocusableButton>
    </div>
  );
}
```

Note: unlike the reference (which lets `<Next>` be clicked with an empty username/code, relying on the `disabled` HTML attribute the reference's `BigButton` supports), this port's `FocusableButton` has no `disabled` prop (Plan 1 didn't need one). The "Next" button is always pressable; if `username`/`code` are empty, `recoverPin()` will simply fail with a normal `[WRONG_RECOVERY]`-mapped error, shown the same way any other recovery failure is — a safe, working behavior, not a Plan 1 gap that needs fixing here.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- src/screens/RecoveryScreen.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/screens/RecoveryScreen.tsx src/screens/RecoveryScreen.test.tsx
git commit -m "feat: port RecoveryScreen (no router, FocusableButton)"
```

---

### Task 14: Build `ProfilePicker` (new screen)

**Files:**
- Create: `src/screens/ProfilePicker.tsx`, `src/screens/ProfilePicker.test.tsx`

**Interfaces:**
- Consumes: `EmojiPinKeypad`, `PinIcon` (Task 9); `avatarEmoji` (Task 10); `getKnownProfiles`, `KnownProfile` (Task 2); `login` (Task 7); `FocusableButton` (Plan 1 Task 4); `useAuthStore` (Task 3).
- Produces: `ProfilePicker()` — no props. Not from the reference — this app's own "remembered device" convenience.

- [ ] **Step 1: Write the failing tests**

```tsx
// src/screens/ProfilePicker.test.tsx
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ProfilePicker } from "./ProfilePicker";
import { PIN_ICONS } from "@/components/EmojiPinKeypad";
import { avatarEmoji } from "@/components/AvatarPicker";
import { addKnownProfile } from "@/lib/knownProfiles";
import { useAuthStore } from "@/store/authStore";
import { mockBackend } from "@/services/mockBackend";
import { initNavigation } from "@/navigation/initNavigation";

beforeAll(() => initNavigation());
beforeEach(async () => {
  window.localStorage.clear();
  mockBackend.reset();
  useAuthStore.getState().logout();
  useAuthStore.getState().setAuthScreen("profilePicker");
  await mockBackend.signup({ username: "SpeedyOtter", pin: ["🐱", "⚡", "🍕", "🌈"], avatar: "avatar_cat", age_band: "6-8" });
  addKnownProfile({ profileId: "known-1", username: "SpeedyOtter", avatar: "avatar_cat" });
});

describe("ProfilePicker", () => {
  it("renders a focusable avatar button per known profile", () => {
    render(<ProfilePicker />);
    expect(screen.getByRole("button", { name: avatarEmoji("avatar_cat") })).toBeInTheDocument();
  });

  it("reveals the PIN pad after picking a profile, and logs in on the correct PIN", async () => {
    const user = userEvent.setup();
    render(<ProfilePicker />);
    await user.click(screen.getByRole("button", { name: avatarEmoji("avatar_cat") }));
    await waitFor(() => expect(screen.getByRole("button", { name: PIN_ICONS[0] })).toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: PIN_ICONS[0] }));
    await user.click(screen.getByRole("button", { name: PIN_ICONS[1] }));
    await user.click(screen.getByRole("button", { name: PIN_ICONS[2] }));
    await user.click(screen.getByRole("button", { name: PIN_ICONS[3] }));
    await user.click(screen.getByRole("button", { name: /done/i }));

    await waitFor(() => expect(useAuthStore.getState().authScreen).toBeNull());
    expect(useAuthStore.getState().activeProfile?.username).toBe("SpeedyOtter");
  });

  it("shows an error on the wrong PIN without completing the auth flow", async () => {
    const user = userEvent.setup();
    render(<ProfilePicker />);
    await user.click(screen.getByRole("button", { name: avatarEmoji("avatar_cat") }));
    await waitFor(() => expect(screen.getByRole("button", { name: PIN_ICONS[0] })).toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: PIN_ICONS[4] }));
    await user.click(screen.getByRole("button", { name: PIN_ICONS[5] }));
    await user.click(screen.getByRole("button", { name: PIN_ICONS[6] }));
    await user.click(screen.getByRole("button", { name: PIN_ICONS[7] }));
    await user.click(screen.getByRole("button", { name: /done/i }));

    expect(await screen.findByText(/invalid username or pin/i)).toBeInTheDocument();
    expect(useAuthStore.getState().authScreen).toBe("profilePicker");
  });

  it("'Use a different name' falls through to the full Login screen", async () => {
    const user = userEvent.setup();
    render(<ProfilePicker />);
    await user.click(screen.getByRole("button", { name: /use a different name/i }));
    expect(useAuthStore.getState().authScreen).toBe("login");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- src/screens/ProfilePicker.test.tsx`
Expected: FAIL — cannot resolve `./ProfilePicker`.

- [ ] **Step 3: Implement**

```tsx
// src/screens/ProfilePicker.tsx
import { useState } from "react";
import { EmojiPinKeypad, type PinIcon } from "@/components/EmojiPinKeypad";
import { avatarEmoji } from "@/components/AvatarPicker";
import { getKnownProfiles } from "@/lib/knownProfiles";
import { login } from "@/lib/auth";
import { FocusableButton } from "@/components/FocusableButton";
import { useAuthStore } from "@/store/authStore";

export function ProfilePicker() {
  const completeAuthFlow = useAuthStore((s) => s.completeAuthFlow);
  const setAuthScreen = useAuthStore((s) => s.setAuthScreen);
  const [pickedUsername, setPickedUsername] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const profiles = getKnownProfiles();

  const onPinDone = async (pin: PinIcon[]) => {
    if (!pickedUsername) return;
    try {
      await login(pickedUsername, pin);
      completeAuthFlow();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    }
  };

  if (pickedUsername) {
    return (
      <div>
        <h1>Hi, {pickedUsername}!</h1>
        <EmojiPinKeypad onComplete={onPinDone} />
        {error && <p>{error}</p>}
      </div>
    );
  }

  return (
    <div>
      <h1>Who's playing?</h1>
      <div role="group" aria-label="known profiles">
        {profiles.map((p, index) => (
          <FocusableButton key={p.profileId} focusKey={`profile-${p.profileId}`} autoFocus={index === 0} onPress={() => setPickedUsername(p.username)}>
            {avatarEmoji(p.avatar)}
          </FocusableButton>
        ))}
      </div>
      <FocusableButton autoFocus={profiles.length === 0} onPress={() => setAuthScreen("login")}>Use a different name</FocusableButton>
    </div>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- src/screens/ProfilePicker.test.tsx`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/screens/ProfilePicker.tsx src/screens/ProfilePicker.test.tsx
git commit -m "feat: add ProfilePicker screen (new, not from reference)"
```

---

### Task 15: Wire `App.tsx` auth gating

**Files:**
- Modify: `src/App.tsx`, `src/App.e2e.test.tsx`
- Modify: `src/lib/auth.ts` (add one line: populate the known-profiles cache on successful signup/login)

**Interfaces:**
- Consumes: `useAuthStore` (Task 3); `ProfilePicker` (Task 14); `LoginScreen` (Task 12); `SignupWizard` (Task 11); `RecoveryScreen` (Task 13); `addKnownProfile` (Task 2). Existing Plan 1 `useContent`, `JourneyMap`, `MissionPlayer`, `RewardScreen`, `useUiStore`, `initNavigation` — unchanged.
- Produces: `App` now gates on `useAuthStore().authScreen`: non-null renders the matching auth screen; `null` renders the existing Plan 1 flow, completely unchanged.

**Note on `knownProfiles` population:** this belongs in `auth.ts`'s `signup`/`login` functions (Task 7), not scattered across each screen — added here, in the same task as the wiring that makes it visibly matter, per Task Right-Sizing ("fold... into the task whose deliverable needs them").

- [ ] **Step 1: Write the failing e2e tests**

```tsx
// src/App.e2e.test.tsx (extend the existing file — add these describe blocks; keep the existing Plan 1 happy-path test intact)
import { useAuthStore } from "@/store/authStore";

describe("App auth gating", () => {
  beforeEach(() => {
    window.localStorage.clear();
    useAuthStore.getState().logout();
    useAuthStore.setState({ authScreen: "login" });
  });

  it("boots to the Login screen when no profile is known on this TV, and signing up reaches the map", async () => {
    const user = userEvent.setup();
    render(<App />);

    expect(await screen.findByText(/welcome back/i)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /make a new player/i }));

    await screen.findByText(/pick a silly name/i);
    await user.type(screen.getByPlaceholderText(/silly name/i), "SpeedyOtter");
    await user.click(screen.getByRole("button", { name: /^next$/i }));

    const { PIN_ICONS } = await import("@/components/EmojiPinKeypad");
    await user.click(screen.getByRole("button", { name: PIN_ICONS[0] }));
    await user.click(screen.getByRole("button", { name: PIN_ICONS[1] }));
    await user.click(screen.getByRole("button", { name: PIN_ICONS[2] }));
    await user.click(screen.getByRole("button", { name: PIN_ICONS[3] }));

    const { AVATARS, AVATAR_EMOJI } = await import("@/components/AvatarPicker");
    await waitFor(() => expect(screen.getByRole("button", { name: AVATAR_EMOJI[AVATARS[0]] })).toBeInTheDocument());
    await user.click(screen.getByRole("button", { name: AVATAR_EMOJI[AVATARS[0]] }));
    await user.click(screen.getByRole("button", { name: /^next$/i }));

    await waitFor(() => expect(screen.getByRole("button", { name: "6-8" })).toBeInTheDocument());
    await user.click(screen.getByRole("button", { name: "6-8" }));

    await screen.findByText(/save this code/i);
    await user.click(screen.getByRole("button", { name: /ok, got it/i }));

    await waitFor(() => expect(screen.getByText(/jungle jump/i)).toBeInTheDocument());
  });

  it("shows the Profile Picker on a second boot and logs in with the cached avatar", async () => {
    const { addKnownProfile } = await import("@/lib/knownProfiles");
    const { mockBackend } = await import("@/services/mockBackend");
    mockBackend.reset();
    await mockBackend.signup({ username: "SpeedyOtter", pin: ["🐱", "⚡", "🍕", "🌈"], avatar: "avatar_cat", age_band: "6-8" });
    addKnownProfile({ profileId: "known-1", username: "SpeedyOtter", avatar: "avatar_cat" });
    useAuthStore.setState({ authScreen: "profilePicker" });

    const user = userEvent.setup();
    render(<App />);

    const { avatarEmoji } = await import("@/components/AvatarPicker");
    await screen.findByText(/who's playing/i);
    await user.click(screen.getByRole("button", { name: avatarEmoji("avatar_cat") }));

    const { PIN_ICONS } = await import("@/components/EmojiPinKeypad");
    await waitFor(() => expect(screen.getByRole("button", { name: PIN_ICONS[0] })).toBeInTheDocument());
    await user.click(screen.getByRole("button", { name: PIN_ICONS[0] }));
    await user.click(screen.getByRole("button", { name: PIN_ICONS[1] }));
    await user.click(screen.getByRole("button", { name: PIN_ICONS[2] }));
    await user.click(screen.getByRole("button", { name: PIN_ICONS[3] }));
    await user.click(screen.getByRole("button", { name: /done/i }));

    await waitFor(() => expect(screen.getByText(/jungle jump/i)).toBeInTheDocument());
  });
});
```

Note: these tests reuse the existing `App.e2e.test.tsx` file's fetch-stub setup (the `byPath`/`vi.stubGlobal("fetch", ...)` from Plan 1 Task 8) — keep that `beforeEach` in place; these new tests only add auth-specific setup on top via their own `beforeEach`.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- src/App.e2e.test.tsx`
Expected: FAIL — `App` currently renders `JourneyMap` unconditionally; the auth screens never appear.

- [ ] **Step 3: Add known-profiles population to `auth.ts`**

```typescript
// src/lib/auth.ts — modify signup() and login() only, rest unchanged
import { addKnownProfile } from "@/lib/knownProfiles";

// ... existing imports and checkUsernameAvailable/recoverPin unchanged ...

export async function signup(args: SignupArgs): Promise<{ profile: Profile; recoveryCode: string }> {
  const { profile, token, recoveryCode } = await backend.signup(args);
  useAuthStore.getState().login(token, profile);
  addKnownProfile({ profileId: profile.id, username: profile.username, avatar: profile.avatar });
  return { profile, recoveryCode };
}

export async function login(username: string, pin: string[]): Promise<Profile> {
  const { profile, token } = await backend.login(username, pin);
  useAuthStore.getState().login(token, profile);
  addKnownProfile({ profileId: profile.id, username: profile.username, avatar: profile.avatar });
  return profile;
}
```

- [ ] **Step 4: Wire `App.tsx`**

```tsx
// src/App.tsx
import { useEffect } from "react";
import { initNavigation } from "@/navigation/initNavigation";
import { useContent } from "@/content/useContent";
import { useUiStore } from "@/store/uiStore";
import { useAuthStore } from "@/store/authStore";
import { JourneyMap } from "@/screens/JourneyMap";
import { MissionPlayer } from "@/screens/MissionPlayer";
import { RewardScreen } from "@/screens/RewardScreen";
import { ProfilePicker } from "@/screens/ProfilePicker";
import { LoginScreen } from "@/screens/LoginScreen";
import { SignupWizard } from "@/screens/SignupWizard";
import { RecoveryScreen } from "@/screens/RecoveryScreen";
import { FocusableButton } from "@/components/FocusableButton";

export default function App() {
  useEffect(() => initNavigation(), []);
  const authScreen = useAuthStore((s) => s.authScreen);

  if (authScreen === "profilePicker") return <ProfilePicker />;
  if (authScreen === "login") return <LoginScreen />;
  if (authScreen === "signup") return <SignupWizard />;
  if (authScreen === "recovery") return <RecoveryScreen />;

  return <MainApp />;
}

function MainApp() {
  const content = useContent();
  const screen = useUiStore((s) => s.screen);
  const activeMissionId = useUiStore((s) => s.activeMissionId);

  if (content.status === "loading") return <p>Getting ready…</p>;
  if (content.status === "error" || !content.world) {
    return (
      <div>
        <p>Let's try again</p>
        <FocusableButton autoFocus onPress={content.retry}>Retry</FocusableButton>
      </div>
    );
  }

  const activeMission = content.missions.find((m) => m.id === activeMissionId) ?? null;

  if (screen === "mission" && activeMission) {
    return <MissionPlayer mission={activeMission} activities={content.activitiesByMission[activeMission.id] ?? []} />;
  }
  if (screen === "reward") {
    return <RewardScreen missionTitle={activeMission?.title ?? "Today's mission"} />;
  }
  return <JourneyMap world={content.world} missions={content.missions} />;
}
```

Note: this splits the old inline body of `App` into a separate `MainApp` component so the auth-gating `if` chain at the top stays flat and readable — a straightforward extraction, not a redesign of Plan 1's logic (every line of `MainApp`'s body is copied verbatim from the old `App.tsx`).

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test`
Expected: PASS — full suite, including all of Plan 1's existing tests (unaffected) plus this task's new ones.

- [ ] **Step 6: Verify build and typecheck**

Run: `npx tsc --noEmit && npm run build`
Expected: both clean.

- [ ] **Step 7: Commit**

```bash
git add src/App.tsx src/App.e2e.test.tsx src/lib/auth.ts
git commit -m "feat: gate App on auth state (profile picker / login / signup / recovery)"
```

---

### Task 16: Real Supabase migration (profiles table + auth RPCs)

**Files:**
- Create: `supabase/migrations/<timestamp>_auth_schema.sql` (exact filename generated by the CLI in Step 1)

**Interfaces:**
- Consumes: the already-linked `activize-kidzz` Supabase project (ref `cdyycgyyekykxpkkfysn`, confirmed `ACTIVE_HEALTHY`).
- Produces: a live `profiles` table and `rpc_check_username_available`/`rpc_signup`/`rpc_login`/`rpc_recover_pin` functions on the real project, matching exactly what `src/services/supabaseBackend.ts` (Task 6) calls.

This is the one task in this plan that touches the real database — everything else only ever ran against `mockBackend`.

- [ ] **Step 1: Generate a timestamped migration file**

Run: `npx supabase migration new auth_schema`
Expected: creates `supabase/migrations/<timestamp>_auth_schema.sql` (empty). Note the exact filename printed — you'll edit that file in the next step.

- [ ] **Step 2: Write the migration SQL (adapted from `dieontime/kids-quiz-claude`'s `supabase/migrations/0001_initial_schema.sql`: age_band renamed, quiz-specific tables/RPCs dropped, `profiles` RLS hardened to default-deny)**

```sql
-- Activize Kidzz — auth schema
--
-- Auth model: custom username + 4-emoji PIN (NOT Supabase Auth).
-- Hashing: SHA-256(secret || salt) using pgcrypto's digest().
-- All credential validation, lockout enforcement, and token issuance
-- happens server-side inside SECURITY DEFINER RPC functions so the anon
-- key alone cannot read pin_hash / recovery_hash / salt.
--
-- RLS: profiles has RLS enabled with NO anon/authenticated policy at all
-- (default-deny). Only the SECURITY DEFINER RPCs below can touch this
-- table — they bypass RLS by design, so a permissive policy would only
-- ever weaken things. This is stricter than the reference implementation
-- this was ported from, which flagged its own permissive policy as
-- temporary.

create schema if not exists extensions;
create extension if not exists pgcrypto;

create table if not exists profiles (
  id              uuid primary key default gen_random_uuid(),
  username        text not null,
  avatar          text not null,
  age_band        text not null check (age_band in ('3-5', '6-8')),
  pin_hash        text not null,
  salt            text not null,
  recovery_hash   text not null,
  failed_attempts integer not null default 0,
  locked_until    timestamptz,
  created_at      timestamptz not null default now()
);

create unique index if not exists profiles_username_lower_uniq
  on profiles (lower(username));

-- -----------------------------------------------------------------------------
-- Helpers
-- -----------------------------------------------------------------------------

create or replace function sha256_hex(p_input text)
returns text
language sql
immutable
set search_path = public, extensions
as $$
  select encode(digest(p_input, 'sha256'), 'hex');
$$;

create or replace function generate_salt()
returns text
language sql
volatile
set search_path = public, extensions
as $$
  select encode(gen_random_bytes(16), 'hex');
$$;

create or replace function generate_recovery_code()
returns text
language plpgsql
volatile
as $$
declare
  adjs text[] := array[
    'BRAVE','COOL','EPIC','FAST','GLAD','HAPPY','HUGE','JOLLY',
    'KIND','LUSH','MEGA','NEON','PROUD','QUICK','RADIANT','SHARP',
    'SWIFT','TALL','ULTRA','VIVID','WILD','ZESTY'
  ];
  nouns text[] := array[
    'BEAR','BIRD','CAT','CLOUD','DRAGON','EAGLE','FOX','FROG',
    'HAWK','HORSE','LION','MOON','PANDA','PLANET','RABBIT','ROCKET',
    'SHARK','STAR','TIGER','UNICORN','WOLF','ZEBRA'
  ];
begin
  return adjs[1 + floor(random() * array_length(adjs, 1))::int]
    || '-' || nouns[1 + floor(random() * array_length(nouns, 1))::int]
    || '-' || lpad(floor(random() * 10000)::text, 4, '0');
end;
$$;

create or replace function contains_profanity(p_input text)
returns boolean
language plpgsql
immutable
as $$
declare
  blocked text[] := array[
    'ass','damn','hell','crap','shit','fuck','bitch','piss',
    'butt','sex','porn','kill','nazi','dick','cock','tit'
  ];
  separated text;
  tok text;
begin
  if p_input is null or length(p_input) = 0 then
    return false;
  end if;

  separated := regexp_replace(p_input, '([a-z])([A-Z])', '\1 \2', 'g');

  for tok in
    select lower(t) from regexp_split_to_table(separated, '[^a-zA-Z]+') as t
    where t <> ''
  loop
    if tok = any(blocked) then
      return true;
    end if;
  end loop;

  return false;
end;
$$;

create or replace function lockout_interval(p_failed_attempts integer)
returns interval
language sql
immutable
as $$
  select case
    when p_failed_attempts >= 10 then interval '24 hours'
    when p_failed_attempts >= 8  then interval '5 minutes'
    when p_failed_attempts >= 5  then interval '1 minute'
    else null
  end;
$$;

create or replace function issue_token(p_profile_id uuid)
returns text
language sql
volatile
as $$
  select 'sb-' || p_profile_id::text || '-' || md5(random()::text);
$$;

-- =============================================================================
-- RPCs
--
-- Error contract: exceptions whose MESSAGE starts with a hint code in
-- square brackets, e.g. "[TAKEN] Username already in use". Clients
-- pattern-match on the prefix:
--   [INVALID] [PROFANITY] [TAKEN] [WRONG_CREDENTIALS] [WRONG_RECOVERY] [LOCKED]
-- =============================================================================

create or replace function rpc_check_username_available(p_username text)
returns boolean
language sql
stable
security definer
set search_path = public, extensions
as $$
  select not exists (
    select 1 from profiles where lower(username) = lower(p_username)
  );
$$;

create or replace function rpc_signup(
  p_username text,
  p_pin      text,
  p_avatar   text,
  p_age_band text
)
returns json
language plpgsql
volatile
security definer
set search_path = public, extensions
as $$
declare
  v_id            uuid;
  v_salt          text;
  v_pin_hash      text;
  v_recovery_code text;
  v_recovery_hash text;
  v_token         text;
begin
  if p_username is null or length(p_username) < 3 or length(p_username) > 20 then
    raise exception '[INVALID] Username must be 3-20 characters';
  end if;

  if p_age_band not in ('3-5', '6-8') then
    raise exception '[INVALID] Age band must be 3-5 or 6-8';
  end if;

  if p_pin is null or length(p_pin) = 0 then
    raise exception '[INVALID] PIN is required';
  end if;

  if contains_profanity(p_username) then
    raise exception '[PROFANITY] Username contains a blocked word';
  end if;

  if exists (select 1 from profiles where lower(username) = lower(p_username)) then
    raise exception '[TAKEN] Username "%" is already taken', p_username;
  end if;

  v_id            := gen_random_uuid();
  v_salt          := generate_salt();
  v_pin_hash      := sha256_hex(p_pin || v_salt);
  v_recovery_code := generate_recovery_code();
  v_recovery_hash := sha256_hex(v_recovery_code || v_salt);

  insert into profiles (
    id, username, avatar, age_band,
    pin_hash, salt, recovery_hash,
    failed_attempts, locked_until
  ) values (
    v_id, p_username, p_avatar, p_age_band,
    v_pin_hash, v_salt, v_recovery_hash,
    0, null
  );

  v_token := issue_token(v_id);

  return json_build_object(
    'profile_id',    v_id,
    'username',      p_username,
    'avatar',        p_avatar,
    'age_band',      p_age_band,
    'recovery_code', v_recovery_code,
    'token',         v_token
  );
end;
$$;

create or replace function rpc_login(
  p_username text,
  p_pin      text
)
returns json
language plpgsql
volatile
security definer
set search_path = public, extensions
as $$
declare
  v_row     profiles%rowtype;
  v_attempt text;
  v_lock    interval;
  v_token   text;
begin
  select * into v_row from profiles where lower(username) = lower(p_username) limit 1;

  if not found then
    raise exception '[WRONG_CREDENTIALS] Invalid username or PIN';
  end if;

  if v_row.locked_until is not null and v_row.locked_until > now() then
    raise exception '[LOCKED] Account is locked until %',
      to_char(v_row.locked_until at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"');
  end if;

  if v_row.locked_until is not null and v_row.locked_until <= now() then
    update profiles set locked_until = null, failed_attempts = 0 where id = v_row.id;
    v_row.locked_until := null;
    v_row.failed_attempts := 0;
  end if;

  v_attempt := sha256_hex(p_pin || v_row.salt);

  if v_attempt <> v_row.pin_hash then
    v_row.failed_attempts := v_row.failed_attempts + 1;
    v_lock := lockout_interval(v_row.failed_attempts);
    update profiles
       set failed_attempts = v_row.failed_attempts,
           locked_until    = case when v_lock is not null then now() + v_lock else locked_until end
     where id = v_row.id;
    raise exception '[WRONG_CREDENTIALS] Invalid username or PIN';
  end if;

  update profiles set failed_attempts = 0, locked_until = null where id = v_row.id;
  v_token := issue_token(v_row.id);

  return json_build_object(
    'profile_id', v_row.id,
    'username',   v_row.username,
    'avatar',     v_row.avatar,
    'age_band',   v_row.age_band,
    'token',      v_token
  );
end;
$$;

create or replace function rpc_recover_pin(
  p_username      text,
  p_recovery_code text,
  p_new_pin       text
)
returns json
language plpgsql
volatile
security definer
set search_path = public, extensions
as $$
declare
  v_row            profiles%rowtype;
  v_attempt        text;
  v_lock           interval;
  v_new_recovery   text;
  v_new_recovery_h text;
  v_new_pin_hash   text;
begin
  if p_new_pin is null or length(p_new_pin) = 0 then
    raise exception '[INVALID] New PIN is required';
  end if;

  select * into v_row from profiles where lower(username) = lower(p_username) limit 1;

  if not found then
    raise exception '[WRONG_RECOVERY] Username or recovery code is incorrect';
  end if;

  if v_row.locked_until is not null and v_row.locked_until > now() then
    raise exception '[LOCKED] Account is locked until %',
      to_char(v_row.locked_until at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"');
  end if;

  if v_row.locked_until is not null and v_row.locked_until <= now() then
    update profiles set locked_until = null, failed_attempts = 0 where id = v_row.id;
    v_row.locked_until := null;
    v_row.failed_attempts := 0;
  end if;

  v_attempt := sha256_hex(p_recovery_code || v_row.salt);

  if v_attempt <> v_row.recovery_hash then
    v_row.failed_attempts := v_row.failed_attempts + 1;
    v_lock := lockout_interval(v_row.failed_attempts);
    update profiles
       set failed_attempts = v_row.failed_attempts,
           locked_until    = case when v_lock is not null then now() + v_lock else locked_until end
     where id = v_row.id;
    raise exception '[WRONG_RECOVERY] Username or recovery code is incorrect';
  end if;

  v_new_recovery   := generate_recovery_code();
  v_new_pin_hash   := sha256_hex(p_new_pin || v_row.salt);
  v_new_recovery_h := sha256_hex(v_new_recovery || v_row.salt);

  update profiles
     set pin_hash        = v_new_pin_hash,
         recovery_hash   = v_new_recovery_h,
         failed_attempts = 0,
         locked_until    = null
   where id = v_row.id;

  return json_build_object('recovery_code', v_new_recovery);
end;
$$;

-- =============================================================================
-- RLS — default-deny on profiles (no anon/authenticated policy at all)
-- =============================================================================

alter table profiles enable row level security;

-- =============================================================================
-- Grants
-- =============================================================================

grant execute on function rpc_check_username_available(text) to anon, authenticated;
grant execute on function rpc_signup(text, text, text, text)  to anon, authenticated;
grant execute on function rpc_login(text, text)                to anon, authenticated;
grant execute on function rpc_recover_pin(text, text, text)    to anon, authenticated;
```

- [ ] **Step 3: Apply the migration to the real, linked project**

Run: `npx supabase db push`
Expected: prompts to confirm applying the new migration to `activize-kidzz` (ref `cdyycgyyekykxpkkfysn`); confirm; succeeds.

- [ ] **Step 4: Populate local `.env` for manual verification**

Run: `npx supabase projects api-keys --project-ref cdyycgyyekykxpkkfysn` to get the anon key. Create `.env` (gitignored, from Task 1) with:
```
VITE_SUPABASE_URL=https://cdyycgyyekykxpkkfysn.supabase.co
VITE_SUPABASE_ANON_KEY=<the anon key printed above>
```

- [ ] **Step 5: Manual verification against the real project**

Run: `npm run dev`. In the browser:
1. Sign up a throwaway profile (e.g. username `VerifyTest`, any PIN/avatar/band).
2. In the Supabase dashboard's SQL editor (or via `psql`), run `select username, pin_hash, salt from profiles where username = 'VerifyTest';` — confirm `pin_hash` is a 64-character hex string (SHA-256), **not** the plaintext PIN.
3. Confirm the hardened RLS: using the anon key directly (e.g. via `curl` against the REST API, or the Supabase dashboard's "run as anon" tool), attempt `select * from profiles` — confirm it returns **zero rows** (proving the default-deny policy), not the row just created.
4. Log out, log back in as `VerifyTest` with the correct PIN — confirm success.
5. Use "Forgot PIN?" with the real recovery code shown at signup — confirm the PIN resets and the old recovery code no longer works.

- [ ] **Step 6: Delete the throwaway verification profile**

Run (in the Supabase SQL editor): `delete from profiles where username = 'VerifyTest';`

- [ ] **Step 7: Commit**

```bash
git add supabase/migrations
git commit -m "feat: apply auth schema migration (profiles + RPCs, hardened RLS)"
```

---

## Self-Review

**Spec coverage:**
- §6 auth state architecture (`useAuthStore`, known-profiles cache, Profile Picker vs Login boot logic) → Tasks 2, 3, 14. ✅
- §7 auth model (custom `profiles` row, `SECURITY DEFINER` RPCs, PIN/recovery-code mechanics, `age_band` rename, `backend.ts` env-switch) → Tasks 5, 6, 7, 16. ✅
- §7 component porting (verbatim logic, adapted screens: router removed, `BigButton`→`FocusableButton`, `framer-motion` dropped) → Tasks 9–13. ✅
- §7 "first real multi-element D-pad navigation" → Tasks 8, 9, 10 (shared grid-mock utility + genuine arrow-key tests). ✅
- §8 migration sequencing (auth schema only, hardened default-deny RLS on `profiles`, gameplay tables deferred to Plan 3) → Task 16. ✅
- §11 testing approach (mockBackend-only automated tests; real-project manual verification pass) → all tasks use mockBackend; Task 16 Step 5 is the one live-database check. ✅
- Global Constraint "no session token persists across restarts" → `useAuthStore` (Task 3) never writes to `localStorage`; only `knownProfiles` (Task 2) does, and only username+avatar, no token. ✅

**Deferred by design (not gaps):** `framer-motion` animations, `PlayfulBackground`, visual styling of any kind — explicit follow-up pass before Plan 3, per the user's own sequencing decision this session.

**Placeholder scan:** no TBD/TODO; every step shows complete, real code (ported from the actual fetched reference source, or newly authored for this app). ✅

**Type consistency check:** `Profile`/`SignupArgs`/`SignupResult`/`LoginResult` are defined exactly once, in Task 3's `src/services/authTypes.ts` — `mockBackend.ts` (Task 5) imports and re-exports them (so `@/services/mockBackend` stays a valid import path for Tasks 6-7, unchanged), nothing redefines them. `useAuthStore`'s action names (`setAuthScreen`, `login`, `completeAuthFlow`, `logout`) are used identically across Tasks 7, 11, 12, 13, 14, 15 — verified no task calls a differently-named action. `AuthScreen`'s five states (`"profilePicker"|"login"|"signup"|"recovery"|null`) are consistent between Task 3's definition and every consumer. `FocusableButton`'s existing Plan 1 interface (`{onPress, children, focusKey?, autoFocus?}`) is used as-is throughout — no task assumes a `disabled` prop that doesn't exist (Tasks 9 and 13 explicitly note where the reference relied on `disabled` and how this port handles it instead).

**One item worth a second look before execution begins:** Task 15's `App.tsx` splits the old single-component body into `App` + `MainApp` — this is the one place an earlier task's file (Plan 1's `App.tsx`) gets restructured rather than purely extended. The split is mechanical (auth-gating `if`s on top, Plan 1's exact old body moved into `MainApp` unchanged), but it's the one task worth double-checking in review that nothing was altered in transit.
