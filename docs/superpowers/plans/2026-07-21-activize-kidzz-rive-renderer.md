# Activize Kidzz — Rive Renderer Plumbing (Plan 7) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the technical pipeline for a real `RiveRenderer`, replacing the shared `PlaceholderRenderer` currently registered under the `"rive"` key in `rendererRegistry` — no real `.riv` art, no content wiring, plumbing only.

**Architecture:** `RiveRenderer` is a plain function component (same `RendererProps` shape as its siblings `ReactRenderer`/`PlaceholderRenderer`) that calls `@rive-app/react-canvas`'s `useRive` hook with a `src` derived from `activity.asset`, autoplays, and falls back to rendering `PlaceholderRenderer` if the file fails to load — `ExercisePlayer` already owns the exercise's completion gate independently via its own timer, so the renderer never needs to signal completion. Because `@rive-app/react-canvas` is a browser/canvas-heavy 3rd-party SDK that no other test in the suite has ever had to import before, a global safety-net mock is added to `src/setupTests.ts` (this repo's established pattern for suite-wide risks — see the existing Supabase-env-stubbing comment already there) so that every test file that transitively imports `rendererRegistry.ts` — which, after Task 2, includes `ExercisePlayer.test.tsx`, `MissionPlayer.test.tsx`, and `App.e2e.test.tsx` — never touches the real Rive runtime, only ever the mock.

**Tech Stack:** Adds one new dependency, `@rive-app/react-canvas` (the official React wrapper around Rive's web runtime; confirmed current, not deprecated, as of 2026-07-21). Existing Vite + React 18.3.1 + TS (strict) + Vitest 2.0.5 stack otherwise unchanged.

## Global Constraints

- No real `.riv` asset exists or is fetched in this plan. No activity JSON's `renderer` field changes to `"rive"` — `RiveRenderer` ships isolated, exercised only by its own and `rendererRegistry`'s unit tests.
- `RiveRenderer` never signals completion back to `ExercisePlayer` — no state machine, no animation input, no callback wired to the gate timer. This matches every existing renderer (`ReactRenderer` has no callback either).
- `@rive-app/react-canvas` is mocked globally in `src/setupTests.ts` — no test file anywhere in the suite should add its own competing `vi.mock("@rive-app/react-canvas", ...)` call; `RiveRenderer.test.tsx` customizes the *same* global mock instance per-test via `vi.mocked(useRive)`, not a second mock registration.
- Full `npm test` + `npx tsc --noEmit` + `npm run build` verification runs at the end (Task 2's final step).

---

### Task 1: `RiveRenderer` component + global test safety net

**Files:**
- Modify: `package.json` (add `@rive-app/react-canvas` dependency)
- Modify: `src/setupTests.ts`
- Create: `src/components/renderers/RiveRenderer.tsx`
- Test: `src/components/renderers/RiveRenderer.test.tsx`

**Interfaces:**
- Consumes: `RendererProps` (`{ activity: MovementActivity | BreathingActivity }`) from `src/content/types.ts` (existing). `PlaceholderRenderer` from `./PlaceholderRenderer` (existing, unchanged).
- Produces: `RiveRenderer(props: RendererProps): JSX.Element` — consumed by Task 2's `rendererRegistry` wiring.

- [ ] **Step 1: Add the dependency**

Run: `cd /c/Repos/activize-kidzz && npm install @rive-app/react-canvas`

Expected: `package.json`'s `dependencies` gains an entry like `"@rive-app/react-canvas": "^4.28.0"` (exact version may be newer by the time this runs — that's fine, `^`-pinned matches this repo's existing style). `package-lock.json` updates. No test yet — this step alone isn't independently verifiable, the next steps build on it.

- [ ] **Step 2: Add the global safety-net mock**

`@rive-app/react-canvas` is a browser/canvas-heavy SDK — mocking it once here means no test file anywhere in the suite (including ones that don't know or care about Rive, like `ExercisePlayer.test.tsx`) can accidentally exercise the real runtime under jsdom just by importing `rendererRegistry.ts` transitively.

Modify `src/setupTests.ts` to:

```ts
import "@testing-library/jest-dom/vitest";

// Force the mock auth backend in every test run, regardless of whether a
// local .env with real Supabase credentials happens to exist on disk.
// A real .env (created for Task 16's live-database verification) once
// caused the full suite to silently hit the real network and write test
// fixture usernames into production -- this guarantees it can't recur.
vi.stubEnv("VITE_SUPABASE_URL", "");
vi.stubEnv("VITE_SUPABASE_ANON_KEY", "");

// @rive-app/react-canvas touches canvas/WASM APIs jsdom doesn't provide.
// Mocking it globally means every test that transitively imports
// rendererRegistry.ts (ExercisePlayer, MissionPlayer, App.e2e) only ever
// sees this safe no-op default -- RiveRenderer.test.tsx customizes this
// same mock instance per-test via vi.mocked(useRive), it does not
// register a second, competing vi.mock for the same module.
vi.mock("@rive-app/react-canvas", () => ({
  useRive: vi.fn(() => ({ RiveComponent: () => null })),
}));
```

- [ ] **Step 3: Run the existing full suite to confirm nothing broke**

Run: `cd /c/Repos/activize-kidzz && npm test`
Expected: PASS (219 tests) — identical to the pre-Plan-7 baseline. This confirms the global mock addition alone is inert until something actually imports `@rive-app/react-canvas`.

- [ ] **Step 4: Write the failing tests for `RiveRenderer`**

Create `src/components/renderers/RiveRenderer.test.tsx`:

```tsx
import { render, screen, act } from "@testing-library/react";
import { useRive } from "@rive-app/react-canvas";
import { RiveRenderer } from "./RiveRenderer";
import type { MovementActivity } from "@/content/types";

interface UseRiveOptions {
  src: string;
  autoplay?: boolean;
  onLoadError?: () => void;
}

function StubRiveComponent() {
  return <div>rive canvas</div>;
}

const movement: MovementActivity = {
  id: "a1", type: "movement", title: "Cross Crawl", ageBands: ["6-8"], narration: "a1.mp3",
  renderer: "rive", asset: "cross-crawl", pacing: { reps: 6, tempoMs: 1200 }, instructions: "Touch hand to opposite knee.",
};

describe("RiveRenderer", () => {
  // Block body matters here: `() => vi.mocked(useRive).mockReset()` would
  // implicitly return mockReset()'s return value (the mock itself, for
  // chaining) -- Vitest treats a function returned from beforeEach as a
  // teardown hook and calls it with zero args after the test, which
  // crashes the "falls back" test below when it destructures `opts`.
  beforeEach(() => {
    vi.mocked(useRive).mockReset();
  });

  it("passes the activity's asset-derived src to useRive and renders the loaded RiveComponent", () => {
    vi.mocked(useRive).mockReturnValue(
      { RiveComponent: StubRiveComponent } as unknown as ReturnType<typeof useRive>,
    );
    render(<RiveRenderer activity={movement} />);
    expect(useRive).toHaveBeenCalledWith(
      expect.objectContaining({ src: "/content/rive/cross-crawl.riv", autoplay: true }),
    );
    expect(screen.getByText("rive canvas")).toBeInTheDocument();
  });

  it("falls back to the placeholder illustration when the file fails to load", () => {
    let capturedOnLoadError: (() => void) | undefined;
    vi.mocked(useRive).mockImplementation((opts: unknown) => {
      capturedOnLoadError = (opts as UseRiveOptions).onLoadError;
      return { RiveComponent: StubRiveComponent } as unknown as ReturnType<typeof useRive>;
    });
    render(<RiveRenderer activity={movement} />);
    act(() => capturedOnLoadError?.());
    expect(screen.getByText(/ask a parent to help/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 5: Run the test to verify it fails**

Run: `cd /c/Repos/activize-kidzz && npx vitest run src/components/renderers/RiveRenderer.test.tsx`
Expected: FAIL — `Cannot find module './RiveRenderer'` (the component doesn't exist yet).

- [ ] **Step 6: Write the minimal implementation**

Create `src/components/renderers/RiveRenderer.tsx`:

```tsx
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

- [ ] **Step 7: Run the test to verify it passes**

Run: `cd /c/Repos/activize-kidzz && npx vitest run src/components/renderers/RiveRenderer.test.tsx`
Expected: PASS (2 tests)

- [ ] **Step 8: Commit**

```bash
git -C /c/Repos/activize-kidzz add package.json package-lock.json src/setupTests.ts src/components/renderers/RiveRenderer.tsx src/components/renderers/RiveRenderer.test.tsx
git -C /c/Repos/activize-kidzz commit -m "feat: add RiveRenderer component with global test safety net"
```

---

### Task 2: Wire `rendererRegistry` to `RiveRenderer`

**Files:**
- Modify: `src/content/rendererRegistry.ts`
- Modify: `src/content/rendererRegistry.test.ts`

**Interfaces:**
- Consumes: `RiveRenderer` from `src/components/renderers/RiveRenderer.tsx` (Task 1).
- Produces: `rendererRegistry.rive === RiveRenderer` — this is the registry every other consumer (`ExercisePlayer`) already reads from; no other file needs to change.

- [ ] **Step 1: Update the failing assertion**

Modify `src/content/rendererRegistry.test.ts` to its full new contents:

```ts
import { rendererRegistry } from "./rendererRegistry";
import { ReactRenderer } from "@/components/renderers/ReactRenderer";
import { PlaceholderRenderer } from "@/components/renderers/PlaceholderRenderer";
import { RiveRenderer } from "@/components/renderers/RiveRenderer";

describe("rendererRegistry", () => {
  it("maps react to ReactRenderer", () => {
    expect(rendererRegistry.react).toBe(ReactRenderer);
  });

  it("maps lottie and video to the shared PlaceholderRenderer", () => {
    expect(rendererRegistry.lottie).toBe(PlaceholderRenderer);
    expect(rendererRegistry.video).toBe(PlaceholderRenderer);
  });

  it("maps rive to RiveRenderer", () => {
    expect(rendererRegistry.rive).toBe(RiveRenderer);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd /c/Repos/activize-kidzz && npx vitest run src/content/rendererRegistry.test.ts`
Expected: FAIL — `expected PlaceholderRenderer to be RiveRenderer` (the registry still points `rive` at `PlaceholderRenderer`).

- [ ] **Step 3: Wire the registry**

Modify `src/content/rendererRegistry.ts` to its full new contents:

```ts
import type { ComponentType } from "react";
import { ReactRenderer } from "@/components/renderers/ReactRenderer";
import { PlaceholderRenderer } from "@/components/renderers/PlaceholderRenderer";
import { RiveRenderer } from "@/components/renderers/RiveRenderer";
import type { Renderer, RendererProps } from "./types";

export const rendererRegistry: Record<Renderer, ComponentType<RendererProps>> = {
  react: ReactRenderer,
  lottie: PlaceholderRenderer,
  video: PlaceholderRenderer,
  rive: RiveRenderer,
};
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd /c/Repos/activize-kidzz && npx vitest run src/content/rendererRegistry.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Full verification**

Run, in order:
1. `cd /c/Repos/activize-kidzz && npm test` — Expected: PASS (222 tests: 219 pre-existing + 2 new `RiveRenderer` tests + 1 net-new `rendererRegistry` test, since `rendererRegistry.test.ts`'s old 2-test file became 3 tests by splitting the combined "lottie, video, and rive" assertion into a "lottie and video" test plus a separate "rive" test).
2. `cd /c/Repos/activize-kidzz && npx tsc --noEmit` — Expected: no errors.
3. `cd /c/Repos/activize-kidzz && npm run build` — Expected: build succeeds.

This is the moment to confirm the Task 1 safety-net mock actually did its job: `ExercisePlayer.test.tsx`, `MissionPlayer.test.tsx`, and `App.e2e.test.tsx` all transitively import `rendererRegistry.ts` → `RiveRenderer.tsx` → `@rive-app/react-canvas` for the first time here, and must still pass unchanged.

- [ ] **Step 6: Commit**

```bash
git -C /c/Repos/activize-kidzz add src/content/rendererRegistry.ts src/content/rendererRegistry.test.ts
git -C /c/Repos/activize-kidzz commit -m "feat: wire rive renderer key to RiveRenderer in rendererRegistry"
```
