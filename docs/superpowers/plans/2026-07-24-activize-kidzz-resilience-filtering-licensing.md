# Progress Resilience, Age-Band Filtering, and Content Licensing Review (Plan 12) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix 3 independent backlog gaps in one batched plan: (1) a failed progress write is currently lost forever instead of queued/retried, (2) `age_band`/`ageBands` are captured everywhere but never actually filtered, (3) the master spec's content-licensing open item has never been formally closed out.

**Architecture:** Task 1 adds a localStorage-backed retry queue directly inside `src/lib/progress.ts`, replayed once at the start of `loadProgress` (this app's real "launch" moment, since no session persists across restarts). Task 2 adds a one-line filter inside `src/content/useContent.ts` where `activitiesByMission` is built. Task 3 is a documentation-only edit to the master spec. The three tasks touch entirely different files and have no dependency on each other — order between them doesn't matter, but they're numbered 1–3 to match the spec's section order.

**Tech Stack:** No new dependencies. Vitest + React Testing Library, following this repo's existing black-box conventions.

## Global Constraints

- `git commit` is blocked by tool permissions this session — stage with `git add` (explicit paths, never `-A`); do not commit after each task; batch all 3 tasks into exactly ONE final commit.
- The final commit command printed for the user must have **no path prefix** (`git commit -m "..."` only) — the user keeps a terminal already open at `C:\Repos\activize-kidzz`. This is distinct from the agent's own Bash tool calls in this plan's steps, which still need `cd C:\Repos\activize-kidzz && ...` since the agent's own shell resets between conversation turns.
- Do not run any `git log`/`git status` verification step beyond what's needed to stage files and print the commit command — confirmed standing preference, do not spend a tool call confirming a commit landed.
- No new npm dependencies. No changes to any UI/visual code (that was Plan 11's scope, already shipped).

---

## Task 1: Progress-write resilience (queue + retry)

**Files:**
- Modify: `src/lib/progress.ts`
- Modify: `src/lib/progress.test.ts`

**Interfaces:**
- Produces: `retryQueuedWrites(profileId: string): Promise<void>` — a new named export from `src/lib/progress.ts`, called internally by `loadProgress` before its existing read; not consumed by any other task in this plan.

- [ ] **Step 1: Write the failing tests**

Add `localStorage.clear()` to the existing `beforeEach` at the top of `src/lib/progress.test.ts` (currently only `mockProgressBackend.reset()`, `useProgressStore.getState().reset()`, and `useAuthStore.setState({ activeProfile: PROFILE })` — the new queue lives directly in raw `localStorage` under a key `mockProgressBackend.reset()` doesn't touch):

```ts
  beforeEach(() => {
    mockProgressBackend.reset();
    useProgressStore.getState().reset();
    useAuthStore.setState({ activeProfile: PROFILE });
    localStorage.clear();
  });
```

Add these 3 new tests inside the existing `describe("recordMissionCompletion", ...)` block (after the existing `"swallows a backend error and leaves the store unchanged (no failure, no losing)"` test — do not modify that test):

```ts
    it("queues a failed write instead of losing it", async () => {
      await loadProgress(PROFILE.id);
      const saveSpy = vi.spyOn(progressBackend, "saveProgress").mockRejectedValueOnce(new Error("network down"));

      await recordMissionCompletion("mission-001", 1, 4);

      const queued = JSON.parse(localStorage.getItem(`activize:pendingProgress:${PROFILE.id}`) ?? "[]");
      expect(queued).toHaveLength(1);
      expect(queued[0]).toMatchObject({ missionId: "mission-001", activitiesDone: 4 });
      expect(queued[0].updated.node).toBe(2);

      saveSpy.mockRestore();
    });

    it("replays a queued write successfully on the next loadProgress call", async () => {
      await loadProgress(PROFILE.id);
      const saveSpy = vi.spyOn(progressBackend, "saveProgress").mockRejectedValueOnce(new Error("network down"));
      await recordMissionCompletion("mission-001", 1, 4);
      saveSpy.mockRestore();

      useProgressStore.getState().reset();
      await loadProgress(PROFILE.id);

      expect(useProgressStore.getState().node).toBe(2);
      expect(localStorage.getItem(`activize:pendingProgress:${PROFILE.id}`)).toBe("[]");
    });

    it("leaves the queue intact if the retry also fails", async () => {
      await loadProgress(PROFILE.id);
      const saveSpy = vi.spyOn(progressBackend, "saveProgress").mockRejectedValueOnce(new Error("network down"));
      await recordMissionCompletion("mission-001", 1, 4);

      saveSpy.mockRejectedValueOnce(new Error("still down"));
      useProgressStore.getState().reset();
      await loadProgress(PROFILE.id);

      const queued = JSON.parse(localStorage.getItem(`activize:pendingProgress:${PROFILE.id}`) ?? "[]");
      expect(queued).toHaveLength(1);
      expect(queued[0]).toMatchObject({ missionId: "mission-001", activitiesDone: 4 });

      saveSpy.mockRestore();
    });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd /c/Repos/activize-kidzz && npm test -- src/lib/progress.test.ts`
Expected: FAIL — `localStorage.getItem(...)` returns `null` (no queue key exists yet), and the 3 new tests fail their `expect(queued)` assertions.

- [ ] **Step 3: Implement the queue + retry**

Full replacement content for `src/lib/progress.ts`:

```ts
import { progressBackend } from "@/services/progressBackend";
import { useProgressStore } from "@/store/progressStore";
import { useAuthStore } from "@/store/authStore";
import { todayDateString, yesterdayDateString } from "@/lib/date";
import type { ProgressRecord } from "@/services/progressTypes";

interface PendingWrite {
  updated: ProgressRecord;
  missionId: string;
  activitiesDone: number;
}

function queueKey(profileId: string): string {
  return `activize:pendingProgress:${profileId}`;
}

function readQueue(profileId: string): PendingWrite[] {
  try {
    const raw = localStorage.getItem(queueKey(profileId));
    return raw ? (JSON.parse(raw) as PendingWrite[]) : [];
  } catch {
    return [];
  }
}

function writeQueue(profileId: string, queue: PendingWrite[]): void {
  localStorage.setItem(queueKey(profileId), JSON.stringify(queue));
}

export async function retryQueuedWrites(profileId: string): Promise<void> {
  const remaining = readQueue(profileId);
  while (remaining.length > 0) {
    const next = remaining[0];
    try {
      await progressBackend.saveProgress(profileId, next.updated);
      await progressBackend.insertCompletion(profileId, next.missionId, next.activitiesDone);
      remaining.shift();
    } catch {
      break; // still offline -- try again next launch
    }
  }
  writeQueue(profileId, remaining);
}

export async function loadProgress(profileId: string): Promise<void> {
  await retryQueuedWrites(profileId);
  const [record, earnedBadgeIds] = await Promise.all([
    progressBackend.loadProgress(profileId),
    progressBackend.loadEarnedBadges(profileId),
  ]);
  useProgressStore.getState().setProgress(record);
  useProgressStore.getState().setEarnedBadgeIds(earnedBadgeIds);
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

  try {
    await progressBackend.saveProgress(profileId, updated);
    await progressBackend.insertCompletion(profileId, missionId, activitiesDone);
    useProgressStore.getState().setProgress(updated);
  } catch {
    // Write failed (e.g. network blip) -- queue for retry on next launch
    // instead of losing it forever. The reward screen is already optimistic
    // (shown regardless of write success), so this stays fully invisible to
    // the kid; see retryQueuedWrites, called from loadProgress above.
    const queue = readQueue(profileId);
    queue.push({ updated, missionId, activitiesDone });
    writeQueue(profileId, queue);
  }
}
```

Note: the early-return guards (`if (!profileId) return;` and `if (missionNode !== current.node) return;`) moved **outside** the `try` block. They're synchronous zustand reads that can't throw, so this changes nothing behaviorally — but it's necessary so `profileId`, `updated`, `missionId`, and `activitiesDone` are all in scope inside the `catch` block to build the queued entry (variables declared inside a `try {}` aren't visible in its `catch {}`).

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd /c/Repos/activize-kidzz && npm test -- src/lib/progress.test.ts`
Expected: PASS — all 14 tests in this file (11 existing + 3 new).

- [ ] **Step 5: Run the full suite to confirm no regressions**

Run: `cd /c/Repos/activize-kidzz && npm test 2>&1 | tail -8`
Expected: `45 test files passed (45)`, `244 tests passed (244)` — 241 existing + 3 new.

Do **not** commit — this build batches to a single commit at the end of Task 3.

---

## Task 2: Age-band content filtering

**Files:**
- Modify: `src/content/useContent.ts`
- Modify: `src/App.e2e.test.tsx`

**Interfaces:**
- Consumes: `useAuthStore.getState().activeProfile?.age_band` (existing, `"3-5" | "6-8" | undefined`).
- No new exports — `useContent()`'s return shape (`ContentState`) is unchanged.

- [ ] **Step 1: Write the failing test**

Add this test to `src/App.e2e.test.tsx`, inside the existing `describe("App end-to-end", ...)` block (after the `"recovers from a failed load by retrying"` test):

```tsx
  it("filters a mission's activities by the profile's age band", async () => {
    const mixedMission = { ...mission, activityIds: ["activity-cross-crawl", "activity-toddler-only"] };
    const toddlerActivity = {
      id: "activity-toddler-only", type: "movement", title: "Toddler Wiggle", ageBands: ["3-5"],
      renderer: "react", asset: "toddler-wiggle", narration: "Wiggle!", pacing: { reps: 1, tempoMs: 1 },
      instructions: "Wiggle your arms!",
    };
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url === "/content/missions/mission-001.json") return { ok: true, json: async () => mixedMission };
        if (url === "/content/activities/activity-toddler-only.json") return { ok: true, json: async () => toddlerActivity };
        return { ok: true, json: async () => byPath[url] };
      }),
    );

    const user = userEvent.setup();
    render(<App />);

    await waitFor(() => expect(screen.getByText(/jungle jump/i)).toBeInTheDocument());
    await user.click(screen.getByRole("button", { name: /wake up your brain/i }));

    expect(screen.getByText(/activity 1 of 1/i)).toBeInTheDocument();
    expect(screen.getByText(/cross crawl/i)).toBeInTheDocument();
    expect(screen.queryByText(/toddler wiggle/i)).not.toBeInTheDocument();
  });
```

This test's `activeProfile` comes from the file's existing `beforeEach` (`age_band: "6-8"`) — unchanged.

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd /c/Repos/activize-kidzz && npm test -- src/App.e2e.test.tsx`
Expected: FAIL — `screen.getByText(/activity 1 of 1/i)` doesn't find a match (currently reads "Activity 1 of 2", since both activities load unfiltered).

- [ ] **Step 3: Implement the filter**

In `src/content/useContent.ts`, add the import alongside the existing ones:

```ts
import { useAuthStore } from "@/store/authStore";
```

Then change:

```ts
        const activitiesByMission: Record<string, Activity[]> = {};
        for (const mission of missions) {
          activitiesByMission[mission.id] = await Promise.all(mission.activityIds.map((id) => loader.loadActivity(id)));
        }
```

to:

```ts
        const ageBand = useAuthStore.getState().activeProfile?.age_band;
        const activitiesByMission: Record<string, Activity[]> = {};
        for (const mission of missions) {
          const activities = await Promise.all(mission.activityIds.map((id) => loader.loadActivity(id)));
          activitiesByMission[mission.id] = ageBand ? activities.filter((a) => a.ageBands.includes(ageBand)) : activities;
        }
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd /c/Repos/activize-kidzz && npm test -- src/App.e2e.test.tsx`
Expected: PASS — all tests in this file, including the new one.

- [ ] **Step 5: Run the full suite to confirm no regressions**

Run: `cd /c/Repos/activize-kidzz && npm test 2>&1 | tail -8`
Expected: `45 test files passed (45)`, `245 tests passed (245)` — 244 from Task 1 + 1 new.

Do **not** commit.

---

## Task 3: Content licensing review (documentation only)

**Files:**
- Modify: `docs/superpowers/specs/2026-07-14-activize-kidzz-design.md`

**Interfaces:** none — this task changes no code.

- [ ] **Step 1: Close out the master spec's §14 open item**

In `docs/superpowers/specs/2026-07-14-activize-kidzz-design.md`, section `## 14. Open Items / Dependencies`, change this line:

```markdown
- Source and license-check the starter movement/puzzle content.
```

to:

```markdown
- ~~Source and license-check the starter movement/puzzle content~~ — **resolved.** Reviewed all 18 activities (Plan 12): movement (Cross Crawl, Arm Circles, Butterfly Taps, Figure-8 Arms, Heel to Toe, Marching in Place, Star Jumps, Superhero Punches, Toe Touches, Windmill Reach) and breathing (Balloon Breathing, Belly Breaths, Bunny Breaths, Ocean Breaths) activities describe generic, widely-documented child-development/occupational-therapy movement patterns — not tied to any specific program, brand, or franchise. Puzzle themes (Critter Recall, Fruit Stand Memory, Weather Watch, Space Voyage Memory) use generic category icons (animals, fruits, weather, space) via standard Unicode emoji — no specific characters, franchises, or trademarked imagery. No licensing risk found.
```

This matches the exact resolved-item pattern already used 3 times earlier in this same section (`~~original~~ — **resolved.** ...`).

- [ ] **Step 2: Run the full test suite one final time**

Run: `cd /c/Repos/activize-kidzz && npm test 2>&1 | tail -8`
Expected: `45 test files passed (45)`, `245 tests passed (245)` — unchanged from the end of Task 2, since this task touches no test-covered code.

- [ ] **Step 3: Type-check and build**

Run: `cd /c/Repos/activize-kidzz && npx tsc --noEmit && npm run build`
Expected: both succeed with no errors.

- [ ] **Step 4: Stage everything and print the single commit command**

```bash
cd /c/Repos/activize-kidzz && git add src/lib/progress.ts src/lib/progress.test.ts src/content/useContent.ts src/App.e2e.test.tsx docs/superpowers/specs/2026-07-14-activize-kidzz-design.md
```

Print for the user to run (no path prefix — the user's terminal is already at `C:\Repos\activize-kidzz`):

```bash
git commit -m "feat: progress-write retry queue, age-band filtering, close licensing review (Plan 12)"
```

---

## Self-Review

**Spec coverage:** §2 (progress-write resilience) → Task 1. §3 (age-band filtering) → Task 2. §4 (content licensing review) → Task 3. §5 (non-goals) → respected: no `"3-5"` content authored, no `online`-event retry, no UI indicator, no changes to badge/streak logic beyond the queue addition.

**Placeholder scan:** no TBD/TODO; every step has complete, copy-pasteable code including all 3 new test cases and the exact master-spec replacement text.

**Type/name consistency:** `PendingWrite`, `queueKey`, `readQueue`, `writeQueue`, and `retryQueuedWrites` are defined once in Task 1's implementation and referenced identically (by the localStorage key format `activize:pendingProgress:${profileId}` and the `{updated, missionId, activitiesDone}` shape) in Task 1's own tests — no other task touches these names. Task 2's `ageBand` variable and `a.ageBands.includes(ageBand)` filter match `Activity`'s real `ageBands: AgeBand[]` field (`src/content/types.ts`) and `Profile`'s real `age_band: "3-5" | "6-8"` field (`src/services/authTypes.ts`) exactly — verified by reading both types fresh this session, not assumed.

**Independent-tasks note:** Tasks 1–3 touch entirely disjoint files (`src/lib/progress.*`, `src/content/useContent.ts` + `src/App.e2e.test.tsx`, and a docs file) and share no logic — consistent with this being 3 bundled backlog items, not one feature, per the spec's own framing.
