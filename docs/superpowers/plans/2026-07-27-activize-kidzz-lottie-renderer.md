# Activize Kidzz — Lottie Renderer + First Real Asset (Plan 13) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a real `LottieRenderer`, replacing the shared `PlaceholderRenderer` currently registered under the `"lottie"` key in `rendererRegistry`, and land one real, hand-scripted Lottie animation for the `activity-balloon-breathing` activity.

**Architecture:** `LottieRenderer` is a plain function component (same `RendererProps` shape as its siblings `ReactRenderer`/`PlaceholderRenderer`/`RiveRenderer`) that fetches `/content/lottie/${activity.asset}.json` itself and renders `lottie-react`'s `<Lottie animationData={...} loop autoplay />` on success, falling back to `PlaceholderRenderer` on fetch/parse failure — `ExercisePlayer` already owns the exercise's completion gate independently via its own timer, so the renderer never needs to signal completion. `lottie-react` is a browser-canvas/SVG-rendering 3rd-party package that no other test in the suite has imported before, so — mirroring Plan 7's `@rive-app/react-canvas` precedent exactly — a global safety-net mock is added to `src/setupTests.ts` so every test that transitively imports `rendererRegistry.ts` (`ExercisePlayer.test.tsx`, `MissionPlayer.test.tsx`, `App.e2e.test.tsx`) never touches the real Lottie runtime, only the mock.

The actual animation is authored by scripting the LottieFiles Creator MCP (`lottiefiles-creator`, tools `get_rules`/`get_api_doc`/`run_script`) — a single `Ellipse` shape layer with keyframed size and fill color. The Creator API has no scripted export method; Task 3 contains a **hard manual checkpoint** where a human must open the Creator browser tab and use File → Export → Lottie JSON before the plan can continue.

**Tech Stack:** Adds one new dependency, `lottie-react` (`^2.4.1` confirmed current on npm as of 2026-07-27) — a thin React wrapper around `lottie-web` that renders plain Lottie JSON directly (the exact format the Creator MCP exports; there is no `.lottie` bundle format involved). Existing Vite + React 18.3.1 + TS (strict) + Vitest 2.0.5 stack otherwise unchanged.

## Global Constraints

- Only `activity-balloon-breathing.json`'s `renderer` field changes, from `"react"` to `"lottie"`. No other of the 13 other movement/breathing activities changes this plan.
- No multi-scene/precomposition (`Scene.createSceneLayer`) — one scene, one shape layer, one shape.
- `LottieRenderer` never signals completion back to `ExercisePlayer` — no callback wired to the gate timer. This matches every existing renderer.
- `lottie-react` is mocked globally in `src/setupTests.ts` — no test file anywhere in the suite should add its own competing `vi.mock("lottie-react", ...)` call; `LottieRenderer.test.tsx` customizes the *same* global mock instance per-test via `vi.mocked(Lottie)`, not a second mock registration.
- Task 3's manual export step is a hard sequential dependency, not parallelizable: nothing in Task 4 can proceed until the exported `.json` file exists on disk.
- Commit cadence for this repo: **one commit for the whole plan**, given only after every task is complete and Task 4's full verification (tests + `tsc` + `build`) passes. Do not commit after each task — Task 4 is the only task with a commit step.

---

### Task 1: `LottieRenderer` component + global test safety net

**Files:**
- Modify: `package.json` (add `lottie-react` dependency)
- Modify: `src/setupTests.ts`
- Create: `src/components/renderers/LottieRenderer.tsx`
- Test: `src/components/renderers/LottieRenderer.test.tsx`

**Interfaces:**
- Consumes: `RendererProps` (`{ activity: MovementActivity | BreathingActivity }`) from `src/content/types.ts` (existing). `PlaceholderRenderer` from `./PlaceholderRenderer` (existing, unchanged).
- Produces: `LottieRenderer(props: RendererProps): JSX.Element` — consumed by Task 2's `rendererRegistry` wiring.

- [ ] **Step 1: Add the dependency**

Run: `cd /c/Repos/activize-kidzz && npm install lottie-react`

Expected: `package.json`'s `dependencies` gains `"lottie-react": "^2.4.1"` (exact patch version may be newer by the time this runs — that's fine, `^`-pinned matches this repo's existing style). `package-lock.json` updates.

- [ ] **Step 2: Add the global safety-net mock**

`lottie-react` renders via canvas/SVG under the hood — mocking it once here means no test file anywhere in the suite (including ones that don't know or care about Lottie, like `ExercisePlayer.test.tsx`) can accidentally exercise the real runtime under jsdom just by importing `rendererRegistry.ts` transitively.

Modify `src/setupTests.ts` — add this block after the existing `@rive-app/react-canvas` mock (do not remove or alter the Rive/Supabase/speechSynthesis blocks already there):

```ts
// lottie-react renders via canvas/SVG that jsdom doesn't fully support.
// Mocking it globally means every test that transitively imports
// rendererRegistry.ts (ExercisePlayer, MissionPlayer, App.e2e) only ever
// sees this safe no-op default -- LottieRenderer.test.tsx customizes this
// same mock instance per-test via vi.mocked(Lottie), it does not
// register a second, competing vi.mock for the same module.
vi.mock("lottie-react", () => ({
  default: vi.fn(() => null),
}));
```

- [ ] **Step 3: Run the existing full suite to confirm nothing broke**

Run: `cd /c/Repos/activize-kidzz && npm test`
Expected: PASS (245 tests) — identical to the pre-Plan-13 baseline. Confirms the global mock addition alone is inert until something actually imports `lottie-react`.

- [ ] **Step 4: Write the failing tests for `LottieRenderer`**

Create `src/components/renderers/LottieRenderer.test.tsx`:

```tsx
import { render, screen, waitFor } from "@testing-library/react";
import Lottie from "lottie-react";
import { LottieRenderer } from "./LottieRenderer";
import type { BreathingActivity } from "@/content/types";

const breathing: BreathingActivity = {
  id: "a1", type: "breathing", title: "Balloon Breathing", ageBands: ["6-8"],
  narration: "Let's do Balloon Breathing!", renderer: "lottie", asset: "balloon-breathing", cycles: 4,
};

describe("LottieRenderer", () => {
  beforeEach(() => {
    vi.mocked(Lottie).mockClear();
  });

  afterEach(() => vi.unstubAllGlobals());

  it("fetches the asset JSON from /content/lottie/<asset>.json and renders Lottie with it", async () => {
    const animationData = { v: "5.5.7", fr: 30, layers: [] };
    const fetchMock = vi.fn(async () => ({ ok: true, json: async () => animationData }));
    vi.stubGlobal("fetch", fetchMock);

    render(<LottieRenderer activity={breathing} />);

    await waitFor(() => expect(Lottie).toHaveBeenCalled());
    expect(fetchMock).toHaveBeenCalledWith("/content/lottie/balloon-breathing.json");
    expect(vi.mocked(Lottie).mock.calls[0][0]).toMatchObject({
      animationData,
      loop: true,
      autoplay: true,
    });
  });

  it("falls back to the placeholder illustration when the fetch fails", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false })));

    render(<LottieRenderer activity={breathing} />);

    await waitFor(() => expect(screen.getByText(/ask a parent to help/i)).toBeInTheDocument());
  });
});
```

- [ ] **Step 5: Run the test to verify it fails**

Run: `cd /c/Repos/activize-kidzz && npx vitest run src/components/renderers/LottieRenderer.test.tsx`
Expected: FAIL — `Cannot find module './LottieRenderer'` (the component doesn't exist yet).

- [ ] **Step 6: Write the minimal implementation**

Create `src/components/renderers/LottieRenderer.tsx`:

```tsx
import { useEffect, useState } from "react";
import Lottie from "lottie-react";
import { PlaceholderRenderer } from "./PlaceholderRenderer";
import type { RendererProps } from "@/content/types";

export function LottieRenderer({ activity }: RendererProps) {
  const [animationData, setAnimationData] = useState<object | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setAnimationData(null);
    setFailed(false);
    fetch(`/content/lottie/${activity.asset}.json`)
      .then((res) => {
        if (!res.ok) throw new Error(`bad status for ${activity.asset}`);
        return res.json();
      })
      .then(setAnimationData)
      .catch(() => setFailed(true));
  }, [activity]);

  if (failed) return <PlaceholderRenderer activity={activity} />;
  if (!animationData) return null;
  return <Lottie animationData={animationData} loop autoplay />;
}
```

- [ ] **Step 7: Run the test to verify it passes**

Run: `cd /c/Repos/activize-kidzz && npx vitest run src/components/renderers/LottieRenderer.test.tsx`
Expected: PASS (2 tests)

---

### Task 2: Wire `rendererRegistry` to `LottieRenderer`

**Files:**
- Modify: `src/content/rendererRegistry.ts`
- Modify: `src/content/rendererRegistry.test.ts`

**Interfaces:**
- Consumes: `LottieRenderer` from `src/components/renderers/LottieRenderer.tsx` (Task 1).
- Produces: `rendererRegistry.lottie === LottieRenderer` — the registry every other consumer (`ExercisePlayer`) already reads from; no other file needs to change.

- [ ] **Step 1: Update the failing assertions**

Modify `src/content/rendererRegistry.test.ts` to its full new contents:

```ts
import { rendererRegistry } from "./rendererRegistry";
import { ReactRenderer } from "@/components/renderers/ReactRenderer";
import { PlaceholderRenderer } from "@/components/renderers/PlaceholderRenderer";
import { RiveRenderer } from "@/components/renderers/RiveRenderer";
import { LottieRenderer } from "@/components/renderers/LottieRenderer";

describe("rendererRegistry", () => {
  it("maps react to ReactRenderer", () => {
    expect(rendererRegistry.react).toBe(ReactRenderer);
  });

  it("maps video to the shared PlaceholderRenderer", () => {
    expect(rendererRegistry.video).toBe(PlaceholderRenderer);
  });

  it("maps rive to RiveRenderer", () => {
    expect(rendererRegistry.rive).toBe(RiveRenderer);
  });

  it("maps lottie to LottieRenderer", () => {
    expect(rendererRegistry.lottie).toBe(LottieRenderer);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd /c/Repos/activize-kidzz && npx vitest run src/content/rendererRegistry.test.ts`
Expected: FAIL — `expected PlaceholderRenderer to be LottieRenderer` (the registry still points `lottie` at `PlaceholderRenderer`).

- [ ] **Step 3: Wire the registry**

Modify `src/content/rendererRegistry.ts` to its full new contents:

```ts
import type { ComponentType } from "react";
import { ReactRenderer } from "@/components/renderers/ReactRenderer";
import { PlaceholderRenderer } from "@/components/renderers/PlaceholderRenderer";
import { RiveRenderer } from "@/components/renderers/RiveRenderer";
import { LottieRenderer } from "@/components/renderers/LottieRenderer";
import type { Renderer, RendererProps } from "./types";

export const rendererRegistry: Record<Renderer, ComponentType<RendererProps>> = {
  react: ReactRenderer,
  lottie: LottieRenderer,
  video: PlaceholderRenderer,
  rive: RiveRenderer,
};
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd /c/Repos/activize-kidzz && npx vitest run src/content/rendererRegistry.test.ts`
Expected: PASS (4 tests)

---

### Task 3: Author the Balloon Breathing Lottie asset (Creator MCP + manual export checkpoint)

**Files:**
- Create: `public/content/lottie/balloon-breathing.json` (produced via the manual export step below, not written directly)

**Interfaces:**
- Consumes: the live `lottiefiles-creator` MCP tools (`run_script`) — confirmed connected and its API/rules already read this session (`get_rules`, `get_api_doc` pages 1–4).
- Produces: a Lottie JSON file at `public/content/lottie/balloon-breathing.json` — consumed by Task 4's content wiring and, at runtime, by `LottieRenderer` (Task 1) via `fetch("/content/lottie/balloon-breathing.json")`.

This task has **no automated tests** — the animation's correctness is a visual check during the manual export step, not something unit tests assert (Task 1's tests use a mocked `fetch` response, independent of this file's real content).

- [ ] **Step 1: Script the scene via `run_script`**

Call the `mcp__lottiefiles-creator__run_script` tool with this exact script. It creates a new scene named "Balloon Breathing" (400×400, 30fps, 4s duration — one breath cycle, matching `ExercisePlayer`'s `BREATH_CYCLE_MS`), one `Ellipse` shape layer with a solid fill using this app's Jungle Canopy `storybook-peach` color (`#FF6B4B` — chosen for contrast against `ExercisePlayer`'s `bg-storybook-lavender` container background, `#2BA8BD`), and keyframes on both the ellipse's `size` and the fill's `color` that grow/lighten at the midpoint and return to the start value by the final frame (seamless loop):

```js
const scene = creator.createScene({
  name: 'Balloon Breathing',
  size: { width: 400, height: 400 },
  framerate: 30,
  duration: 4,
});
creator.switchToScene(scene);

const balloonLayer = scene.createShapeLayer({ name: 'Balloon', position: { x: 200, y: 200 } });
const balloon = balloonLayer.createEllipse({ position: { x: 0, y: 0 }, size: { width: 160, height: 160 } });
const fill = balloonLayer.createFill({ type: 'SOLID', color: { r: 255, g: 107, b: 75 } });

balloon.size.addKeyframes([
  { frame: 0, value: { width: 160, height: 160 } },
  { frame: 60, value: { width: 260, height: 260 } },
  { frame: 120, value: { width: 160, height: 160 } },
]);

fill.color.addKeyframes([
  { frame: 0, value: { r: 255, g: 107, b: 75 } },
  { frame: 60, value: { r: 255, g: 150, b: 120 } },
  { frame: 120, value: { r: 255, g: 107, b: 75 } },
]);

console.log(JSON.stringify({
  sceneName: scene.name,
  layers: scene.layers.map((l) => l.name),
  shapeCount: balloonLayer.shapes.length,
  fillCount: balloonLayer.fills.length,
  sizeKeyframeCount: balloon.size.keyframes.length,
  colorKeyframeCount: fill.color.keyframes.length,
}));
```

Expected console output (captured and returned by `run_script`):
```json
{"sceneName":"Balloon Breathing","layers":["Balloon"],"shapeCount":1,"fillCount":1,"sizeKeyframeCount":3,"colorKeyframeCount":3}
```

If any field doesn't match (e.g. `shapeCount` isn't `1`), do not proceed — re-read `get_rules`/`get_api_doc` and fix the script before continuing; do not guess at API shapes not confirmed in the docs.

- [ ] **Step 2: STOP — manual export checkpoint**

This step cannot be automated; the Creator API has no scripted `export()`/`save()`/`download()` method (confirmed across all 4 pages of `get_api_doc`).

Ask the user to:
1. Open the `creator.lottiefiles.com` browser tab (should already show the "Balloon Breathing" scene active, per `creator.switchToScene` in Step 1).
2. Visually review the balloon animation (it should grow and lighten, then shrink and darken back, over 4 seconds, looping smoothly).
3. Use File → Export → Lottie JSON to download the file.
4. Hand the file back — either its local download path, or paste its full JSON contents directly.

**Do not proceed to Step 3 until the user has provided the exported file.** If the visual review in step 2 reveals a problem (e.g. balloon looks wrong, doesn't loop cleanly), go back to Step 1, adjust the script, and re-export — do not attempt to hand-patch the exported JSON directly.

- [ ] **Step 3: Place the exported file**

Write the user-provided file contents verbatim to `public/content/lottie/balloon-breathing.json`.

Run: `cd /c/Repos/activize-kidzz && node -e "JSON.parse(require('fs').readFileSync('public/content/lottie/balloon-breathing.json', 'utf8')); console.log('valid JSON')"`
Expected: prints `valid JSON` with no error (confirms the file is well-formed before Task 4 wires it up — this is not a schema check, just a parse check, since there's no zod schema for raw Lottie animation JSON in this codebase).

---

### Task 4: Wire content, full verification, single commit

**Files:**
- Modify: `public/content/activities/activity-balloon-breathing.json`

**Interfaces:**
- Consumes: `public/content/lottie/balloon-breathing.json` (Task 3), `rendererRegistry.lottie === LottieRenderer` (Task 2).
- Produces: nothing consumed by later tasks — this is the plan's final task.

- [ ] **Step 1: Flip the activity's renderer field**

Modify `public/content/activities/activity-balloon-breathing.json` to its full new contents:

```json
{
  "id": "activity-balloon-breathing",
  "type": "breathing",
  "title": "Balloon Breathing",
  "ageBands": ["6-8"],
  "renderer": "lottie",
  "asset": "balloon-breathing",
  "narration": "Let's do Balloon Breathing! Breathe in slowly like you're filling up a balloon, then breathe out.",
  "cycles": 4
}
```

Only the `renderer` field changes (`"react"` → `"lottie"`); every other field is unchanged. No test in the suite references this file directly (confirmed: no fixture or test imports `activity-balloon-breathing.json` — `App.e2e.test.tsx` uses `activity-cross-crawl.json` via its own fixture), so there is no test to update for this step alone; correctness is covered by Step 2's full-suite run plus the schema's existing `renderer` enum (`z.enum(["rive", "lottie", "video", "react"])` in `src/content/schema.ts`, already includes `"lottie"` — unchanged).

- [ ] **Step 2: Full verification**

Run, in order:
1. `cd /c/Repos/activize-kidzz && npm test` — Expected: PASS (248 tests: 245 pre-existing + 2 new `LottieRenderer` tests + 1 net-new `rendererRegistry` test, since its old 3-test file became 4 tests by splitting the combined "lottie, video" case — Plan 7 had already split "rive" out — into separate "video" and "lottie" assertions).
2. `cd /c/Repos/activize-kidzz && npx tsc --noEmit` — Expected: no errors.
3. `cd /c/Repos/activize-kidzz && npm run build` — Expected: build succeeds.

This is the moment to confirm Task 1's safety-net mock did its job: `ExercisePlayer.test.tsx`, `MissionPlayer.test.tsx`, and `App.e2e.test.tsx` all transitively import `rendererRegistry.ts` → `LottieRenderer.tsx` → `lottie-react` for the first time here, and must still pass unchanged.

- [ ] **Step 3: Single commit for the whole plan**

```bash
git -C /c/Repos/activize-kidzz add package.json package-lock.json src/setupTests.ts src/components/renderers/LottieRenderer.tsx src/components/renderers/LottieRenderer.test.tsx src/content/rendererRegistry.ts src/content/rendererRegistry.test.ts public/content/lottie/balloon-breathing.json public/content/activities/activity-balloon-breathing.json
git -C /c/Repos/activize-kidzz commit -m "feat: add LottieRenderer and real Balloon Breathing animation (Plan 13)"
```
