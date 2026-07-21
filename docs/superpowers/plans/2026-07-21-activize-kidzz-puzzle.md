# Activize Kidzz — Sequence-Memory Puzzle (Plan 8) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first real puzzle mechanic — sequence memory (Simon-says style) — replacing `MissionPlayer`'s current bare "Done"-button stub for any non-movement/breathing activity, plus the `puzzleTypeRegistry` extension point for future puzzle kinds.

**Architecture:** `PuzzleActivity` becomes a properly discriminated content type (`{ type: "puzzle"; puzzle: PuzzleData }`, mirroring `BadgeRule`'s shape) instead of today's untyped `{ puzzleType: string; data: Record<string, unknown> }`. A `useSequenceMemory` hook owns the actual `"watching" → "input" → "success"` state machine (timing overridable for tests, mirroring `useInterstitial`'s split from `InterstitialPlayer`); `SequenceMemoryPuzzle` is a thin registry-facing component wrapping that hook with real default timings. `puzzleTypeRegistry` dispatches by `puzzleType` (mirroring `badgeRuleRegistry`'s pattern even at one entry); `PuzzlePlayer` does the registry lookup and delegates, mirroring `ExercisePlayer`'s role for movement/breathing. The puzzle is **self-validating** — no parent-confirmation button, since the D-pad input itself is screen-observable, unlike a physical movement.

**Tech Stack:** No new dependencies. Existing Vite + React + TS (strict) + Vitest + Zod + `@noriginmedia/norigin-spatial-navigation` stack.

## Global Constraints

- No fail state, no attempt cap: a wrong input resets progress to 0 and replays the watch phase — never a "you lost" screen. This matches the existing "no failure, no losing" principle already documented inline in `lib/progress.ts`'s `recordMissionCompletion`.
- `SequenceMemoryPuzzle` takes only `{ activity: PuzzleActivity; onValidated: () => void }` — the same shape every `puzzleTypeRegistry` entry must accept, and the same shape `PuzzlePlayer` passes through. No parent-validation button, no gate timer (that's `ExercisePlayer`'s model, not this one).
- Timing overrides (`stepMs`, `successFlashMs`) live on the `useSequenceMemory` hook, not on `SequenceMemoryPuzzle`'s props — the component always uses real defaults (800ms/600ms). This mirrors `useInterstitial`/`InterstitialPlayer`'s existing split in this codebase exactly: the hook is unit-tested with tiny overrides, the component is tested with real defaults and generous `waitFor` timeouts.
- All new timing tests use real timers (never fake timers + `waitFor`, which are known to deadlock in this codebase).
- Full `npm test` + `npx tsc --noEmit` + `npm run build` verification runs at the end (Task 5's final step).
- Per explicit user direction this time: do **not** commit after each task. Complete all 5 tasks in one continuous session, stage everything together, and print exactly **one** commit command after Task 5's full verification passes (mirroring Plan 6's and Plan 7's delivery style).

---

### Task 1: Content model — `PuzzleData` type + schema validation

**Files:**
- Modify: `src/content/types.ts`
- Modify: `src/content/schema.ts`
- Test: `src/content/schema.test.ts`

**Interfaces:**
- Produces: `PuzzleData = { puzzleType: "sequence_memory"; icons: string[]; sequence: string[] }`, `PuzzleActivity = ActivityBase & { type: "puzzle"; puzzle: PuzzleData }` — consumed by every later task. `parseActivity` (existing export, behavior extended) now validates the new `puzzle` shape.

- [ ] **Step 1: Write the failing tests**

Add to `src/content/schema.test.ts` (after the existing `"rejects an activity with an unknown type"` test):

```ts
const puzzleActivityJson = {
  id: "activity-sequence-1", type: "puzzle", title: "Remember the Order",
  ageBands: ["6-8"], narration: "sequence-1.mp3",
  puzzle: { puzzleType: "sequence_memory", icons: ["🐱", "🐶", "🐰"], sequence: ["🐱", "🐶"] },
};

it("parses a puzzle activity with a sequence_memory puzzle", () => {
  const a = parseActivity(puzzleActivityJson);
  expect(a.type).toBe("puzzle");
  if (a.type === "puzzle") {
    expect(a.puzzle).toEqual({ puzzleType: "sequence_memory", icons: ["🐱", "🐶", "🐰"], sequence: ["🐱", "🐶"] });
  }
});

it("rejects a sequence_memory puzzle whose sequence references an icon not in icons", () => {
  expect(() =>
    parseActivity({
      ...puzzleActivityJson,
      puzzle: { puzzleType: "sequence_memory", icons: ["🐱", "🐶"], sequence: ["🐱", "🦊"] },
    }),
  ).toThrow();
});

it("rejects a sequence_memory puzzle with duplicate icons", () => {
  expect(() =>
    parseActivity({
      ...puzzleActivityJson,
      puzzle: { puzzleType: "sequence_memory", icons: ["🐱", "🐱", "🐶"], sequence: ["🐱"] },
    }),
  ).toThrow();
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /c/Repos/activize-kidzz && npx vitest run src/content/schema.test.ts`
Expected: FAIL — the first new test fails because `activitySchema`'s current `puzzle` branch still expects `puzzleType`/`data` at the top level, not a nested `puzzle` object (`puzzleActivityJson` doesn't have those fields, so parsing throws instead of succeeding). The other two new tests fail too, since nothing validates `sequence`-values-exist-in-`icons` or `icons`-has-no-duplicates yet.

- [ ] **Step 3: Update the type**

In `src/content/types.ts`, replace:

```ts
export interface PuzzleActivity extends ActivityBase {
  type: "puzzle";
  puzzleType: string;
  data: Record<string, unknown>;
}
```

with:

```ts
export interface PuzzleActivity extends ActivityBase {
  type: "puzzle";
  puzzle: PuzzleData;
}

export type PuzzleData =
  | { puzzleType: "sequence_memory"; icons: string[]; sequence: string[] };
```

- [ ] **Step 4: Update the schema**

In `src/content/schema.ts`, replace the `puzzle` branch inside `activitySchema`'s array:

```ts
// Before
z.object({ ...activityBase, type: z.literal("puzzle"), puzzleType: z.string(), data: z.record(z.unknown()) }),
```

Add this above `const activitySchema = ...` (right after the `renderer` const):

```ts
const sequenceMemoryDataSchema = z
  .object({
    puzzleType: z.literal("sequence_memory"),
    icons: z.array(z.string()),
    sequence: z.array(z.string()),
  })
  .refine((data) => data.sequence.every((s) => data.icons.includes(s)), {
    message: "every sequence value must exist in icons",
  })
  .refine((data) => new Set(data.icons).size === data.icons.length, {
    message: "icons must not contain duplicates",
  });

// Only one puzzle kind exists so far -- this becomes a real
// z.discriminatedUnion("puzzleType", [...]) once a second kind ships.
// z.discriminatedUnion's branches must stay plain ZodObjects; the
// cross-field .refine() checks above only compose post-union, not
// per-branch, so the union itself waits until there's more than one kind.
const puzzleDataSchema = sequenceMemoryDataSchema;
```

Then change the `activitySchema` array's `puzzle` branch to:

```ts
z.object({ ...activityBase, type: z.literal("puzzle"), puzzle: puzzleDataSchema }),
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd /c/Repos/activize-kidzz && npx vitest run src/content/schema.test.ts`
Expected: PASS (13 tests: 10 existing + 3 new)

- [ ] **Step 6: Run the full suite to confirm no ripple**

Run: `cd /c/Repos/activize-kidzz && npm test`
Expected: PASS (225 tests: 222 pre-existing + 3 new from this task's `schema.test.ts` additions). No other file reads the old `puzzleType`/`data` fields in production code, so nothing else breaks.

---

### Task 2: `useSequenceMemory` hook

**Files:**
- Create: `src/lib/useSequenceMemory.ts`
- Test: `src/lib/useSequenceMemory.test.ts`

**Interfaces:**
- Consumes: nothing from earlier tasks (pure hook, takes `sequence: string[]` directly, not a `PuzzleActivity`).
- Produces: `useSequenceMemory(sequence: string[], onComplete: () => void, opts?: { stepMs?: number; successFlashMs?: number }): SequenceMemoryState` where `SequenceMemoryState = { phase: "watching" | "input" | "success"; watchIndex: number; progress: number; submit: (icon: string) => void }` — consumed by Task 3's `SequenceMemoryPuzzle`.

- [ ] **Step 1: Write the failing tests**

Create `src/lib/useSequenceMemory.test.ts`:

```ts
import { renderHook, waitFor, act } from "@testing-library/react";
import { useSequenceMemory } from "./useSequenceMemory";

describe("useSequenceMemory", () => {
  it("starts in the watching phase at step 0", () => {
    const { result } = renderHook(() => useSequenceMemory(["🐱", "🐶"], () => {}, { stepMs: 10, successFlashMs: 10 }));
    expect(result.current.phase).toBe("watching");
    expect(result.current.watchIndex).toBe(0);
  });

  it("advances the watch step over time, then enters input", async () => {
    const { result } = renderHook(() => useSequenceMemory(["🐱", "🐶"], () => {}, { stepMs: 10, successFlashMs: 10 }));
    await waitFor(() => expect(result.current.watchIndex).toBe(1));
    await waitFor(() => expect(result.current.phase).toBe("input"));
  });

  it("ignores submit calls while still in the watching phase", () => {
    const { result } = renderHook(() => useSequenceMemory(["🐱", "🐶"], () => {}, { stepMs: 10000, successFlashMs: 10 }));
    act(() => result.current.submit("🐱"));
    expect(result.current.phase).toBe("watching");
    expect(result.current.progress).toBe(0);
  });

  it("advances progress on a correct submit and calls onComplete after the full sequence", async () => {
    const onComplete = vi.fn();
    const { result } = renderHook(() => useSequenceMemory(["🐱", "🐶"], onComplete, { stepMs: 10, successFlashMs: 10 }));
    await waitFor(() => expect(result.current.phase).toBe("input"));
    act(() => result.current.submit("🐱"));
    expect(result.current.progress).toBe(1);
    act(() => result.current.submit("🐶"));
    await waitFor(() => expect(result.current.phase).toBe("success"));
    await waitFor(() => expect(onComplete).toHaveBeenCalledTimes(1));
  });

  it("resets progress and replays the watch phase on a wrong submit", async () => {
    const { result } = renderHook(() => useSequenceMemory(["🐱", "🐶"], () => {}, { stepMs: 10, successFlashMs: 10 }));
    await waitFor(() => expect(result.current.phase).toBe("input"));
    act(() => result.current.submit("🐶")); // wrong -- sequence[0] is "🐱"
    expect(result.current.phase).toBe("watching");
    expect(result.current.progress).toBe(0);
    expect(result.current.watchIndex).toBe(0);
    await waitFor(() => expect(result.current.phase).toBe("input"));
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /c/Repos/activize-kidzz && npx vitest run src/lib/useSequenceMemory.test.ts`
Expected: FAIL — `Cannot find module './useSequenceMemory'` (the hook doesn't exist yet).

- [ ] **Step 3: Write the implementation**

Create `src/lib/useSequenceMemory.ts`:

```ts
import { useEffect, useState } from "react";

export type SequenceMemoryPhase = "watching" | "input" | "success";

export interface SequenceMemoryState {
  phase: SequenceMemoryPhase;
  watchIndex: number;
  progress: number;
  submit: (icon: string) => void;
}

export function useSequenceMemory(
  sequence: string[],
  onComplete: () => void,
  opts?: { stepMs?: number; successFlashMs?: number },
): SequenceMemoryState {
  const stepMs = opts?.stepMs ?? 800;
  const successFlashMs = opts?.successFlashMs ?? 600;
  const [phase, setPhase] = useState<SequenceMemoryPhase>("watching");
  const [watchIndex, setWatchIndex] = useState(0);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (phase !== "watching") return;
    if (watchIndex >= sequence.length) {
      setPhase("input");
      return;
    }
    const timer = setTimeout(() => setWatchIndex((i) => i + 1), stepMs);
    return () => clearTimeout(timer);
  }, [phase, watchIndex, sequence.length, stepMs]);

  useEffect(() => {
    if (phase !== "success") return;
    const timer = setTimeout(onComplete, successFlashMs);
    return () => clearTimeout(timer);
  }, [phase, successFlashMs, onComplete]);

  const submit = (icon: string) => {
    if (phase !== "input") return;
    if (icon === sequence[progress]) {
      const next = progress + 1;
      if (next === sequence.length) {
        setPhase("success");
      } else {
        setProgress(next);
      }
    } else {
      setProgress(0);
      setWatchIndex(0);
      setPhase("watching");
    }
  };

  return { phase, watchIndex, progress, submit };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd /c/Repos/activize-kidzz && npx vitest run src/lib/useSequenceMemory.test.ts`
Expected: PASS (5 tests)

---

### Task 3: `SequenceMemoryPuzzle` component

**Files:**
- Create: `src/components/puzzles/SequenceMemoryPuzzle.tsx`
- Test: `src/components/puzzles/SequenceMemoryPuzzle.test.tsx`

**Interfaces:**
- Consumes: `PuzzleActivity` from `src/content/types.ts` (Task 1). `useSequenceMemory` from `src/lib/useSequenceMemory.ts` (Task 2). `FocusableButton` from `src/components/FocusableButton.tsx` (existing).
- Produces: `SequenceMemoryPuzzle(props: { activity: PuzzleActivity; onValidated: () => void }): JSX.Element` — consumed by Task 4's `puzzleTypeRegistry`.

- [ ] **Step 1: Write the failing tests**

Create `src/components/puzzles/SequenceMemoryPuzzle.test.tsx`:

```tsx
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SequenceMemoryPuzzle } from "./SequenceMemoryPuzzle";
import { initNavigation } from "@/navigation/initNavigation";
import { mockGridLayout } from "@/testUtils/mockGridLayout";
import type { PuzzleActivity } from "@/content/types";

const activity: PuzzleActivity = {
  id: "p1", type: "puzzle", title: "Remember the Order", ageBands: ["6-8"], narration: "p1.mp3",
  puzzle: { puzzleType: "sequence_memory", icons: ["🐱", "🐶"], sequence: ["🐱", "🐶"] },
};

describe("SequenceMemoryPuzzle", () => {
  beforeAll(() => initNavigation());

  it("renders every icon in the grid", () => {
    render(<SequenceMemoryPuzzle activity={activity} onValidated={() => {}} />);
    expect(screen.getByRole("button", { name: "🐱" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "🐶" })).toBeInTheDocument();
  });

  it("disables the grid during the watch phase", () => {
    render(<SequenceMemoryPuzzle activity={activity} onValidated={() => {}} />);
    expect(screen.getByRole("button", { name: "🐱" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "🐶" })).toBeDisabled();
  });

  it("ArrowRight moves D-pad focus to the geometrically-next icon", async () => {
    const restore = mockGridLayout((el) => {
      const label = el.getAttribute?.("aria-label") ?? el.textContent;
      const index = activity.puzzle.icons.findIndex((icon) => icon === label);
      return index === -1 ? null : index;
    }, 4);

    render(<SequenceMemoryPuzzle activity={activity} onValidated={() => {}} />);
    await waitFor(() => expect(screen.getByRole("button", { name: "🐱" })).toHaveAttribute("data-focused", "true"));

    fireEvent.keyDown(window, { keyCode: 39, code: "ArrowRight", key: "ArrowRight" });

    await waitFor(() => expect(screen.getByRole("button", { name: "🐶" })).toHaveAttribute("data-focused", "true"));
    restore();
  });

  it("solves the puzzle end-to-end with real default timings and calls onValidated", async () => {
    const onValidated = vi.fn();
    const user = userEvent.setup();
    render(<SequenceMemoryPuzzle activity={activity} onValidated={onValidated} />);

    await waitFor(() => expect(screen.getByRole("button", { name: "🐱" })).not.toBeDisabled(), { timeout: 3000 });

    await user.click(screen.getByRole("button", { name: "🐱" }));
    await user.click(screen.getByRole("button", { name: "🐶" }));

    await waitFor(() => expect(screen.getByText(/got it/i)).toBeInTheDocument(), { timeout: 1000 });
    await waitFor(() => expect(onValidated).toHaveBeenCalledTimes(1), { timeout: 1000 });
  }, 10000);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /c/Repos/activize-kidzz && npx vitest run src/components/puzzles/SequenceMemoryPuzzle.test.tsx`
Expected: FAIL — `Cannot find module './SequenceMemoryPuzzle'`.

- [ ] **Step 3: Write the implementation**

Create `src/components/puzzles/SequenceMemoryPuzzle.tsx`:

```tsx
import { useSequenceMemory } from "@/lib/useSequenceMemory";
import { FocusableButton } from "@/components/FocusableButton";
import type { PuzzleActivity } from "@/content/types";

interface Props {
  activity: PuzzleActivity;
  onValidated: () => void;
}

export function SequenceMemoryPuzzle({ activity, onValidated }: Props) {
  const { icons, sequence } = activity.puzzle;
  const { phase, watchIndex, submit } = useSequenceMemory(sequence, onValidated);

  if (phase === "success") {
    return (
      <div role="status" aria-label="Solved">
        <p className="text-2xl font-bold">🎉 Got it!</p>
      </div>
    );
  }

  const watching = phase === "watching";
  const highlightedIcon = watching ? sequence[watchIndex] : null;

  return (
    <div role="group" aria-label="sequence memory puzzle" className="grid grid-cols-4 gap-3 max-w-xs mb-4">
      {icons.map((icon, index) => (
        <FocusableButton
          key={icon}
          variant="grid"
          className={icon === highlightedIcon ? "bg-storybook-gold" : "bg-storybook-lavender text-storybook-lavenderText"}
          focusKey={`seq-icon-${icon}`}
          autoFocus={index === 0}
          disabled={watching}
          onPress={() => submit(icon)}
        >
          {icon}
        </FocusableButton>
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd /c/Repos/activize-kidzz && npx vitest run src/components/puzzles/SequenceMemoryPuzzle.test.tsx`
Expected: PASS (4 tests)

---

### Task 4: `puzzleTypeRegistry` + `PuzzlePlayer`

**Files:**
- Create: `src/content/puzzleTypeRegistry.ts`
- Create: `src/components/PuzzlePlayer.tsx`
- Test: `src/content/puzzleTypeRegistry.test.ts`
- Test: `src/components/PuzzlePlayer.test.tsx`

**Interfaces:**
- Consumes: `SequenceMemoryPuzzle` from `src/components/puzzles/SequenceMemoryPuzzle.tsx` (Task 3). `PuzzleActivity`, `PuzzleData` from `src/content/types.ts` (Task 1).
- Produces: `puzzleTypeRegistry: Record<PuzzleData["puzzleType"], ComponentType<{ activity: PuzzleActivity; onValidated: () => void }>>`. `PuzzlePlayer(props: { activity: PuzzleActivity; onValidated: () => void }): JSX.Element` — consumed by Task 5's `MissionPlayer`.

- [ ] **Step 1: Write the failing tests**

Create `src/content/puzzleTypeRegistry.test.ts`:

```ts
import { puzzleTypeRegistry } from "./puzzleTypeRegistry";
import { SequenceMemoryPuzzle } from "@/components/puzzles/SequenceMemoryPuzzle";

describe("puzzleTypeRegistry", () => {
  it("maps sequence_memory to SequenceMemoryPuzzle", () => {
    expect(puzzleTypeRegistry.sequence_memory).toBe(SequenceMemoryPuzzle);
  });
});
```

Create `src/components/PuzzlePlayer.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { PuzzlePlayer } from "./PuzzlePlayer";
import { initNavigation } from "@/navigation/initNavigation";
import type { PuzzleActivity } from "@/content/types";

const activity: PuzzleActivity = {
  id: "p1", type: "puzzle", title: "Remember the Order", ageBands: ["6-8"], narration: "p1.mp3",
  puzzle: { puzzleType: "sequence_memory", icons: ["🐱", "🐶"], sequence: ["🐱", "🐶"] },
};

describe("PuzzlePlayer", () => {
  beforeAll(() => initNavigation());

  it("renders the registered component for the activity's puzzleType", () => {
    render(<PuzzlePlayer activity={activity} onValidated={() => {}} />);
    expect(screen.getByRole("button", { name: "🐱" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "🐶" })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /c/Repos/activize-kidzz && npx vitest run src/content/puzzleTypeRegistry.test.ts src/components/PuzzlePlayer.test.tsx`
Expected: FAIL — both `Cannot find module` errors (neither file exists yet).

- [ ] **Step 3: Write the implementation**

Create `src/content/puzzleTypeRegistry.ts`:

```ts
import type { ComponentType } from "react";
import { SequenceMemoryPuzzle } from "@/components/puzzles/SequenceMemoryPuzzle";
import type { PuzzleActivity, PuzzleData } from "./types";

interface PuzzleComponentProps {
  activity: PuzzleActivity;
  onValidated: () => void;
}

export const puzzleTypeRegistry: Record<PuzzleData["puzzleType"], ComponentType<PuzzleComponentProps>> = {
  sequence_memory: SequenceMemoryPuzzle,
};
```

Create `src/components/PuzzlePlayer.tsx`:

```tsx
import { puzzleTypeRegistry } from "@/content/puzzleTypeRegistry";
import type { PuzzleActivity } from "@/content/types";

interface Props {
  activity: PuzzleActivity;
  onValidated: () => void;
}

export function PuzzlePlayer({ activity, onValidated }: Props) {
  const PuzzleComponent = puzzleTypeRegistry[activity.puzzle.puzzleType];
  return <PuzzleComponent activity={activity} onValidated={onValidated} />;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd /c/Repos/activize-kidzz && npx vitest run src/content/puzzleTypeRegistry.test.ts src/components/PuzzlePlayer.test.tsx`
Expected: PASS (2 tests)

---

### Task 5: Wire `PuzzlePlayer` into `MissionPlayer`

**Files:**
- Modify: `src/screens/MissionPlayer.tsx`
- Test: `src/screens/MissionPlayer.test.tsx`

**Interfaces:**
- Consumes: `PuzzlePlayer` from `src/components/PuzzlePlayer.tsx` (Task 4).
- Produces: nothing new — this is the final integration point.

- [ ] **Step 1: Write the failing test**

Add to `src/screens/MissionPlayer.test.tsx`, after the existing `"goes to the reward screen after the last activity"` test in the first `describe("MissionPlayer", ...)` block:

```tsx
it("renders and solves a puzzle activity, advancing to the reward screen", async () => {
  const user = userEvent.setup();
  const puzzleMission: Mission = { id: "mission-001", worldId: "world-jungle", node: 1, title: "Day 1", activityIds: ["p1"] };
  const puzzleActivities: Activity[] = [
    {
      id: "p1", type: "puzzle", title: "Remember the Order", ageBands: ["6-8"], narration: "p1.mp3",
      puzzle: { puzzleType: "sequence_memory", icons: ["🐱", "🐶"], sequence: ["🐱"] },
    },
  ];
  render(<MissionPlayer mission={puzzleMission} activities={puzzleActivities} badges={[]} worldId="world-jungle" totalMissionsInWorld={1} />);

  expect(screen.getByText(/remember the order/i)).toBeInTheDocument();
  await waitFor(() => expect(screen.getByRole("button", { name: "🐱" })).not.toBeDisabled(), { timeout: 3000 });
  await user.click(screen.getByRole("button", { name: "🐱" }));

  await waitFor(() => expect(useUiStore.getState().screen).toBe("reward"), { timeout: 3000 });
}, 10000);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /c/Repos/activize-kidzz && npx vitest run src/screens/MissionPlayer.test.tsx -t "renders and solves a puzzle activity"`
Expected: FAIL — the old bare "Done" button renders instead of the puzzle grid, so `screen.getByRole("button", { name: "🐱" })` never appears (times out or throws immediately, since `getByRole` fails fast when no match exists).

- [ ] **Step 3: Wire `PuzzlePlayer` into `MissionPlayer`**

In `src/screens/MissionPlayer.tsx`, add the import:

```tsx
import { PuzzlePlayer } from "@/components/PuzzlePlayer";
```

Replace:

```tsx
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
```

with:

```tsx
{activity.type === "movement" || activity.type === "breathing" ? (
  <ExercisePlayer key={activity.id} activity={activity} onValidated={onDone} />
) : (
  <PuzzlePlayer key={activity.id} activity={activity} onValidated={onDone} />
)}
```

`FocusableButton` was only ever used in the removed "Done" button branch above — nothing else in this file references it. Remove its now-dead import line:

```tsx
// Delete this line entirely
import { FocusableButton } from "@/components/FocusableButton";
```

`tsconfig.json` has `noUnusedLocals: true` — leaving this import in place fails `tsc --noEmit` (Step 5 below) and `npm run build`.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /c/Repos/activize-kidzz && npx vitest run src/screens/MissionPlayer.test.tsx`
Expected: PASS (13 tests: 12 existing + 1 new)

- [ ] **Step 5: Full verification**

Run, in order:
1. `cd /c/Repos/activize-kidzz && npm test` — Expected: PASS (237 tests: 222 baseline + 3 schema tests (Task 1) + 5 useSequenceMemory tests (Task 2) + 4 SequenceMemoryPuzzle tests (Task 3) + 2 registry/PuzzlePlayer tests (Task 4) + 1 MissionPlayer test (Task 5) = 15 new tests).
2. `cd /c/Repos/activize-kidzz && npx tsc --noEmit` — Expected: no errors.
3. `cd /c/Repos/activize-kidzz && npm run build` — Expected: build succeeds.

- [ ] **Step 6: Commit**

Per this session's explicit direction, this is the **only** commit for the whole plan — stage everything from all 5 tasks together:

```bash
git -C /c/Repos/activize-kidzz add src/content/types.ts src/content/schema.ts src/content/schema.test.ts src/lib/useSequenceMemory.ts src/lib/useSequenceMemory.test.ts src/components/puzzles/SequenceMemoryPuzzle.tsx src/components/puzzles/SequenceMemoryPuzzle.test.tsx src/content/puzzleTypeRegistry.ts src/content/puzzleTypeRegistry.test.ts src/components/PuzzlePlayer.tsx src/components/PuzzlePlayer.test.tsx src/screens/MissionPlayer.tsx src/screens/MissionPlayer.test.tsx
git -C /c/Repos/activize-kidzz commit -m "feat: add sequence-memory puzzle rendering (Plan 8)"
```
