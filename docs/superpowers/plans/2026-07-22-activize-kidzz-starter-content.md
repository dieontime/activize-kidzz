# Activize Kidzz — Richer Starter Content (Plan 9) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Grow `world-jungle` from 1 mission to 10, each with 2-3 movement/breathing/puzzle activities, making `badge-missions-total` (needs 10 completions) and `badge-world-complete-jungle` properly reachable through real play.

**Architecture:** Pure content authoring — new/modified JSON files under `public/content/`, zero code changes. This plan is fundamentally different from every prior plan in this repo: there is no code to TDD, so each task's "test" is a schema-validation check (a temporary Vitest file importing the real `parseMission`/`parseActivity` from `src/content/schema.ts` against the new JSON, asserting it parses without throwing — deleted at the end of the same task, never committed), not a permanent automated test. The final task adds manual browser verification.

**Tech Stack:** No new dependencies, no code changes. Existing content pipeline (`src/content/schema.ts`'s zod validation, `src/content/loader.ts`, `useContent.ts`) already supports everything here unmodified.

## Global Constraints

- Every movement/breathing activity: `renderer: "react"` (the only renderer with a real implementation — `rive`/`lottie`/`video` just show `PlaceholderRenderer`), `ageBands: ["6-8"]`, a real `narration` filename string (nothing plays it yet — a separate backlog item, not this plan's concern).
- Movement `pacing`: `reps` 4-8, `tempoMs` 1000-1500 (matches the existing `activity-cross-crawl`'s range, so `ExercisePlayer`'s gate duration — `reps * tempoMs` — stays in a similar ballpark across all activities).
- Breathing activities have **no `instructions` field** — `BreathingActivity` in `src/content/types.ts` doesn't define one (only `MovementActivity` does); `ReactRenderer`'s breathing branch renders a fixed "Breathe in, breathe out — {cycles} times" text regardless of content. Every new breathing activity here uses `cycles: 4`.
- Every puzzle activity: `type: "puzzle"`, `puzzle: { puzzleType: "sequence_memory", icons: [...], sequence: [...] }`. Per `schema.ts`'s real `.refine()` rules (added in Plan 8): every `sequence` value must exist in `icons`, and `icons` must have no duplicates. Each puzzle gets its own emoji theme, sized to `sequence.length` + 1 distractor icon never used in `sequence`.
- `src/content/__fixtures__/*` (the automated test suite's fixtures) are **not touched** — a separate, deliberately minimal set; no test reads `public/content/`.
- No second world, no world-advance mechanism — out of scope, confirmed with the user (a separate future plan).
- Per this session's standing preference: do **not** commit after each task. Complete all 6 tasks in one continuous session, stage everything together, and print exactly **one** commit command after Task 6's manual verification passes.

---

### Task 1: World manifest + Mission 1 (add Belly Breaths)

**Files:**
- Modify: `public/content/worlds/world-jungle.json`
- Modify: `public/content/missions/mission-001.json`
- Create: `public/content/activities/activity-belly-breaths.json`

**Interfaces:**
- Produces: `activity-belly-breaths` (a `BreathingActivity`), referenced by `mission-001.activityIds`. `world-jungle.missionIds` grows to the full 10-mission list (all 10 ids referenced here even though missions 2-10 don't exist as files until later tasks — `worldSchema` only validates `missionIds: z.array(z.string())`, it doesn't check the referenced mission files exist, so this is safe to do now).

- [ ] **Step 1: Author the new activity**

Create `public/content/activities/activity-belly-breaths.json`:

```json
{
  "id": "activity-belly-breaths",
  "type": "breathing",
  "title": "Belly Breaths",
  "ageBands": ["6-8"],
  "renderer": "react",
  "asset": "belly-breaths",
  "narration": "belly-breaths.mp3",
  "cycles": 4
}
```

- [ ] **Step 2: Update Mission 1's activities**

Modify `public/content/missions/mission-001.json` to:

```json
{
  "id": "mission-001",
  "worldId": "world-jungle",
  "node": 1,
  "title": "Day 1: Wake Up Your Brain",
  "activityIds": ["activity-cross-crawl", "activity-belly-breaths"]
}
```

- [ ] **Step 3: Update the world's mission list**

Modify `public/content/worlds/world-jungle.json` to:

```json
{
  "id": "world-jungle",
  "order": 1,
  "theme": "jungle",
  "name": "Jungle Jump",
  "missionIds": ["mission-001", "mission-002", "mission-003", "mission-004", "mission-005", "mission-006", "mission-007", "mission-008", "mission-009", "mission-010"],
  "art": "worlds/jungle.png"
}
```

- [ ] **Step 4: Validate against the real schema**

Create a temporary file `src/content/__plan9-check.test.ts`:

```ts
import worldJson from "../../public/content/worlds/world-jungle.json";
import mission1Json from "../../public/content/missions/mission-001.json";
import bellyBreathsJson from "../../public/content/activities/activity-belly-breaths.json";
import { parseWorld, parseMission, parseActivity } from "./schema";

describe("Plan 9 content validation (Task 1)", () => {
  it("parses the updated world, mission 1, and the new belly-breaths activity", () => {
    expect(parseWorld(worldJson).missionIds).toHaveLength(10);
    expect(parseMission(mission1Json).activityIds).toEqual(["activity-cross-crawl", "activity-belly-breaths"]);
    const a = parseActivity(bellyBreathsJson);
    expect(a.type).toBe("breathing");
  });
});
```

Run: `cd /c/Repos/activize-kidzz && npx vitest run src/content/__plan9-check.test.ts`
Expected: PASS (1 test)

- [ ] **Step 5: Delete the temporary validation file**

```bash
rm /c/Repos/activize-kidzz/src/content/__plan9-check.test.ts
```

This file is throwaway per-task scaffolding, not a permanent addition to the suite (confirmed scope with the user: no automated tests added by this plan).

---

### Task 2: Missions 2-3 (Bounce and Balance, Reach and Remember)

**Files:**
- Create: `public/content/missions/mission-002.json`
- Create: `public/content/missions/mission-003.json`
- Create: `public/content/activities/activity-star-jumps.json`
- Create: `public/content/activities/activity-heel-to-toe.json`
- Create: `public/content/activities/activity-toe-touches.json`
- Create: `public/content/activities/activity-puzzle-critters.json`

**Interfaces:**
- Produces: `activity-star-jumps` and `activity-figure-8-arms` (Task 4) get reused by Task 5's mission-010 — `activity-star-jumps`'s id must stay exactly this for that later reference to resolve.

- [ ] **Step 1: Author Day 2's activities**

Create `public/content/activities/activity-star-jumps.json`:

```json
{
  "id": "activity-star-jumps",
  "type": "movement",
  "title": "Star Jumps",
  "ageBands": ["6-8"],
  "renderer": "react",
  "asset": "star-jumps",
  "narration": "star-jumps.mp3",
  "pacing": { "reps": 8, "tempoMs": 1000 },
  "instructions": "Jump with your arms and legs out like a star, then back together!"
}
```

Create `public/content/activities/activity-heel-to-toe.json`:

```json
{
  "id": "activity-heel-to-toe",
  "type": "movement",
  "title": "Heel to Toe",
  "ageBands": ["6-8"],
  "renderer": "react",
  "asset": "heel-to-toe",
  "narration": "heel-to-toe.mp3",
  "pacing": { "reps": 6, "tempoMs": 1300 },
  "instructions": "Walk in a line, touching your heel to your toes with each step!"
}
```

- [ ] **Step 2: Author Day 3's activities**

Create `public/content/activities/activity-toe-touches.json`:

```json
{
  "id": "activity-toe-touches",
  "type": "movement",
  "title": "Toe Touches",
  "ageBands": ["6-8"],
  "renderer": "react",
  "asset": "toe-touches",
  "narration": "toe-touches.mp3",
  "pacing": { "reps": 6, "tempoMs": 1200 },
  "instructions": "Reach your opposite hand down to touch your toes, then switch sides!"
}
```

Create `public/content/activities/activity-puzzle-critters.json`:

```json
{
  "id": "activity-puzzle-critters",
  "type": "puzzle",
  "title": "Critter Recall",
  "ageBands": ["6-8"],
  "narration": "puzzle-critters.mp3",
  "puzzle": { "puzzleType": "sequence_memory", "icons": ["🐱", "🐶", "🐰"], "sequence": ["🐱", "🐶"] }
}
```

- [ ] **Step 3: Author the two missions**

Create `public/content/missions/mission-002.json`:

```json
{
  "id": "mission-002",
  "worldId": "world-jungle",
  "node": 2,
  "title": "Day 2: Bounce and Balance",
  "activityIds": ["activity-star-jumps", "activity-heel-to-toe"]
}
```

Create `public/content/missions/mission-003.json`:

```json
{
  "id": "mission-003",
  "worldId": "world-jungle",
  "node": 3,
  "title": "Day 3: Reach and Remember",
  "activityIds": ["activity-toe-touches", "activity-puzzle-critters"]
}
```

- [ ] **Step 4: Validate against the real schema**

Create a temporary file `src/content/__plan9-check.test.ts`:

```ts
import mission2Json from "../../public/content/missions/mission-002.json";
import mission3Json from "../../public/content/missions/mission-003.json";
import starJumpsJson from "../../public/content/activities/activity-star-jumps.json";
import heelToToeJson from "../../public/content/activities/activity-heel-to-toe.json";
import toeTouchesJson from "../../public/content/activities/activity-toe-touches.json";
import puzzleCrittersJson from "../../public/content/activities/activity-puzzle-critters.json";
import { parseMission, parseActivity } from "./schema";

describe("Plan 9 content validation (Task 2)", () => {
  it("parses missions 2-3 and their activities", () => {
    expect(parseMission(mission2Json).node).toBe(2);
    expect(parseMission(mission3Json).node).toBe(3);
    expect(parseActivity(starJumpsJson).type).toBe("movement");
    expect(parseActivity(heelToToeJson).type).toBe("movement");
    expect(parseActivity(toeTouchesJson).type).toBe("movement");
    const puzzle = parseActivity(puzzleCrittersJson);
    expect(puzzle.type).toBe("puzzle");
  });
});
```

Run: `cd /c/Repos/activize-kidzz && npx vitest run src/content/__plan9-check.test.ts`
Expected: PASS (1 test)

- [ ] **Step 5: Delete the temporary validation file**

```bash
rm /c/Repos/activize-kidzz/src/content/__plan9-check.test.ts
```

---

### Task 3: Missions 4-5 (Deep Breaths & Big Stretches, Pattern Play)

**Files:**
- Create: `public/content/missions/mission-004.json`
- Create: `public/content/missions/mission-005.json`
- Create: `public/content/activities/activity-windmill-reach.json`
- Create: `public/content/activities/activity-balloon-breathing.json`
- Create: `public/content/activities/activity-marching.json`
- Create: `public/content/activities/activity-puzzle-fruits.json`

**Interfaces:**
- Produces: `activity-windmill-reach` and `activity-balloon-breathing` get reused by Task 5's mission-009 — their ids must stay exactly these for that later reference to resolve.

- [ ] **Step 1: Author Day 4's activities**

Create `public/content/activities/activity-windmill-reach.json`:

```json
{
  "id": "activity-windmill-reach",
  "type": "movement",
  "title": "Windmill Reach",
  "ageBands": ["6-8"],
  "renderer": "react",
  "asset": "windmill-reach",
  "narration": "windmill-reach.mp3",
  "pacing": { "reps": 6, "tempoMs": 1400 },
  "instructions": "Stand tall with feet apart, and swing one hand down to touch the opposite foot!"
}
```

Create `public/content/activities/activity-balloon-breathing.json`:

```json
{
  "id": "activity-balloon-breathing",
  "type": "breathing",
  "title": "Balloon Breathing",
  "ageBands": ["6-8"],
  "renderer": "react",
  "asset": "balloon-breathing",
  "narration": "balloon-breathing.mp3",
  "cycles": 4
}
```

- [ ] **Step 2: Author Day 5's activities**

Create `public/content/activities/activity-marching.json`:

```json
{
  "id": "activity-marching",
  "type": "movement",
  "title": "Marching in Place",
  "ageBands": ["6-8"],
  "renderer": "react",
  "asset": "marching",
  "narration": "marching.mp3",
  "pacing": { "reps": 8, "tempoMs": 1000 },
  "instructions": "March in place, lifting your knees high and swinging your opposite arm!"
}
```

Create `public/content/activities/activity-puzzle-fruits.json`:

```json
{
  "id": "activity-puzzle-fruits",
  "type": "puzzle",
  "title": "Fruit Stand Memory",
  "ageBands": ["6-8"],
  "narration": "puzzle-fruits.mp3",
  "puzzle": { "puzzleType": "sequence_memory", "icons": ["🍎", "🍌", "🍇", "🍊"], "sequence": ["🍎", "🍌", "🍇"] }
}
```

- [ ] **Step 3: Author the two missions**

Create `public/content/missions/mission-004.json`:

```json
{
  "id": "mission-004",
  "worldId": "world-jungle",
  "node": 4,
  "title": "Day 4: Deep Breaths, Big Stretches",
  "activityIds": ["activity-windmill-reach", "activity-balloon-breathing"]
}
```

Create `public/content/missions/mission-005.json`:

```json
{
  "id": "mission-005",
  "worldId": "world-jungle",
  "node": 5,
  "title": "Day 5: Pattern Play",
  "activityIds": ["activity-marching", "activity-puzzle-fruits"]
}
```

- [ ] **Step 4: Validate against the real schema**

Create a temporary file `src/content/__plan9-check.test.ts`:

```ts
import mission4Json from "../../public/content/missions/mission-004.json";
import mission5Json from "../../public/content/missions/mission-005.json";
import windmillReachJson from "../../public/content/activities/activity-windmill-reach.json";
import balloonBreathingJson from "../../public/content/activities/activity-balloon-breathing.json";
import marchingJson from "../../public/content/activities/activity-marching.json";
import puzzleFruitsJson from "../../public/content/activities/activity-puzzle-fruits.json";
import { parseMission, parseActivity } from "./schema";

describe("Plan 9 content validation (Task 3)", () => {
  it("parses missions 4-5 and their activities", () => {
    expect(parseMission(mission4Json).node).toBe(4);
    expect(parseMission(mission5Json).node).toBe(5);
    expect(parseActivity(windmillReachJson).type).toBe("movement");
    expect(parseActivity(balloonBreathingJson).type).toBe("breathing");
    expect(parseActivity(marchingJson).type).toBe("movement");
    expect(parseActivity(puzzleFruitsJson).type).toBe("puzzle");
  });
});
```

Run: `cd /c/Repos/activize-kidzz && npx vitest run src/content/__plan9-check.test.ts`
Expected: PASS (1 test)

- [ ] **Step 5: Delete the temporary validation file**

```bash
rm /c/Repos/activize-kidzz/src/content/__plan9-check.test.ts
```

---

### Task 4: Missions 6-7 (Twist and Turn, Full Body Fun — 3 activities each)

**Files:**
- Create: `public/content/missions/mission-006.json`
- Create: `public/content/missions/mission-007.json`
- Create: `public/content/activities/activity-butterfly-taps.json`
- Create: `public/content/activities/activity-superhero-punches.json`
- Create: `public/content/activities/activity-ocean-breaths.json`
- Create: `public/content/activities/activity-arm-circles.json`
- Create: `public/content/activities/activity-figure-8-arms.json`
- Create: `public/content/activities/activity-bunny-breaths.json`

**Interfaces:**
- Produces: `activity-figure-8-arms` gets reused by Task 5's mission-010 — its id must stay exactly this for that later reference to resolve.

- [ ] **Step 1: Author Day 6's activities**

Create `public/content/activities/activity-butterfly-taps.json`:

```json
{
  "id": "activity-butterfly-taps",
  "type": "movement",
  "title": "Butterfly Taps",
  "ageBands": ["6-8"],
  "renderer": "react",
  "asset": "butterfly-taps",
  "narration": "butterfly-taps.mp3",
  "pacing": { "reps": 6, "tempoMs": 1200 },
  "instructions": "Cross your arms and tap your opposite shoulders, like butterfly wings!"
}
```

Create `public/content/activities/activity-superhero-punches.json`:

```json
{
  "id": "activity-superhero-punches",
  "type": "movement",
  "title": "Superhero Punches",
  "ageBands": ["6-8"],
  "renderer": "react",
  "asset": "superhero-punches",
  "narration": "superhero-punches.mp3",
  "pacing": { "reps": 8, "tempoMs": 1000 },
  "instructions": "Punch one arm across your body, then switch to the other side, like a superhero!"
}
```

Create `public/content/activities/activity-ocean-breaths.json`:

```json
{
  "id": "activity-ocean-breaths",
  "type": "breathing",
  "title": "Ocean Breaths",
  "ageBands": ["6-8"],
  "renderer": "react",
  "asset": "ocean-breaths",
  "narration": "ocean-breaths.mp3",
  "cycles": 4
}
```

- [ ] **Step 2: Author Day 7's activities**

Create `public/content/activities/activity-arm-circles.json`:

```json
{
  "id": "activity-arm-circles",
  "type": "movement",
  "title": "Arm Circles",
  "ageBands": ["6-8"],
  "renderer": "react",
  "asset": "arm-circles",
  "narration": "arm-circles.mp3",
  "pacing": { "reps": 8, "tempoMs": 1000 },
  "instructions": "Make big circles in the air with both of your arms!"
}
```

Create `public/content/activities/activity-figure-8-arms.json`:

```json
{
  "id": "activity-figure-8-arms",
  "type": "movement",
  "title": "Figure-8 Arms",
  "ageBands": ["6-8"],
  "renderer": "react",
  "asset": "figure-8-arms",
  "narration": "figure-8-arms.mp3",
  "pacing": { "reps": 6, "tempoMs": 1300 },
  "instructions": "Draw a big figure-8 in the air with both hands together!"
}
```

Create `public/content/activities/activity-bunny-breaths.json`:

```json
{
  "id": "activity-bunny-breaths",
  "type": "breathing",
  "title": "Bunny Breaths",
  "ageBands": ["6-8"],
  "renderer": "react",
  "asset": "bunny-breaths",
  "narration": "bunny-breaths.mp3",
  "cycles": 4
}
```

- [ ] **Step 3: Author the two missions**

Create `public/content/missions/mission-006.json`:

```json
{
  "id": "mission-006",
  "worldId": "world-jungle",
  "node": 6,
  "title": "Day 6: Twist and Turn",
  "activityIds": ["activity-butterfly-taps", "activity-superhero-punches", "activity-ocean-breaths"]
}
```

Create `public/content/missions/mission-007.json`:

```json
{
  "id": "mission-007",
  "worldId": "world-jungle",
  "node": 7,
  "title": "Day 7: Full Body Fun",
  "activityIds": ["activity-arm-circles", "activity-figure-8-arms", "activity-bunny-breaths"]
}
```

- [ ] **Step 4: Validate against the real schema**

Create a temporary file `src/content/__plan9-check.test.ts`:

```ts
import mission6Json from "../../public/content/missions/mission-006.json";
import mission7Json from "../../public/content/missions/mission-007.json";
import butterflyTapsJson from "../../public/content/activities/activity-butterfly-taps.json";
import superheroPunchesJson from "../../public/content/activities/activity-superhero-punches.json";
import oceanBreathsJson from "../../public/content/activities/activity-ocean-breaths.json";
import armCirclesJson from "../../public/content/activities/activity-arm-circles.json";
import figure8ArmsJson from "../../public/content/activities/activity-figure-8-arms.json";
import bunnyBreathsJson from "../../public/content/activities/activity-bunny-breaths.json";
import { parseMission, parseActivity } from "./schema";

describe("Plan 9 content validation (Task 4)", () => {
  it("parses missions 6-7 (3 activities each) and their activities", () => {
    expect(parseMission(mission6Json).activityIds).toHaveLength(3);
    expect(parseMission(mission7Json).activityIds).toHaveLength(3);
    expect(parseActivity(butterflyTapsJson).type).toBe("movement");
    expect(parseActivity(superheroPunchesJson).type).toBe("movement");
    expect(parseActivity(oceanBreathsJson).type).toBe("breathing");
    expect(parseActivity(armCirclesJson).type).toBe("movement");
    expect(parseActivity(figure8ArmsJson).type).toBe("movement");
    expect(parseActivity(bunnyBreathsJson).type).toBe("breathing");
  });
});
```

Run: `cd /c/Repos/activize-kidzz && npx vitest run src/content/__plan9-check.test.ts`
Expected: PASS (1 test)

- [ ] **Step 5: Delete the temporary validation file**

```bash
rm /c/Repos/activize-kidzz/src/content/__plan9-check.test.ts
```

---

### Task 5: Missions 8-10 (Memory Match, Stretch and Sway, Grand Finale)

**Files:**
- Create: `public/content/missions/mission-008.json`
- Create: `public/content/missions/mission-009.json`
- Create: `public/content/missions/mission-010.json`
- Create: `public/content/activities/activity-puzzle-weather.json`
- Create: `public/content/activities/activity-puzzle-space.json`

**Interfaces:**
- Consumes: `activity-cross-crawl` (existing), `activity-windmill-reach` and `activity-balloon-breathing` (Task 3), `activity-star-jumps` (Task 2), `activity-figure-8-arms` (Task 4) — all referenced by id only, no new activity files needed for the reused ones.

- [ ] **Step 1: Author the two new puzzle activities**

Create `public/content/activities/activity-puzzle-weather.json`:

```json
{
  "id": "activity-puzzle-weather",
  "type": "puzzle",
  "title": "Weather Watch",
  "ageBands": ["6-8"],
  "narration": "puzzle-weather.mp3",
  "puzzle": { "puzzleType": "sequence_memory", "icons": ["☀️", "🌧️", "❄️", "⛈️", "🌈"], "sequence": ["☀️", "🌧️", "❄️", "⛈️"] }
}
```

Create `public/content/activities/activity-puzzle-space.json`:

```json
{
  "id": "activity-puzzle-space",
  "type": "puzzle",
  "title": "Space Voyage Memory",
  "ageBands": ["6-8"],
  "narration": "puzzle-space.mp3",
  "puzzle": { "puzzleType": "sequence_memory", "icons": ["🚀", "🪐", "⭐", "🌙", "☄️"], "sequence": ["🚀", "🪐", "⭐", "🌙"] }
}
```

- [ ] **Step 2: Author missions 8-10**

Create `public/content/missions/mission-008.json`:

```json
{
  "id": "mission-008",
  "worldId": "world-jungle",
  "node": 8,
  "title": "Day 8: Memory Match",
  "activityIds": ["activity-cross-crawl", "activity-puzzle-weather"]
}
```

Create `public/content/missions/mission-009.json`:

```json
{
  "id": "mission-009",
  "worldId": "world-jungle",
  "node": 9,
  "title": "Day 9: Stretch and Sway",
  "activityIds": ["activity-windmill-reach", "activity-balloon-breathing"]
}
```

Create `public/content/missions/mission-010.json`:

```json
{
  "id": "mission-010",
  "worldId": "world-jungle",
  "node": 10,
  "title": "Day 10: Grand Finale",
  "activityIds": ["activity-star-jumps", "activity-figure-8-arms", "activity-puzzle-space"]
}
```

- [ ] **Step 3: Validate against the real schema**

Create a temporary file `src/content/__plan9-check.test.ts`:

```ts
import mission8Json from "../../public/content/missions/mission-008.json";
import mission9Json from "../../public/content/missions/mission-009.json";
import mission10Json from "../../public/content/missions/mission-010.json";
import puzzleWeatherJson from "../../public/content/activities/activity-puzzle-weather.json";
import puzzleSpaceJson from "../../public/content/activities/activity-puzzle-space.json";
import { parseMission, parseActivity } from "./schema";

describe("Plan 9 content validation (Task 5)", () => {
  it("parses missions 8-10 and the two new puzzle activities", () => {
    expect(parseMission(mission8Json).node).toBe(8);
    expect(parseMission(mission9Json).node).toBe(9);
    expect(parseMission(mission10Json).node).toBe(10);
    expect(parseActivity(puzzleWeatherJson).type).toBe("puzzle");
    expect(parseActivity(puzzleSpaceJson).type).toBe("puzzle");
  });
});
```

Run: `cd /c/Repos/activize-kidzz && npx vitest run src/content/__plan9-check.test.ts`
Expected: PASS (1 test)

- [ ] **Step 4: Delete the temporary validation file**

```bash
rm /c/Repos/activize-kidzz/src/content/__plan9-check.test.ts
```

---

### Task 6: Full validation + manual browser verification

**Files:**
- None new — this task only verifies the 29 files authored or referenced across Tasks 1-5 (1 world + 10 missions + 18 activities, counting `activity-cross-crawl` which already existed and was not modified).

- [ ] **Step 1: Validate every mission and activity against the real schema in one pass**

Create a temporary file `src/content/__plan9-check.test.ts`:

```ts
import { parseWorld, parseMission, parseActivity } from "./schema";
import worldJson from "../../public/content/worlds/world-jungle.json";
import mission001 from "../../public/content/missions/mission-001.json";
import mission002 from "../../public/content/missions/mission-002.json";
import mission003 from "../../public/content/missions/mission-003.json";
import mission004 from "../../public/content/missions/mission-004.json";
import mission005 from "../../public/content/missions/mission-005.json";
import mission006 from "../../public/content/missions/mission-006.json";
import mission007 from "../../public/content/missions/mission-007.json";
import mission008 from "../../public/content/missions/mission-008.json";
import mission009 from "../../public/content/missions/mission-009.json";
import mission010 from "../../public/content/missions/mission-010.json";

const missions = [mission001, mission002, mission003, mission004, mission005, mission006, mission007, mission008, mission009, mission010];

describe("Plan 9 content validation (Task 6, full pass)", () => {
  it("parses the world and all 10 missions with sequential node numbers", () => {
    const world = parseWorld(worldJson);
    expect(world.missionIds).toEqual(missions.map((m) => m.id));
    missions.forEach((m, i) => expect(parseMission(m).node).toBe(i + 1));
  });

  it("parses every activity referenced by every mission, with no duplicate activity ids left unauthored", async () => {
    const activityIds = new Set(missions.flatMap((m) => m.activityIds));
    for (const id of activityIds) {
      const mod = await import(`../../public/content/activities/${id}.json`);
      expect(() => parseActivity(mod.default)).not.toThrow();
    }
  });
});
```

Run: `cd /c/Repos/activize-kidzz && npx vitest run src/content/__plan9-check.test.ts`
Expected: PASS (2 tests) — the second test's dynamic `import()` walks every activity id actually referenced by any mission (including reused ones like `activity-cross-crawl`, `activity-windmill-reach`, `activity-balloon-breathing`, `activity-star-jumps`, `activity-figure-8-arms`), confirming nothing was missed or misspelled across all 5 authoring tasks.

- [ ] **Step 2: Delete the temporary validation file**

```bash
rm /c/Repos/activize-kidzz/src/content/__plan9-check.test.ts
```

- [ ] **Step 3: Confirm the existing automated suite is untouched**

Run: `cd /c/Repos/activize-kidzz && npm test`
Expected: PASS (237 tests — unchanged from before this plan; nothing in `src/content/__fixtures__/*` or any test file was modified).

- [ ] **Step 4: Manual browser verification**

Start the dev server and confirm the new content actually plays through in a real browser (per the spec's own stated verification approach):

```bash
cd /c/Repos/activize-kidzz && npm run dev
```

1. Navigate to `http://localhost:5173/`, sign up a fresh test profile (or log into an existing one).
2. Confirm the JourneyMap now shows "Day 1: Wake Up Your Brain" as before, and that Mission 1 now has 2 activities (Cross Crawl, then Belly Breaths) instead of 1.
3. Complete Mission 1 (both activities), confirm it advances toward Mission 2 ("Day 2: Bounce and Balance").
4. Complete Mission 2 and Mission 3, confirming Mission 3's puzzle ("Critter Recall") renders as a real interactive sequence-memory grid (not the old bare "Done" button) and that solving it advances the mission.
5. Confirm `useProgressStore`'s `totalMissionsCompleted` has reached 3 (checkable via a `list_network_requests` look at the `progress` table write, or by continuing to play through more missions until `badge-missions-total` fires in the Trophy Shelf — full playthrough of all 10 isn't required for this manual check, 3-4 missions is enough to confirm the mechanism works end-to-end).
6. Stop the dev server.

- [ ] **Step 5: Commit**

Per this session's standing preference, this is the **only** commit for the whole plan — stage everything from all 6 tasks together:

```bash
git -C /c/Repos/activize-kidzz add public/content/worlds/world-jungle.json public/content/missions/mission-001.json public/content/missions/mission-002.json public/content/missions/mission-003.json public/content/missions/mission-004.json public/content/missions/mission-005.json public/content/missions/mission-006.json public/content/missions/mission-007.json public/content/missions/mission-008.json public/content/missions/mission-009.json public/content/missions/mission-010.json public/content/activities/activity-belly-breaths.json public/content/activities/activity-star-jumps.json public/content/activities/activity-heel-to-toe.json public/content/activities/activity-toe-touches.json public/content/activities/activity-puzzle-critters.json public/content/activities/activity-windmill-reach.json public/content/activities/activity-balloon-breathing.json public/content/activities/activity-marching.json public/content/activities/activity-puzzle-fruits.json public/content/activities/activity-butterfly-taps.json public/content/activities/activity-superhero-punches.json public/content/activities/activity-ocean-breaths.json public/content/activities/activity-arm-circles.json public/content/activities/activity-figure-8-arms.json public/content/activities/activity-bunny-breaths.json public/content/activities/activity-puzzle-weather.json public/content/activities/activity-puzzle-space.json
git -C /c/Repos/activize-kidzz commit -m "content: expand world-jungle to 10 missions (Plan 9)"
```
