# Activize Kidzz — Richer Starter Content (Plan 9)

## 1. Goal

`public/content/` currently has exactly one world (`world-jungle`), one mission (`mission-001`, "Day 1: Wake Up Your Brain"), and one activity (`activity-cross-crawl`) — a deliberate minimal placeholder copied from the test-fixture JSON to unblock local dev serving (a prior session's fix). Consequence: `progress.node` can never advance past 2 and `totalMissionsCompleted` can never exceed 1, so `badge-missions-total` (needs 10 completions) can never be earned, and there's only ever "Day 1" to play.

This plan authors 9 additional missions (10 total) in the existing `world-jungle`, each with 2-3 activities mixing movement/breathing/puzzle types, making `missions_total` and `world_complete` properly reachable through real play.

**Explicitly in scope:** 9 new mission JSON files + their activity JSON files, all in `public/content/`. Updating `world-jungle.json`'s `missionIds` to list all 10 missions in order.

**Explicitly out of scope (confirmed with the user):**
- A second world, or the world-advance mechanism a second world would require. `progress.node` is a monotonic global counter matching this world's own Day-N numbering, and `world_complete`'s rule (`progress.node > totalMissionsInWorld`) only holds together because exactly one world exists — adding a second world needs new code (renumbering, world-index advancement), a separate future plan.
- `badge-streak-3`/`badge-streak-7`: these require completions on consecutive *real calendar days* (`nextStreakCount` in `lib/progress.ts` compares against actual today/yesterday), so no amount of added content makes them reachable in one sitting — that's inherent to how streaks work, not something this plan changes or needs to address.
- Any code change at all. This is a pure content-authoring plan, matching the spec's own "drop a JSON file, zero code" story for adding content within an existing world.
- Updating `src/content/__fixtures__/*` (the automated test suite's fixtures) — these are a separate, deliberately minimal set that already diverges from real content in trivial ways (ids, single activity), and stay that way. No test relies on `public/content/`'s actual contents.
- Audio/narration playback — `narration` fields stay populated with `.mp3` filenames per the existing schema requirement (nothing plays them yet; that's a separate backlog item).

## 2. Content Structure

10 missions total (`mission-001` through `mission-010`), each `node: 1` through `10` respectively (matching the existing "Day N" numbering convention), 2-3 activities each:

| Day | Title | Activities |
|---|---|---|
| 1 | Wake Up Your Brain | Cross Crawl (existing, kept as-is) + Belly Breaths |
| 2 | Bounce and Balance | Star Jumps + Heel-to-Toe Walk |
| 3 | Reach and Remember | Toe Touches + a sequence puzzle (2 icons) |
| 4 | Deep Breaths, Big Stretches | Windmill Reach + Balloon Breathing |
| 5 | Pattern Play | Marching in Place + a sequence puzzle (3 icons) |
| 6 | Twist and Turn | Butterfly Taps + Superhero Punches + Ocean Breaths |
| 7 | Full Body Fun | Arm Circles + Figure-8 Arms + Bunny Breaths |
| 8 | Memory Match | Cross Crawl (repeat) + a sequence puzzle (4 icons) |
| 9 | Stretch and Sway | Windmill Reach (repeat) + Balloon Breathing (repeat) |
| 10 | Grand Finale | Star Jumps (repeat) + Figure-8 Arms (repeat) + a sequence puzzle (4 icons) |

Repeats across days are intentional — real movement routines repeat exercises, not a shortcut. Puzzle sequence length grows from 2 to 4 icons across the week as a gentle difficulty progression (per `SequenceMemoryPuzzle`'s existing, code-unchanged mechanic from Plan 8).

**Movement/breathing pacing convention:** every new activity uses `pacing: { reps, tempoMs }` in the same range as the existing `activity-cross-crawl` (`reps: 4-8`, `tempoMs: 1000-1500`), so no single exercise feels out of place in the gate-timer duration it produces (`ExercisePlayer`'s existing `gateDurationMs = reps * tempoMs`, unchanged).

**Puzzle icon sets:** each puzzle activity gets its own themed emoji set (distinct from the others, e.g. animals for one, food for another) sized to `sequence.length + 1-2` distractors, per `SequenceMemoryPuzzle`'s existing schema rules (every `sequence` value must exist in `icons`, `icons` has no duplicates).

## 3. Files

- Modify: `public/content/worlds/world-jungle.json` — `missionIds` grows from `["mission-001"]` to the full ordered list of 10.
- Modify: `public/content/missions/mission-001.json` — `activityIds` grows to include a new Belly Breaths activity alongside the existing Cross Crawl.
- Create: `public/content/missions/mission-002.json` through `mission-010.json`.
- Create: every new activity JSON referenced by the missions above, under `public/content/activities/`.

No changes to `src/content/types.ts`, `schema.ts`, `loader.ts`, `useContent.ts`, or any component — the existing content pipeline already supports everything here without modification.

## 4. Testing

None needed — this is content, not code. The existing automated suite doesn't read `public/content/` at all (it uses `src/content/__fixtures__/*`), so nothing to add or change there. Verification is manual: run the dev server, play through missions, confirm `missions_total`/`world_complete` badges are reachable and the puzzle activities render correctly with their new content (reusing the browser-based verification approach from the content-serving-gap fix session).
