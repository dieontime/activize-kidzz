# Belly/Bunny/Ocean Breaths in Real Lottie (Plan 14) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert the 3 remaining breathing activities — Belly Breaths, Bunny Breaths, Ocean Breaths — from `renderer: "react"` to real, hand-scripted Lottie animations, reusing the `LottieRenderer`/`rendererRegistry` pipeline built in Plan 13 unchanged.

**Architecture:** Pure content authoring — no code changes. `LottieRenderer` already fetches `/content/lottie/${activity.asset}.json` generically for any `renderer: "lottie"` activity; each activity's `asset` field already matches the naming convention. This plan scripts 3 new Lottie scenes via the `lottiefiles-creator` MCP's `run_script`, has the user manually export them (the Creator API has no scripted export method — confirmed in Plan 13), places the exported files, and flips 3 `renderer` fields.

**Tech Stack:** No new dependencies. Reuses `lottie-react` (Plan 13) and the live `lottiefiles-creator` MCP (`get_rules`/`get_api_doc`/`run_script`, already read/verified in Plan 13 — Scene/ShapeLayer/TextLayer/Animatable API confirmed against the live API, not guessed).

## Global Constraints

- No changes to `LottieRenderer.tsx`, `rendererRegistry.ts`, or `setupTests.ts` — all already correct and generic from Plan 13.
- No new test files — no test in the suite references `activity-belly-breaths.json`/`activity-bunny-breaths.json`/`activity-ocean-breaths.json` by name (confirmed in Plan 13 for the equivalent Balloon Breathing case).
- Each Lottie scene represents exactly **one breath cycle** (30fps, 120 frames, 400×400px), looped via `<Lottie loop>` in the existing `LottieRenderer` — fully decoupled from each activity's own `cycles` field, which only drives `ExercisePlayer`'s gate-timer math.
- Text layer `startFrame`/`endFrame` MUST be set via direct property assignment after creation (`layer.startFrame = X; layer.endFrame = Y;`), not via `TextLayerCreateOptions` — Plan 13 found that `startFrame` passed at creation time did not reliably apply, while direct post-creation assignment does.
- Text fill color is set explicitly to black (`{r:0,g:0,b:0}`) at creation this time — Plan 13 shipped white-on-white by default and had to fix it after visual review; starting from black avoids repeating that mistake, while the visual-review step (Task 2) can still correct it if it reads wrong against a particular scene's background.
- Commit cadence: **one commit for the whole plan**, given only after Task 3's full verification (tests + `tsc` + `build`) passes. Do not commit after Tasks 1 or 2.

---

### Task 1: Script all 3 Lottie scenes via the Creator MCP

**Files:** None created directly — each scene lives inside the Creator MCP session (accessible in the user's `creator.lottiefiles.com` browser tab) until Task 2's manual export.

**Interfaces:**
- Consumes: the live `lottiefiles-creator` MCP's `run_script` tool.
- Produces: 3 scenes inside the Creator session, named "Belly Breaths", "Bunny Breaths", "Ocean Breaths" — consumed by Task 2's manual export.

Per the design spec, script all 3 back-to-back with no pause in between (the single checkpoint comes after, in Task 2).

- [ ] **Step 1: Script "Belly Breaths"**

Call `mcp__lottiefiles-creator__run_script` with:

```js
const scene = creator.createScene({
  name: 'Belly Breaths',
  size: { width: 400, height: 400 },
  framerate: 30,
  duration: 4,
});
creator.switchToScene(scene);

const bellyLayer = scene.createShapeLayer({ name: 'Belly', position: { x: 200, y: 200 } });
const belly = bellyLayer.createEllipse({ position: { x: 0, y: 0 }, size: { width: 160, height: 160 } });
bellyLayer.createFill({ type: 'SOLID', color: { r: 255, g: 201, b: 60 } });

belly.size.addKeyframes([
  { frame: 0, value: { width: 160, height: 160 } },
  { frame: 60, value: { width: 260, height: 260 } },
  { frame: 120, value: { width: 160, height: 160 } },
]);

const breatheIn = scene.createTextLayer({
  name: 'Breathe In Label', text: 'Breathe in', position: { x: 200, y: 350 },
  fontSize: 32, alignment: 'center', fill: { type: 'SOLID', color: { r: 0, g: 0, b: 0 } },
});
breatheIn.startFrame = 0;
breatheIn.endFrame = 60;

const breatheOut = scene.createTextLayer({
  name: 'Breathe Out Label', text: 'Breathe out', position: { x: 200, y: 350 },
  fontSize: 32, alignment: 'center', fill: { type: 'SOLID', color: { r: 0, g: 0, b: 0 } },
});
breatheOut.startFrame = 60;
breatheOut.endFrame = 120;

bellyLayer.sendToBack();

console.log(JSON.stringify({
  sceneName: scene.name,
  layerNames: scene.layers.map((l) => l.name),
  shapeIsLast: scene.layers[scene.layers.length - 1].name === 'Belly',
  breatheInRange: [breatheIn.startFrame, breatheIn.endFrame],
  breatheOutRange: [breatheOut.startFrame, breatheOut.endFrame],
  shapeCount: bellyLayer.shapes.length,
  fillCount: bellyLayer.fills.length,
  sizeKeyframeCount: belly.size.keyframes.length,
}));
```

Expected console output: `shapeIsLast: true`, `breatheInRange: [0,60]`, `breatheOutRange: [60,120]`, `shapeCount: 1`, `fillCount: 1`, `sizeKeyframeCount: 3`, `layerNames` containing all 3 names ("Belly", "Breathe In Label", "Breathe Out Label" in some order). If any field doesn't match, stop and fix the script before continuing — do not proceed to Step 2 with a broken scene.

- [ ] **Step 2: Script "Bunny Breaths"**

Call `mcp__lottiefiles-creator__run_script` with:

```js
const scene = creator.createScene({
  name: 'Bunny Breaths',
  size: { width: 400, height: 400 },
  framerate: 30,
  duration: 4,
});
creator.switchToScene(scene);

const bunnyLayer = scene.createShapeLayer({ name: 'Bunny Nose', position: { x: 200, y: 200 } });
const nose = bunnyLayer.createEllipse({ position: { x: 0, y: 0 }, size: { width: 140, height: 140 } });
bunnyLayer.createFill({ type: 'SOLID', color: { r: 251, g: 246, b: 234 } });

nose.size.addKeyframes([
  { frame: 0, value: { width: 140, height: 140 } },
  { frame: 15, value: { width: 170, height: 170 } },
  { frame: 25, value: { width: 155, height: 155 } },
  { frame: 40, value: { width: 185, height: 185 } },
  { frame: 50, value: { width: 170, height: 170 } },
  { frame: 60, value: { width: 200, height: 200 } },
  { frame: 120, value: { width: 140, height: 140 } },
]);

const sniffLabel = scene.createTextLayer({
  name: 'Sniff Label', text: 'Sniff! Sniff! Sniff!', position: { x: 200, y: 350 },
  fontSize: 28, alignment: 'center', fill: { type: 'SOLID', color: { r: 0, g: 0, b: 0 } },
});
sniffLabel.startFrame = 0;
sniffLabel.endFrame = 60;

const breatheOut = scene.createTextLayer({
  name: 'Breathe Out Label', text: 'Breathe out', position: { x: 200, y: 350 },
  fontSize: 32, alignment: 'center', fill: { type: 'SOLID', color: { r: 0, g: 0, b: 0 } },
});
breatheOut.startFrame = 60;
breatheOut.endFrame = 120;

bunnyLayer.sendToBack();

console.log(JSON.stringify({
  sceneName: scene.name,
  layerNames: scene.layers.map((l) => l.name),
  shapeIsLast: scene.layers[scene.layers.length - 1].name === 'Bunny Nose',
  sniffRange: [sniffLabel.startFrame, sniffLabel.endFrame],
  breatheOutRange: [breatheOut.startFrame, breatheOut.endFrame],
  shapeCount: bunnyLayer.shapes.length,
  fillCount: bunnyLayer.fills.length,
  sizeKeyframeCount: nose.size.keyframes.length,
}));
```

Expected console output: `shapeIsLast: true`, `sniffRange: [0,60]`, `breatheOutRange: [60,120]`, `shapeCount: 1`, `fillCount: 1`, `sizeKeyframeCount: 7`. If any field doesn't match, stop and fix before continuing.

- [ ] **Step 3: Script "Ocean Breaths"**

Call `mcp__lottiefiles-creator__run_script` with:

```js
const scene = creator.createScene({
  name: 'Ocean Breaths',
  size: { width: 400, height: 400 },
  framerate: 30,
  duration: 4,
});
creator.switchToScene(scene);

const waveLayer = scene.createShapeLayer({ name: 'Wave', position: { x: 200, y: 200 } });
const wave = waveLayer.createEllipse({ position: { x: 0, y: 0 }, size: { width: 160, height: 160 } });
waveLayer.createFill({ type: 'SOLID', color: { r: 251, g: 246, b: 234 } });

wave.size.addKeyframes([
  { frame: 0, value: { width: 160, height: 160 } },
  { frame: 60, value: { width: 260, height: 260 } },
  { frame: 120, value: { width: 160, height: 160 } },
]);

waveLayer.position.addKeyframes([
  { frame: 0, value: { x: 200, y: 200 } },
  { frame: 60, value: { x: 200, y: 200 } },
  { frame: 75, value: { x: 200, y: 185 } },
  { frame: 90, value: { x: 200, y: 215 } },
  { frame: 105, value: { x: 200, y: 190 } },
  { frame: 120, value: { x: 200, y: 200 } },
]);

const breatheIn = scene.createTextLayer({
  name: 'Breathe In Label', text: 'Breathe in', position: { x: 200, y: 350 },
  fontSize: 32, alignment: 'center', fill: { type: 'SOLID', color: { r: 0, g: 0, b: 0 } },
});
breatheIn.startFrame = 0;
breatheIn.endFrame = 60;

const breatheOut = scene.createTextLayer({
  name: 'Breathe Out Label', text: 'Breathe out', position: { x: 200, y: 350 },
  fontSize: 32, alignment: 'center', fill: { type: 'SOLID', color: { r: 0, g: 0, b: 0 } },
});
breatheOut.startFrame = 60;
breatheOut.endFrame = 120;

waveLayer.sendToBack();

console.log(JSON.stringify({
  sceneName: scene.name,
  layerNames: scene.layers.map((l) => l.name),
  shapeIsLast: scene.layers[scene.layers.length - 1].name === 'Wave',
  breatheInRange: [breatheIn.startFrame, breatheIn.endFrame],
  breatheOutRange: [breatheOut.startFrame, breatheOut.endFrame],
  shapeCount: waveLayer.shapes.length,
  fillCount: waveLayer.fills.length,
  sizeKeyframeCount: wave.size.keyframes.length,
  positionKeyframeCount: waveLayer.position.keyframes.length,
}));
```

Expected console output: `shapeIsLast: true`, `breatheInRange: [0,60]`, `breatheOutRange: [60,120]`, `shapeCount: 1`, `fillCount: 1`, `sizeKeyframeCount: 3`, `positionKeyframeCount: 6`. If any field doesn't match, stop and fix before continuing.

---

### Task 2: Manual export checkpoint — review, export, place all 3 files

**Files:**
- Create: `public/content/lottie/belly-breaths.json`, `public/content/lottie/bunny-breaths.json`, `public/content/lottie/ocean-breaths.json` (produced via manual export, not written directly).

**Interfaces:**
- Consumes: the 3 scenes scripted in Task 1, visible in the user's Creator browser tab.
- Produces: 3 Lottie JSON files consumed by Task 3's content wiring and, at runtime, by the existing `LottieRenderer`.

This task has no automated tests — visual correctness is a human judgment call at the export checkpoint, not something unit tests assert (matching Plan 13's precedent).

- [ ] **Step 1: STOP — single consolidated export checkpoint**

Ask the user to, in one sitting:
1. Open the `creator.lottiefiles.com` tab and review all 3 scenes ("Belly Breaths", "Bunny Breaths", "Ocean Breaths") — each should show its shape growing/animating with the correct color and readable black text at the right times (0–60 vs 60–120 frames).
2. For each of the 3, use File → Export → Lottie JSON and save the file.
3. Hand back all 3 files (paths or pasted contents).

**Do not proceed to Step 2 until all 3 files have been provided.** If review finds a problem with one scene (wrong color, bad timing, illegible text), only that one scene's Task 1 script needs adjusting and re-running — the other two are unaffected and don't need re-export.

- [ ] **Step 2: Place the exported files**

Write each provided file verbatim to its path:
- `public/content/lottie/belly-breaths.json`
- `public/content/lottie/bunny-breaths.json`
- `public/content/lottie/ocean-breaths.json`

Run:
```
node -e "['belly-breaths','bunny-breaths','ocean-breaths'].forEach(n => { JSON.parse(require('fs').readFileSync('public/content/lottie/'+n+'.json','utf8')); console.log(n, 'valid JSON'); })"
```
Expected: prints `belly-breaths valid JSON`, `bunny-breaths valid JSON`, `ocean-breaths valid JSON` with no errors.

---

### Task 3: Content wiring, full verification, single commit

**Files:**
- Modify: `public/content/activities/activity-belly-breaths.json`, `public/content/activities/activity-bunny-breaths.json`, `public/content/activities/activity-ocean-breaths.json`.

**Interfaces:**
- Consumes: the 3 files placed in Task 2, `rendererRegistry.lottie === LottieRenderer` (already true since Plan 13).
- Produces: nothing consumed by later tasks — this is the plan's final task.

- [ ] **Step 1: Flip each activity's renderer field**

Modify `public/content/activities/activity-belly-breaths.json` to its full new contents:

```json
{
  "id": "activity-belly-breaths",
  "type": "breathing",
  "title": "Belly Breaths",
  "ageBands": ["6-8"],
  "renderer": "lottie",
  "asset": "belly-breaths",
  "narration": "Let's do Belly Breaths! Put your hands on your belly, breathe in deep, then breathe out slowly.",
  "cycles": 4
}
```

Modify `public/content/activities/activity-bunny-breaths.json` to its full new contents:

```json
{
  "id": "activity-bunny-breaths",
  "type": "breathing",
  "title": "Bunny Breaths",
  "ageBands": ["6-8"],
  "renderer": "lottie",
  "asset": "bunny-breaths",
  "narration": "Let's do Bunny Breaths! Take three quick sniffs like a bunny, then breathe out slowly.",
  "cycles": 4
}
```

Modify `public/content/activities/activity-ocean-breaths.json` to its full new contents:

```json
{
  "id": "activity-ocean-breaths",
  "type": "breathing",
  "title": "Ocean Breaths",
  "ageBands": ["6-8"],
  "renderer": "lottie",
  "asset": "ocean-breaths",
  "narration": "Let's do Ocean Breaths! Breathe in slowly, then breathe out like ocean waves.",
  "cycles": 4
}
```

Only the `renderer` field changes in each (`"react"` → `"lottie"`); every other field is unchanged. No test in the suite references any of these 3 files, so there is no test to update for this step alone.

- [ ] **Step 2: Full verification**

Run, in order:
1. `cd /c/Repos/activize-kidzz && npm test` — Expected: PASS (248 tests — identical count to the post-Plan-13 baseline, since this plan adds no new tests).
2. `cd /c/Repos/activize-kidzz && npx tsc --noEmit` — Expected: no errors.
3. `cd /c/Repos/activize-kidzz && npm run build` — Expected: build succeeds.

- [ ] **Step 3: Single commit for the whole plan**

```bash
git -C /c/Repos/activize-kidzz add public/content/lottie/belly-breaths.json public/content/lottie/bunny-breaths.json public/content/lottie/ocean-breaths.json public/content/activities/activity-belly-breaths.json public/content/activities/activity-bunny-breaths.json public/content/activities/activity-ocean-breaths.json
git -C /c/Repos/activize-kidzz commit -m "feat: add real Lottie animations for Belly/Bunny/Ocean Breaths (Plan 14)"
```
