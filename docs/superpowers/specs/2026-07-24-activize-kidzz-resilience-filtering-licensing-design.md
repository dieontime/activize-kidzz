# Progress Resilience, Age-Band Filtering, and Content Licensing Review (Plan 12) — Design Spec

## 1. Goal

Three independent backlog items, bundled into one plan by explicit user choice (different files/layers, no shared logic — grouped for process efficiency on a solo project, not because they're one feature):

1. A failed progress write is currently lost forever — no queue, no retry.
2. `age_band`/`ageBands` are captured and tagged everywhere but never actually filtered.
3. The master spec's own open item ("source and license-check the starter content") has never been formally closed out.

## 2. Progress-Write Resilience

**Current state:** `src/lib/progress.ts`'s `recordMissionCompletion` wraps its two backend calls (`saveProgress`, `insertCompletion`) in a try/catch that silently discards any failure — a network blip at mission-complete means that completion is gone forever, with no way to recover it. Master spec §10 calls for queuing the write in localStorage and retrying on next launch.

**Design:**
- On catch, instead of discarding, push `{ updated: ProgressRecord, missionId: string, activitiesDone: number }` onto a localStorage-backed array under the key `activize:pendingProgress:<profileId>`.
- A new `retryQueuedWrites(profileId: string): Promise<void>` in `src/lib/progress.ts` reads that queue, and for each entry (in order) re-attempts `progressBackend.saveProgress` + `progressBackend.insertCompletion`. On success, removes that entry from the queue. On the first failure, stops (leaves the remaining queue untouched) rather than retrying repeatedly in the same launch — avoids a retry storm on a still-offline device.
- `loadProgress(profileId)` — already the single call made right after every login/signup, which is this app's real "launch" moment since no session persists across app restarts — calls `retryQueuedWrites(profileId)` **first**, before its existing read, so the backend is brought current before it's read into the store. This was chosen (over also retrying on a `window` `online` event) as the simpler option matching the spec's literal "retry on next launch" wording; a live mid-session Wi-Fi-drop-then-recovery scenario was judged low-probability for a ~7-minute daily session and not worth the added event-listener lifecycle.
- Stays fully invisible to the kid — the reward screen was always optimistic (shown immediately regardless of write success); this only stops a failed write from being silently lost.

## 3. Age-Band Content Filtering

**Current state:** `profile.age_band` (`"3-5"|"6-8"`) and `activity.ageBands` (an array on every `Activity`) both exist and are populated everywhere, but nothing in `useContent.ts` or `MissionPlayer.tsx` ever reads `profile.age_band` to filter anything. Harmless today only because all 18 real activities are tagged `["6-8"]`.

**Design:**
- In `src/content/useContent.ts`, where `activitiesByMission[mission.id]` is built, filter the loaded activities down to those whose `ageBands` includes `useAuthStore.getState().activeProfile?.age_band` (falling back to showing everything if `age_band` is somehow unset — a defensive no-op, not an expected path).
- Filtering happens **per-activity within a mission**, not per-mission — a mission with a mix of age-tagged activities shows only the matching subset to each profile.
- If filtering leaves a mission with zero activities, no new code is needed: `MissionPlayer` already has a path for a mission with an empty activity list (it auto-completes and advances straight to the reward screen — confirmed via its existing test, `"goes straight to the reward screen when the mission has no activities"`).
- No new content is authored in this plan — this only adds the filtering code path, verified against the existing all-`"6-8"` content (a `"6-8"` profile's experience must be provably unchanged, since there's no `"3-5"` content yet to exercise the other branch).

## 4. Content Licensing Review

**Not a code task.** Master spec §14's open item: "Source and license-check the starter movement/puzzle content."

**Review conclusion:** all 18 activities (10 movement, 4 breathing, 4 puzzle) were authored directly during this build (Plan 1's initial activity, Plan 9's expansion to 10 missions) — none copied or adapted from any specific copyrighted source:
- **Movement** (Cross Crawl, Arm Circles, Butterfly Taps, Figure-8 Arms, Heel to Toe, Marching in Place, Star Jumps, Superhero Punches, Toe Touches, Windmill Reach) and **breathing** (Balloon Breathing, Belly Breaths, Bunny Breaths, Ocean Breaths) activities describe generic, widely-documented child-development/occupational-therapy movement patterns (cross-lateral coordination, bilateral movement, basic breathing exercises) — not tied to any specific program, brand, or franchise.
- **Puzzle** themes (Critter Recall, Fruit Stand Memory, Weather Watch, Space Voyage Memory) use generic category icons (animals, fruits, weather, space) via standard Unicode emoji — no specific characters, franchises, or trademarked imagery.

**Conclusion: no licensing risk found.** Closed out by editing master spec §14 directly (`docs/superpowers/specs/2026-07-14-activize-kidzz-design.md`), matching the pattern already used for 3 other resolved items in that same section.

## 5. Non-Goals

- No age-band-aware content actually authored (no `"3-5"` activities) — purely the filtering code path.
- No mid-session network-reconnect retry (`online` event) — launch-only retry, per §2.
- No UI indicator for pending/queued writes — stays fully invisible, matching the existing optimistic-reward design.
- No changes to the badge-evaluation logic, streak math, or any other part of `lib/progress.ts` beyond the queue/retry addition.
