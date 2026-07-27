# Activize Kidzz — Lottie Renderer + First Real Asset (Plan 13)

## 1. Goal

Build a real `LottieRenderer`, replacing the shared `PlaceholderRenderer` currently registered under the `"lottie"` key in `rendererRegistry`, and land one real, hand-scripted Lottie animation for the `activity-balloon-breathing` activity. Unlike Plan 7 (Rive plumbing only, no asset), this plan produces one working real-art activity end to end.

**Explicitly in scope:** the `lottie-react` dependency, a `LottieRenderer` component matching the existing `RendererProps` contract, its load-failure fallback behavior, the `rendererRegistry` wiring change, one Lottie JSON asset authored via the LottieFiles Creator MCP (`lottiefiles-creator`, tools: `get_rules`, `get_api_doc`, `run_script`), and flipping `activity-balloon-breathing.json`'s `renderer` field from `"react"` to `"lottie"`.

**Explicitly out of scope:** converting any other activity off `renderer: "react"` (13 other activities untouched this plan — deferred). Multi-scene/precomposition animation (`Scene.createSceneLayer`) — this asset needs only one scene. Any change to `ExercisePlayer`'s gate-timer mechanic, `useContent.ts`, or the `Activity`/`RendererProps` type contracts.

## 2. Why Lottie Instead of Rive (Context)

Per the master spec's open item (§14): *"Rive authoring: who produces the `.riv` art (self vs artist); early activities may ship as Lottie/video via the pluggable renderer until Rive art exists."* Research this session established no same-session path exists to produce a real `.riv` file (Rive's MCP requires the desktop editor running locally; Rive's community marketplace has no direct `.riv` download — both need a human exporting from Rive's own editor UI). Lottie was chosen instead specifically because the **LottieFiles Creator MCP** (`lottiefiles-creator`, npx `@lottiefiles/creator-mcp`) can build an animation via scripted API calls (`run_script` against a `creator` global object) — no editor mouse-work required to construct it, only to export it (see §5).

This plan does not resolve the master-spec item's authoring question in general — it produces one asset via one path (scripted Lottie), leaving the broader "who produces art going forward" question open.

## 3. Dependency

Add `lottie-react` to `dependencies` in `package.json` (`^`-pinned, matching this project's existing pin style). It's a thin React wrapper around `lottie-web` and renders plain Lottie JSON directly — the exact format the Creator MCP exports (`ExportFormat = 'LOTTIE_JSON'` is its only supported export format; there is no `.lottie` bundle format involved). Chosen over `@lottiefiles/dotlottie-react` (built around the zipped `.lottie` format via a heavier WASM renderer — solves a problem this plan doesn't have) and over raw `lottie-web` (would require hand-rolled DOM ref/lifecycle management that `lottie-react` already provides).

## 4. `LottieRenderer` Component

New file `src/components/renderers/LottieRenderer.tsx`, same `RendererProps` shape (`{ activity: MovementActivity | BreathingActivity }`) as its siblings:

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

- **File path convention:** `/content/lottie/<asset>.json`, mirroring `RiveRenderer`'s `/content/rive/<asset>.riv` and the existing `public/content/` layout. `activity.asset` (`"balloon-breathing"`) is the same field already carried by the content schema — no new content field.
- **Fetch, not a load-error callback:** Rive's precedent uses `useRive`'s `onLoadError` because that's how that library reports failure. `lottie-react` renders from an in-memory `animationData` object rather than fetching a URL itself, so `LottieRenderer` fetches the JSON directly and catches failure — matching this codebase's existing fetch-then-catch idiom (see `src/content/loader.ts`) rather than forcing a mismatched callback shape onto a different library. Behavior (graceful fallback on failure) is identical to `RiveRenderer`; only the mechanism differs.
- **Brief `null` render while loading:** the fetch is same-origin static JSON, expected to resolve near-instantly; `ExercisePlayer`'s own gate timer (see below) already governs perceived pacing, so no loading spinner is needed here — consistent with the rest of the app's "no spinner" interstitial philosophy.
- **No completion signal:** as with every other renderer, `ExercisePlayer` computes its own gate duration (`cycles * BREATH_CYCLE_MS` for breathing activities) independent of the renderer, and disables its "We did it!" button until that timer elapses. `LottieRenderer` does not signal back up.

## 5. The Balloon Breathing Asset

Built via `run_script` against the Creator MCP:

- **One scene, one shape layer:** an `Ellipse` named "Balloon".
- **Keyframes:** `size` animated small → large → small across one breath cycle (~3–4 seconds), timed loosely against `activity-balloon-breathing.json`'s existing `cycles: 4` pacing (the Lottie file itself only needs to represent *one* cycle — `loop` on the `<Lottie>` component repeats it; the activity's `cycles` field continues to only drive `ExercisePlayer`'s gate-duration math, unrelated to the Lottie file's own frame count).
- **Color:** solid fill pulled from the Jungle Canopy palette (`src/index.css`'s `@theme` block, Plan 11), not a generic red balloon — picked to sit visually consistent with the rest of the app's illustrated theme.
- **Looping:** first and last keyframe values matched so the `loop` prop produces a seamless cycle with no visual jump-cut.
- **No nested scenes/precomposition:** `Scene.createSceneLayer` (confirmed supported by the live API) is not needed for a single shape and is out of scope here — reserved for a future, more ambitious asset.

### Manual export checkpoint

The Creator API has no scripted `export()`/`save()`/`download()` method (confirmed by reading all 4 pages of `get_api_doc` — `ExportFormat = 'LOTTIE_JSON'` exists as a type but is never wired to any callable method). Exporting is a manual Creator-UI action. Plan execution therefore pauses after the scene is scripted:

1. Agent runs the `run_script` calls that build the scene, then stops.
2. User opens the `creator.lottiefiles.com` tab, visually reviews the result, and uses File → Export → Lottie JSON to download the file.
3. User hands the agent the exported file (path or pasted contents).
4. Agent places it at `public/content/lottie/balloon-breathing.json`, and continues with the renderer/wiring/test work.

This checkpoint is a hard sequencing dependency in the implementation plan, not a parallelizable task.

## 6. `rendererRegistry` Wiring

One-line change in `src/content/rendererRegistry.ts`: the `lottie` key moves from `PlaceholderRenderer` to `LottieRenderer`. `video` stays mapped to `PlaceholderRenderer`, untouched — out of scope.

## 7. Content Change

`public/content/activities/activity-balloon-breathing.json`: `"renderer": "react"` → `"renderer": "lottie"`. No other field changes — `asset` is already `"balloon-breathing"`, matching the new file path convention.

## 8. Testing

Per this repo's testing philosophy (mock only at system boundaries), `lottie-react` is mocked at the module boundary:

```ts
vi.mock<typeof import("lottie-react")>("lottie-react");
```

- **`LottieRenderer.test.tsx`:** mocks global `fetch` via `vi.stubGlobal("fetch", ...)`, the same pattern `App.e2e.test.tsx` already uses for global-fetch stubbing (`src/content/loader.test.ts`'s `fetchFn` DI pattern doesn't apply here — `LottieRenderer` calls the global `fetch` directly, matching `ExercisePlayer`/other components rather than `ContentLoader`'s injectable-dependency design). Asserts:
  - `fetch` is called with `/content/lottie/<activity.asset>.json`.
  - On a resolved/ok response, the mocked `Lottie` component receives `animationData` equal to the parsed JSON, and is rendered.
  - On a rejected/non-ok response, the component renders `PlaceholderRenderer`'s real (un-mocked) English fallback text.
- **`rendererRegistry.test.ts`** (existing file, extended): asserts `rendererRegistry.lottie === LottieRenderer`, not `PlaceholderRenderer`.
- No test depends on the real exported Lottie JSON's exact shape — the mocked `fetch` response can be any valid-looking JSON object; correctness of the actual animation content is a visual/manual check during the export checkpoint (§5), not something unit tests assert.
