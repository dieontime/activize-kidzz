# Activize Kidzz — Rewards Engine (Plan 5) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A content-driven badge rule engine (streak / world_complete / missions_total) that awards badges on mission completion, displayed inline on `RewardScreen` and on a new persistent Trophy Shelf screen.

**Architecture:** Badges are CDN-loaded content (like worlds/missions/activities) evaluated by a `badgeRuleRegistry` (one pure function per `rule.kind`). A new `lib/badges.ts` facade (`evaluateAndAwardBadges`) runs after every mission completion, checks each badge not yet in the persisted `earnedBadgeIds` set, awards newly-qualifying ones, and stores the result in a `newlyEarnedBadgeIds` field that `RewardScreen` reads reactively — same fire-and-forget, optimistic-UI pattern `recordMissionCompletion` already uses.

**Tech Stack:** No new dependencies. Existing Vite + React + TS + Vitest + Zustand + Supabase stack.

## Global Constraints

- Badge art is an `emoji` field, not a real asset — matches the renderer-art deferral already established in Plan 4.
- `world_complete` evaluates against the current world's `missionIds.length` (not a dedicated multi-world tracking system) — correct today even with one world; no rework needed when a future plan adds real multi-world advancement.
- Adding `totalMissionsCompleted` as a **required** field to `ProgressRecord` breaks every existing call site that constructs a full record literal (test fixtures across several files predating this plan). Task 3 is responsible for fixing every one of them, not just the ones it directly tests — the codebase must type-check and all pre-existing tests must still pass after Task 3, not just after Task 9.
- No new dependencies installed.
- Full `npm test` + `npx tsc --noEmit` + `npm run build` verification runs at the end (Task 9).

---

### Task 1: Badge content types + schema + fixtures

**Files:**
- Modify: `src/content/types.ts`
- Modify: `src/content/schema.ts`
- Modify: `src/content/schema.test.ts`
- Create: `src/content/__fixtures__/badge-streak-3.json`
- Create: `src/content/__fixtures__/badge-streak-7.json`
- Create: `src/content/__fixtures__/badge-world-complete-jungle.json`
- Create: `src/content/__fixtures__/badge-missions-total.json`

**Interfaces:**
- Produces: `BadgeRule`, `Badge` types (`content/types.ts`); `parseBadge` (`content/schema.ts`) — consumed by Task 2 (loader/useContent) and Task 5 (`badgeRuleRegistry`).

- [ ] **Step 1: Create the 4 badge fixture files**

`src/content/__fixtures__/badge-streak-3.json`:
```json
{ "id": "badge-streak-3", "name": "3-Day Streak", "emoji": "🔥", "rule": { "kind": "streak", "value": 3 } }
```

`src/content/__fixtures__/badge-streak-7.json`:
```json
{ "id": "badge-streak-7", "name": "7-Day Streak", "emoji": "🌟", "rule": { "kind": "streak", "value": 7 } }
```

`src/content/__fixtures__/badge-world-complete-jungle.json`:
```json
{ "id": "badge-world-complete-jungle", "name": "Jungle Explorer", "emoji": "🏆", "rule": { "kind": "world_complete", "worldId": "world-jungle" } }
```

`src/content/__fixtures__/badge-missions-total.json`:
```json
{ "id": "badge-missions-total", "name": "Mission Master", "emoji": "🎖️", "rule": { "kind": "missions_total", "value": 10 } }
```

- [ ] **Step 2: Append `BadgeRule`/`Badge` to `src/content/types.ts`** — add at the end of the file:

```typescript
export type BadgeRule =
  | { kind: "streak"; value: number }
  | { kind: "world_complete"; worldId: string }
  | { kind: "missions_total"; value: number };

export interface Badge {
  id: string;
  name: string;
  emoji: string;
  rule: BadgeRule;
}
```

- [ ] **Step 3: Write the failing tests** — replace `src/content/schema.test.ts`'s full content:

```typescript
import manifestJson from "./__fixtures__/manifest.json";
import worldJson from "./__fixtures__/world-jungle.json";
import missionJson from "./__fixtures__/mission-001.json";
import activityJson from "./__fixtures__/activity-cross-crawl.json";
import badgeStreak3Json from "./__fixtures__/badge-streak-3.json";
import badgeWorldCompleteJson from "./__fixtures__/badge-world-complete-jungle.json";
import badgeMissionsTotalJson from "./__fixtures__/badge-missions-total.json";
import { parseManifest, parseWorld, parseMission, parseActivity, parseBadge } from "./schema";

describe("content schema", () => {
  it("parses a valid manifest", () => {
    expect(parseManifest(manifestJson).worldIds).toEqual(["world-jungle"]);
  });

  it("parses a valid world", () => {
    expect(parseWorld(worldJson).name).toBe("Jungle Jump");
  });

  it("parses a valid mission with ordered activities", () => {
    expect(parseMission(missionJson).activityIds).toEqual(["activity-cross-crawl"]);
  });

  it("parses a movement activity with pacing", () => {
    const a = parseActivity(activityJson);
    expect(a.type).toBe("movement");
    if (a.type === "movement") {
      expect(a.pacing.reps).toBe(6);
    }
  });

  it("rejects an activity with an unknown type", () => {
    expect(() => parseActivity({ ...activityJson, type: "dance" })).toThrow();
  });

  it("rejects a manifest missing worldIds", () => {
    expect(() => parseManifest({ version: 1 })).toThrow();
  });

  it("parses a streak badge", () => {
    const b = parseBadge(badgeStreak3Json);
    expect(b.rule).toEqual({ kind: "streak", value: 3 });
  });

  it("parses a world_complete badge", () => {
    const b = parseBadge(badgeWorldCompleteJson);
    expect(b.rule).toEqual({ kind: "world_complete", worldId: "world-jungle" });
  });

  it("parses a missions_total badge", () => {
    const b = parseBadge(badgeMissionsTotalJson);
    expect(b.rule).toEqual({ kind: "missions_total", value: 10 });
  });

  it("rejects a badge with an unknown rule kind", () => {
    expect(() => parseBadge({ ...badgeStreak3Json, rule: { kind: "mystery", value: 1 } })).toThrow();
  });
});
```

- [ ] **Step 4: Run to verify the new tests fail**

Run: `npx vitest run src/content/schema.test.ts`
Expected: FAIL — `parseBadge` is not exported from `./schema`; the original 6 tests still pass.

- [ ] **Step 5: Implement `parseBadge` in `src/content/schema.ts`** — replace the file's full content:

```typescript
import { z } from "zod";
import type { Manifest, World, Mission, Activity, Badge } from "./types";

const ageBand = z.enum(["3-5", "6-8"]);
const renderer = z.enum(["rive", "lottie", "video", "react"]);

const manifestSchema = z.object({
  version: z.number(),
  worldIds: z.array(z.string()),
  badgeIds: z.array(z.string()),
});

const worldSchema = z.object({
  id: z.string(),
  order: z.number(),
  theme: z.string(),
  name: z.string(),
  missionIds: z.array(z.string()),
  art: z.string(),
});

const missionSchema = z.object({
  id: z.string(),
  worldId: z.string(),
  node: z.number(),
  title: z.string(),
  activityIds: z.array(z.string()),
});

const activityBase = { id: z.string(), title: z.string(), ageBands: z.array(ageBand), narration: z.string(), interstitial: z.boolean().optional() };

const activitySchema = z.discriminatedUnion("type", [
  z.object({ ...activityBase, type: z.literal("movement"), renderer, asset: z.string(), pacing: z.object({ reps: z.number(), tempoMs: z.number() }), instructions: z.string() }),
  z.object({ ...activityBase, type: z.literal("puzzle"), puzzleType: z.string(), data: z.record(z.unknown()) }),
  z.object({ ...activityBase, type: z.literal("breathing"), renderer, asset: z.string(), cycles: z.number() }),
]);

const badgeRuleSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("streak"), value: z.number() }),
  z.object({ kind: z.literal("world_complete"), worldId: z.string() }),
  z.object({ kind: z.literal("missions_total"), value: z.number() }),
]);

const badgeSchema = z.object({
  id: z.string(),
  name: z.string(),
  emoji: z.string(),
  rule: badgeRuleSchema,
});

export const parseManifest = (json: unknown): Manifest => manifestSchema.parse(json);
export const parseWorld = (json: unknown): World => worldSchema.parse(json);
export const parseMission = (json: unknown): Mission => missionSchema.parse(json);
export const parseActivity = (json: unknown): Activity => activitySchema.parse(json) as Activity;
export const parseBadge = (json: unknown): Badge => badgeSchema.parse(json) as Badge;
```

- [ ] **Step 6: Run to verify all tests pass**

Run: `npx vitest run src/content/schema.test.ts`
Expected: PASS (10 tests)

- [ ] **Step 7: Commit**

```bash
git add src/content/types.ts src/content/schema.ts src/content/schema.test.ts src/content/__fixtures__/badge-streak-3.json src/content/__fixtures__/badge-streak-7.json src/content/__fixtures__/badge-world-complete-jungle.json src/content/__fixtures__/badge-missions-total.json
git commit -m "feat: add Badge content type, schema, and fixtures"
```

---

### Task 2: Loader + useContent badge loading

**Files:**
- Modify: `src/content/loader.ts`
- Modify: `src/content/useContent.ts`
- Modify: `src/content/__fixtures__/manifest.json`
- Modify: `src/App.e2e.test.tsx`

**Interfaces:**
- Consumes: `parseBadge`, `Badge` (Task 1).
- Produces: `ContentLoader.loadBadge(id)`; `ContentState.badges: Badge[]` — consumed by Task 6 (`MissionPlayer`/`App.tsx`), Task 7 (`RewardScreen`), Task 8 (`TrophyShelf`).

**Note:** no dedicated test is added for `loadBadge` in `loader.test.ts` — `loadWorld`/`loadMission`/`loadActivity` have no direct loader-level tests either (only `loadManifest`'s resilience paths are tested there); coverage for the other loaders comes through the e2e integration test, and this plan follows that same existing precedent for `loadBadge`.

- [ ] **Step 1: Add `loadBadge` to `src/content/loader.ts`** — replace the file's full content:

```typescript
import { parseManifest, parseWorld, parseMission, parseActivity, parseBadge } from "./schema";
import type { Manifest, World, Mission, Activity, Badge } from "./types";

export interface ContentLoaderDeps {
  baseUrl: string;
  fetchFn?: typeof fetch;
  storage?: Pick<Storage, "getItem" | "setItem">;
}

export interface ContentLoader {
  loadManifest(): Promise<Manifest>;
  loadWorld(id: string): Promise<World>;
  loadMission(id: string): Promise<Mission>;
  loadActivity(id: string): Promise<Activity>;
  loadBadge(id: string): Promise<Badge>;
}

const KEY = "activize:content:";

export function createContentLoader(deps: ContentLoaderDeps): ContentLoader {
  const fetchFn = deps.fetchFn ?? fetch;
  const memory = new Map<string, unknown>();

  async function load<T>(path: string, parse: (j: unknown) => T): Promise<T> {
    const cacheKey = KEY + path;
    try {
      const res = await fetchFn(`${deps.baseUrl}/${path}`);
      if (!("ok" in res) || !res.ok) throw new Error(`bad status for ${path}`);
      const value = parse(await res.json());
      memory.set(cacheKey, value);
      try {
        deps.storage?.setItem(cacheKey, JSON.stringify(value));
      } catch {
        /* persistence is best-effort */
      }
      return value;
    } catch (err) {
      if (memory.has(cacheKey)) return memory.get(cacheKey) as T;
      const stored = deps.storage?.getItem(cacheKey);
      if (stored) {
        try {
          return parse(JSON.parse(stored));
        } catch {
          /* corrupted cache — fall through */
        }
      }
      throw err;
    }
  }

  return {
    loadManifest: () => load("manifest.json", parseManifest),
    loadWorld: (id) => load(`worlds/${id}.json`, parseWorld),
    loadMission: (id) => load(`missions/${id}.json`, parseMission),
    loadActivity: (id) => load(`activities/${id}.json`, parseActivity),
    loadBadge: (id) => load(`badges/${id}.json`, parseBadge),
  };
}
```

- [ ] **Step 2: Add badge loading to `src/content/useContent.ts`** — replace the file's full content:

```typescript
import { useEffect, useState } from "react";
import { createContentLoader } from "./loader";
import { useProgressStore } from "@/store/progressStore";
import type { World, Mission, Activity, Badge } from "./types";

const baseUrl = import.meta.env.VITE_CONTENT_URL ?? "/content";

export interface ContentState {
  status: "loading" | "ready" | "error";
  world: World | null;
  missions: Mission[];
  activitiesByMission: Record<string, Activity[]>;
  badges: Badge[];
  retry: () => void;
}

export function useContent(): ContentState {
  const [state, setState] = useState<Omit<ContentState, "retry">>({
    status: "loading",
    world: null,
    missions: [],
    activitiesByMission: {},
    badges: [],
  });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setState((s) => ({ ...s, status: "loading" }));
    const loader = createContentLoader({ baseUrl, storage: window.localStorage });
    (async () => {
      try {
        const manifest = await loader.loadManifest();
        const worldIndex = useProgressStore.getState().world;
        const worldId = manifest.worldIds[worldIndex] ?? manifest.worldIds[0];
        const world = await loader.loadWorld(worldId);
        const missions = await Promise.all(world.missionIds.map((id) => loader.loadMission(id)));
        const activitiesByMission: Record<string, Activity[]> = {};
        for (const mission of missions) {
          activitiesByMission[mission.id] = await Promise.all(mission.activityIds.map((id) => loader.loadActivity(id)));
        }
        const badges = await Promise.all(manifest.badgeIds.map((id) => loader.loadBadge(id)));
        if (!cancelled) setState({ status: "ready", world, missions, activitiesByMission, badges });
      } catch {
        if (!cancelled) setState((s) => ({ ...s, status: "error" }));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  return { ...state, retry: () => setAttempt((a) => a + 1) };
}
```

- [ ] **Step 3: Update the shared manifest fixture** — replace `src/content/__fixtures__/manifest.json`'s full content:

```json
{ "version": 1, "worldIds": ["world-jungle"], "badgeIds": ["badge-streak-3", "badge-streak-7", "badge-world-complete-jungle", "badge-missions-total"] }
```

- [ ] **Step 4: Wire the new badge fetches into the e2e fixture mock** — in `src/App.e2e.test.tsx`, add 4 imports after the existing `activity` import (line 10):

```tsx
import badgeStreak3 from "@/content/__fixtures__/badge-streak-3.json";
import badgeStreak7 from "@/content/__fixtures__/badge-streak-7.json";
import badgeWorldComplete from "@/content/__fixtures__/badge-world-complete-jungle.json";
import badgeMissionsTotal from "@/content/__fixtures__/badge-missions-total.json";
```

and add 4 entries to the `byPath` map (after the existing `"/content/activities/activity-cross-crawl.json": activity,` line):

```tsx
  "/content/badges/badge-streak-3.json": badgeStreak3,
  "/content/badges/badge-streak-7.json": badgeStreak7,
  "/content/badges/badge-world-complete-jungle.json": badgeWorldComplete,
  "/content/badges/badge-missions-total.json": badgeMissionsTotal,
```

**Why this is required, not optional:** `useContent` now fetches every id in `manifest.badgeIds` on boot. Without these 4 routes, the e2e test's fetch mock returns `undefined` for each badge URL, `parseBadge` throws, and `useContent` falls into its `status: "error"` branch — every e2e test would fail with "Let's try again" never resolving.

- [ ] **Step 5: Run the e2e suite to verify it still passes**

Run: `npx vitest run src/App.e2e.test.tsx`
Expected: PASS (5 tests, unchanged count — this step only fixes fixture wiring, no new assertions).

**Note on a real behavior change this surfaces (expected, not a bug):** `world-jungle`'s fixture has exactly one mission. Once Task 6 wires `evaluateAndAwardBadges` into `MissionPlayer`, completing that one mission will make `node` (2) exceed `totalMissionsInWorld` (1), so `badge-world-complete-jungle` becomes newly earned during both e2e tests that complete the mission. This doesn't break any existing e2e assertion (they use partial-text matchers, not exact-content matchers) — flagged here so it isn't mistaken for a regression during Task 9's full-suite run.

- [ ] **Step 6: Commit**

```bash
git add src/content/loader.ts src/content/useContent.ts src/content/__fixtures__/manifest.json src/App.e2e.test.tsx
git commit -m "feat: load badge content in useContent"
```

---

### Task 3: Progress data model — `totalMissionsCompleted` counter

**Files:**
- Modify: `src/services/progressTypes.ts`
- Modify: `src/services/mockProgressBackend.ts`
- Modify: `src/services/mockProgressBackend.test.ts`
- Modify: `src/services/supabaseProgressBackend.ts`
- Create: `supabase/migrations/20260720090000_rewards_schema.sql`
- Modify: `src/lib/progress.ts`
- Modify: `src/lib/progress.test.ts`
- Modify: `src/store/progressStore.test.ts` (mechanical fix only — see Step 12)
- Modify: `src/screens/RewardScreen.test.tsx` (mechanical fix only — see Step 12)
- Modify: `src/screens/JourneyMap.test.tsx` (mechanical fix only — see Step 12)
- Modify: `src/screens/MissionPlayer.test.tsx` (mechanical fix only — see Step 12)

**Interfaces:**
- Produces: `ProgressRecord.totalMissionsCompleted: number`; `progressBackend.insertEarnedBadge(profileId, badgeId)`; `progressBackend.loadEarnedBadges(profileId): Promise<string[]>` — consumed by Task 4 (`progressStore`/`lib/progress.ts`'s `loadProgress`) and Task 5 (`lib/badges.ts`).

**Why this task touches 4 unrelated test files:** adding a required field to `ProgressRecord` breaks every existing test that constructs a full record literal by hand (not via `{ ...DEFAULT_PROGRESS }` spread). This is the same category of ripple Plan 4 hit with `App.e2e.test.tsx` — fixing it here, in the task that causes it, keeps every task's end-state green rather than deferring a known break to Task 9.

- [ ] **Step 1: Add the field to `src/services/progressTypes.ts`** — replace the file's full content:

```typescript
export interface ProgressRecord {
  world: number;
  node: number;
  streakCount: number;
  longestStreak: number;
  lastCompletedDate: string | null;
  totalMissionsCompleted: number;
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
  totalMissionsCompleted: 0,
};
```

- [ ] **Step 2: Write the failing tests** — replace `src/services/mockProgressBackend.test.ts`'s full content:

```typescript
import { mockProgressBackend } from "./mockProgressBackend";

describe("mockProgressBackend", () => {
  beforeEach(() => mockProgressBackend.reset());

  it("returns the default record when no progress exists for a profile", async () => {
    const record = await mockProgressBackend.loadProgress("profile-1");
    expect(record).toEqual({
      world: 0, node: 1, streakCount: 0, longestStreak: 0, lastCompletedDate: null, totalMissionsCompleted: 0,
    });
  });

  it("saveProgress persists and loadProgress returns the saved record", async () => {
    await mockProgressBackend.saveProgress("profile-1", {
      world: 0, node: 2, streakCount: 1, longestStreak: 1, lastCompletedDate: "2026-07-17", totalMissionsCompleted: 1,
    });
    const record = await mockProgressBackend.loadProgress("profile-1");
    expect(record).toEqual({
      world: 0, node: 2, streakCount: 1, longestStreak: 1, lastCompletedDate: "2026-07-17", totalMissionsCompleted: 1,
    });
  });

  it("keeps progress isolated per profile", async () => {
    await mockProgressBackend.saveProgress("profile-1", {
      world: 0, node: 2, streakCount: 1, longestStreak: 1, lastCompletedDate: "2026-07-17", totalMissionsCompleted: 1,
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

  it("returns an empty list of earned badges for a profile with none", async () => {
    const badges = await mockProgressBackend.loadEarnedBadges("profile-1");
    expect(badges).toEqual([]);
  });

  it("insertEarnedBadge persists and loadEarnedBadges returns it", async () => {
    await mockProgressBackend.insertEarnedBadge("profile-1", "badge-streak-3");
    const badges = await mockProgressBackend.loadEarnedBadges("profile-1");
    expect(badges).toEqual(["badge-streak-3"]);
  });

  it("keeps earned badges isolated per profile", async () => {
    await mockProgressBackend.insertEarnedBadge("profile-1", "badge-streak-3");
    const other = await mockProgressBackend.loadEarnedBadges("profile-2");
    expect(other).toEqual([]);
  });
});
```

- [ ] **Step 3: Run to verify it fails**

Run: `npx vitest run src/services/mockProgressBackend.test.ts`
Expected: FAIL — the two round-trip tests fail (`total_missions_completed` isn't persisted yet), and the three earned-badge tests fail to compile (`insertEarnedBadge`/`loadEarnedBadges` don't exist on `mockProgressBackend` yet).

- [ ] **Step 4: Implement `src/services/mockProgressBackend.ts`** — replace the file's full content:

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
  total_missions_completed: number;
}

interface StoredCompletion {
  id: string;
  profile_id: string;
  mission_id: string;
  completed_at: string;
  activities_done: number;
}

interface StoredEarnedBadge {
  profile_id: string;
  badge_id: string;
  earned_at: string;
}

const KEY_PROGRESS = "mockProgressBackend.progress";
const KEY_COMPLETIONS = "mockProgressBackend.completions";
const KEY_BADGES = "mockProgressBackend.earnedBadges";

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
    totalMissionsCompleted: row.total_missions_completed,
  };
}

export const mockProgressBackend = {
  reset(): void {
    localStorage.removeItem(KEY_PROGRESS);
    localStorage.removeItem(KEY_COMPLETIONS);
    localStorage.removeItem(KEY_BADGES);
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
      total_missions_completed: record.totalMissionsCompleted,
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

  async insertEarnedBadge(profileId: string, badgeId: string): Promise<void> {
    const rows = readKey<StoredEarnedBadge>(KEY_BADGES);
    rows.push({ profile_id: profileId, badge_id: badgeId, earned_at: new Date().toISOString() });
    writeKey(KEY_BADGES, rows);
  },

  async loadEarnedBadges(profileId: string): Promise<string[]> {
    const rows = readKey<StoredEarnedBadge>(KEY_BADGES);
    return rows.filter((r) => r.profile_id === profileId).map((r) => r.badge_id);
  },
};
```

- [ ] **Step 5: Run to verify it passes**

Run: `npx vitest run src/services/mockProgressBackend.test.ts`
Expected: PASS (7 tests)

- [ ] **Step 6: Implement `src/services/supabaseProgressBackend.ts`** — replace the file's full content (no dedicated test file for this backend, matching the existing precedent — it isn't tested today either):

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
      .select("world, node, streak_count, longest_streak, last_completed_date, total_missions_completed")
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
      totalMissionsCompleted: data.total_missions_completed,
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
      total_missions_completed: record.totalMissionsCompleted,
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

  async insertEarnedBadge(profileId: string, badgeId: string): Promise<void> {
    const { error } = await client().from("earned_badges").insert({
      profile_id: profileId,
      badge_id: badgeId,
    });
    if (error) throw new Error(error.message);
  },

  async loadEarnedBadges(profileId: string): Promise<string[]> {
    const { data, error } = await client()
      .from("earned_badges")
      .select("badge_id")
      .eq("profile_id", profileId);
    if (error) throw new Error(error.message);
    return (data ?? []).map((row) => row.badge_id as string);
  },
};
```

- [ ] **Step 7: Create the migration** — `supabase/migrations/20260720090000_rewards_schema.sql`:

```sql
-- Activize Kidzz — rewards engine schema (Plan 5)
--
-- Adds the running mission-completion counter the missions_total badge
-- rule needs. earned_badges itself (table, RLS, grants) was already
-- created schema-only in Plan 3's migration -- this plan is the first to
-- actually write to it, via the existing permissive anon/authenticated
-- policy and grants, so no RLS/grant changes are needed here.

alter table progress
  add column if not exists total_missions_completed integer not null default 0;
```

- [ ] **Step 8: Write the failing test** — in `src/lib/progress.test.ts`, add totalMissionsCompleted to the two existing `mockProgressBackend.saveProgress` seed calls and add a new test. The two existing calls to fix (inside `describe("recordMissionCompletion", ...)`):

Before:
```ts
      await mockProgressBackend.saveProgress(PROFILE.id, {
        world: 0, node: 2, streakCount: 3, longestStreak: 3, lastCompletedDate: "2026-07-16",
      });
```
After:
```ts
      await mockProgressBackend.saveProgress(PROFILE.id, {
        world: 0, node: 2, streakCount: 3, longestStreak: 3, lastCompletedDate: "2026-07-16", totalMissionsCompleted: 5,
      });
```

Before:
```ts
      await mockProgressBackend.saveProgress(PROFILE.id, {
        world: 0, node: 2, streakCount: 5, longestStreak: 5, lastCompletedDate: "2026-07-10",
      });
```
After:
```ts
      await mockProgressBackend.saveProgress(PROFILE.id, {
        world: 0, node: 2, streakCount: 5, longestStreak: 5, lastCompletedDate: "2026-07-10", totalMissionsCompleted: 8,
      });
```

Then add this new test at the end of the `describe("recordMissionCompletion", ...)` block, right before its closing `});`:

```ts
    it("increments totalMissionsCompleted on each completion", async () => {
      await loadProgress(PROFILE.id);
      await recordMissionCompletion("mission-001", 1, 4);
      expect(useProgressStore.getState().totalMissionsCompleted).toBe(1);
    });
```

- [ ] **Step 9: Run to verify the new test fails**

Run: `npx vitest run src/lib/progress.test.ts`
Expected: FAIL — only the new "increments totalMissionsCompleted" test fails (`totalMissionsCompleted` stays `0`); the other 8 pass.

- [ ] **Step 10: Implement the increment in `src/lib/progress.ts`** — replace the file's full content:

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
      totalMissionsCompleted: current.totalMissionsCompleted + 1,
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

*(Note: this is Task 3's version of `lib/progress.ts` — Task 4 modifies `loadProgress` again to also load earned badges.)*

- [ ] **Step 11: Run to verify all tests pass**

Run: `npx vitest run src/lib/progress.test.ts`
Expected: PASS (9 tests)

- [ ] **Step 12: Fix the remaining `ProgressRecord` literal construction sites**

In `src/store/progressStore.test.ts`, the identical block appears twice (in `"setProgress replaces the record..."` and `"reset returns to the default zeroed state"`):

Before:
```ts
    useProgressStore.getState().setProgress({
      world: 0, node: 3, streakCount: 2, longestStreak: 5, lastCompletedDate: "2026-07-17",
    });
```
After (apply to both occurrences):
```ts
    useProgressStore.getState().setProgress({
      world: 0, node: 3, streakCount: 2, longestStreak: 5, lastCompletedDate: "2026-07-17", totalMissionsCompleted: 4,
    });
```

In `src/screens/RewardScreen.test.tsx`:

Before:
```ts
    useProgressStore.getState().setProgress({
      world: 0, node: 2, streakCount: 3, longestStreak: 3, lastCompletedDate: "2026-07-17",
    });
```
After:
```ts
    useProgressStore.getState().setProgress({
      world: 0, node: 2, streakCount: 3, longestStreak: 3, lastCompletedDate: "2026-07-17", totalMissionsCompleted: 3,
    });
```

Before:
```ts
    useProgressStore.getState().setProgress({
      world: 0, node: 2, streakCount: 1, longestStreak: 1, lastCompletedDate: "2026-07-17",
    });
```
After:
```ts
    useProgressStore.getState().setProgress({
      world: 0, node: 2, streakCount: 1, longestStreak: 1, lastCompletedDate: "2026-07-17", totalMissionsCompleted: 1,
    });
```

In `src/screens/JourneyMap.test.tsx`, this exact block appears 3 times (in `"renders a mission before..."`, `"renders the mission at the current node..."`, `"renders a mission after..."`):

Before:
```ts
    useProgressStore.getState().setProgress({
      world: 0, node: 2, streakCount: 1, longestStreak: 1, lastCompletedDate: "2020-01-01",
    });
```
After (apply to all 3 occurrences):
```ts
    useProgressStore.getState().setProgress({
      world: 0, node: 2, streakCount: 1, longestStreak: 1, lastCompletedDate: "2020-01-01", totalMissionsCompleted: 1,
    });
```

And the 4th call in `"renders the current mission as locked if it was already completed today"`:

Before:
```ts
    useProgressStore.getState().setProgress({
      world: 0, node: 2, streakCount: 1, longestStreak: 1, lastCompletedDate: today,
    });
```
After:
```ts
    useProgressStore.getState().setProgress({
      world: 0, node: 2, streakCount: 1, longestStreak: 1, lastCompletedDate: today, totalMissionsCompleted: 1,
    });
```

In `src/screens/MissionPlayer.test.tsx`, in the `beforeEach` of `describe("MissionPlayer progress recording", ...)`:

Before:
```ts
    useProgressStore.getState().setProgress({
      world: 0, node: 1, streakCount: 0, longestStreak: 0, lastCompletedDate: null,
    });
```
After:
```ts
    useProgressStore.getState().setProgress({
      world: 0, node: 1, streakCount: 0, longestStreak: 0, lastCompletedDate: null, totalMissionsCompleted: 0,
    });
```

And in `"does not advance the node when replaying an already-completed mission"`:

Before:
```ts
    useProgressStore.getState().setProgress({
      world: 0, node: 2, streakCount: 1, longestStreak: 1, lastCompletedDate: "2020-01-01",
    });
```
After:
```ts
    useProgressStore.getState().setProgress({
      world: 0, node: 2, streakCount: 1, longestStreak: 1, lastCompletedDate: "2020-01-01", totalMissionsCompleted: 1,
    });
```

- [ ] **Step 13: Run the full test suite and type checker to confirm no ripple remains**

Run: `npm test`
Expected: PASS, zero failures.

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 14: Commit**

```bash
git add src/services/progressTypes.ts src/services/mockProgressBackend.ts src/services/mockProgressBackend.test.ts src/services/supabaseProgressBackend.ts supabase/migrations/20260720090000_rewards_schema.sql src/lib/progress.ts src/lib/progress.test.ts src/store/progressStore.test.ts src/screens/RewardScreen.test.tsx src/screens/JourneyMap.test.tsx src/screens/MissionPlayer.test.tsx
git commit -m "feat: add totalMissionsCompleted counter and earned-badge read/write"
```

---

### Task 4: `progressStore` earned-badge state + `loadProgress` wiring

**Files:**
- Modify: `src/store/progressStore.ts`
- Modify: `src/store/progressStore.test.ts`
- Modify: `src/lib/progress.ts`
- Modify: `src/lib/progress.test.ts`

**Interfaces:**
- Consumes: `progressBackend.loadEarnedBadges` (Task 3).
- Produces: `progressStore`'s `earnedBadgeIds: string[]`, `newlyEarnedBadgeIds: string[]`, `setEarnedBadgeIds(ids)`, `awardBadges(newlyEarnedIds)` — consumed by Task 5 (`lib/badges.ts`), Task 7 (`RewardScreen`), Task 8 (`TrophyShelf`).

- [ ] **Step 1: Write the failing tests** — replace `src/store/progressStore.test.ts`'s full content:

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
    expect(state.earnedBadgeIds).toEqual([]);
    expect(state.newlyEarnedBadgeIds).toEqual([]);
  });

  it("setProgress replaces the record and marks isLoaded true", () => {
    useProgressStore.getState().setProgress({
      world: 0, node: 3, streakCount: 2, longestStreak: 5, lastCompletedDate: "2026-07-17", totalMissionsCompleted: 4,
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
      world: 0, node: 3, streakCount: 2, longestStreak: 5, lastCompletedDate: "2026-07-17", totalMissionsCompleted: 4,
    });
    useProgressStore.getState().awardBadges(["badge-streak-3"]);
    useProgressStore.getState().reset();
    const state = useProgressStore.getState();
    expect(state.node).toBe(1);
    expect(state.isLoaded).toBe(false);
    expect(state.earnedBadgeIds).toEqual([]);
    expect(state.newlyEarnedBadgeIds).toEqual([]);
  });

  it("setEarnedBadgeIds replaces the persisted badge id list", () => {
    useProgressStore.getState().setEarnedBadgeIds(["badge-streak-3", "badge-streak-7"]);
    expect(useProgressStore.getState().earnedBadgeIds).toEqual(["badge-streak-3", "badge-streak-7"]);
  });

  it("awardBadges appends to earnedBadgeIds and replaces newlyEarnedBadgeIds", () => {
    useProgressStore.getState().setEarnedBadgeIds(["badge-streak-3"]);
    useProgressStore.getState().awardBadges(["badge-streak-7"]);
    const state = useProgressStore.getState();
    expect(state.earnedBadgeIds).toEqual(["badge-streak-3", "badge-streak-7"]);
    expect(state.newlyEarnedBadgeIds).toEqual(["badge-streak-7"]);
  });

  it("awardBadges with an empty list clears newlyEarnedBadgeIds without changing earnedBadgeIds", () => {
    useProgressStore.getState().setEarnedBadgeIds(["badge-streak-3"]);
    useProgressStore.getState().awardBadges(["badge-streak-7"]);
    useProgressStore.getState().awardBadges([]);
    const state = useProgressStore.getState();
    expect(state.earnedBadgeIds).toEqual(["badge-streak-3", "badge-streak-7"]);
    expect(state.newlyEarnedBadgeIds).toEqual([]);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/store/progressStore.test.ts`
Expected: FAIL — `earnedBadgeIds`/`newlyEarnedBadgeIds`/`setEarnedBadgeIds`/`awardBadges` don't exist yet.

- [ ] **Step 3: Implement `src/store/progressStore.ts`** — replace the file's full content:

```typescript
import { create } from "zustand";
import { DEFAULT_PROGRESS, type ProgressRecord } from "@/services/progressTypes";

interface ProgressState extends ProgressRecord {
  isLoaded: boolean;
  earnedBadgeIds: string[];
  newlyEarnedBadgeIds: string[];
  setProgress: (record: ProgressRecord) => void;
  reset: () => void;
  setEarnedBadgeIds: (ids: string[]) => void;
  awardBadges: (newlyEarnedIds: string[]) => void;
}

export const useProgressStore = create<ProgressState>((set) => ({
  ...DEFAULT_PROGRESS,
  isLoaded: false,
  earnedBadgeIds: [],
  newlyEarnedBadgeIds: [],
  setProgress: (record) => set({ ...record, isLoaded: true }),
  reset: () => set({ ...DEFAULT_PROGRESS, isLoaded: false, earnedBadgeIds: [], newlyEarnedBadgeIds: [] }),
  setEarnedBadgeIds: (ids) => set({ earnedBadgeIds: ids }),
  awardBadges: (newlyEarnedIds) =>
    set((s) => ({
      earnedBadgeIds: [...s.earnedBadgeIds, ...newlyEarnedIds],
      newlyEarnedBadgeIds: newlyEarnedIds,
    })),
}));
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/store/progressStore.test.ts`
Expected: PASS (6 tests)

- [ ] **Step 5: Write the failing test** — in `src/lib/progress.test.ts`, add this test inside `describe("loadProgress", ...)`, right after the existing `"populates the progress store from the backend's default record for a new profile"` test:

```ts
    it("populates earnedBadgeIds from the backend", async () => {
      await mockProgressBackend.insertEarnedBadge(PROFILE.id, "badge-streak-3");
      await loadProgress(PROFILE.id);
      expect(useProgressStore.getState().earnedBadgeIds).toEqual(["badge-streak-3"]);
    });
```

- [ ] **Step 6: Run to verify it fails**

Run: `npx vitest run src/lib/progress.test.ts`
Expected: FAIL — `earnedBadgeIds` stays `[]` (`loadProgress` doesn't fetch it yet); the other 9 tests still pass.

- [ ] **Step 7: Implement the wiring in `src/lib/progress.ts`** — replace only the `loadProgress` function (everything else in the file is unchanged from Task 3):

Before:
```typescript
export async function loadProgress(profileId: string): Promise<void> {
  const record = await progressBackend.loadProgress(profileId);
  useProgressStore.getState().setProgress(record);
}
```
After:
```typescript
export async function loadProgress(profileId: string): Promise<void> {
  const [record, earnedBadgeIds] = await Promise.all([
    progressBackend.loadProgress(profileId),
    progressBackend.loadEarnedBadges(profileId),
  ]);
  useProgressStore.getState().setProgress(record);
  useProgressStore.getState().setEarnedBadgeIds(earnedBadgeIds);
}
```

- [ ] **Step 8: Run to verify all tests pass**

Run: `npx vitest run src/lib/progress.test.ts`
Expected: PASS (10 tests)

- [ ] **Step 9: Commit**

```bash
git add src/store/progressStore.ts src/store/progressStore.test.ts src/lib/progress.ts src/lib/progress.test.ts
git commit -m "feat: add earned-badge state to progressStore and loadProgress"
```

---

### Task 5: Badge rule engine (`badgeRuleRegistry` + `lib/badges.ts`)

**Files:**
- Create: `src/content/badgeRuleRegistry.ts`
- Create: `src/content/badgeRuleRegistry.test.ts`
- Create: `src/lib/badges.ts`
- Create: `src/lib/badges.test.ts`

**Interfaces:**
- Consumes: `Badge`, `BadgeRule` (Task 1); `progressStore.earnedBadgeIds`/`awardBadges` (Task 4); `progressBackend.insertEarnedBadge` (Task 3).
- Produces: `evaluateBadgeRule(rule, ctx)`, `BadgeEvalContext` (`content/badgeRuleRegistry.ts`); `evaluateAndAwardBadges(badges, ctx): Promise<Badge[]>` (`lib/badges.ts`) — consumed by Task 6 (`MissionPlayer`).

- [ ] **Step 1: Write the failing tests** — `src/content/badgeRuleRegistry.test.ts`:

```typescript
import { evaluateBadgeRule, type BadgeEvalContext } from "./badgeRuleRegistry";
import { DEFAULT_PROGRESS } from "@/services/progressTypes";

function ctx(progressOverrides: Partial<BadgeEvalContext["progress"]> = {}): BadgeEvalContext {
  return {
    progress: { ...DEFAULT_PROGRESS, ...progressOverrides },
    worldId: "world-jungle",
    totalMissionsInWorld: 1,
  };
}

describe("evaluateBadgeRule", () => {
  describe("streak", () => {
    it("is false one below the threshold", () => {
      expect(evaluateBadgeRule({ kind: "streak", value: 3 }, ctx({ streakCount: 2 }))).toBe(false);
    });
    it("is true at the threshold", () => {
      expect(evaluateBadgeRule({ kind: "streak", value: 3 }, ctx({ streakCount: 3 }))).toBe(true);
    });
    it("is true above the threshold", () => {
      expect(evaluateBadgeRule({ kind: "streak", value: 3 }, ctx({ streakCount: 4 }))).toBe(true);
    });
  });

  describe("world_complete", () => {
    it("is false when the current world doesn't match the badge's worldId", () => {
      const rule = { kind: "world_complete" as const, worldId: "world-desert" };
      expect(evaluateBadgeRule(rule, ctx({ node: 2 }))).toBe(false);
    });
    it("is false when node has not yet passed the world's mission count", () => {
      const rule = { kind: "world_complete" as const, worldId: "world-jungle" };
      expect(evaluateBadgeRule(rule, ctx({ node: 1 }))).toBe(false);
    });
    it("is true once node passes the world's mission count", () => {
      const rule = { kind: "world_complete" as const, worldId: "world-jungle" };
      expect(evaluateBadgeRule(rule, ctx({ node: 2 }))).toBe(true);
    });
  });

  describe("missions_total", () => {
    it("is false one below the target", () => {
      expect(evaluateBadgeRule({ kind: "missions_total", value: 10 }, ctx({ totalMissionsCompleted: 9 }))).toBe(false);
    });
    it("is true at the target", () => {
      expect(evaluateBadgeRule({ kind: "missions_total", value: 10 }, ctx({ totalMissionsCompleted: 10 }))).toBe(true);
    });
    it("is true above the target", () => {
      expect(evaluateBadgeRule({ kind: "missions_total", value: 10 }, ctx({ totalMissionsCompleted: 11 }))).toBe(true);
    });
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/content/badgeRuleRegistry.test.ts`
Expected: FAIL — `Cannot find module './badgeRuleRegistry'`

- [ ] **Step 3: Implement `src/content/badgeRuleRegistry.ts`**

```typescript
import type { BadgeRule } from "./types";
import type { ProgressRecord } from "@/services/progressTypes";

export interface BadgeEvalContext {
  progress: ProgressRecord;
  worldId: string;
  totalMissionsInWorld: number;
}

type BadgeRuleRegistry = {
  [K in BadgeRule["kind"]]: (rule: Extract<BadgeRule, { kind: K }>, ctx: BadgeEvalContext) => boolean;
};

export const badgeRuleRegistry: BadgeRuleRegistry = {
  streak: (rule, ctx) => ctx.progress.streakCount >= rule.value,
  world_complete: (rule, ctx) => rule.worldId === ctx.worldId && ctx.progress.node > ctx.totalMissionsInWorld,
  missions_total: (rule, ctx) => ctx.progress.totalMissionsCompleted >= rule.value,
};

export function evaluateBadgeRule(rule: BadgeRule, ctx: BadgeEvalContext): boolean {
  const evaluator = badgeRuleRegistry[rule.kind] as (rule: BadgeRule, ctx: BadgeEvalContext) => boolean;
  return evaluator(rule, ctx);
}
```

**Why the cast in `evaluateBadgeRule`:** TypeScript can't statically prove that indexing `badgeRuleRegistry` by a non-literal `rule.kind` preserves the correlation between the chosen key and `rule`'s own narrowed type (a well-known limitation for this "table of per-variant functions" shape). The cast is localized to this one dispatch function; every individual function in `badgeRuleRegistry` above stays correctly narrowed to its own rule variant with no cast needed, and `evaluateBadgeRule` is always called with a `rule` whose `kind` genuinely matches by construction (the only caller, `lib/badges.ts`, always passes a badge's own `rule`).

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/content/badgeRuleRegistry.test.ts`
Expected: PASS (9 tests)

- [ ] **Step 5: Write the failing tests** — `src/lib/badges.test.ts`:

```typescript
import { useAuthStore } from "@/store/authStore";
import { useProgressStore } from "@/store/progressStore";
import { mockProgressBackend } from "@/services/mockProgressBackend";
import { progressBackend } from "@/services/progressBackend";
import { evaluateAndAwardBadges } from "./badges";
import type { Badge } from "@/content/types";

const PROFILE = { id: "profile-1", username: "SpeedyOtter", avatar: "avatar_cat", age_band: "6-8" as const };

const streakBadge: Badge = { id: "badge-streak-3", name: "3-Day Streak", emoji: "🔥", rule: { kind: "streak", value: 3 } };
const worldBadge: Badge = {
  id: "badge-world-complete-jungle",
  name: "Jungle Explorer",
  emoji: "🏆",
  rule: { kind: "world_complete", worldId: "world-jungle" },
};

describe("evaluateAndAwardBadges", () => {
  beforeEach(() => {
    mockProgressBackend.reset();
    useProgressStore.getState().reset();
    useAuthStore.setState({ activeProfile: PROFILE });
  });

  afterEach(() => useAuthStore.getState().logout());

  it("does nothing if no profile is active", async () => {
    useAuthStore.setState({ activeProfile: null });
    const result = await evaluateAndAwardBadges([streakBadge], { worldId: "world-jungle", totalMissionsInWorld: 1 });
    expect(result).toEqual([]);
  });

  it("awards a badge whose rule newly evaluates true", async () => {
    useProgressStore.getState().setProgress({
      world: 0, node: 1, streakCount: 3, longestStreak: 3, lastCompletedDate: "2026-07-17", totalMissionsCompleted: 3,
    });
    const result = await evaluateAndAwardBadges([streakBadge], { worldId: "world-jungle", totalMissionsInWorld: 1 });
    expect(result.map((b) => b.id)).toEqual(["badge-streak-3"]);
    expect(useProgressStore.getState().earnedBadgeIds).toEqual(["badge-streak-3"]);
    expect(useProgressStore.getState().newlyEarnedBadgeIds).toEqual(["badge-streak-3"]);
  });

  it("does not re-award a badge that's already earned", async () => {
    useProgressStore.getState().setProgress({
      world: 0, node: 1, streakCount: 3, longestStreak: 3, lastCompletedDate: "2026-07-17", totalMissionsCompleted: 3,
    });
    useProgressStore.getState().setEarnedBadgeIds(["badge-streak-3"]);
    const result = await evaluateAndAwardBadges([streakBadge], { worldId: "world-jungle", totalMissionsInWorld: 1 });
    expect(result).toEqual([]);
    expect(useProgressStore.getState().newlyEarnedBadgeIds).toEqual([]);
  });

  it("persists the award via progressBackend.insertEarnedBadge", async () => {
    useProgressStore.getState().setProgress({
      world: 0, node: 1, streakCount: 3, longestStreak: 3, lastCompletedDate: "2026-07-17", totalMissionsCompleted: 3,
    });
    await evaluateAndAwardBadges([streakBadge], { worldId: "world-jungle", totalMissionsInWorld: 1 });
    const persisted = await mockProgressBackend.loadEarnedBadges(PROFILE.id);
    expect(persisted).toEqual(["badge-streak-3"]);
  });

  it("evaluates world_complete against the given world context", async () => {
    useProgressStore.getState().setProgress({
      world: 0, node: 2, streakCount: 0, longestStreak: 0, lastCompletedDate: "2026-07-17", totalMissionsCompleted: 1,
    });
    const result = await evaluateAndAwardBadges([worldBadge], { worldId: "world-jungle", totalMissionsInWorld: 1 });
    expect(result.map((b) => b.id)).toEqual(["badge-world-complete-jungle"]);
  });

  it("leaves newlyEarnedBadgeIds empty when nothing qualifies", async () => {
    const result = await evaluateAndAwardBadges([streakBadge, worldBadge], { worldId: "world-jungle", totalMissionsInWorld: 5 });
    expect(result).toEqual([]);
    expect(useProgressStore.getState().newlyEarnedBadgeIds).toEqual([]);
  });

  it("swallows a backend error and returns an empty list (no failure, no losing)", async () => {
    useProgressStore.getState().setProgress({
      world: 0, node: 1, streakCount: 3, longestStreak: 3, lastCompletedDate: "2026-07-17", totalMissionsCompleted: 3,
    });
    const insertSpy = vi.spyOn(progressBackend, "insertEarnedBadge").mockRejectedValueOnce(new Error("network down"));
    const result = await evaluateAndAwardBadges([streakBadge], { worldId: "world-jungle", totalMissionsInWorld: 1 });
    expect(result).toEqual([]);
    expect(useProgressStore.getState().earnedBadgeIds).toEqual([]); // not marked earned -- self-heals next completion
    insertSpy.mockRestore();
  });
});
```

- [ ] **Step 6: Run to verify it fails**

Run: `npx vitest run src/lib/badges.test.ts`
Expected: FAIL — `Cannot find module './badges'`

- [ ] **Step 7: Implement `src/lib/badges.ts`**

```typescript
import { progressBackend } from "@/services/progressBackend";
import { useProgressStore } from "@/store/progressStore";
import { useAuthStore } from "@/store/authStore";
import { evaluateBadgeRule } from "@/content/badgeRuleRegistry";
import type { Badge } from "@/content/types";

interface AwardContext {
  worldId: string;
  totalMissionsInWorld: number;
}

export async function evaluateAndAwardBadges(badges: Badge[], ctx: AwardContext): Promise<Badge[]> {
  try {
    const profileId = useAuthStore.getState().activeProfile?.id;
    if (!profileId) return [];

    const progress = useProgressStore.getState();
    const newly = badges.filter(
      (b) => !progress.earnedBadgeIds.includes(b.id) && evaluateBadgeRule(b.rule, { ...ctx, progress }),
    );

    for (const b of newly) {
      await progressBackend.insertEarnedBadge(profileId, b.id);
    }

    useProgressStore.getState().awardBadges(newly.map((b) => b.id));
    return newly;
  } catch {
    // Same resilience contract as recordMissionCompletion: never throw to a
    // fire-and-forget caller. A missed badge write self-heals next
    // completion (earnedBadgeIds is re-checked from scratch each time).
    return [];
  }
}
```

- [ ] **Step 8: Run to verify all tests pass**

Run: `npx vitest run src/lib/badges.test.ts`
Expected: PASS (7 tests)

- [ ] **Step 9: Commit**

```bash
git add src/content/badgeRuleRegistry.ts src/content/badgeRuleRegistry.test.ts src/lib/badges.ts src/lib/badges.test.ts
git commit -m "feat: add badge rule engine and evaluateAndAwardBadges"
```

---

### Task 6: Wire badge evaluation into `MissionPlayer`

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/screens/MissionPlayer.tsx`
- Modify: `src/screens/MissionPlayer.test.tsx`

**Interfaces:**
- Consumes: `evaluateAndAwardBadges` (Task 5).

- [ ] **Step 1: Write the failing tests** — replace `src/screens/MissionPlayer.test.tsx`'s full content:

```tsx
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { initNavigation } from "@/navigation/initNavigation";
import { MissionPlayer } from "./MissionPlayer";
import { useUiStore } from "@/store/uiStore";
import { useAuthStore } from "@/store/authStore";
import { useProgressStore } from "@/store/progressStore";
import type { Activity, Badge, Mission } from "@/content/types";

const mission: Mission = { id: "mission-001", worldId: "world-jungle", node: 1, title: "Day 1", activityIds: ["a1", "a2"] };
const activities: Activity[] = [
  { id: "a1", type: "movement", title: "Cross Crawl", ageBands: ["6-8"], narration: "a1.mp3", renderer: "react", asset: "cross-crawl", pacing: { reps: 1, tempoMs: 1 }, instructions: "Touch hand to opposite knee." },
  { id: "a2", type: "movement", title: "Belly Breaths", ageBands: ["6-8"], narration: "a2.mp3", renderer: "react", asset: "belly", pacing: { reps: 1, tempoMs: 1 }, instructions: "Breathe in, breathe out." },
];
const missionsBadge: Badge = { id: "badge-missions-total", name: "Mission Master", emoji: "🎖️", rule: { kind: "missions_total", value: 1 } };
const missionsBadgeHighTarget: Badge = { id: "badge-missions-total-5", name: "Mission Master", emoji: "🎖️", rule: { kind: "missions_total", value: 5 } };

async function completeCurrentActivity(user: ReturnType<typeof userEvent.setup>) {
  await waitFor(() => expect(screen.getByRole("button", { name: /we did it/i })).not.toBeDisabled());
  await user.click(screen.getByRole("button", { name: /we did it/i }));
}

describe("MissionPlayer", () => {
  beforeAll(() => {
    initNavigation();
  });

  beforeEach(() => useUiStore.getState().startMission("mission-001"));

  it("shows the first activity and progress", () => {
    render(<MissionPlayer mission={mission} activities={activities} badges={[]} worldId="world-jungle" totalMissionsInWorld={1} />);
    expect(screen.getByText(/cross crawl/i)).toBeInTheDocument();
    expect(screen.getByText(/activity 1 of 2/i)).toBeInTheDocument();
  });

  it("advances through activities when the parent presses We did it!", async () => {
    const user = userEvent.setup();
    render(<MissionPlayer mission={mission} activities={activities} badges={[]} worldId="world-jungle" totalMissionsInWorld={1} />);
    await completeCurrentActivity(user);
    expect(screen.getByText(/belly breaths/i)).toBeInTheDocument();
    expect(screen.getByText(/activity 2 of 2/i)).toBeInTheDocument();
  });

  it("goes to the reward screen after the last activity", async () => {
    const user = userEvent.setup();
    render(<MissionPlayer mission={mission} activities={activities} badges={[]} worldId="world-jungle" totalMissionsInWorld={1} />);
    await completeCurrentActivity(user);
    await completeCurrentActivity(user);
    expect(useUiStore.getState().screen).toBe("reward");
  });

  it("goes straight to the reward screen when the mission has no activities", async () => {
    render(<MissionPlayer mission={mission} activities={[]} badges={[]} worldId="world-jungle" totalMissionsInWorld={1} />);
    await waitFor(() => expect(useUiStore.getState().screen).toBe("reward"));
  });

  it("keeps D-pad focus on the validate button across activity transitions", async () => {
    const user = userEvent.setup();
    render(<MissionPlayer mission={mission} activities={activities} badges={[]} worldId="world-jungle" totalMissionsInWorld={1} />);

    await waitFor(() =>
      expect(screen.getByRole("button", { name: /we did it/i })).toHaveAttribute("data-focused", "true"),
    );

    await completeCurrentActivity(user);

    await waitFor(() =>
      expect(screen.getByRole("button", { name: /we did it/i })).toHaveAttribute("data-focused", "true"),
    );
  });

  it("does not let the mission be completed before the gate elapses", () => {
    render(<MissionPlayer mission={mission} activities={activities} badges={[]} worldId="world-jungle" totalMissionsInWorld={1} />);
    expect(screen.getByRole("button", { name: /we did it/i })).toBeDisabled();
  });
});

describe("MissionPlayer progress recording", () => {
  beforeEach(() => {
    useAuthStore.setState({
      activeProfile: { id: "profile-1", username: "SpeedyOtter", avatar: "avatar_cat", age_band: "6-8" },
    });
    useProgressStore.getState().setProgress({
      world: 0, node: 1, streakCount: 0, longestStreak: 0, lastCompletedDate: null, totalMissionsCompleted: 0,
    });
  });

  afterEach(() => {
    useAuthStore.getState().logout();
    useProgressStore.getState().reset();
  });

  it("advances the progress node after completing the mission at the current node", async () => {
    const user = userEvent.setup();
    render(<MissionPlayer mission={mission} activities={activities} badges={[]} worldId="world-jungle" totalMissionsInWorld={1} />);
    await completeCurrentActivity(user);
    await completeCurrentActivity(user);
    await waitFor(() => expect(useProgressStore.getState().node).toBe(2));
  });

  it("does not advance the node when replaying an already-completed mission", async () => {
    useProgressStore.getState().setProgress({
      world: 0, node: 2, streakCount: 1, longestStreak: 1, lastCompletedDate: "2020-01-01", totalMissionsCompleted: 1,
    });
    const user = userEvent.setup();
    render(<MissionPlayer mission={mission} activities={activities} badges={[]} worldId="world-jungle" totalMissionsInWorld={1} />); // mission.node is 1, progress.node is 2
    await completeCurrentActivity(user);
    await completeCurrentActivity(user);
    await new Promise((resolve) => setTimeout(resolve, 0)); // let the fire-and-forget write settle
    expect(useProgressStore.getState().node).toBe(2); // unchanged
  });

  it("awards a badge whose rule crosses its threshold on completion", async () => {
    const user = userEvent.setup();
    render(
      <MissionPlayer mission={mission} activities={activities} badges={[missionsBadge]} worldId="world-jungle" totalMissionsInWorld={1} />,
    );
    await completeCurrentActivity(user);
    await completeCurrentActivity(user);
    await waitFor(() => expect(useProgressStore.getState().newlyEarnedBadgeIds).toEqual(["badge-missions-total"]));
  });

  it("leaves newlyEarnedBadgeIds empty when no badge threshold is crossed", async () => {
    const user = userEvent.setup();
    render(
      <MissionPlayer mission={mission} activities={activities} badges={[missionsBadgeHighTarget]} worldId="world-jungle" totalMissionsInWorld={1} />,
    );
    await completeCurrentActivity(user);
    await completeCurrentActivity(user);
    await waitFor(() => expect(useProgressStore.getState().node).toBe(2));
    expect(useProgressStore.getState().newlyEarnedBadgeIds).toEqual([]);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/screens/MissionPlayer.test.tsx`
Expected: FAIL — `MissionPlayer`'s `Props` doesn't accept `badges`/`worldId`/`totalMissionsInWorld` yet.

- [ ] **Step 3: Implement `src/screens/MissionPlayer.tsx`** — replace the file's full content:

```tsx
import { useEffect, useState } from "react";
import { PageShell } from "@/components/PageShell";
import { FocusableButton } from "@/components/FocusableButton";
import { ExercisePlayer } from "@/components/ExercisePlayer";
import { useUiStore } from "@/store/uiStore";
import { recordMissionCompletion } from "@/lib/progress";
import { evaluateAndAwardBadges } from "@/lib/badges";
import type { Activity, Badge, Mission } from "@/content/types";

interface Props {
  mission: Mission;
  activities: Activity[];
  badges: Badge[];
  worldId: string;
  totalMissionsInWorld: number;
}

export function MissionPlayer({ mission, activities, badges, worldId, totalMissionsInWorld }: Props) {
  const goToReward = useUiStore((s) => s.goToReward);
  const [index, setIndex] = useState(0);
  const activity = activities[index];

  async function completeMission(activitiesDone: number): Promise<void> {
    await recordMissionCompletion(mission.id, mission.node, activitiesDone);
    await evaluateAndAwardBadges(badges, { worldId, totalMissionsInWorld });
  }

  useEffect(() => {
    if (activities.length === 0) {
      void completeMission(0);
      goToReward();
    }
    // completeMission closes over mission/badges/worldId/totalMissionsInWorld,
    // all listed below -- it is intentionally recreated each render, not memoized.
  }, [activities, goToReward, mission.id, mission.node, badges, worldId, totalMissionsInWorld]);

  const onDone = () => {
    if (index + 1 >= activities.length) {
      void completeMission(activities.length);
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
        <h2 className="text-2xl font-bold mb-2">{activity.title}</h2>
        {activity.type === "movement" || activity.type === "breathing" ? (
          <ExercisePlayer key={activity.id} activity={activity} onValidated={onDone} />
        ) : (
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
        )}
      </section>
    </PageShell>
  );
}
```

- [ ] **Step 4: Wire `App.tsx` to pass the new props** — in `src/App.tsx`, replace:

Before:
```tsx
  if (screen === "mission" && activeMission) {
    return <MissionPlayer mission={activeMission} activities={content.activitiesByMission[activeMission.id] ?? []} />;
  }
```
After:
```tsx
  if (screen === "mission" && activeMission) {
    return (
      <MissionPlayer
        mission={activeMission}
        activities={content.activitiesByMission[activeMission.id] ?? []}
        badges={content.badges}
        worldId={content.world.id}
        totalMissionsInWorld={content.world.missionIds.length}
      />
    );
  }
```

- [ ] **Step 5: Run to verify all tests pass**

Run: `npx vitest run src/screens/MissionPlayer.test.tsx`
Expected: PASS (10 tests)

- [ ] **Step 6: Commit**

```bash
git add src/App.tsx src/screens/MissionPlayer.tsx src/screens/MissionPlayer.test.tsx
git commit -m "feat: evaluate and award badges on mission completion"
```

---

### Task 7: `RewardScreen` badge display

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/screens/RewardScreen.tsx`
- Modify: `src/screens/RewardScreen.test.tsx`

**Interfaces:**
- Consumes: `progressStore.newlyEarnedBadgeIds` (Task 4); `content.badges` (Task 2).

- [ ] **Step 1: Write the failing tests** — replace `src/screens/RewardScreen.test.tsx`'s full content:

```tsx
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { initNavigation } from "@/navigation/initNavigation";
import { RewardScreen } from "./RewardScreen";
import { useUiStore } from "@/store/uiStore";
import { useProgressStore } from "@/store/progressStore";
import type { Badge } from "@/content/types";

const streakBadge: Badge = { id: "badge-streak-3", name: "3-Day Streak", emoji: "🔥", rule: { kind: "streak", value: 3 } };

describe("RewardScreen", () => {
  beforeAll(() => {
    initNavigation();
  });

  beforeEach(() => useUiStore.getState().startMission("mission-001"));

  it("shows the mission title in the reward message", () => {
    render(<RewardScreen missionTitle="Day 1: Wake Up Your Brain" badges={[]} />);
    expect(screen.getByText(/day 1: wake up your brain complete/i)).toBeInTheDocument();
  });

  it("puts D-pad focus on the Back to Map button by default", async () => {
    render(<RewardScreen missionTitle="Day 1: Wake Up Your Brain" badges={[]} />);
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /back to map/i })).toHaveAttribute("data-focused", "true"),
    );
  });

  it("returns to the map when Back to Map is pressed", async () => {
    const user = userEvent.setup();
    render(<RewardScreen missionTitle="Day 1: Wake Up Your Brain" badges={[]} />);
    await user.click(screen.getByRole("button", { name: /back to map/i }));
    expect(useUiStore.getState().screen).toBe("map");
  });
});

describe("RewardScreen streak display", () => {
  afterEach(() => useProgressStore.getState().reset());

  it("shows a streak line when the streak is 2 or more days", () => {
    useProgressStore.getState().setProgress({
      world: 0, node: 2, streakCount: 3, longestStreak: 3, lastCompletedDate: "2026-07-17", totalMissionsCompleted: 3,
    });
    render(<RewardScreen missionTitle="Day 1: Wake Up Your Brain" badges={[]} />);
    expect(screen.getByText(/3-day streak/i)).toBeInTheDocument();
  });

  it("does not show a streak line on day 1 (no streak yet)", () => {
    useProgressStore.getState().setProgress({
      world: 0, node: 2, streakCount: 1, longestStreak: 1, lastCompletedDate: "2026-07-17", totalMissionsCompleted: 1,
    });
    render(<RewardScreen missionTitle="Day 1: Wake Up Your Brain" badges={[]} />);
    expect(screen.queryByText(/-day streak/i)).not.toBeInTheDocument();
  });
});

describe("RewardScreen badge display", () => {
  afterEach(() => useProgressStore.getState().reset());

  it("shows a newly earned badge's emoji and name", () => {
    useProgressStore.getState().awardBadges(["badge-streak-3"]);
    render(<RewardScreen missionTitle="Day 1: Wake Up Your Brain" badges={[streakBadge]} />);
    expect(screen.getByText(/3-day streak/i)).toBeInTheDocument();
    expect(screen.getByText(/🔥/)).toBeInTheDocument();
  });

  it("shows nothing extra when no badge was newly earned", () => {
    render(<RewardScreen missionTitle="Day 1: Wake Up Your Brain" badges={[streakBadge]} />);
    expect(screen.queryByText(/🔥/)).not.toBeInTheDocument();
  });

  it("does not show a badge earned in an earlier session, only newly earned ones", () => {
    useProgressStore.getState().setEarnedBadgeIds(["badge-streak-3"]);
    render(<RewardScreen missionTitle="Day 1: Wake Up Your Brain" badges={[streakBadge]} />);
    expect(screen.queryByText(/🔥/)).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/screens/RewardScreen.test.tsx`
Expected: FAIL — `RewardScreen`'s `Props` doesn't accept `badges` yet.

- [ ] **Step 3: Implement `src/screens/RewardScreen.tsx`** — replace the file's full content:

```tsx
import { FocusableButton } from "@/components/FocusableButton";
import { PageShell } from "@/components/PageShell";
import { useUiStore } from "@/store/uiStore";
import { useProgressStore } from "@/store/progressStore";
import type { Badge } from "@/content/types";

interface Props {
  missionTitle: string;
  badges: Badge[];
}

export function RewardScreen({ missionTitle, badges }: Props) {
  const goToMap = useUiStore((s) => s.goToMap);
  const streakCount = useProgressStore((s) => s.streakCount);
  const newlyEarnedBadgeIds = useProgressStore((s) => s.newlyEarnedBadgeIds);
  const newlyEarnedBadges = badges.filter((b) => newlyEarnedBadgeIds.includes(b.id));

  return (
    <PageShell>
      <section className="text-center">
        <h1 className="text-3xl font-bold mb-4">You did it!</h1>
        <p className="text-lg mb-4">{missionTitle} complete — you earned a star!</p>
        {streakCount >= 2 && (
          <p className="text-lg font-bold text-storybook-gold mb-4">{streakCount}-day streak!</p>
        )}
        {newlyEarnedBadges.map((badge) => (
          <p key={badge.id} className="text-lg font-bold text-storybook-gold mb-4">
            {badge.emoji} {badge.name}!
          </p>
        ))}
        <FocusableButton variant="pill" className="bg-storybook-peach text-storybook-peachText" autoFocus onPress={goToMap}>
          Back to Map
        </FocusableButton>
      </section>
    </PageShell>
  );
}
```

- [ ] **Step 4: Wire `App.tsx` to pass badges** — in `src/App.tsx`, replace:

Before:
```tsx
  if (screen === "reward") {
    return <RewardScreen missionTitle={activeMission?.title ?? "Today's mission"} />;
  }
```
After:
```tsx
  if (screen === "reward") {
    return <RewardScreen missionTitle={activeMission?.title ?? "Today's mission"} badges={content.badges} />;
  }
```

- [ ] **Step 5: Run to verify all tests pass**

Run: `npx vitest run src/screens/RewardScreen.test.tsx`
Expected: PASS (8 tests)

- [ ] **Step 6: Commit**

```bash
git add src/App.tsx src/screens/RewardScreen.tsx src/screens/RewardScreen.test.tsx
git commit -m "feat: show newly earned badges on RewardScreen"
```

---

### Task 8: Trophy Shelf screen + navigation

**Files:**
- Modify: `src/store/uiStore.ts`
- Modify: `src/store/uiStore.test.ts`
- Create: `src/screens/TrophyShelf.tsx`
- Create: `src/screens/TrophyShelf.test.tsx`
- Modify: `src/screens/JourneyMap.tsx`
- Modify: `src/screens/JourneyMap.test.tsx`
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: `progressStore.earnedBadgeIds` (Task 4); `content.badges` (Task 2).

- [ ] **Step 1: Write the failing test** — append to `src/store/uiStore.test.ts`'s existing `describe("uiStore", ...)` block (after `"goToReward moves to the reward screen"`):

```ts
  it("goToTrophyShelf moves to the trophy shelf screen", () => {
    useUiStore.getState().goToTrophyShelf();
    expect(useUiStore.getState().screen).toBe("trophyShelf");
  });
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/store/uiStore.test.ts`
Expected: FAIL — `goToTrophyShelf` doesn't exist yet.

- [ ] **Step 3: Implement `src/store/uiStore.ts`** — replace the file's full content:

```typescript
import { create } from "zustand";

export type Screen = "map" | "mission" | "reward" | "trophyShelf";

interface UiState {
  screen: Screen;
  activeMissionId: string | null;
  goToMap: () => void;
  startMission: (missionId: string) => void;
  goToReward: () => void;
  goToTrophyShelf: () => void;
}

export const useUiStore = create<UiState>((set) => ({
  screen: "map",
  activeMissionId: null,
  goToMap: () => set({ screen: "map", activeMissionId: null }),
  startMission: (missionId) => set({ screen: "mission", activeMissionId: missionId }),
  goToReward: () => set({ screen: "reward" }),
  goToTrophyShelf: () => set({ screen: "trophyShelf" }),
}));
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/store/uiStore.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Write the failing tests** — `src/screens/TrophyShelf.test.tsx`:

```tsx
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { initNavigation } from "@/navigation/initNavigation";
import { TrophyShelf } from "./TrophyShelf";
import { useUiStore } from "@/store/uiStore";
import { useProgressStore } from "@/store/progressStore";
import type { Badge } from "@/content/types";

const badges: Badge[] = [
  { id: "badge-streak-3", name: "3-Day Streak", emoji: "🔥", rule: { kind: "streak", value: 3 } },
  { id: "badge-streak-7", name: "7-Day Streak", emoji: "🌟", rule: { kind: "streak", value: 7 } },
];

describe("TrophyShelf", () => {
  beforeAll(() => initNavigation());
  afterEach(() => useProgressStore.getState().reset());

  it("shows an earned badge's name and emoji", () => {
    useProgressStore.getState().setEarnedBadgeIds(["badge-streak-3"]);
    render(<TrophyShelf badges={badges} />);
    expect(screen.getByText("3-Day Streak")).toBeInTheDocument();
    expect(screen.getByText("🔥")).toBeInTheDocument();
  });

  it("shows an unearned badge as locked, hiding its name and emoji", () => {
    useProgressStore.getState().setEarnedBadgeIds(["badge-streak-3"]);
    render(<TrophyShelf badges={badges} />);
    expect(screen.queryByText("7-Day Streak")).not.toBeInTheDocument();
    expect(screen.getAllByText("Locked").length).toBeGreaterThan(0);
  });

  it("puts D-pad focus on the Back to Map button by default", async () => {
    render(<TrophyShelf badges={badges} />);
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /back to map/i })).toHaveAttribute("data-focused", "true"),
    );
  });

  it("returns to the map when Back to Map is pressed", async () => {
    const user = userEvent.setup();
    render(<TrophyShelf badges={badges} />);
    await user.click(screen.getByRole("button", { name: /back to map/i }));
    expect(useUiStore.getState().screen).toBe("map");
  });
});
```

- [ ] **Step 6: Run to verify it fails**

Run: `npx vitest run src/screens/TrophyShelf.test.tsx`
Expected: FAIL — `Cannot find module './TrophyShelf'`

- [ ] **Step 7: Implement `src/screens/TrophyShelf.tsx`**

```tsx
import { FocusableButton } from "@/components/FocusableButton";
import { PageShell } from "@/components/PageShell";
import { useUiStore } from "@/store/uiStore";
import { useProgressStore } from "@/store/progressStore";
import type { Badge } from "@/content/types";

interface Props {
  badges: Badge[];
}

export function TrophyShelf({ badges }: Props) {
  const goToMap = useUiStore((s) => s.goToMap);
  const earnedBadgeIds = useProgressStore((s) => s.earnedBadgeIds);

  return (
    <PageShell>
      <h1 className="text-3xl font-bold mb-6">Trophy Shelf</h1>
      <ul className="grid grid-cols-3 gap-4 list-none p-0 m-0 mb-6">
        {badges.map((badge) => {
          const earned = earnedBadgeIds.includes(badge.id);
          return (
            <li key={badge.id}>
              <div
                aria-label={earned ? badge.name : `${badge.name}, locked`}
                className={`w-full rounded-2xl p-4 text-center font-bold ${
                  earned ? "bg-storybook-mint text-storybook-mintText" : "bg-storybook-tan text-storybook-ink opacity-60"
                }`}
              >
                <div className="text-4xl mb-2">{earned ? badge.emoji : "🔒"}</div>
                {earned ? badge.name : "Locked"}
              </div>
            </li>
          );
        })}
      </ul>
      <FocusableButton variant="pill" className="bg-storybook-peach text-storybook-peachText" autoFocus onPress={goToMap}>
        Back to Map
      </FocusableButton>
    </PageShell>
  );
}
```

- [ ] **Step 8: Run to verify all tests pass**

Run: `npx vitest run src/screens/TrophyShelf.test.tsx`
Expected: PASS (4 tests)

- [ ] **Step 9: Write the failing test** — append to `src/screens/JourneyMap.test.tsx`'s existing `describe("JourneyMap", ...)` block (after `"puts D-pad focus on the first mission by default"`):

```tsx
  it("navigates to the Trophy Shelf when its button is pressed", async () => {
    const user = userEvent.setup();
    render(<JourneyMap world={world} missions={missions} />);
    await user.click(screen.getByRole("button", { name: /trophy shelf/i }));
    expect(useUiStore.getState().screen).toBe("trophyShelf");
  });
```

- [ ] **Step 10: Run to verify it fails**

Run: `npx vitest run src/screens/JourneyMap.test.tsx`
Expected: FAIL — no "Trophy Shelf" button exists yet.

- [ ] **Step 11: Implement the button in `src/screens/JourneyMap.tsx`** — replace the file's full content:

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
  const goToTrophyShelf = useUiStore((s) => s.goToTrophyShelf);
  const progressNode = useProgressStore((s) => s.node);
  const lastCompletedDate = useProgressStore((s) => s.lastCompletedDate);
  const today = todayDateString();

  return (
    <PageShell>
      <h1 className="text-3xl font-bold mb-6">{world.name}</h1>
      <ul className="grid grid-cols-3 gap-4 list-none p-0 m-0 mb-6">
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
      <FocusableButton variant="pill" className="bg-storybook-peach text-storybook-peachText" onPress={goToTrophyShelf}>
        Trophy Shelf
      </FocusableButton>
    </PageShell>
  );
}
```

- [ ] **Step 12: Run to verify all tests pass**

Run: `npx vitest run src/screens/JourneyMap.test.tsx`
Expected: PASS (8 tests)

- [ ] **Step 13: Wire `App.tsx`'s trophyShelf branch** — in `src/App.tsx`, add the `TrophyShelf` import alongside the other screen imports:

```tsx
import { TrophyShelf } from "@/screens/TrophyShelf";
```

and add a branch right before the final `return <JourneyMap ... />` line in `MainApp`:

```tsx
  if (screen === "trophyShelf") {
    return <TrophyShelf badges={content.badges} />;
  }
  return <JourneyMap world={content.world} missions={content.missions} />;
```

- [ ] **Step 14: Commit**

```bash
git add src/store/uiStore.ts src/store/uiStore.test.ts src/screens/TrophyShelf.tsx src/screens/TrophyShelf.test.tsx src/screens/JourneyMap.tsx src/screens/JourneyMap.test.tsx src/App.tsx
git commit -m "feat: add Trophy Shelf screen and navigation from JourneyMap"
```

---

### Task 9: Full-suite verification

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
