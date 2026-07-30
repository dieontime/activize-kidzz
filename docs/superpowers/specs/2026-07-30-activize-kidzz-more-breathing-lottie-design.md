# Activize Kidzz — Belly/Bunny/Ocean Breaths in Real Lottie (Plan 14)

## 1. Goal

Convert the 3 remaining breathing activities — `activity-belly-breaths`, `activity-bunny-breaths`, `activity-ocean-breaths` — from `renderer: "react"` (emoji + CSS pulse) to real, hand-scripted Lottie animations, using the `LottieRenderer`/`rendererRegistry`/Creator-MCP pipeline already built in Plan 13.

**Explicitly in scope:** authoring 3 new Lottie JSON assets via the `lottiefiles-creator` MCP's `run_script`, and flipping each of the 3 activities' `renderer` field from `"react"` to `"lottie"`.

**Explicitly out of scope:** any of the 10 movement activities (Arm Circles, Marching, Star Jumps, etc.) — they involve depicting a human figure doing an action, which doesn't fit the Creator API's shape primitives without a materially different, harder art approach; deferred to a future plan. Any change to `LottieRenderer.tsx`, `rendererRegistry.ts`, or `setupTests.ts` — all already correct and generic from Plan 13, and no code change is needed to support these 3 new assets.

## 2. Why No Code Changes Are Needed

`LottieRenderer` (Plan 13) already fetches `/content/lottie/${activity.asset}.json` generically for any activity with `renderer: "lottie"`, and each of these 3 activities' `asset` field already matches the file-naming convention (`belly-breaths`, `bunny-breaths`, `ocean-breaths`). This plan is pure content authoring: 3 new files under `public/content/lottie/`, plus a one-line `renderer` field edit in each of the 3 activity JSON files. No test file needs updating either — per Plan 13's precedent, no test in the suite imports these activity JSON files directly (confirmed for `activity-balloon-breathing.json`; the same holds for these 3, since no test references any of `belly-breaths`/`bunny-breaths`/`ocean-breaths` by name).

## 3. Visual Concepts

All 3 use the same core principle established in Plan 13: the Lottie file represents **one** breath cycle at 30fps/120 frames/400×400px, looped via the `<Lottie loop>` prop in `LottieRenderer`. This is fully decoupled from each activity's own `cycles` field, which only drives `ExercisePlayer`'s gate-timer math (`cycles * BREATH_CYCLE_MS`) — unrelated to the Lottie file's own frame count, exactly as established for Balloon Breathing.

### Belly Breaths
Same rhythm as Balloon Breathing: one deep inhale, one slow exhale — this activity's own narration ("breathe in deep, then breathe out slowly") maps directly onto Balloon's proven pattern. A single `Ellipse` shape layer, `storybook-gold` (`#FFC93C`) solid fill, keyframed size small (160×160) → large (260×260) → small across frames 0/60/120 (identical structure to Balloon's ellipse keyframes). Two text labels, same technique as Balloon's "Breathe in"/"Breathe out" (black fill, time-ranged via `startFrame`/`endFrame`): "Breathe in" (frames 0–60), "Breathe out" (frames 60–120).

### Bunny Breaths
Distinct rhythm matching its own narration ("three quick sniffs like a bunny, then breathe out slowly"): a single shape (`storybook-paper`, `#FBF6EA`, off-white) pulses small→slightly-larger→small three times quickly across frames 0–60 (three ~20-frame pulses), then grows once more and settles slowly back to rest across frames 60–120 (one slow exhale). Two text labels: "Sniff! Sniff! Sniff!" (frames 0–60), "Breathe out" (frames 60–120).

### Ocean Breaths
Narration: "breathe in slowly, then breathe out like ocean waves." Inhale (frames 0–60) grows normally like the others. Exhale (frames 60–120) does **not** simply shrink — instead the shape's `position` is keyframed in a wavy up-down bob (multiple keyframe points oscillating vertically while the shape settles back toward rest) to evoke a rolling wave, without requiring a multi-layer wave scene. `storybook-paper` (`#FBF6EA`, white) fill, reading as a wave-crest against the teal `ExercisePlayer` container background. Text labels: "Breathe in" (frames 0–60), "Breathe out" (frames 60–120).

Exact color/copy/timing is subject to change based on the manual visual-review step (§5) — the same way Balloon Breathing's text color got corrected from white to black after the user's live review in Plan 13.

## 4. Content Changes

- Create `public/content/lottie/belly-breaths.json`, `public/content/lottie/bunny-breaths.json`, `public/content/lottie/ocean-breaths.json` (via manual export, see §5).
- Modify `public/content/activities/activity-belly-breaths.json`, `activity-bunny-breaths.json`, `activity-ocean-breaths.json`: `"renderer": "react"` → `"renderer": "lottie"` in each. No other field changes.

## 5. Manual Export Workflow

The Creator API has no scripted export method (confirmed in Plan 13 — `ExportFormat = 'LOTTIE_JSON'` exists as a type but is never wired to any callable method). Unlike Plan 13's single checkpoint, this plan batches the scripting side to reduce interruptions:

1. Script all 3 scenes back-to-back via `run_script` (one call per scene, no pause between them).
2. **Single consolidated checkpoint:** ask the user to review all 3 scenes in the Creator tab and export each as Lottie JSON, in one sitting, rather than stopping after each individual scene.
3. Place each exported file at its corresponding path under `public/content/lottie/`, validating each with a `JSON.parse` sanity check (no schema exists for raw Lottie JSON, matching Plan 13's approach).
4. If the user's visual review surfaces a problem with any one scene, only that scene's script needs re-running and re-exporting — the other two are unaffected.

## 6. Testing

No new test files — matching Plan 13's finding that no test in the suite references these activity JSON files by name. Verification is:
- `JSON.parse` sanity check per exported Lottie file (§5, step 3).
- Full `npm test` + `npx tsc --noEmit` + `npm run build` after all 3 activities' `renderer` fields are flipped — confirms nothing else in the suite broke and the existing `LottieRenderer`/`rendererRegistry` tests (already covering the generic renderer behavior) still pass unchanged.
- One commit for the whole plan, per this repo's standing convention.
