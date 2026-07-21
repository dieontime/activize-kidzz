# Activize Kidzz — Rive Renderer Plumbing (Plan 7)

## 1. Goal

Build the technical pipeline for a real `RiveRenderer`, replacing the shared `PlaceholderRenderer` currently registered under the `"rive"` key in `rendererRegistry`. This is plumbing only — no real `.riv` art exists yet, and none is sourced or fetched as part of this plan.

**Explicitly in scope:** the `@rive-app/react-canvas` dependency, a `RiveRenderer` component matching the existing `RendererProps` contract, its load-failure fallback behavior, and the `rendererRegistry` wiring change. All verified via mocked unit tests.

**Explicitly out of scope:** sourcing or authoring any real `.riv` asset (no design tool, no artist, no downloaded sample file this plan — deferred to a future plan once an art source is decided). Wiring any existing content JSON to `renderer: "rive"` (no activity's `renderer` field changes — `RiveRenderer` ships isolated, exercised only by its own unit tests, not by any live content path). Rive state machines, animation inputs, or any interactivity beyond autoplay — `ExercisePlayer` already owns exercise gating independently via its own timer (`gateDurationMs`), so the renderer's only job is to display something; it never signals completion back up.

## 2. Dependency

Add `@rive-app/react-canvas` to `dependencies` in `package.json`, `^`-pinned to whatever version resolves at install time (matching this project's existing pin style, e.g. `@supabase/supabase-js`). It's the official React wrapper around Rive's web runtime and is compatible with the React 18.3.1 already in use — chosen over the lower-level `@rive-app/canvas` package specifically because every other renderer in `rendererRegistry` (`ReactRenderer`, `PlaceholderRenderer`) is a plain function component, and the React wrapper's `useRive` hook fits that shape directly without manual canvas/ref management.

## 3. `RiveRenderer` Component

New file `src/components/renderers/RiveRenderer.tsx`, same `RendererProps` shape (`{ activity: MovementActivity | BreathingActivity }`) as its siblings:

```ts
import { useState } from "react";
import { useRive } from "@rive-app/react-canvas";
import { PlaceholderRenderer } from "./PlaceholderRenderer";
import type { RendererProps } from "@/content/types";

export function RiveRenderer({ activity }: RendererProps) {
  const [failed, setFailed] = useState(false);
  const { RiveComponent } = useRive({
    src: `/content/rive/${activity.asset}.riv`,
    autoplay: true,
    onLoadError: () => setFailed(true),
  });

  if (failed) return <PlaceholderRenderer activity={activity} />;
  return <RiveComponent />;
}
```

- **File path convention:** `/content/rive/<asset>.riv`, mirroring the `public/content/` layout already established for manifest/world/mission/activity/badge JSON (a prior session's fix — see `public/content/` in the repo). `activity.asset` (e.g. `"cross-crawl"`) is the same field `ReactRenderer` and the content schema already carry; this plan adds no new content field.
- **No completion signal:** `ExercisePlayer` computes its own gate duration (`reps * tempoMs` for movement, `cycles * BREATH_CYCLE_MS` for breathing) independent of whatever the renderer displays, and disables its "We did it!" button until that timer elapses regardless of renderer type. `RiveRenderer` does not need a state machine, input, or `onStop`/`onPlay` callback wired back to `ExercisePlayer` — this holds for every existing renderer (`ReactRenderer` has no callback either) and continues to hold here.

## 4. Fallback on Load Failure

Per the master spec's resilience rule (§10: "Asset (`.riv`/audio) fails → skip to a static illustration + text/voice instruction; never crash the mission"): `useRive`'s `onLoadError` callback flips local state, switching the render to `PlaceholderRenderer` — reusing its existing static-illustration-plus-instruction treatment rather than duplicating fallback UI. `PlaceholderRenderer`'s current copy ("Ask a parent to help you do this one!") already reads correctly for "no interactive visual available, do this one with a parent's guidance" — the same message fits both its original use (no renderer built yet for a renderer key) and this new one (renderer built, but this particular asset failed to load).

Since no content points at `renderer: "rive"` yet, this path is only exercised by tests forcing the mocked hook to report a load error — never by the live running app in this plan.

## 5. `rendererRegistry` Wiring

One-line change in `src/content/rendererRegistry.ts`: the `rive` key moves from `PlaceholderRenderer` to `RiveRenderer`. `lottie` and `video` stay mapped to `PlaceholderRenderer`, untouched — out of scope.

## 6. Testing

Per this repo's testing philosophy (mock only at system boundaries — 3rd-party SDKs are a canonical example), `@rive-app/react-canvas` is mocked at the module boundary, the same pattern CLAUDE.md's own `chart.js` example demonstrates:

```ts
vi.mock<typeof import("@rive-app/react-canvas")>("@rive-app/react-canvas");
```

- **`RiveRenderer.test.tsx`:** the mocked `useRive` is asserted to receive `src: "/content/rive/<activity.asset>.riv"`; when the mock resolves normally, the component renders whatever `RiveComponent` the mock returns; when the mock's `onLoadError` is invoked (simulated by capturing the options object passed to `useRive` and calling it directly in the test), the component renders `PlaceholderRenderer`'s output instead (asserted via its real, un-mocked English text — this component itself is not mocked).
- **`rendererRegistry.test.ts`** (existing file, extended): asserts `rendererRegistry.rive === RiveRenderer`, not `PlaceholderRenderer`.
