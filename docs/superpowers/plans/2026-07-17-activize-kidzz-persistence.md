# Activize Kidzz — Persistence (Plan 3) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the app real memory — persist per-profile progress (current mission, streak) and mission-completion history to Supabase, add daily-gate lock states to the journey map, and show a streak indicator on the reward screen.

**Architecture:** Mirrors the existing auth pattern exactly: `progressStore` (zustand) + `mockProgressBackend`/`supabaseProgressBackend`/`progressBackend.ts` (env switch) + `lib/progress.ts` (facade). `lib/auth.ts`'s `signup`/`login` load progress right after authenticating; `authStore.logout()` resets it. All streak/lock-state math is pure and lives in small, independently-testable `lib/` modules.

**Tech Stack:** Existing stack unchanged (Vite + React + TS + Zustand + Vitest + Supabase). No new dependencies.

## Global Constraints

- No `earned_badges` writer in this plan — the table is migrated (schema only) but nothing inserts into it; that's a later plan's scope.
- No multi-world switching UI — only one world exists in content; `progress.world` is a 0-based index into `manifest.worldIds`, persisted for forward-compatibility only.
- `progress.node` is 1-based, matching the already-authored `Mission.node` field (e.g. "Day 1" = `node: 1`) — deliberately a different base than `progress.world`, each chosen to match what it's compared against. A fresh profile defaults to `node: 1`.
- The completion write (`recordMissionCompletion`) is fire-and-forget from its caller (`MissionPlayer`) — `goToReward()` is called immediately, without awaiting the write. Per the master spec's "no failure, no losing" design rule (§4), a network blip must never block the reward moment. `recordMissionCompletion` itself swallows its own errors.
- Replaying an already-completed mission (its `node` no longer matches the profile's current `progress.node`) must not re-advance progress or double-log a completion — enforced inside `recordMissionCompletion` via a node-mismatch guard, not by caller-side logic.
- No RPCs needed for the new tables (unlike auth) — `progress`/`mission_completions`/`earned_badges` use permissive `anon`/`authenticated` RLS with direct `supabase-js` table reads/writes, per the approved spec's accepted trade-off.
- Full `npm test` + `npx tsc --noEmit` + `npm run build` verification runs at the end (Task 13).

---

### Task 1: Supabase migration — progress, mission_completions, earned_badges

**Files:**
- Create: `supabase/migrations/20260717090000_progress_schema.sql`

- [ ] **Step 1: Write the migration**

```sql
-- Activize Kidzz — persistence schema (Plan 3)
--
-- progress: one row per profile, summarising current position + streak.
-- Read on every boot (after login/signup), written once per mission
-- completion via a single upsert -- deliberately denormalized so a boot
-- costs one row read instead of aggregating the whole completions log,
-- important on a possibly-flaky TV WiFi connection.
--
-- mission_completions: append-only log, one row per completed mission.
--
-- earned_badges: schema only in this plan -- no code writes to it yet.
-- The badge rule engine that decides when a badge is earned is a later
-- plan's scope; this table exists now so that plan's migration doesn't
-- need to touch `profiles` again.
--
-- RLS: permissive anon/authenticated CRUD on all three tables (unlike
-- `profiles`, which is default-deny). Accepted trade-off: there is no
-- server session to scope RLS by in this app's custom-auth model, so the
-- client is trusted to only query its own profile_id (returned at
-- login/signup, held client-side). None of these tables hold credentials
-- or PII beyond a chosen username/avatar (already in `profiles`) -- must
-- be revisited before any future clinical (Tier C) pivot.

create table if not exists progress (
  profile_id          uuid primary key references profiles(id) on delete cascade,
  world               integer not null default 0,
  node                integer not null default 1,
  streak_count        integer not null default 0,
  longest_streak      integer not null default 0,
  last_completed_date date
);

create table if not exists mission_completions (
  id              uuid primary key default gen_random_uuid(),
  profile_id      uuid not null references profiles(id) on delete cascade,
  mission_id      text not null,
  completed_at    timestamptz not null default now(),
  activities_done integer not null default 0
);

create index if not exists mission_completions_profile_id_idx
  on mission_completions (profile_id);

create table if not exists earned_badges (
  profile_id  uuid not null references profiles(id) on delete cascade,
  badge_id    text not null,
  earned_at   timestamptz not null default now(),
  primary key (profile_id, badge_id)
);

-- =============================================================================
-- RLS — permissive CRUD (see rationale above)
-- =============================================================================

alter table progress enable row level security;
alter table mission_completions enable row level security;
alter table earned_badges enable row level security;

create policy progress_anon_all on progress
  for all to anon, authenticated
  using (true) with check (true);

create policy mission_completions_anon_all on mission_completions
  for all to anon, authenticated
  using (true) with check (true);

create policy earned_badges_anon_all on earned_badges
  for all to anon, authenticated
  using (true) with check (true);

-- =============================================================================
-- Grants
-- =============================================================================

grant select, insert, update on progress to anon, authenticated;
grant select, insert on mission_completions to anon, authenticated;
grant select, insert on earned_badges to anon, authenticated;
```

- [ ] **Step 2: Dry-run against the linked Supabase project**

Run: `supabase db push --dry-run`
Expected: reports the 3 new tables + policies + grants to be created, no errors.

- [ ] **Step 3: Apply live**

Run: `supabase db push --yes`
Expected: migration applied successfully.

- [ ] **Step 4: Verify live via the REST API**

```bash
source <(grep -v '^#' .env | sed 's/^/export /')
curl -s -o /tmp/progress_check.json -w "%{http_code}\n" "$VITE_SUPABASE_URL/rest/v1/progress?select=*" \
  -H "apikey: $VITE_SUPABASE_ANON_KEY" -H "Authorization: Bearer $VITE_SUPABASE_ANON_KEY"
cat /tmp/progress_check.json
```

Expected: HTTP `200`, body `[]` (empty array — confirms the table exists and anon SELECT is allowed). Repeat with `/mission_completions` and `/earned_badges` in place of `/progress`.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260717090000_progress_schema.sql
git commit -m "feat: add progress/mission_completions/earned_badges schema"
```

---

### Task 2: progressTypes + progressStore

**Files:**
- Create: `src/services/progressTypes.ts`
- Create: `src/store/progressStore.ts`
- Test: `src/store/progressStore.test.ts`

**Interfaces:**
- Produces: `ProgressRecord` (`{ world, node, streakCount, longestStreak, lastCompletedDate }`), `DEFAULT_PROGRESS`, and `useProgressStore` (`{ ...ProgressRecord, isLoaded, setProgress(record), reset() }`) — consumed by every later task.

- [ ] **Step 1: Create `src/services/progressTypes.ts`**

```typescript
export interface ProgressRecord {
  world: number;
  node: number;
  streakCount: number;
  longestStreak: number;
  lastCompletedDate: string | null;
}

// world is a 0-based index into manifest.worldIds; node is 1-based,
// matching the authored Mission.node ("Day N") numbering -- deliberately
// different bases, each chosen to match what it's compared against.
export const DEFAULT_PROGRESS: ProgressRecord = {
  world: 0,
  node: 1,
  streakCount: 0,
  longestStreak: 0,
  lastCompletedDate: null,
};
```

- [ ] **Step 2: Write the failing test for the store**

```typescript
import { useProgressStore } from "./progressStore";

describe("useProgressStore", () => {
  afterEach(() => useProgressStore.getState().reset());

  it("starts with the default zeroed progress", () => {
    const state = useProgressStore.getState();
    expect(state.world).toBe(0);
    expect(state.node).toBe(1);
    expect(state.streakCount).toBe(0);
    expect(state.longestStreak).toBe(0);
    expect(state.lastCompletedDate).toBeNull();
    expect(state.isLoaded).toBe(false);
  });

  it("setProgress replaces the record and marks isLoaded true", () => {
    useProgressStore.getState().setProgress({
      world: 0, node: 3, streakCount: 2, longestStreak: 5, lastCompletedDate: "2026-07-17",
    });
    const state = useProgressStore.getState();
    expect(state.node).toBe(3);
    expect(state.streakCount).toBe(2);
    expect(state.longestStreak).toBe(5);
    expect(state.lastCompletedDate).toBe("2026-07-17");
    expect(state.isLoaded).toBe(true);
  });

  it("reset returns to the default zeroed state", () => {
    useProgressStore.getState().setProgress({
      world: 0, node: 3, streakCount: 2, longestStreak: 5, lastCompletedDate: "2026-07-17",
    });
    useProgressStore.getState().reset();
    const state = useProgressStore.getState();
    expect(state.node).toBe(1);
    expect(state.isLoaded).toBe(false);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run src/store/progressStore.test.ts`
Expected: FAIL — `Cannot find module './progressStore'`

- [ ] **Step 4: Implement `src/store/progressStore.ts`**

```typescript
import { create } from "zustand";
import { DEFAULT_PROGRESS, type ProgressRecord } from "@/services/progressTypes";

interface ProgressState extends ProgressRecord {
  isLoaded: boolean;
  setProgress: (record: ProgressRecord) => void;
  reset: () => void;
}

export const useProgressStore = create<ProgressState>((set) => ({
  ...DEFAULT_PROGRESS,
  isLoaded: false,
  setProgress: (record) => set({ ...record, isLoaded: true }),
  reset: () => set({ ...DEFAULT_PROGRESS, isLoaded: false }),
}));
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/store/progressStore.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 6: Commit**

```bash
git add src/services/progressTypes.ts src/store/progressStore.ts src/store/progressStore.test.ts
git commit -m "feat: add progressStore and shared ProgressRecord type"
```

---

### Task 3: mockProgressBackend

**Files:**
- Create: `src/services/mockProgressBackend.ts`
- Test: `src/services/mockProgressBackend.test.ts`

**Interfaces:**
- Consumes: `ProgressRecord`, `DEFAULT_PROGRESS` from Task 2.
- Produces: `mockProgressBackend.{reset(), loadProgress(profileId), saveProgress(profileId, record), insertCompletion(profileId, missionId, activitiesDone)}` — this exact shape (`loadProgress`/`saveProgress`/`insertCompletion`) is the `ProgressBackend` interface every later task assumes; `supabaseProgressBackend` (Task 4) implements the same shape.

- [ ] **Step 1: Write the failing tests**

```typescript
import { mockProgressBackend } from "./mockProgressBackend";

describe("mockProgressBackend", () => {
  beforeEach(() => mockProgressBackend.reset());

  it("returns the default record when no progress exists for a profile", async () => {
    const record = await mockProgressBackend.loadProgress("profile-1");
    expect(record).toEqual({ world: 0, node: 1, streakCount: 0, longestStreak: 0, lastCompletedDate: null });
  });

  it("saveProgress persists and loadProgress returns the saved record", async () => {
    await mockProgressBackend.saveProgress("profile-1", {
      world: 0, node: 2, streakCount: 1, longestStreak: 1, lastCompletedDate: "2026-07-17",
    });
    const record = await mockProgressBackend.loadProgress("profile-1");
    expect(record).toEqual({ world: 0, node: 2, streakCount: 1, longestStreak: 1, lastCompletedDate: "2026-07-17" });
  });

  it("keeps progress isolated per profile", async () => {
    await mockProgressBackend.saveProgress("profile-1", {
      world: 0, node: 2, streakCount: 1, longestStreak: 1, lastCompletedDate: "2026-07-17",
    });
    const other = await mockProgressBackend.loadProgress("profile-2");
    expect(other.node).toBe(1);
  });

  it("insertCompletion does not throw and does not affect loadProgress", async () => {
    await expect(
      mockProgressBackend.insertCompletion("profile-1", "mission-001", 4),
    ).resolves.toBeUndefined();
    const record = await mockProgressBackend.loadProgress("profile-1");
    expect(record.node).toBe(1);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/services/mockProgressBackend.test.ts`
Expected: FAIL — `Cannot find module './mockProgressBackend'`

- [ ] **Step 3: Implement**

```typescript
import { DEFAULT_PROGRESS, type ProgressRecord } from "./progressTypes";

export type { ProgressRecord };
export { DEFAULT_PROGRESS };

interface StoredProgress {
  profile_id: string;
  world: number;
  node: number;
  streak_count: number;
  longest_streak: number;
  last_completed_date: string | null;
}

interface StoredCompletion {
  id: string;
  profile_id: string;
  mission_id: string;
  completed_at: string;
  activities_done: number;
}

const KEY_PROGRESS = "mockProgressBackend.progress";
const KEY_COMPLETIONS = "mockProgressBackend.completions";

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

function toRecord(row: StoredProgress): ProgressRecord {
  return {
    world: row.world,
    node: row.node,
    streakCount: row.streak_count,
    longestStreak: row.longest_streak,
    lastCompletedDate: row.last_completed_date,
  };
}

export const mockProgressBackend = {
  reset(): void {
    localStorage.removeItem(KEY_PROGRESS);
    localStorage.removeItem(KEY_COMPLETIONS);
  },

  async loadProgress(profileId: string): Promise<ProgressRecord> {
    const rows = readKey<StoredProgress>(KEY_PROGRESS);
    const row = rows.find((r) => r.profile_id === profileId);
    return row ? toRecord(row) : { ...DEFAULT_PROGRESS };
  },

  async saveProgress(profileId: string, record: ProgressRecord): Promise<void> {
    const rows = readKey<StoredProgress>(KEY_PROGRESS);
    const idx = rows.findIndex((r) => r.profile_id === profileId);
    const stored: StoredProgress = {
      profile_id: profileId,
      world: record.world,
      node: record.node,
      streak_count: record.streakCount,
      longest_streak: record.longestStreak,
      last_completed_date: record.lastCompletedDate,
    };
    if (idx === -1) rows.push(stored);
    else rows[idx] = stored;
    writeKey(KEY_PROGRESS, rows);
  },

  async insertCompletion(profileId: string, missionId: string, activitiesDone: number): Promise<void> {
    const rows = readKey<StoredCompletion>(KEY_COMPLETIONS);
    rows.push({
      id: crypto.randomUUID(),
      profile_id: profileId,
      mission_id: missionId,
      completed_at: new Date().toISOString(),
      activities_done: activitiesDone,
    });
    writeKey(KEY_COMPLETIONS, rows);
  },
};
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/services/mockProgressBackend.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add src/services/mockProgressBackend.ts src/services/mockProgressBackend.test.ts
git commit -m "feat: add mockProgressBackend"
```

---

### Task 4: supabaseProgressBackend + progressBackend switch

**Files:**
- Create: `src/services/supabaseProgressBackend.ts`
- Create: `src/services/progressBackend.ts`

**Interfaces:**
- Consumes: `ProgressRecord`, `DEFAULT_PROGRESS` from Task 2; the `ProgressBackend` shape from Task 3.
- Produces: `progressBackend` — the single import point every later task uses (never import `mockProgressBackend`/`supabaseProgressBackend` directly outside this file and tests).

**Note on testing:** mirrors this codebase's existing convention for `supabaseBackend.ts`/`backend.ts` — no dedicated unit test file (mocking the Supabase client for pure unit tests is low-value here). Confidence comes from: (a) Task 1's live REST verification that the tables/RLS actually work, and (b) this file being a direct structural mirror of the already-proven `supabaseBackend.ts` client setup. Verification for this task is `npm test` (no regressions) + `npx tsc --noEmit`.

- [ ] **Step 1: Implement `src/services/supabaseProgressBackend.ts`**

```typescript
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { DEFAULT_PROGRESS, type ProgressRecord } from "./progressTypes";

export type { ProgressRecord };

let _client: SupabaseClient | null = null;

function client(): SupabaseClient {
  if (_client) return _client;
  const url = import.meta.env.VITE_SUPABASE_URL;
  const anon = import.meta.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !anon) {
    throw new Error("supabaseProgressBackend: VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY must be set");
  }
  _client = createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } });
  return _client;
}

export const supabaseProgressBackend = {
  async loadProgress(profileId: string): Promise<ProgressRecord> {
    const { data, error } = await client()
      .from("progress")
      .select("world, node, streak_count, longest_streak, last_completed_date")
      .eq("profile_id", profileId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) return { ...DEFAULT_PROGRESS };
    return {
      world: data.world,
      node: data.node,
      streakCount: data.streak_count,
      longestStreak: data.longest_streak,
      lastCompletedDate: data.last_completed_date,
    };
  },

  async saveProgress(profileId: string, record: ProgressRecord): Promise<void> {
    const { error } = await client().from("progress").upsert({
      profile_id: profileId,
      world: record.world,
      node: record.node,
      streak_count: record.streakCount,
      longest_streak: record.longestStreak,
      last_completed_date: record.lastCompletedDate,
    });
    if (error) throw new Error(error.message);
  },

  async insertCompletion(profileId: string, missionId: string, activitiesDone: number): Promise<void> {
    const { error } = await client().from("mission_completions").insert({
      profile_id: profileId,
      mission_id: missionId,
      activities_done: activitiesDone,
    });
    if (error) throw new Error(error.message);
  },
};
```

- [ ] **Step 2: Implement `src/services/progressBackend.ts`**

```typescript
import { mockProgressBackend } from "./mockProgressBackend";
import { supabaseProgressBackend } from "./supabaseProgressBackend";

const HAS_SUPABASE_CONFIG = Boolean(
  import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY,
);

export const progressBackend = HAS_SUPABASE_CONFIG ? supabaseProgressBackend : mockProgressBackend;
```

- [ ] **Step 3: Verify no regressions**

Run: `npm test`
Expected: same pass count as before this task (no new tests added).

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/services/supabaseProgressBackend.ts src/services/progressBackend.ts
git commit -m "feat: add supabaseProgressBackend and the progressBackend switch"
```

---

### Task 5: Date utilities + mission lock-state helper

**Files:**
- Create: `src/lib/date.ts`
- Test: `src/lib/date.test.ts`
- Create: `src/lib/missionLockState.ts`
- Test: `src/lib/missionLockState.test.ts`

**Interfaces:**
- Produces: `todayDateString(): string`, `yesterdayDateString(): string` (both `"YYYY-MM-DD"`, UTC-based — consistent with how the rest of this codebase does date/time, e.g. `mockBackend.ts`'s `locked_until` timestamps, with no special local-timezone handling). Produces `MissionLockState = "completed" | "current" | "locked"` and `missionLockState(missionNode, progressNode, lastCompletedDate, today): MissionLockState` — consumed by Tasks 6 and 8.

- [ ] **Step 1: Write the failing date tests**

```typescript
import { todayDateString, yesterdayDateString } from "./date";

describe("date utilities", () => {
  afterEach(() => vi.useRealTimers());

  it("todayDateString returns the current UTC date as YYYY-MM-DD", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-17T15:30:00.000Z"));
    expect(todayDateString()).toBe("2026-07-17");
  });

  it("yesterdayDateString returns the day before today", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-17T15:30:00.000Z"));
    expect(yesterdayDateString()).toBe("2026-07-16");
  });

  it("yesterdayDateString correctly crosses a month boundary", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-01T02:00:00.000Z"));
    expect(yesterdayDateString()).toBe("2026-07-31");
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/lib/date.test.ts`
Expected: FAIL — `Cannot find module './date'`

- [ ] **Step 3: Implement `src/lib/date.ts`**

```typescript
export function todayDateString(): string {
  return new Date().toISOString().slice(0, 10);
}

export function yesterdayDateString(): string {
  return new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/lib/date.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Write the failing missionLockState tests**

```typescript
import { missionLockState } from "./missionLockState";

describe("missionLockState", () => {
  it("marks a mission before the current node as completed", () => {
    expect(missionLockState(1, 2, "2026-07-17", "2026-07-17")).toBe("completed");
  });

  it("marks the mission at the current node as current when not yet done today", () => {
    expect(missionLockState(2, 2, "2026-07-16", "2026-07-17")).toBe("current");
  });

  it("marks the mission at the current node as current for a fresh profile with no completions", () => {
    expect(missionLockState(1, 1, null, "2026-07-17")).toBe("current");
  });

  it("marks the mission at the current node as locked once it was already completed today", () => {
    expect(missionLockState(2, 2, "2026-07-17", "2026-07-17")).toBe("locked");
  });

  it("marks a mission after the current node as locked", () => {
    expect(missionLockState(3, 2, "2026-07-16", "2026-07-17")).toBe("locked");
  });
});
```

- [ ] **Step 6: Run to verify it fails**

Run: `npx vitest run src/lib/missionLockState.test.ts`
Expected: FAIL — `Cannot find module './missionLockState'`

- [ ] **Step 7: Implement `src/lib/missionLockState.ts`**

```typescript
export type MissionLockState = "completed" | "current" | "locked";

export function missionLockState(
  missionNode: number,
  progressNode: number,
  lastCompletedDate: string | null,
  today: string,
): MissionLockState {
  if (missionNode < progressNode) return "completed";
  if (missionNode === progressNode) return lastCompletedDate === today ? "locked" : "current";
  return "locked";
}
```

- [ ] **Step 8: Run to verify it passes**

Run: `npx vitest run src/lib/missionLockState.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 9: Commit**

```bash
git add src/lib/date.ts src/lib/date.test.ts src/lib/missionLockState.ts src/lib/missionLockState.test.ts
git commit -m "feat: add date utilities and mission lock-state helper"
```

---

### Task 6: lib/progress.ts facade (loadProgress + recordMissionCompletion)

**Files:**
- Create: `src/lib/progress.ts`
- Test: `src/lib/progress.test.ts`

**Interfaces:**
- Consumes: `progressBackend` from Task 4; `useProgressStore` from Task 2; `todayDateString`/`yesterdayDateString` from Task 5; `useAuthStore` (existing, `activeProfile.id`).
- Produces: `loadProgress(profileId: string): Promise<void>`, `recordMissionCompletion(missionId: string, missionNode: number, activitiesDone: number): Promise<void>` — consumed by Task 7 (`loadProgress`) and Task 9 (`recordMissionCompletion`).

- [ ] **Step 1: Write the failing tests**

```typescript
import { useAuthStore } from "@/store/authStore";
import { useProgressStore } from "@/store/progressStore";
import { mockProgressBackend } from "@/services/mockProgressBackend";
import { loadProgress, recordMissionCompletion } from "./progress";

const PROFILE = { id: "profile-1", username: "SpeedyOtter", avatar: "avatar_cat", age_band: "6-8" as const };

describe("lib/progress", () => {
  beforeEach(() => {
    mockProgressBackend.reset();
    useProgressStore.getState().reset();
    useAuthStore.setState({ activeProfile: PROFILE });
  });

  afterEach(() => {
    vi.useRealTimers();
    useAuthStore.getState().logout();
  });

  describe("loadProgress", () => {
    it("populates the progress store from the backend's default record for a new profile", async () => {
      await loadProgress(PROFILE.id);
      const state = useProgressStore.getState();
      expect(state.node).toBe(1);
      expect(state.isLoaded).toBe(true);
    });
  });

  describe("recordMissionCompletion", () => {
    it("does nothing if no profile is active", async () => {
      useAuthStore.setState({ activeProfile: null });
      await recordMissionCompletion("mission-001", 1, 4);
      expect(useProgressStore.getState().node).toBe(1);
    });

    it("ignores a replay of a mission that isn't the current node", async () => {
      await loadProgress(PROFILE.id);
      await recordMissionCompletion("mission-001", 1, 4); // node 1 -> 2
      expect(useProgressStore.getState().node).toBe(2);

      await recordMissionCompletion("mission-001", 1, 4); // replaying node 1 again
      expect(useProgressStore.getState().node).toBe(2); // unchanged
    });

    it("starts a 1-day streak on the first-ever completion", async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-07-17T12:00:00.000Z"));
      await loadProgress(PROFILE.id);
      await recordMissionCompletion("mission-001", 1, 4);
      const state = useProgressStore.getState();
      expect(state.streakCount).toBe(1);
      expect(state.longestStreak).toBe(1);
      expect(state.lastCompletedDate).toBe("2026-07-17");
      expect(state.node).toBe(2);
    });

    it("increments the streak when the previous completion was yesterday", async () => {
      await mockProgressBackend.saveProgress(PROFILE.id, {
        world: 0, node: 2, streakCount: 3, longestStreak: 3, lastCompletedDate: "2026-07-16",
      });
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-07-17T12:00:00.000Z"));
      await loadProgress(PROFILE.id);
      await recordMissionCompletion("mission-002", 2, 4);
      const state = useProgressStore.getState();
      expect(state.streakCount).toBe(4);
      expect(state.longestStreak).toBe(4);
    });

    it("resets the streak to 1 after a gap longer than a day", async () => {
      await mockProgressBackend.saveProgress(PROFILE.id, {
        world: 0, node: 2, streakCount: 5, longestStreak: 5, lastCompletedDate: "2026-07-10",
      });
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-07-17T12:00:00.000Z"));
      await loadProgress(PROFILE.id);
      await recordMissionCompletion("mission-002", 2, 4);
      const state = useProgressStore.getState();
      expect(state.streakCount).toBe(1);
      expect(state.longestStreak).toBe(5); // longest streak is never reduced
    });

    it("persists the new record to the backend so a reload sees it", async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-07-17T12:00:00.000Z"));
      await loadProgress(PROFILE.id);
      await recordMissionCompletion("mission-001", 1, 4);

      useProgressStore.getState().reset();
      await loadProgress(PROFILE.id);
      expect(useProgressStore.getState().node).toBe(2);
    });
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/lib/progress.test.ts`
Expected: FAIL — `Cannot find module './progress'`

- [ ] **Step 3: Implement `src/lib/progress.ts`**

```typescript
import { progressBackend } from "@/services/progressBackend";
import { useProgressStore } from "@/store/progressStore";
import { useAuthStore } from "@/store/authStore";
import { todayDateString, yesterdayDateString } from "@/lib/date";
import type { ProgressRecord } from "@/services/progressTypes";

export async function loadProgress(profileId: string): Promise<void> {
  const record = await progressBackend.loadProgress(profileId);
  useProgressStore.getState().setProgress(record);
}

function nextStreakCount(lastCompletedDate: string | null, streakCount: number): number {
  const today = todayDateString();
  if (lastCompletedDate === today) return streakCount; // defensive -- the lock state should prevent this
  if (lastCompletedDate === yesterdayDateString()) return streakCount + 1;
  return 1;
}

export async function recordMissionCompletion(
  missionId: string,
  missionNode: number,
  activitiesDone: number,
): Promise<void> {
  try {
    const profileId = useAuthStore.getState().activeProfile?.id;
    if (!profileId) return;

    const current = useProgressStore.getState();
    if (missionNode !== current.node) return; // replay of an already-completed mission

    const streakCount = nextStreakCount(current.lastCompletedDate, current.streakCount);
    const updated: ProgressRecord = {
      world: current.world,
      node: current.node + 1,
      streakCount,
      longestStreak: Math.max(current.longestStreak, streakCount),
      lastCompletedDate: todayDateString(),
    };

    await progressBackend.saveProgress(profileId, updated);
    await progressBackend.insertCompletion(profileId, missionId, activitiesDone);
    useProgressStore.getState().setProgress(updated);
  } catch {
    // Best-effort persistence -- per spec ("no failure, no losing"), a
    // network blip must never block the reward moment. The caller does
    // not await this, by design.
  }
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/lib/progress.test.ts`
Expected: PASS (7 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/progress.ts src/lib/progress.test.ts
git commit -m "feat: add lib/progress facade with streak-transition logic"
```

---

### Task 7: Wire progress into auth (login/signup/logout)

**Files:**
- Modify: `src/lib/auth.ts`
- Modify: `src/store/authStore.ts`
- Modify: `src/lib/auth.test.ts`

**Interfaces:**
- Consumes: `loadProgress` from Task 6; `useProgressStore` from Task 2.

- [ ] **Step 1: Replace `src/lib/auth.ts`'s full content**

```typescript
import type { Profile, SignupArgs } from "@/services/mockBackend";
import { backend } from "@/services/backend";
import { useAuthStore } from "@/store/authStore";
import { addKnownProfile } from "@/lib/knownProfiles";
import { loadProgress } from "@/lib/progress";

export type { Profile, SignupArgs };

export async function signup(args: SignupArgs): Promise<{ profile: Profile; recoveryCode: string }> {
  const { profile, token, recoveryCode } = await backend.signup(args);
  useAuthStore.getState().login(token, profile);
  addKnownProfile({ profileId: profile.id, username: profile.username, avatar: profile.avatar });
  await loadProgress(profile.id);
  return { profile, recoveryCode };
}

export async function login(username: string, pin: string[]): Promise<Profile> {
  const { profile, token } = await backend.login(username, pin);
  useAuthStore.getState().login(token, profile);
  addKnownProfile({ profileId: profile.id, username: profile.username, avatar: profile.avatar });
  await loadProgress(profile.id);
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

- [ ] **Step 2: Replace `src/store/authStore.ts`'s full content**

```typescript
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
```

- [ ] **Step 3: Update `src/lib/auth.test.ts`'s full content**

```typescript
import { signup, login, recoverPin, checkUsernameAvailable } from "./auth";
import { useAuthStore } from "@/store/authStore";
import { useProgressStore } from "@/store/progressStore";
import { mockBackend } from "@/services/mockBackend";
import { mockProgressBackend } from "@/services/mockProgressBackend";

describe("auth", () => {
  beforeEach(() => {
    mockBackend.reset();
    mockProgressBackend.reset();
    useAuthStore.getState().logout();
    useProgressStore.getState().reset();
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

  it("signup also loads progress for the new profile", async () => {
    await signup({ username: "SpeedyOtter", pin: ["🐱", "⚡", "🍕", "🌈"], avatar: "avatar_cat", age_band: "6-8" });
    expect(useProgressStore.getState().isLoaded).toBe(true);
    expect(useProgressStore.getState().node).toBe(1);
  });

  it("login logs the profile into useAuthStore", async () => {
    await signup({ username: "SpeedyOtter", pin: ["🐱", "⚡", "🍕", "🌈"], avatar: "avatar_cat", age_band: "6-8" });
    useAuthStore.getState().logout();
    const profile = await login("SpeedyOtter", ["🐱", "⚡", "🍕", "🌈"]);
    expect(profile.username).toBe("SpeedyOtter");
    expect(useAuthStore.getState().activeProfile?.username).toBe("SpeedyOtter");
  });

  it("login also loads progress for the returning profile", async () => {
    await signup({ username: "SpeedyOtter", pin: ["🐱", "⚡", "🍕", "🌈"], avatar: "avatar_cat", age_band: "6-8" });
    useAuthStore.getState().logout();
    await login("SpeedyOtter", ["🐱", "⚡", "🍕", "🌈"]);
    expect(useProgressStore.getState().isLoaded).toBe(true);
  });

  it("logout resets the progress store", async () => {
    await signup({ username: "SpeedyOtter", pin: ["🐱", "⚡", "🍕", "🌈"], avatar: "avatar_cat", age_band: "6-8" });
    expect(useProgressStore.getState().isLoaded).toBe(true);
    useAuthStore.getState().logout();
    expect(useProgressStore.getState().isLoaded).toBe(false);
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

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/auth.test.ts`
Expected: PASS (8 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/auth.ts src/store/authStore.ts src/lib/auth.test.ts
git commit -m "feat: load progress on login/signup, reset it on logout"
```

---

### Task 8: JourneyMap daily-gate lock states

**Files:**
- Modify: `src/screens/JourneyMap.tsx`
- Modify: `src/screens/JourneyMap.test.tsx`

**Interfaces:**
- Consumes: `useProgressStore` from Task 2; `missionLockState`, `todayDateString` from Task 5.

- [ ] **Step 1: Replace `src/screens/JourneyMap.tsx`'s full content**

```tsx
import { FocusableButton } from "@/components/FocusableButton";
import { PageShell } from "@/components/PageShell";
import { useUiStore } from "@/store/uiStore";
import { useProgressStore } from "@/store/progressStore";
import { missionLockState } from "@/lib/missionLockState";
import { todayDateString } from "@/lib/date";
import type { World, Mission } from "@/content/types";

interface Props {
  world: World;
  missions: Mission[];
}

export function JourneyMap({ world, missions }: Props) {
  const startMission = useUiStore((s) => s.startMission);
  const progressNode = useProgressStore((s) => s.node);
  const lastCompletedDate = useProgressStore((s) => s.lastCompletedDate);
  const today = todayDateString();

  return (
    <PageShell>
      <h1 className="text-3xl font-bold mb-6">{world.name}</h1>
      <ul className="grid grid-cols-3 gap-4 list-none p-0 m-0">
        {missions.map((mission) => {
          const state = missionLockState(mission.node, progressNode, lastCompletedDate, today);
          if (state === "locked") {
            return (
              <li key={mission.id}>
                <div
                  aria-label={`${mission.title}, locked`}
                  className="w-full rounded-2xl p-4 text-center font-bold bg-storybook-tan text-storybook-ink opacity-60"
                >
                  {mission.title}
                </div>
              </li>
            );
          }
          return (
            <li key={mission.id}>
              <FocusableButton
                variant="card"
                className="w-full bg-storybook-mint text-storybook-mintText"
                autoFocus={state === "current"}
                onPress={() => startMission(mission.id)}
              >
                {mission.title}
              </FocusableButton>
            </li>
          );
        })}
      </ul>
    </PageShell>
  );
}
```

- [ ] **Step 2: Add lock-state tests to `src/screens/JourneyMap.test.tsx`**

Append this new `describe` block (keep the existing `describe("JourneyMap", ...)` block exactly as-is — those 3 tests need no changes, since a single mission at `node: 1` with the default fresh progressStore state is always "current"):

```typescript
import { useProgressStore } from "@/store/progressStore";

// ...(existing imports and the "JourneyMap" describe block stay unchanged)...

describe("JourneyMap lock states", () => {
  const threeMissions: Mission[] = [
    { id: "mission-001", worldId: "world-jungle", node: 1, title: "Day 1: Wake Up", activityIds: [] },
    { id: "mission-002", worldId: "world-jungle", node: 2, title: "Day 2: Stretch It Out", activityIds: [] },
    { id: "mission-003", worldId: "world-jungle", node: 3, title: "Day 3: Cool Down", activityIds: [] },
  ];

  afterEach(() => useProgressStore.getState().reset());

  it("renders a mission before the current node as completed (still a clickable button)", () => {
    useProgressStore.getState().setProgress({
      world: 0, node: 2, streakCount: 1, longestStreak: 1, lastCompletedDate: "2020-01-01",
    });
    render(<JourneyMap world={world} missions={threeMissions} />);
    expect(screen.getByRole("button", { name: /day 1/i })).toBeInTheDocument();
  });

  it("renders the mission at the current node as a focusable button", async () => {
    useProgressStore.getState().setProgress({
      world: 0, node: 2, streakCount: 1, longestStreak: 1, lastCompletedDate: "2020-01-01",
    });
    render(<JourneyMap world={world} missions={threeMissions} />);
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /day 2/i })).toHaveAttribute("data-focused", "true"),
    );
  });

  it("renders a mission after the current node as locked, not a button", () => {
    useProgressStore.getState().setProgress({
      world: 0, node: 2, streakCount: 1, longestStreak: 1, lastCompletedDate: "2020-01-01",
    });
    render(<JourneyMap world={world} missions={threeMissions} />);
    expect(screen.queryByRole("button", { name: /day 3/i })).not.toBeInTheDocument();
    expect(screen.getByText(/day 3/i)).toBeInTheDocument();
  });

  it("renders the current mission as locked if it was already completed today", () => {
    const today = new Date().toISOString().slice(0, 10);
    useProgressStore.getState().setProgress({
      world: 0, node: 2, streakCount: 1, longestStreak: 1, lastCompletedDate: today,
    });
    render(<JourneyMap world={world} missions={threeMissions} />);
    expect(screen.queryByRole("button", { name: /day 2/i })).not.toBeInTheDocument();
    expect(screen.getByText(/day 2/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Run tests to verify they pass**

Run: `npx vitest run src/screens/JourneyMap.test.tsx`
Expected: PASS (7 tests — the original 3 plus 4 new)

- [ ] **Step 4: Commit**

```bash
git add src/screens/JourneyMap.tsx src/screens/JourneyMap.test.tsx
git commit -m "feat: add daily-gate lock states to JourneyMap"
```

---

### Task 9: MissionPlayer completion-write wiring

**Files:**
- Modify: `src/screens/MissionPlayer.tsx`
- Modify: `src/screens/MissionPlayer.test.tsx`

**Interfaces:**
- Consumes: `recordMissionCompletion` from Task 6.

- [ ] **Step 1: Replace `src/screens/MissionPlayer.tsx`'s full content**

```tsx
import { useEffect, useState } from "react";
import { FocusableButton } from "@/components/FocusableButton";
import { PageShell } from "@/components/PageShell";
import { useUiStore } from "@/store/uiStore";
import { recordMissionCompletion } from "@/lib/progress";
import type { Activity, Mission } from "@/content/types";

interface Props {
  mission: Mission;
  activities: Activity[];
}

export function MissionPlayer({ mission, activities }: Props) {
  const goToReward = useUiStore((s) => s.goToReward);
  const [index, setIndex] = useState(0);
  const activity = activities[index];

  useEffect(() => {
    if (activities.length === 0) {
      void recordMissionCompletion(mission.id, mission.node, 0);
      goToReward();
    }
  }, [activities, goToReward, mission.id, mission.node]);

  const onDone = () => {
    if (index + 1 >= activities.length) {
      void recordMissionCompletion(mission.id, mission.node, activities.length);
      goToReward();
    } else {
      setIndex((i) => i + 1);
    }
  };

  if (!activity) return null;

  return (
    <PageShell>
      <section aria-label={mission.title}>
        <p className="text-lg opacity-80 mb-4">
          Activity {index + 1} of {activities.length}
        </p>
        <div className="bg-storybook-lavender text-storybook-lavenderText rounded-2xl p-6 mb-6">
          <h2 className="text-2xl font-bold mb-2">{activity.title}</h2>
          {activity.type === "movement" && <p className="text-lg">{activity.instructions}</p>}
        </div>
        <FocusableButton
          key={activity.id}
          variant="pill"
          className="bg-storybook-peach text-storybook-peachText"
          autoFocus
          focusKey={`done-${activity.id}`}
          onPress={onDone}
        >
          Done
        </FocusableButton>
      </section>
    </PageShell>
  );
}
```

- [ ] **Step 2: Add progress-recording tests to `src/screens/MissionPlayer.test.tsx`**

Add these imports to the top of the file and this new `describe` block (keep the existing `describe("MissionPlayer", ...)` block unchanged):

```typescript
import { useAuthStore } from "@/store/authStore";
import { useProgressStore } from "@/store/progressStore";

// ...

describe("MissionPlayer progress recording", () => {
  beforeEach(() => {
    useAuthStore.setState({
      activeProfile: { id: "profile-1", username: "SpeedyOtter", avatar: "avatar_cat", age_band: "6-8" },
    });
    useProgressStore.getState().setProgress({
      world: 0, node: 1, streakCount: 0, longestStreak: 0, lastCompletedDate: null,
    });
  });

  afterEach(() => {
    useAuthStore.getState().logout();
    useProgressStore.getState().reset();
  });

  it("advances the progress node after completing the mission at the current node", async () => {
    const user = userEvent.setup();
    render(<MissionPlayer mission={mission} activities={activities} />);
    await user.click(screen.getByRole("button", { name: /done/i }));
    await user.click(screen.getByRole("button", { name: /done/i }));
    await waitFor(() => expect(useProgressStore.getState().node).toBe(2));
  });

  it("does not advance the node when replaying an already-completed mission", async () => {
    useProgressStore.getState().setProgress({
      world: 0, node: 2, streakCount: 1, longestStreak: 1, lastCompletedDate: "2020-01-01",
    });
    const user = userEvent.setup();
    render(<MissionPlayer mission={mission} activities={activities} />); // mission.node is 1, progress.node is 2
    await user.click(screen.getByRole("button", { name: /done/i }));
    await user.click(screen.getByRole("button", { name: /done/i }));
    await new Promise((resolve) => setTimeout(resolve, 0)); // let the fire-and-forget write settle
    expect(useProgressStore.getState().node).toBe(2); // unchanged
  });
});
```

- [ ] **Step 3: Run tests to verify they pass**

Run: `npx vitest run src/screens/MissionPlayer.test.tsx`
Expected: PASS (7 tests — the original 5 plus 2 new)

- [ ] **Step 4: Commit**

```bash
git add src/screens/MissionPlayer.tsx src/screens/MissionPlayer.test.tsx
git commit -m "feat: record mission completion in MissionPlayer"
```

---

### Task 10: RewardScreen streak display

**Files:**
- Modify: `src/screens/RewardScreen.tsx`
- Modify: `src/screens/RewardScreen.test.tsx`

**Interfaces:**
- Consumes: `useProgressStore` from Task 2.

- [ ] **Step 1: Replace `src/screens/RewardScreen.tsx`'s full content**

```tsx
import { FocusableButton } from "@/components/FocusableButton";
import { PageShell } from "@/components/PageShell";
import { useUiStore } from "@/store/uiStore";
import { useProgressStore } from "@/store/progressStore";

interface Props {
  missionTitle: string;
}

export function RewardScreen({ missionTitle }: Props) {
  const goToMap = useUiStore((s) => s.goToMap);
  const streakCount = useProgressStore((s) => s.streakCount);
  return (
    <PageShell>
      <section className="text-center">
        <h1 className="text-3xl font-bold mb-4">You did it!</h1>
        <p className="text-lg mb-4">{missionTitle} complete — you earned a star!</p>
        {streakCount >= 2 && (
          <p className="text-lg font-bold text-storybook-gold mb-4">{streakCount}-day streak!</p>
        )}
        <FocusableButton variant="pill" className="bg-storybook-peach text-storybook-peachText" autoFocus onPress={goToMap}>
          Back to Map
        </FocusableButton>
      </section>
    </PageShell>
  );
}
```

- [ ] **Step 2: Add streak-display tests to `src/screens/RewardScreen.test.tsx`**

Add this import and new `describe` block (keep the existing `describe("RewardScreen", ...)` block unchanged):

```typescript
import { useProgressStore } from "@/store/progressStore";

// ...

describe("RewardScreen streak display", () => {
  afterEach(() => useProgressStore.getState().reset());

  it("shows a streak line when the streak is 2 or more days", () => {
    useProgressStore.getState().setProgress({
      world: 0, node: 2, streakCount: 3, longestStreak: 3, lastCompletedDate: "2026-07-17",
    });
    render(<RewardScreen missionTitle="Day 1: Wake Up Your Brain" />);
    expect(screen.getByText(/3-day streak/i)).toBeInTheDocument();
  });

  it("does not show a streak line on day 1 (no streak yet)", () => {
    useProgressStore.getState().setProgress({
      world: 0, node: 2, streakCount: 1, longestStreak: 1, lastCompletedDate: "2026-07-17",
    });
    render(<RewardScreen missionTitle="Day 1: Wake Up Your Brain" />);
    expect(screen.queryByText(/-day streak/i)).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Run tests to verify they pass**

Run: `npx vitest run src/screens/RewardScreen.test.tsx`
Expected: PASS (5 tests — the original 3 plus 2 new)

- [ ] **Step 4: Commit**

```bash
git add src/screens/RewardScreen.tsx src/screens/RewardScreen.test.tsx
git commit -m "feat: show a streak indicator on RewardScreen"
```

---

### Task 11: useContent reads the persisted world index

**Files:**
- Modify: `src/content/useContent.ts`

**Interfaces:**
- Consumes: `useProgressStore` from Task 2.

- [ ] **Step 1: Modify `src/content/useContent.ts`**

Add the import:

```typescript
import { useProgressStore } from "@/store/progressStore";
```

Replace this line:

```typescript
        const manifest = await loader.loadManifest();
        const world = await loader.loadWorld(manifest.worldIds[0]);
```

with:

```typescript
        const manifest = await loader.loadManifest();
        const worldIndex = useProgressStore.getState().world;
        const worldId = manifest.worldIds[worldIndex] ?? manifest.worldIds[0];
        const world = await loader.loadWorld(worldId);
```

- [ ] **Step 2: Verify no regressions**

Run: `npx vitest run src/App.e2e.test.tsx`
Expected: PASS (existing tests — `progress.world` defaults to `0`, matching the prior hardcoded `worldIds[0]` behavior exactly, so this is a no-op change until a second world exists in content).

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/content/useContent.ts
git commit -m "feat: load the persisted world index instead of hardcoding worldIds[0]"
```

---

### Task 12: App.e2e.test.tsx — reset progress state, add a resume-after-reload test

**Files:**
- Modify: `src/App.e2e.test.tsx`

**Interfaces:**
- Consumes: `useProgressStore` from Task 2; `loadProgress` from Task 6.

**Context:** The `App auth gating` describe block's existing `beforeEach` already calls `useAuthStore.getState().logout()`, which (per Task 7) now resets `progressStore` as a side effect — no changes needed there. The top-level `beforeEach` (used by the `App end-to-end` describe block) bypasses login entirely (`authScreen: null` set directly), so it needs its own explicit reset, plus a fake `activeProfile` so `recordMissionCompletion`/`loadProgress` have a profile ID to key off (without one, completion-recording silently no-ops, per Task 6's design).

- [ ] **Step 1: Replace the top-level `beforeEach` in `src/App.e2e.test.tsx`**

Add this import near the top of the file:

```typescript
import { useProgressStore } from "@/store/progressStore";
```

Replace:

```typescript
beforeEach(() => {
  useUiStore.getState().goToMap();
  window.localStorage.clear();
  useAuthStore.setState({ authScreen: null });
  vi.stubGlobal("fetch", vi.fn(async (url: string) => ({ ok: true, json: async () => byPath[url] })));
});
```

with:

```typescript
beforeEach(() => {
  useUiStore.getState().goToMap();
  useProgressStore.getState().reset();
  window.localStorage.clear();
  useAuthStore.setState({
    authScreen: null,
    activeProfile: { id: "e2e-profile", username: "TestKid", avatar: "avatar_cat", age_band: "6-8" },
  });
  vi.stubGlobal("fetch", vi.fn(async (url: string) => ({ ok: true, json: async () => byPath[url] })));
});
```

- [ ] **Step 2: Add a resume-after-reload test to the `App end-to-end` describe block**

```typescript
  it("resumes correctly after a reload: a mission completed today shows locked, not current", async () => {
    const user = userEvent.setup();
    const { unmount } = render(<App />);

    await waitFor(() =>
      expect(screen.getByRole("button", { name: /wake up your brain/i })).toHaveAttribute("data-focused", "true"),
    );
    await user.click(screen.getByRole("button", { name: /wake up your brain/i }));
    await user.click(screen.getByRole("button", { name: /done/i }));
    await waitFor(() => expect(screen.getByText(/you did it/i)).toBeInTheDocument());
    await user.click(screen.getByRole("button", { name: /back to map/i }));
    await waitFor(() => expect(useProgressStore.getState().node).toBe(2));

    unmount();
    // Simulate a real page reload: reset in-memory state (a fresh JS
    // runtime would start here), but keep the persisted mockProgressBackend
    // data intact -- that's the whole point of this test.
    useProgressStore.getState().reset();
    useUiStore.getState().goToMap();
    const { loadProgress } = await import("@/lib/progress");
    await loadProgress("e2e-profile");

    render(<App />);

    await waitFor(() => expect(screen.getByText(/jungle jump/i)).toBeInTheDocument());
    expect(screen.queryByRole("button", { name: /wake up your brain/i })).not.toBeInTheDocument();
    expect(screen.getByText(/wake up your brain/i)).toBeInTheDocument();
  });
```

Add this test inside the existing `describe("App end-to-end", ...)` block, after the `"recovers from a failed load by retrying"` test.

- [ ] **Step 3: Run tests to verify they pass**

Run: `npx vitest run src/App.e2e.test.tsx`
Expected: PASS (5 tests — the original 4 plus 1 new)

- [ ] **Step 4: Commit**

```bash
git add src/App.e2e.test.tsx
git commit -m "test: verify progress persists across a simulated reload"
```

---

### Task 13: Full-suite verification

**Files:** none (verification only — no code changes)

- [ ] **Step 1: Run the full test suite**

Run: `npm test`
Expected: PASS, zero failures.

- [ ] **Step 2: Run the type checker**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Run a production build**

Run: `npm run build`
Expected: build succeeds.

No commit for this task — it makes no file changes.
