# Activize Kidzz — Rewards Engine (Plan 5)

## 1. Goal

Implement the badge rule engine the master spec designed (§5, §9) end to end: content-driven badges, a `badgeRuleRegistry` that evaluates them, awarding on mission completion, and two places they're seen — inline on `RewardScreen` and on a new persistent Trophy Shelf screen.

**Explicitly in scope, full master-spec rule set:** `streak` (3-day/7-day), `world_complete`, `missions_total`. **Out of scope:** real badge art/asset pipeline (badges render as an `emoji` field, matching `ReactRenderer`'s existing emoji+text pattern — swappable for real art with zero architecture change, same deferral already applied to renderers in Plan 4); multi-world progress tracking (the `world_complete` rule evaluates against the current world's mission count, which is correct today and needs no rework when a future plan adds real multi-world advancement).

## 2. Content Model

- New types in `content/types.ts`:
  ```ts
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
- `schema.ts`: `badgeSchema` as a `discriminatedUnion` on `rule.kind`, matching the existing `activitySchema` pattern. `parseBadge` export.
- `ContentLoader` gains `loadBadge(id): Promise<Badge>`. `useContent` loads every id in `manifest.badgeIds` (already present in `Manifest`, unused until now) and returns `badges: Badge[]` alongside the existing fields.
- New fixture content: one badge JSON per rule kind (`badge-streak-3`, `badge-streak-7`, `badge-world-complete-jungle`, `badge-missions-total`), added to the fixture `manifest.json`'s `badgeIds`.

## 3. Progress Data Model

- `ProgressRecord` gains `totalMissionsCompleted: number` (starts at `0` in `DEFAULT_PROGRESS`).
- New migration (`supabase/migrations/`, Plan 5's own): adds `total_missions_completed integer not null default 0` to `progress`; no change to `earned_badges`' shape (Plan 3 already created it schema-only).
- `progressBackend` (both `mockProgressBackend` and `supabaseProgressBackend`) gains two methods, mirroring the existing `insertCompletion`/`loadProgress` shape:
  - `insertEarnedBadge(profileId, badgeId): Promise<void>` — insert-only, matches `earned_badges`' `(profile_id, badge_id)` primary key (a duplicate insert is a conflict the caller avoids by checking `earnedBadgeIds` first, not by relying on upsert semantics).
  - `loadEarnedBadges(profileId): Promise<string[]>` — returns badge ids.
- `progressStore` gains two fields plus one action, matching the store's existing action-only mutation pattern (`setProgress`/`reset` — no external code calls `.setState` directly today):
  - `earnedBadgeIds: string[]` — the full persisted set, populated wherever `loadProgress` is called (auth login/signup, matching how the record itself loads).
  - `newlyEarnedBadgeIds: string[]` — ephemeral, overwritten (not appended) on every `evaluateAndAwardBadges` call, including to `[]` when nothing new was earned. No explicit reset action needed — always reflects the most recent completion.
  - `awardBadges: (newlyEarnedIds: string[]) => void` — appends to `earnedBadgeIds`, replaces `newlyEarnedBadgeIds` with the given list.

## 4. Badge Rule Engine

- `content/badgeRuleRegistry.ts`: `Record<BadgeRule["kind"], (rule: BadgeRule, ctx: EvalContext) => boolean>`, one pure function per kind — matches `rendererRegistry`/`puzzleRegistry`'s "new mechanic = one function" pattern.
- `EvalContext = { progress: ProgressRecord; worldId: string; totalMissionsInWorld: number }`.
  - `streak`: `progress.streakCount >= rule.value`
  - `world_complete`: `rule.worldId === ctx.worldId && progress.node > ctx.totalMissionsInWorld`
  - `missions_total`: `progress.totalMissionsCompleted >= rule.value`
- New `lib/badges.ts`, mirroring `lib/progress.ts`'s facade shape:
  ```ts
  export async function evaluateAndAwardBadges(
    badges: Badge[],
    ctx: Omit<EvalContext, "progress">,
  ): Promise<Badge[]> {
    try {
      const profileId = useAuthStore.getState().activeProfile?.id;
      if (!profileId) return [];
      const progress = useProgressStore.getState();
      const newly = badges.filter(
        (b) => !progress.earnedBadgeIds.includes(b.id) && badgeRuleRegistry[b.rule.kind](b.rule, { ...ctx, progress }),
      );
      for (const b of newly) await progressBackend.insertEarnedBadge(profileId, b.id);
      useProgressStore.getState().awardBadges(newly.map((b) => b.id));
      return newly;
    } catch {
      // Same resilience contract as recordMissionCompletion: never throw to
      // a fire-and-forget caller. A missed badge write self-heals next
      // completion (earnedBadgeIds re-checks from scratch each time).
      return [];
    }
  }
  ```

## 5. Wiring: Mission-Complete Flow

- `App.tsx`'s `MainApp` passes `totalMissionsInWorld={content.world.missionIds.length}`, `worldId={content.world.id}`, and `badges={content.badges}` down to `MissionPlayer`.
- `MissionPlayer`'s completion path:
  ```ts
  async function onMissionComplete() {
    await recordMissionCompletion(mission.id, mission.node, activities.length);
    await evaluateAndAwardBadges(badges, { worldId, totalMissionsInWorld });
  }
  void onMissionComplete();
  goToReward();
  ```
  `goToReward()` is still not blocked on either async step — preserves the existing "kid sees the reward immediately" optimistic-UI guarantee (spec §10). Badges pop in reactively once the store updates, same as `streakCount` already does today.

## 6. UI

- `RewardScreen` gains a `badges: Badge[]` prop (from `content.badges`); reads `newlyEarnedBadgeIds` from `progressStore` and renders each newly-earned badge's `emoji` + `name` alongside the existing streak line. Renders nothing extra when the array is empty.
- New `screens/TrophyShelf.tsx`: renders every badge in `content.badges` in the same grid/card visual language as `JourneyMap`'s mission grid. A badge is "earned" (full color, name shown) if its id is in `progressStore.earnedBadgeIds`, else "locked" (greyed out, matching `JourneyMap`'s existing locked-mission treatment). One `FocusableButton` ("Back to Map") calling `goToMap()`.
- `uiStore.Screen` extends to `"map" | "mission" | "reward" | "trophyShelf"`, with a new `goToTrophyShelf()` action mirroring `goToMap`/`goToReward`.
- `JourneyMap` gains an always-focusable `FocusableButton` ("Trophy Shelf") calling `goToTrophyShelf()`.
- `App.tsx`'s `MainApp` adds the `screen === "trophyShelf"` branch, rendering `<TrophyShelf badges={content.badges} />`.

## 7. Testing

- **Badge rule engine**: table-driven test over `badgeRuleRegistry`, one case per rule kind, boundary values (streak count one below/at/above threshold; node one below/at/above `totalMissionsInWorld`; `totalMissionsCompleted` one below/at/above target).
- **`evaluateAndAwardBadges`**: awards a badge exactly once (a second call against the same qualifying progress doesn't re-insert or reappear in `newlyEarnedBadgeIds`); a rejected `insertEarnedBadge` doesn't throw to the caller (mirrors the targeted error-swallowing test Plan 3's review required for `recordMissionCompletion`).
- **`MissionPlayer` integration**: completing a mission that crosses a badge threshold surfaces it in `newlyEarnedBadgeIds`; a completion that crosses none leaves it empty.
- **`RewardScreen`**: renders newly-earned badge name/emoji when present; unchanged when empty.
- **`TrophyShelf`**: earned badges render as earned, unearned as locked; "Back to Map" navigates correctly.
- **Backends**: `mockProgressBackend`/`supabaseProgressBackend` get direct tests for `insertEarnedBadge`/`loadEarnedBadges`, mirroring existing `insertCompletion`/`loadProgress` coverage.
- Fixture badge JSON (one per rule kind) is shared across all of the above, consistent with how `activity-cross-crawl.json` is reused today.
