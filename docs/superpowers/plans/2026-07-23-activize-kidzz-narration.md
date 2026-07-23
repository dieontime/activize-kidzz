# Narration Playback (Plan 10) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a button-triggered "🔊 Read it" narration control to every activity screen, using the browser's Web Speech API (`speechSynthesis`) only — no pre-recorded audio.

**Architecture:** A single new `NarrationButton` component wraps `window.speechSynthesis`, feature-detected (renders nothing if unavailable) and cancel-then-speak on every press (no stacking). It's wired into exactly one place — `MissionPlayer.tsx` — since that's the only component that holds `activity: Activity` in scope regardless of activity type (movement/breathing/puzzle), so `ExercisePlayer` and `PuzzlePlayer` need no changes at all. The `narration` field on every activity JSON changes meaning from "mp3 filename" (never used) to "the literal line to speak."

**Tech Stack:** React + TS, Web Speech API (`speechSynthesis`, `SpeechSynthesisUtterance` — both browser globals, no new npm dependency), Vitest + React Testing Library.

## Global Constraints

- No pre-recorded mp3 playback — Web Speech API only, per the approved spec's explicit deviation from the master spec's mp3-primary design.
- No auto-play — the narration button is pressed by the kid/parent, never triggered automatically on mount.
- No mute/settings/voice/rate customization UI, no persistence of any narration preference. Fixed rate ~0.9, default voice, hardcoded.
- No narration anywhere outside the per-activity `MissionPlayer` screen (not `JourneyMap`, not `RewardScreen`, not auth screens).
- `git commit` is blocked by tool permissions this session — every task stages with `git add <exact files>` (never `git add -A`); do **not** commit after each task. Exactly ONE commit command is printed for the user, after the final task's full verification passes.
- Bash's working directory resets to a different project between conversation turns in this environment — every bash call touching this repo must use `git -C C:\Repos\activize-kidzz ...` or a single chained `cd C:\Repos\activize-kidzz && ...`.

---

## Task 1: `NarrationButton` component + global `speechSynthesis` test mock

**Files:**
- Modify: `src/setupTests.ts`
- Create: `src/components/NarrationButton.tsx`
- Test: `src/components/NarrationButton.test.tsx`

**Interfaces:**
- Produces: `NarrationButton({ text: string }): JSX.Element | null` — a named export from `src/components/NarrationButton.tsx`. Task 2 imports it as `import { NarrationButton } from "@/components/NarrationButton";` and renders `<NarrationButton text={activity.narration} />`.
- Consumes: `FocusableButton` from `@/components/FocusableButton` (existing, `variant="pill"`), `initNavigation` from `@/navigation/initNavigation` (existing, used in the test only).

- [ ] **Step 1: Add the global `speechSynthesis` mock to `setupTests.ts`**

`window.speechSynthesis` and `SpeechSynthesisUtterance` don't exist under jsdom. Add this global default, mirroring the existing `@rive-app/react-canvas` mock already in this file:

Append to `src/setupTests.ts`:

```ts
// Web Speech API (speechSynthesis) doesn't exist under jsdom. This global
// default mirrors the @rive-app/react-canvas mock above: every test that
// renders NarrationButton/MissionPlayer sees this safe no-op unless it
// deliberately overrides window.speechSynthesis itself (see
// NarrationButton.test.tsx's "unavailable" case).
Object.defineProperty(window, "speechSynthesis", {
  writable: true,
  configurable: true,
  value: { speak: vi.fn(), cancel: vi.fn() } as unknown as SpeechSynthesis,
});
window.SpeechSynthesisUtterance = vi
  .fn()
  .mockImplementation((text: string) => ({ text })) as unknown as typeof SpeechSynthesisUtterance;
```

- [ ] **Step 2: Write the failing test**

Create `src/components/NarrationButton.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { initNavigation } from "@/navigation/initNavigation";
import { NarrationButton } from "./NarrationButton";

describe("NarrationButton", () => {
  beforeAll(() => {
    initNavigation();
  });

  beforeEach(() => {
    vi.mocked(window.speechSynthesis.speak).mockReset();
    vi.mocked(window.speechSynthesis.cancel).mockReset();
  });

  it("speaks the given text when pressed", async () => {
    const user = userEvent.setup();
    render(<NarrationButton text="Let's do Cross Crawl!" />);
    await user.click(screen.getByRole("button", { name: /read it/i }));
    expect(window.speechSynthesis.cancel).toHaveBeenCalled();
    expect(window.speechSynthesis.speak).toHaveBeenCalledWith(
      expect.objectContaining({ text: "Let's do Cross Crawl!" }),
    );
  });

  it("cancels any in-progress speech before speaking again on a second press", async () => {
    const user = userEvent.setup();
    render(<NarrationButton text="Hello" />);
    const button = screen.getByRole("button", { name: /read it/i });
    await user.click(button);
    await user.click(button);
    expect(window.speechSynthesis.cancel).toHaveBeenCalledTimes(2);
    expect(window.speechSynthesis.speak).toHaveBeenCalledTimes(2);
  });

  it("renders nothing when speechSynthesis is unavailable", () => {
    const original = window.speechSynthesis;
    (window as { speechSynthesis?: SpeechSynthesis }).speechSynthesis = undefined;
    const { container } = render(<NarrationButton text="Hello" />);
    expect(container).toBeEmptyDOMElement();
    window.speechSynthesis = original;
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `cd /c/Repos/activize-kidzz && npm test -- src/components/NarrationButton.test.tsx --watchAll=false`
Expected: FAIL — `Failed to resolve import "./NarrationButton"` (the component doesn't exist yet).

- [ ] **Step 4: Implement `NarrationButton`**

Create `src/components/NarrationButton.tsx`:

```tsx
import { FocusableButton } from "@/components/FocusableButton";

interface Props {
  text: string;
}

export function NarrationButton({ text }: Props) {
  if (typeof window === "undefined" || !window.speechSynthesis) {
    return null;
  }

  const speak = () => {
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(new SpeechSynthesisUtterance(text));
  };

  return (
    <FocusableButton onPress={speak} variant="pill" className="bg-storybook-mint text-storybook-mintText">
      🔊 Read it
    </FocusableButton>
  );
}
```

Every other `FocusableButton` usage in this app sets an explicit background/text color pair (e.g. `ExercisePlayer`'s "We did it!" uses `bg-storybook-peach text-storybook-peachText`) — `storybook-mint`/`storybook-mintText` (already defined in `src/index.css`, unused by any other button) keeps this visually consistent instead of falling back to unstyled default button chrome.

- [ ] **Step 5: Run the test to verify it passes**

Run: `cd /c/Repos/activize-kidzz && npm test -- src/components/NarrationButton.test.tsx --watchAll=false`
Expected: PASS — 3 tests passing.

- [ ] **Step 6: Run the full suite to confirm no regressions**

Run: `cd /c/Repos/activize-kidzz && npm test 2>&1 | tail -8`
Expected: 45 test files passed, 240 tests passed (237 existing + 3 new).

Do **not** commit — this build batches to a single commit at the end of Task 3.

---

## Task 2: Wire `NarrationButton` into `MissionPlayer`

**Files:**
- Modify: `src/screens/MissionPlayer.tsx`
- Modify: `src/screens/MissionPlayer.test.tsx`

**Interfaces:**
- Consumes: `NarrationButton` from Task 1 (`import { NarrationButton } from "@/components/NarrationButton";`, prop `text: string`).

- [ ] **Step 1: Write the failing test**

Add this test inside the existing `describe("MissionPlayer", ...)` block in `src/screens/MissionPlayer.test.tsx` (after the existing `it("shows the first activity and progress", ...)` test, using the file's existing top-level `mission`/`activities` fixtures):

```tsx
  it("renders a narration button that speaks the activity's narration text when pressed", async () => {
    const user = userEvent.setup();
    render(<MissionPlayer mission={mission} activities={activities} badges={[]} worldId="world-jungle" totalMissionsInWorld={1} />);
    await user.click(screen.getByRole("button", { name: /read it/i }));
    expect(window.speechSynthesis.speak).toHaveBeenCalledWith(
      expect.objectContaining({ text: activities[0].narration }),
    );
  });
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd /c/Repos/activize-kidzz && npm test -- src/screens/MissionPlayer.test.tsx --watchAll=false`
Expected: FAIL — `Unable to find an accessible element with the role "button" and name /read it/i` (the button isn't rendered yet).

- [ ] **Step 3: Wire `NarrationButton` into `MissionPlayer`**

In `src/screens/MissionPlayer.tsx`, add the import alongside the existing component imports:

```ts
import { NarrationButton } from "@/components/NarrationButton";
```

Then change the render section (currently):

```tsx
        <h2 className="text-2xl font-bold mb-2">{activity.title}</h2>
        {activity.type === "movement" || activity.type === "breathing" ? (
```

to:

```tsx
        <h2 className="text-2xl font-bold mb-2">{activity.title}</h2>
        <div className="mb-4">
          <NarrationButton text={activity.narration} />
        </div>
        {activity.type === "movement" || activity.type === "breathing" ? (
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd /c/Repos/activize-kidzz && npm test -- src/screens/MissionPlayer.test.tsx --watchAll=false`
Expected: PASS — all `MissionPlayer` tests passing (existing tests unaffected, since `NarrationButton` never sets `autoFocus` and doesn't change any existing assertion's target).

- [ ] **Step 5: Run the full suite to confirm no regressions**

Run: `cd /c/Repos/activize-kidzz && npm test 2>&1 | tail -8`
Expected: 45 test files passed, 241 tests passed (240 from Task 1 + 1 new).

Do **not** commit — this build batches to a single commit at the end of Task 3.

---

## Task 3: Rewrite `narration` content across all 18 activity files + final verification

**Files:**
- Modify: all 18 files under `public/content/activities/*.json`
- Test: temporary `src/content/__plan10-check.test.ts` (created and deleted within this task, never committed)

**Interfaces:**
- Consumes: `parseActivity` from `@/content/schema` (existing, `parseActivity(json: unknown): Activity`, throws on invalid shape).

This task has no permanent automated test — the schema (`narration: z.string()`) already accepts any string, so there's nothing new to assert beyond "does it still parse," which the temporary check below covers. There is no way to automatically assert "is this good spoken copy"; each new value is hand-written to be simple, first-person, and to state what the activity is before describing it (mirroring the existing `instructions` copy style), so verify by reading the diffs.

- [ ] **Step 1: Rewrite the `narration` field in every activity file**

Change exactly one field (`narration`) in each of these 18 files under `public/content/activities/` — every other field is unchanged:

| File | New `narration` value |
|---|---|
| `activity-cross-crawl.json` | `"Let's do Cross Crawl! Touch your right hand to your left knee, then switch."` |
| `activity-arm-circles.json` | `"Let's do Arm Circles! Make big circles in the air with both of your arms."` |
| `activity-balloon-breathing.json` | `"Let's do Balloon Breathing! Breathe in slowly like you're filling up a balloon, then breathe out."` |
| `activity-belly-breaths.json` | `"Let's do Belly Breaths! Put your hands on your belly, breathe in deep, then breathe out slowly."` |
| `activity-bunny-breaths.json` | `"Let's do Bunny Breaths! Take three quick sniffs like a bunny, then breathe out slowly."` |
| `activity-butterfly-taps.json` | `"Let's do Butterfly Taps! Cross your arms and tap your opposite shoulders, like butterfly wings."` |
| `activity-figure-8-arms.json` | `"Let's do Figure-8 Arms! Draw a big figure-8 in the air with both hands together."` |
| `activity-heel-to-toe.json` | `"Let's do Heel to Toe! Walk in a line, touching your heel to your toes with each step."` |
| `activity-marching.json` | `"Let's do Marching in Place! Lift your knees high and swing your opposite arm."` |
| `activity-ocean-breaths.json` | `"Let's do Ocean Breaths! Breathe in slowly, then breathe out like ocean waves."` |
| `activity-puzzle-critters.json` | `"Let's play Critter Recall! Watch the animals, then repeat the pattern."` |
| `activity-puzzle-fruits.json` | `"Let's play Fruit Stand Memory! Watch the fruits, then repeat the pattern."` |
| `activity-puzzle-space.json` | `"Let's play Space Voyage Memory! Watch the pattern, then repeat it."` |
| `activity-puzzle-weather.json` | `"Let's play Weather Watch! Watch the pattern, then repeat it."` |
| `activity-star-jumps.json` | `"Let's do Star Jumps! Jump with your arms and legs out like a star, then back together."` |
| `activity-superhero-punches.json` | `"Let's do Superhero Punches! Punch one arm across your body, then switch sides, like a superhero."` |
| `activity-toe-touches.json` | `"Let's do Toe Touches! Reach your opposite hand down to touch your toes, then switch sides."` |
| `activity-windmill-reach.json` | `"Let's do Windmill Reach! Stand tall with feet apart, and swing one hand down to touch the opposite foot."` |

Example (`public/content/activities/activity-cross-crawl.json`), unchanged fields elided for illustration — the real file keeps every other field exactly as-is, only `narration` changes:

```json
{
  "id": "activity-cross-crawl",
  "type": "movement",
  "title": "Cross Crawl",
  "ageBands": ["6-8"],
  "renderer": "react",
  "asset": "cross-crawl",
  "narration": "Let's do Cross Crawl! Touch your right hand to your left knee, then switch.",
  "pacing": { "reps": 6, "tempoMs": 1200 },
  "instructions": "Touch your right hand to your left knee, then switch!"
}
```

- [ ] **Step 2: Schema-parse smoke check (temporary, not committed)**

Create `src/content/__plan10-check.test.ts`:

```ts
import { parseActivity } from "@/content/schema";
import crossCrawl from "../../public/content/activities/activity-cross-crawl.json";
import armCircles from "../../public/content/activities/activity-arm-circles.json";
import balloonBreathing from "../../public/content/activities/activity-balloon-breathing.json";
import bellyBreaths from "../../public/content/activities/activity-belly-breaths.json";
import bunnyBreaths from "../../public/content/activities/activity-bunny-breaths.json";
import butterflyTaps from "../../public/content/activities/activity-butterfly-taps.json";
import figure8Arms from "../../public/content/activities/activity-figure-8-arms.json";
import heelToToe from "../../public/content/activities/activity-heel-to-toe.json";
import marching from "../../public/content/activities/activity-marching.json";
import oceanBreaths from "../../public/content/activities/activity-ocean-breaths.json";
import puzzleCritters from "../../public/content/activities/activity-puzzle-critters.json";
import puzzleFruits from "../../public/content/activities/activity-puzzle-fruits.json";
import puzzleSpace from "../../public/content/activities/activity-puzzle-space.json";
import puzzleWeather from "../../public/content/activities/activity-puzzle-weather.json";
import starJumps from "../../public/content/activities/activity-star-jumps.json";
import superheroPunches from "../../public/content/activities/activity-superhero-punches.json";
import toeTouches from "../../public/content/activities/activity-toe-touches.json";
import windmillReach from "../../public/content/activities/activity-windmill-reach.json";

const allActivities = [
  crossCrawl, armCircles, balloonBreathing, bellyBreaths, bunnyBreaths, butterflyTaps,
  figure8Arms, heelToToe, marching, oceanBreaths, puzzleCritters, puzzleFruits,
  puzzleSpace, puzzleWeather, starJumps, superheroPunches, toeTouches, windmillReach,
];

describe("Plan 10 content smoke check (temporary, delete after running)", () => {
  it("parses every activity file and every narration is a non-empty spoken line", () => {
    for (const raw of allActivities) {
      const activity = parseActivity(raw);
      expect(activity.narration.length).toBeGreaterThan(0);
      expect(activity.narration.endsWith(".mp3")).toBe(false);
    }
  });
});
```

- [ ] **Step 3: Run the smoke check**

Run: `cd /c/Repos/activize-kidzz && npm test -- src/content/__plan10-check.test.ts --watchAll=false`
Expected: PASS — 1 test passing, confirming all 18 files still parse under the real schema and no `narration` value is empty or still an `.mp3` filename.

- [ ] **Step 4: Delete the temporary check**

```bash
cd /c/Repos/activize-kidzz && rm src/content/__plan10-check.test.ts
```

- [ ] **Step 5: Run the full suite**

Run: `cd /c/Repos/activize-kidzz && npm test 2>&1 | tail -8`
Expected: 45 test files passed, 241 tests passed (same count as end of Task 2 — this task added no permanent tests).

- [ ] **Step 6: Type-check and build**

Run: `cd /c/Repos/activize-kidzz && npx tsc --noEmit && npm run build`
Expected: both succeed with no errors.

- [ ] **Step 7: Manual browser verification**

Start the dev server (`npm run dev`), sign up or log in a test profile, open a mission, and confirm:
- A "🔊 Read it" button is visible and focusable via D-pad (arrow keys) next to the activity title.
- Pressing it speaks the activity's `narration` line aloud (or silently no-ops with zero console errors if the browser/engine has no `speechSynthesis` support).
- Pressing it again while already speaking restarts cleanly (no overlapping/garbled audio).
- This works for at least one activity of each type: movement, breathing, and puzzle.

- [ ] **Step 8: Stage everything and print the single commit command**

```bash
cd /c/Repos/activize-kidzz && git add src/setupTests.ts src/components/NarrationButton.tsx src/components/NarrationButton.test.tsx src/screens/MissionPlayer.tsx src/screens/MissionPlayer.test.tsx public/content/activities/*.json
```

Print for the user to run:

```bash
git -C C:\Repos\activize-kidzz commit -m "feat: add Web Speech API narration playback (Plan 10)"
```

---

## Self-Review

**Spec coverage:** Task 1 covers the component + feature detection + global mock (spec §4). Task 2 covers the single `MissionPlayer` integration point (spec §4). Task 3 covers the content model change across all 18 files (spec §3) and the manual browser verification the spec's testing section implies for the end-to-end experience. All spec non-goals (§6) are respected — no mp3, no auto-play, no settings UI, no narration outside `MissionPlayer`.

**Placeholder scan:** No TBD/TODO. Every step has real, complete code — including all 18 real narration strings (not "similar to the above").

**Type consistency:** `NarrationButton`'s `Props.text: string` (Task 1) matches how Task 2 calls it — `<NarrationButton text={activity.narration} />`, and `activity.narration` is `string` on `ActivityBase` (`src/content/types.ts:31`) for every activity type. `parseActivity` (Task 3) is the same function already exported from `src/content/schema.ts:74` — no new export invented.

**Test-count consistency fixed during self-review:** Task 1's Step 6 originally undercounted — corrected to 240 (237 existing + 3 new `NarrationButton` tests). Task 2's Step 5 corrected to 241 (+1 new `MissionPlayer` test). Task 3 adds no permanent tests, so its final count also reads 241.
