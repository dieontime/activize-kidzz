# Activize Kidzz — Persistence (Plan 3)

## 1. Goal

Give the app real memory. Right now every screen resets on reload: `useUiStore` only tracks in-memory navigation state (`screen`, `activeMissionId`), and `useContent` always loads `manifest.worldIds[0]` fresh. A logged-in profile has nowhere to store game progress — the "one day = one mission" core loop (spec §3) and the linear, gated journey map (spec §4) don't actually exist in code yet; `JourneyMap` currently renders every mission as equally clickable with no completed/current/locked distinction.

This plan wires up the `progress` / `mission_completions` / `earned_badges` tables already designed in the master spec (`docs/superpowers/specs/2026-07-14-activize-kidzz-design.md` §8), adds the daily-gate lock-state logic to `JourneyMap`, and adds a small streak indicator to `RewardScreen`.

**Explicitly out of scope for this plan:**
- `earned_badges` gets a migration but no writer — the badge rule engine that decides *when* a badge is earned is Plan 5's scope ("rewards engine"). Writing to this table is deferred there.
- Multi-world switching UI. Only one world (`world-jungle`) exists in content today. `progress.world` is persisted for forward-compatibility, and `useContent` loads whichever world ID is persisted instead of hardcoding `worldIds[0]`, but there is no "world complete, here's the next one" transition screen — there's nothing to transition to yet.

## 2. Architecture

Mirrors the existing auth pattern (`authStore`/`mockBackend`/`supabaseBackend`/`backend.ts`/`lib/auth.ts`) exactly — no new architectural shape, just the same one applied to a second domain:

- `src/services/mockProgressBackend.ts` — localStorage-array-backed mock, same convention as `mockBackend.ts`.
- `src/services/supabaseProgressBackend.ts` — direct `supabase-js` table reads/writes (no RPCs needed — unlike auth, there's no secret to protect behind a `SECURITY DEFINER` function; RLS is permissive by design, see §3).
- `src/services/progressBackend.ts` — env-based switch, identical shape to `backend.ts`.
- `src/store/progressStore.ts` — zustand: `{ node: number, streakCount: number, longestStreak: number, lastCompletedDate: string | null, isLoaded: boolean }`.
- `src/lib/progress.ts` — facade: `loadProgress(profileId): Promise<void>` (populates `progressStore`), `recordMissionCompletion(profileId, missionId, activitiesDone): Promise<void>`.

**Wiring into auth:** `lib/auth.ts`'s `signup`/`login` call `loadProgress(profile.id)` immediately after `useAuthStore.getState().login(...)` — the same place `addKnownProfile` is already called. `useAuthStore.logout()` also resets `progressStore` to its zeroed default — critical for the multi-kid shared-TV model, so one kid's progress can never leak into the next kid's `ProfilePicker` session on the same TV.

**No progress row on signup.** `loadProgress` returns a zeroed default (`node: 1, streakCount: 0, longestStreak: 0, lastCompletedDate: null`) when the DB has no row for that profile yet. `node` is 1-based, matching the already-authored `Mission.node` ("Day N") numbering — not a 0-based array index. The row is only ever created by the completion upsert (`recordMissionCompletion`) — matching the spec's "single upsert at mission-complete" write pattern, no extra write at signup time.

## 3. Data model (migration)

Unchanged from the master spec §8 — this plan just applies it:

```sql
progress                        -- one row per profile, created lazily
  profile_id      uuid  PK/FK -> profiles.id on delete cascade
  world           int
  node            int              -- index of the NEXT playable mission
  streak_count    int
  longest_streak  int
  last_completed_date date

mission_completions              -- append-only log
  id              uuid  PK
  profile_id      uuid  FK -> profiles.id on delete cascade
  mission_id      text
  completed_at    timestamptz
  activities_done int

earned_badges                    -- schema only this plan, no writer (Plan 5)
  profile_id      uuid  FK -> profiles.id on delete cascade
  badge_id        text
  earned_at       timestamptz
  PRIMARY KEY (profile_id, badge_id)
```

RLS: permissive `anon`/`authenticated` CRUD on all three tables (matches the spec's explicitly-accepted trade-off for this app's threat model — the client is trusted to only query its own `profile_id`; revisit before any future clinical Tier C pivot, per spec §13/§8).

## 4. Daily-gate lock-state model

For a mission with its authored `Mission.node` value (1-based, matching "Day N"), compared against `progress.node` and `progress.last_completed_date`:

| Condition | State | Rendering |
|---|---|---|
| `mission.node < progress.node` | completed | clickable (see replay note below), visually marked done |
| `mission.node === progress.node` and `last_completed_date !== today` | current | clickable, auto-focused (today's mission) |
| `mission.node === progress.node` and `last_completed_date === today` | done-for-today | locked — not a `FocusableButton`, D-pad focus can't land on it |
| `mission.node > progress.node` | locked | locked — same as above |

A fresh profile (`node: 1, last_completed_date: null`) has the mission at `node: 1` ("Day 1") immediately in the **current** state. "Today" is a UTC-date-string comparison (`YYYY-MM-DD`, midnight boundary), matching the existing streak-logic convention already decided in the master spec.

**Replaying a completed mission does not call `recordMissionCompletion`.** Only reaching the reward screen via the **current** mission does. Past missions stay replayable — per spec §4's "no failure, no losing" design rule, locking a kid out of a favorite mission would read as punitive, not motivating.

## 5. Completion write path

Both of `MissionPlayer`'s exit points — the normal `onDone` reaching the last activity, and the zero-activities `useEffect` early-exit — call the same `recordMissionCompletion(profileId, missionId, activitiesDone)` exactly once, immediately before `goToReward()`. Inside `recordMissionCompletion`:

1. Compare the stored `last_completed_date` to today: same day → no-op (defensive only — the lock state should prevent this path from being reachable) / yesterday → `streak_count + 1` / older gap or `null` → reset to `1`.
2. `longest_streak = max(longest_streak, streak_count)`; `last_completed_date = today`; `node = node + 1`.
3. Upsert the `progress` row with the new values; insert one `mission_completions` row (`activities_done` = the actual count reached — `activities.length` on the normal path, `0` on the zero-activities edge case).

## 6. Streak display

`RewardScreen` reads `streakCount` from `progressStore` (updated by the completion write above) and shows a small line beneath the existing "you earned a star!" message — e.g. "3-day streak!" — only when `streakCount >= 2` (so day one doesn't awkwardly announce "1-day streak"). Uses the `storybook-gold` accent established in Plan 2.5's palette.

## 7. Testing

- `mockProgressBackend` follows `mockBackend`'s localStorage-array pattern — same conventions, easy to unit test in isolation.
- Streak-transition tests use `vi.useFakeTimers()` (same technique as Plan 2's lockout-ladder tests) covering same-day/yesterday/older-gap scenarios.
- `JourneyMap` gets new tests for all three lock states (completed/current/locked) via role/text assertions — a locked mission must not be a `FocusableButton` (D-pad focus can never land on it).
- One App-level end-to-end test: fresh profile → mission 0 is current → complete it → reload the app → mission 0 shows completed, mission 1 shows current.

## 8. Non-goals (recap)

- No `earned_badges` writer (Plan 5's rewards/badge-rule-engine work).
- No multi-world switching UI (only one world exists in content; `progress.world` persists for forward-compatibility only).
- No changes to the per-activity demonstrate → mimic → parent-validates flow inside `MissionPlayer` — only the "reached the end" transition point gets the new completion-write call.
