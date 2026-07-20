# Activize Kidzz — Renderers (Plan 4) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A pluggable exercise renderer (`rendererRegistry` + `ExercisePlayer`) with a demo → gate-timer → parent-validates flow for Movement/Breathing activities, replacing `MissionPlayer`'s current plain-text-and-always-enabled-button behavior.

**Architecture:** `ExercisePlayer` owns the gate timer and the validate button; it looks up a renderer component from `rendererRegistry` by `activity.renderer` and renders it. `FocusableButton` gets one new optional `disabled` prop (native HTML `disabled` for semantics/testing + an internal press-guard, since the D-pad focus library tracks focus independently of native DOM focus and does not respect the native attribute on its own).

**Tech Stack:** No new dependencies. Existing Vite + React + TS + Vitest + Zustand stack.

## Global Constraints

- No puzzle-activity handling — separate registry/plan, out of scope.
- Only `"react"` gets real content; `"lottie"`/`"video"`/`"rive"` all resolve to one shared `PlaceholderRenderer` — no new libraries installed.
- `FocusableButton`'s new `disabled` prop defaults to `false` — all ~10 existing call sites must be unaffected (verified via full suite, not per-call-site edits).
- Validate button label is "We did it!" for movement/breathing (via `ExercisePlayer`) — the untouched puzzle fallback in `MissionPlayer` keeps saying "Done"; this asymmetry is deliberate, not a bug.
- Full `npm test` + `npx tsc --noEmit` + `npm run build` verification runs at the end (Task 5).

---

### Task 1: FocusableButton `disabled` prop

**Files:**
- Modify: `src/components/FocusableButton.tsx`
- Modify: `src/components/FocusableButton.test.tsx`

**Interfaces:**
- Produces: `FocusableButton`'s `disabled?: boolean` prop (default `false`) — consumed by Task 3 (`ExercisePlayer`).

- [ ] **Step 1: Write the failing tests** — append to the existing `describe("FocusableButton", ...)` block:

```tsx
  it("does not call onPress when Enter is pressed while disabled", async () => {
    const onPress = vi.fn();
    render(
      <FocusableButton autoFocus disabled onPress={onPress}>
        Locked
      </FocusableButton>,
    );

    await waitFor(() =>
      expect(screen.getByRole("button", { name: /locked/i })).toHaveAttribute("data-focused", "true"),
    );

    fireEvent.keyDown(window, { keyCode: 13, code: "Enter", key: "Enter" });

    expect(onPress).not.toHaveBeenCalled();
  });

  it("stays focusable via autoFocus even while disabled", async () => {
    render(
      <FocusableButton autoFocus disabled onPress={() => {}}>
        Locked
      </FocusableButton>,
    );

    await waitFor(() =>
      expect(screen.getByRole("button", { name: /locked/i })).toHaveAttribute("data-focused", "true"),
    );
    expect(screen.getByRole("button", { name: /locked/i })).toBeDisabled();
  });

  it("calls onPress once re-enabled", async () => {
    const onPress = vi.fn();
    const { rerender } = render(
      <FocusableButton autoFocus disabled onPress={onPress}>
        Locked
      </FocusableButton>,
    );

    await waitFor(() =>
      expect(screen.getByRole("button", { name: /locked/i })).toHaveAttribute("data-focused", "true"),
    );

    rerender(
      <FocusableButton autoFocus disabled={false} onPress={onPress}>
        Locked
      </FocusableButton>,
    );

    fireEvent.keyDown(window, { keyCode: 13, code: "Enter", key: "Enter" });

    expect(onPress).toHaveBeenCalledTimes(1);
  });
```

- [ ] **Step 2: Run to verify the new tests fail**

Run: `npx vitest run src/components/FocusableButton.test.tsx`
Expected: the 3 new tests FAIL (no `disabled` prop exists yet); the original 4 still pass.

- [ ] **Step 3: Replace `src/components/FocusableButton.tsx`'s full content**

```tsx
import { useEffect, type ReactNode } from "react";
import { useFocusable } from "@noriginmedia/norigin-spatial-navigation";

type Variant = "pill" | "card" | "grid";

interface Props {
  onPress: () => void;
  children: ReactNode;
  focusKey?: string;
  autoFocus?: boolean;
  variant?: Variant;
  className?: string;
  disabled?: boolean;
}

const FOCUS_RING =
  "data-[focused=true]:outline data-[focused=true]:outline-4 data-[focused=true]:outline-dashed data-[focused=true]:outline-storybook-gold data-[focused=true]:outline-offset-2 data-[focused=true]:shadow-[0_0_16px_2px_rgba(224,164,88,0.5)]";

const VARIANT_CLASSES: Record<Variant, string> = {
  pill: `rounded-full px-6 py-3 font-bold data-[focused=true]:scale-110 ${FOCUS_RING}`,
  card: `rounded-2xl p-4 text-center font-bold data-[focused=true]:scale-[1.08] ${FOCUS_RING}`,
  grid: `rounded-xl p-2 text-2xl data-[focused=true]:scale-[1.12] ${FOCUS_RING}`,
};

export function FocusableButton({
  onPress,
  children,
  focusKey,
  autoFocus,
  variant = "pill",
  className,
  disabled = false,
}: Props) {
  const handlePress = () => {
    if (!disabled) onPress();
  };
  const { ref, focused, focusSelf } = useFocusable({ focusKey, onEnterPress: handlePress });

  useEffect(() => {
    if (autoFocus) focusSelf();
  }, [autoFocus, focusSelf]);

  return (
    <button
      ref={ref}
      data-focused={focused}
      disabled={disabled}
      onClick={handlePress}
      className={`border-none cursor-pointer transition-transform duration-150 ${VARIANT_CLASSES[variant]} ${disabled ? "opacity-50 cursor-not-allowed" : ""} ${className ?? ""}`}
    >
      {children}
    </button>
  );
}
```

**Why both a native `disabled` attribute and a `handlePress` guard:** the D-pad focus library (`@noriginmedia/norigin-spatial-navigation`) tracks "focus" as its own internal concept and fires `onEnterPress` from its own keydown listener — it does not consult the native `disabled` DOM attribute at all, so the guard is load-bearing for blocking D-pad Enter presses. The native attribute is still added for correct semantics, native mouse-click suppression, and so `toBeDisabled()` works in tests — it does not replace the guard.

- [ ] **Step 4: Run to verify all tests pass**

Run: `npx vitest run src/components/FocusableButton.test.tsx`
Expected: PASS (7 tests — the original 4 plus 3 new)

- [ ] **Step 5: Commit**

```bash
git add src/components/FocusableButton.tsx src/components/FocusableButton.test.tsx
git commit -m "feat: add disabled prop to FocusableButton"
```

---

### Task 2: Renderer registry + ReactRenderer + PlaceholderRenderer

**Files:**
- Modify: `src/content/types.ts`
- Create: `src/content/rendererRegistry.ts`
- Create: `src/content/rendererRegistry.test.ts`
- Create: `src/components/renderers/ReactRenderer.tsx`
- Create: `src/components/renderers/ReactRenderer.test.tsx`
- Create: `src/components/renderers/PlaceholderRenderer.tsx`
- Create: `src/components/renderers/PlaceholderRenderer.test.tsx`

**Interfaces:**
- Produces: `RendererProps` (`{ activity: MovementActivity | BreathingActivity }`) in `content/types.ts`; `rendererRegistry: Record<Renderer, ComponentType<RendererProps>>` — consumed by Task 3 (`ExercisePlayer`).

- [ ] **Step 1: Add `RendererProps` to `src/content/types.ts`** — append at the end of the file:

```typescript
export interface RendererProps {
  activity: MovementActivity | BreathingActivity;
}
```

- [ ] **Step 2: Write the failing tests for `ReactRenderer`**

```typescript
import { render, screen } from "@testing-library/react";
import { ReactRenderer } from "./ReactRenderer";
import type { MovementActivity, BreathingActivity } from "@/content/types";

const movement: MovementActivity = {
  id: "a1", type: "movement", title: "Cross Crawl", ageBands: ["6-8"], narration: "a1.mp3",
  renderer: "react", asset: "cross-crawl", pacing: { reps: 6, tempoMs: 1200 }, instructions: "Touch hand to opposite knee.",
};

const breathing: BreathingActivity = {
  id: "a2", type: "breathing", title: "Belly Breaths", ageBands: ["6-8"], narration: "a2.mp3",
  renderer: "react", asset: "belly", cycles: 4,
};

describe("ReactRenderer", () => {
  it("shows the movement instructions", () => {
    render(<ReactRenderer activity={movement} />);
    expect(screen.getByText(/touch hand to opposite knee/i)).toBeInTheDocument();
  });

  it("shows the breathing cycle count", () => {
    render(<ReactRenderer activity={breathing} />);
    expect(screen.getByText(/4 times/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Run to verify it fails**

Run: `npx vitest run src/components/renderers/ReactRenderer.test.tsx`
Expected: FAIL — `Cannot find module './ReactRenderer'`

- [ ] **Step 4: Implement `src/components/renderers/ReactRenderer.tsx`**

```tsx
import type { RendererProps } from "@/content/types";

export function ReactRenderer({ activity }: RendererProps) {
  if (activity.type === "movement") {
    return (
      <div className="text-center">
        <div className="text-6xl mb-4 animate-bounce">🏃</div>
        <p className="text-lg">{activity.instructions}</p>
      </div>
    );
  }
  return (
    <div className="text-center">
      <div className="text-6xl mb-4 animate-pulse">🫁</div>
      <p className="text-lg">Breathe in, breathe out — {activity.cycles} times.</p>
    </div>
  );
}
```

- [ ] **Step 5: Run to verify it passes**

Run: `npx vitest run src/components/renderers/ReactRenderer.test.tsx`
Expected: PASS (2 tests)

- [ ] **Step 6: Write the failing test for `PlaceholderRenderer`**

```typescript
import { render, screen } from "@testing-library/react";
import { PlaceholderRenderer } from "./PlaceholderRenderer";
import type { MovementActivity } from "@/content/types";

const movement: MovementActivity = {
  id: "a1", type: "movement", title: "Cross Crawl", ageBands: ["6-8"], narration: "a1.mp3",
  renderer: "rive", asset: "cross-crawl", pacing: { reps: 6, tempoMs: 1200 }, instructions: "Touch hand to opposite knee.",
};

describe("PlaceholderRenderer", () => {
  it("shows a placeholder message regardless of activity content", () => {
    render(<PlaceholderRenderer activity={movement} />);
    expect(screen.getByText(/ask a parent to help/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 7: Run to verify it fails**

Run: `npx vitest run src/components/renderers/PlaceholderRenderer.test.tsx`
Expected: FAIL — `Cannot find module './PlaceholderRenderer'`

- [ ] **Step 8: Implement `src/components/renderers/PlaceholderRenderer.tsx`**

```tsx
import type { RendererProps } from "@/content/types";

export function PlaceholderRenderer(_: RendererProps) {
  return (
    <div className="text-center">
      <div className="text-6xl mb-4">✨</div>
      <p className="text-lg">Ask a parent to help you do this one!</p>
    </div>
  );
}
```

- [ ] **Step 9: Run to verify it passes**

Run: `npx vitest run src/components/renderers/PlaceholderRenderer.test.tsx`
Expected: PASS (1 test)

- [ ] **Step 10: Write the failing test for the registry**

```typescript
import { rendererRegistry } from "./rendererRegistry";
import { ReactRenderer } from "@/components/renderers/ReactRenderer";
import { PlaceholderRenderer } from "@/components/renderers/PlaceholderRenderer";

describe("rendererRegistry", () => {
  it("maps react to ReactRenderer", () => {
    expect(rendererRegistry.react).toBe(ReactRenderer);
  });

  it("maps lottie, video, and rive to the shared PlaceholderRenderer", () => {
    expect(rendererRegistry.lottie).toBe(PlaceholderRenderer);
    expect(rendererRegistry.video).toBe(PlaceholderRenderer);
    expect(rendererRegistry.rive).toBe(PlaceholderRenderer);
  });
});
```

- [ ] **Step 11: Run to verify it fails**

Run: `npx vitest run src/content/rendererRegistry.test.ts`
Expected: FAIL — `Cannot find module './rendererRegistry'`

- [ ] **Step 12: Implement `src/content/rendererRegistry.ts`**

```typescript
import type { ComponentType } from "react";
import { ReactRenderer } from "@/components/renderers/ReactRenderer";
import { PlaceholderRenderer } from "@/components/renderers/PlaceholderRenderer";
import type { Renderer, RendererProps } from "./types";

export const rendererRegistry: Record<Renderer, ComponentType<RendererProps>> = {
  react: ReactRenderer,
  lottie: PlaceholderRenderer,
  video: PlaceholderRenderer,
  rive: PlaceholderRenderer,
};
```

- [ ] **Step 13: Run to verify it passes**

Run: `npx vitest run src/content/rendererRegistry.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 14: Commit**

```bash
git add src/content/types.ts src/content/rendererRegistry.ts src/content/rendererRegistry.test.ts src/components/renderers/ReactRenderer.tsx src/components/renderers/ReactRenderer.test.tsx src/components/renderers/PlaceholderRenderer.tsx src/components/renderers/PlaceholderRenderer.test.tsx
git commit -m "feat: add renderer registry, ReactRenderer, and PlaceholderRenderer"
```

---

### Task 3: ExercisePlayer

**Files:**
- Create: `src/components/ExercisePlayer.tsx`
- Create: `src/components/ExercisePlayer.test.tsx`

**Interfaces:**
- Consumes: `FocusableButton`'s `disabled` prop (Task 1); `rendererRegistry` (Task 2).
- Produces: `ExercisePlayer({ activity: MovementActivity | BreathingActivity, onValidated: () => void })` and the exported constant `BREATH_CYCLE_MS` — consumed by Task 4 (`MissionPlayer`).

- [ ] **Step 1: Write the failing tests**

```tsx
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { initNavigation } from "@/navigation/initNavigation";
import { ExercisePlayer } from "./ExercisePlayer";
import type { MovementActivity, BreathingActivity } from "@/content/types";

const movement: MovementActivity = {
  id: "a1", type: "movement", title: "Cross Crawl", ageBands: ["6-8"], narration: "a1.mp3",
  renderer: "react", asset: "cross-crawl", pacing: { reps: 2, tempoMs: 100 }, instructions: "Touch hand to opposite knee.",
};

const breathing: BreathingActivity = {
  id: "a2", type: "breathing", title: "Belly Breaths", ageBands: ["6-8"], narration: "a2.mp3",
  renderer: "react", asset: "belly", cycles: 1,
};

describe("ExercisePlayer", () => {
  beforeAll(() => initNavigation());
  afterEach(() => vi.useRealTimers());

  it("starts with the validate button disabled", () => {
    render(<ExercisePlayer activity={movement} onValidated={() => {}} />);
    expect(screen.getByRole("button", { name: /we did it/i })).toBeDisabled();
  });

  it("enables the validate button after the movement gate duration (reps * tempoMs)", async () => {
    vi.useFakeTimers();
    render(<ExercisePlayer activity={movement} onValidated={() => {}} />);
    vi.advanceTimersByTime(2 * 100);
    await waitFor(() => expect(screen.getByRole("button", { name: /we did it/i })).not.toBeDisabled());
  });

  it("enables the validate button after the breathing gate duration (cycles * BREATH_CYCLE_MS)", async () => {
    vi.useFakeTimers();
    render(<ExercisePlayer activity={breathing} onValidated={() => {}} />);
    vi.advanceTimersByTime(1 * 4000);
    await waitFor(() => expect(screen.getByRole("button", { name: /we did it/i })).not.toBeDisabled());
  });

  it("calls onValidated when pressed after the gate elapses", async () => {
    vi.useFakeTimers();
    const onValidated = vi.fn();
    render(<ExercisePlayer activity={movement} onValidated={onValidated} />);
    vi.advanceTimersByTime(2 * 100);
    await waitFor(() => expect(screen.getByRole("button", { name: /we did it/i })).not.toBeDisabled());
    vi.useRealTimers();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /we did it/i }));
    expect(onValidated).toHaveBeenCalledTimes(1);
  });

  it("renders the ReactRenderer content for a react-renderer activity", () => {
    render(<ExercisePlayer activity={movement} onValidated={() => {}} />);
    expect(screen.getByText(/touch hand to opposite knee/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/components/ExercisePlayer.test.tsx`
Expected: FAIL — `Cannot find module './ExercisePlayer'`

- [ ] **Step 3: Implement `src/components/ExercisePlayer.tsx`**

```tsx
import { useEffect, useState } from "react";
import { FocusableButton } from "@/components/FocusableButton";
import { rendererRegistry } from "@/content/rendererRegistry";
import type { MovementActivity, BreathingActivity } from "@/content/types";

export const BREATH_CYCLE_MS = 4000;

interface Props {
  activity: MovementActivity | BreathingActivity;
  onValidated: () => void;
}

function gateDurationMs(activity: MovementActivity | BreathingActivity): number {
  if (activity.type === "movement") return activity.pacing.reps * activity.pacing.tempoMs;
  return activity.cycles * BREATH_CYCLE_MS;
}

export function ExercisePlayer({ activity, onValidated }: Props) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setReady(false);
    const timer = setTimeout(() => setReady(true), gateDurationMs(activity));
    return () => clearTimeout(timer);
  }, [activity]);

  const Renderer = rendererRegistry[activity.renderer];

  return (
    <>
      <div className="bg-storybook-lavender text-storybook-lavenderText rounded-2xl p-6 mb-6">
        <Renderer activity={activity} />
      </div>
      <FocusableButton
        variant="pill"
        className="bg-storybook-peach text-storybook-peachText"
        autoFocus
        disabled={!ready}
        onPress={onValidated}
      >
        We did it!
      </FocusableButton>
    </>
  );
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/components/ExercisePlayer.test.tsx`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add src/components/ExercisePlayer.tsx src/components/ExercisePlayer.test.tsx
git commit -m "feat: add ExercisePlayer with gated validate button"
```

---

### Task 4: Wire ExercisePlayer into MissionPlayer

**Files:**
- Modify: `src/screens/MissionPlayer.tsx`
- Modify: `src/screens/MissionPlayer.test.tsx`

**Interfaces:**
- Consumes: `ExercisePlayer` (Task 3).

**Note:** the existing fixture activities in `MissionPlayer.test.tsx` are `type: "movement"` — every existing test that clicks `getByRole("button", { name: /done/i })` must be updated to `/we did it/i`, and the gate timer needs fake-timer advancement before those clicks, since the button now starts disabled. This is a real, necessary change to already-passing tests, not incidental churn.

- [ ] **Step 1: Replace `src/screens/MissionPlayer.tsx`'s full content**

```tsx
import { useEffect, useState } from "react";
import { PageShell } from "@/components/PageShell";
import { FocusableButton } from "@/components/FocusableButton";
import { ExercisePlayer } from "@/components/ExercisePlayer";
import { useUiStore } from "@/store/uiStore";
import { recordMissionCompletion } from "@/lib/progress";
import type { Activity, Mission } from "@/content/types";

interface Props {
  mission: Mission;
  activities: Activity[];
}

export function MissionPlayer({ mission, activities }: Props) {
  const goToReward = useUiStore((s) => s.goToReward);
  const [index, setIndex] = useState(0);
  const activity = activities[index];

  useEffect(() => {
    if (activities.length === 0) {
      void recordMissionCompletion(mission.id, mission.node, 0);
      goToReward();
    }
  }, [activities, goToReward, mission.id, mission.node]);

  const onDone = () => {
    if (index + 1 >= activities.length) {
      void recordMissionCompletion(mission.id, mission.node, activities.length);
      goToReward();
    } else {
      setIndex((i) => i + 1);
    }
  };

  if (!activity) return null;

  return (
    <PageShell>
      <section aria-label={mission.title}>
        <p className="text-lg opacity-80 mb-4">
          Activity {index + 1} of {activities.length}
        </p>
        <h2 className="text-2xl font-bold mb-2">{activity.title}</h2>
        {activity.type === "movement" || activity.type === "breathing" ? (
          <ExercisePlayer key={activity.id} activity={activity} onValidated={onDone} />
        ) : (
          <FocusableButton
            key={activity.id}
            variant="pill"
            className="bg-storybook-peach text-storybook-peachText"
            autoFocus
            focusKey={`done-${activity.id}`}
            onPress={onDone}
          >
            Done
          </FocusableButton>
        )}
      </section>
    </PageShell>
  );
}
```

- [ ] **Step 2: Replace `src/screens/MissionPlayer.test.tsx`'s full content**

```tsx
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { initNavigation } from "@/navigation/initNavigation";
import { MissionPlayer } from "./MissionPlayer";
import { useUiStore } from "@/store/uiStore";
import { useAuthStore } from "@/store/authStore";
import { useProgressStore } from "@/store/progressStore";
import type { Activity, Mission } from "@/content/types";

const mission: Mission = { id: "mission-001", worldId: "world-jungle", node: 1, title: "Day 1", activityIds: ["a1", "a2"] };
const activities: Activity[] = [
  { id: "a1", type: "movement", title: "Cross Crawl", ageBands: ["6-8"], narration: "a1.mp3", renderer: "react", asset: "cross-crawl", pacing: { reps: 1, tempoMs: 1 }, instructions: "Touch hand to opposite knee." },
  { id: "a2", type: "breathing", title: "Belly Breaths", ageBands: ["6-8"], narration: "a2.mp3", renderer: "react", asset: "belly", cycles: 1 },
];

async function completeCurrentActivity(user: ReturnType<typeof userEvent.setup>) {
  vi.useFakeTimers();
  vi.advanceTimersByTime(5000);
  vi.useRealTimers();
  await waitFor(() => expect(screen.getByRole("button", { name: /we did it/i })).not.toBeDisabled());
  await user.click(screen.getByRole("button", { name: /we did it/i }));
}

describe("MissionPlayer", () => {
  beforeAll(() => {
    initNavigation();
  });

  beforeEach(() => useUiStore.getState().startMission("mission-001"));

  it("shows the first activity and progress", () => {
    render(<MissionPlayer mission={mission} activities={activities} />);
    expect(screen.getByText(/cross crawl/i)).toBeInTheDocument();
    expect(screen.getByText(/activity 1 of 2/i)).toBeInTheDocument();
  });

  it("advances through activities when the parent presses We did it!", async () => {
    const user = userEvent.setup();
    render(<MissionPlayer mission={mission} activities={activities} />);
    await completeCurrentActivity(user);
    expect(screen.getByText(/belly breaths/i)).toBeInTheDocument();
    expect(screen.getByText(/activity 2 of 2/i)).toBeInTheDocument();
  });

  it("goes to the reward screen after the last activity", async () => {
    const user = userEvent.setup();
    render(<MissionPlayer mission={mission} activities={activities} />);
    await completeCurrentActivity(user);
    await completeCurrentActivity(user);
    expect(useUiStore.getState().screen).toBe("reward");
  });

  it("goes straight to the reward screen when the mission has no activities", async () => {
    render(<MissionPlayer mission={mission} activities={[]} />);
    await waitFor(() => expect(useUiStore.getState().screen).toBe("reward"));
  });

  it("keeps D-pad focus on the validate button across activity transitions", async () => {
    const user = userEvent.setup();
    render(<MissionPlayer mission={mission} activities={activities} />);

    await waitFor(() =>
      expect(screen.getByRole("button", { name: /we did it/i })).toHaveAttribute("data-focused", "true"),
    );

    await completeCurrentActivity(user);

    await waitFor(() =>
      expect(screen.getByRole("button", { name: /we did it/i })).toHaveAttribute("data-focused", "true"),
    );
  });

  it("does not let the mission be completed before the gate elapses", async () => {
    render(<MissionPlayer mission={mission} activities={activities} />);
    expect(screen.getByRole("button", { name: /we did it/i })).toBeDisabled();
  });
});

describe("MissionPlayer progress recording", () => {
  beforeEach(() => {
    useAuthStore.setState({
      activeProfile: { id: "profile-1", username: "SpeedyOtter", avatar: "avatar_cat", age_band: "6-8" },
    });
    useProgressStore.getState().setProgress({
      world: 0, node: 1, streakCount: 0, longestStreak: 0, lastCompletedDate: null,
    });
  });

  afterEach(() => {
    useAuthStore.getState().logout();
    useProgressStore.getState().reset();
  });

  it("advances the progress node after completing the mission at the current node", async () => {
    const user = userEvent.setup();
    render(<MissionPlayer mission={mission} activities={activities} />);
    await completeCurrentActivity(user);
    await completeCurrentActivity(user);
    await waitFor(() => expect(useProgressStore.getState().node).toBe(2));
  });

  it("does not advance the node when replaying an already-completed mission", async () => {
    useProgressStore.getState().setProgress({
      world: 0, node: 2, streakCount: 1, longestStreak: 1, lastCompletedDate: "2020-01-01",
    });
    const user = userEvent.setup();
    render(<MissionPlayer mission={mission} activities={activities} />); // mission.node is 1, progress.node is 2
    await completeCurrentActivity(user);
    await completeCurrentActivity(user);
    await new Promise((resolve) => setTimeout(resolve, 0)); // let the fire-and-forget write settle
    expect(useProgressStore.getState().node).toBe(2); // unchanged
  });
});
```

- [ ] **Step 3: Run tests to verify they pass**

Run: `npx vitest run src/screens/MissionPlayer.test.tsx`
Expected: PASS (8 tests)

- [ ] **Step 4: Commit**

```bash
git add src/screens/MissionPlayer.tsx src/screens/MissionPlayer.test.tsx
git commit -m "feat: wire ExercisePlayer into MissionPlayer for movement/breathing activities"
```

---

### Task 5: Full-suite verification

**Files:** none (verification only — no code changes)

- [ ] **Step 1: Run the full test suite**

Run: `npm test`
Expected: PASS, zero failures.

- [ ] **Step 2: Run the type checker**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Run a production build**

Run: `npm run build`
Expected: build succeeds.

No commit for this task — it makes no file changes.
