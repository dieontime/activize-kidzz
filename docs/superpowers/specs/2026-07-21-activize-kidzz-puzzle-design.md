# Activize Kidzz — Sequence-Memory Puzzle (Plan 8)

## 1. Goal

Build real rendering and interaction for `PuzzleActivity`, currently a defined content type with zero handling: `MissionPlayer.tsx` falls any non-movement/breathing activity through to a bare "Done" button, no puzzle UI, no interaction, no validation of any kind. This plan builds the first concrete puzzle mechanic — sequence memory (Simon-says style) — and the extension point (`puzzleTypeRegistry`) for adding more puzzle kinds later without touching `MissionPlayer` again.

**Explicitly in scope:** the `PuzzleData` content-type restructure, the `sequence_memory` puzzle kind end-to-end (data shape, schema validation, component, tests), `puzzleTypeRegistry`, and `MissionPlayer`'s three-way activity-type wiring.

**Explicitly out of scope:** any puzzle kind other than `sequence_memory` (the registry is built to make adding one easy, but no second kind ships this plan). Authoring real puzzle content into `public/content/` (no activity JSON is added or wired to `type: "puzzle"` this plan — mirrors Plan 7's "plumbing, not content" precedent). Difficulty scaling / adaptive sequence length (content authors pick a fixed `sequence` per activity; no runtime difficulty adjustment).

## 2. Content Model

`PuzzleActivity` (`src/content/types.ts`) changes from today's untyped placeholder:

```ts
// Before
export interface PuzzleActivity extends ActivityBase {
  type: "puzzle";
  puzzleType: string;
  data: Record<string, unknown>;
}
```

to a properly discriminated shape, matching how `BadgeRule` already works:

```ts
// After
export interface PuzzleActivity extends ActivityBase {
  type: "puzzle";
  puzzle: PuzzleData;
}

export type PuzzleData =
  | { puzzleType: "sequence_memory"; icons: string[]; sequence: string[] };
```

`icons`: the full emoji grid shown to the kid — matches this app's existing emoji-first style (`EmojiPinKeypad`, `AvatarPicker`), no image assets needed. May include entries never used in `sequence` ("distractors") — remembering *which* icons lit up, not just clicking every tile, is the actual memory challenge. `sequence`: the order to reproduce, each value drawn from `icons`.

This is a zero-consumer restructure: nothing in production code reads the old `puzzleType`/`data` fields today (only type defs, the zod schema, and fixtures reference them), so there is no breaking change to fix elsewhere.

**Schema validation** (`src/content/schema.ts`). There is no standalone named schema for puzzle activities today — the `puzzle` branch is inline inside `activitySchema`'s `z.discriminatedUnion("type", [...])` array:

```ts
// Before (schema.ts, inside activitySchema's array)
z.object({ ...activityBase, type: z.literal("puzzle"), puzzleType: z.string(), data: z.record(z.unknown()) }),
```

New validation is added as its own schema, following the `badgeRuleSchema`/`badgeSchema` precedent (a standalone schema, embedded by reference):

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
// (z.discriminatedUnion's branches must stay plain ZodObjects; the
// cross-field .refine() checks above only work applied post-union, not
// per-branch, so the union itself waits until there's more than one kind.)
const puzzleDataSchema = sequenceMemoryDataSchema;
```

`activitySchema`'s `puzzle` branch changes to embed it:

```ts
// After
z.object({ ...activityBase, type: z.literal("puzzle"), puzzle: puzzleDataSchema }),
```

## 3. `SequenceMemoryPuzzle` Component

New `src/components/puzzles/SequenceMemoryPuzzle.tsx`. Owns a `"watching" | "input"` state machine:

- **`"watching"`** (entered on mount, and re-entered after any wrong input): each icon in `activity.puzzle.sequence` highlights one at a time, `stepMs` apart (default 800ms, overridable for tests — the same real-timers-with-tiny-overrides pattern used throughout this codebase, e.g. `useInterstitial`). The grid is non-interactive during this phase (every tile's `FocusableButton` gets `disabled`, the prop Plan 4 already added). Once every step has played, transitions to `"input"`.
- **`"input"`**: the kid D-pad-navigates the grid and presses tiles. A correct press (matches `sequence[progress]`) advances `progress`. A wrong press resets `progress` to 0 and drops straight back to `"watching"` — the sequence replays from the start. **No fail state, no attempt limit** — matches this app's established "no failure, no losing" tone (same principle already documented inline in `lib/progress.ts`'s `recordMissionCompletion`).
- **Success**: once `progress === sequence.length`, a brief "🎉 Got it!" flash renders for `successFlashMs` (default 600ms, overridable — same scale as `InterstitialPlayer`'s "Ready!" flash), then the component calls `onValidated()` itself.

**No parent-validation button** — unlike `ExercisePlayer` (which exists specifically because a screen can't observe whether a kid did a real physical movement), a sequence-memory puzzle's correctness is entirely screen-observable: the D-pad input *is* the interaction. `SequenceMemoryPuzzle` auto-validates on a correct solve.

Component signature mirrors `ExercisePlayer`'s shape for consistency:

```ts
interface SequenceMemoryPuzzleProps {
  activity: PuzzleActivity;
  onValidated: () => void;
}
```

## 4. Wiring

New `src/content/puzzleTypeRegistry.ts`:

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

Built as a registry even at one entry, mirroring `badgeRuleRegistry`'s precedent — the whole content system's principle is "registries are touched only for a new *mechanic*, never for new content," and a bare `if` in `MissionPlayer` would need revisiting the moment a second puzzle kind ships.

A new `src/components/PuzzlePlayer.tsx`, mirroring `ExercisePlayer`'s role for movement/breathing, does the registry lookup:

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

`MissionPlayer.tsx`'s current two-way branch:

```tsx
{activity.type === "movement" || activity.type === "breathing" ? (
  <ExercisePlayer key={activity.id} activity={activity} onValidated={onDone} />
) : (
  <FocusableButton /* bare "Done" stub */>Done</FocusableButton>
)}
```

becomes three-way — the bare "Done" stub is removed entirely (it becomes genuinely dead code once `puzzle` has real handling):

```tsx
{activity.type === "movement" || activity.type === "breathing" ? (
  <ExercisePlayer key={activity.id} activity={activity} onValidated={onDone} />
) : (
  <PuzzlePlayer key={activity.id} activity={activity} onValidated={onDone} />
)}
```

## 5. Testing

- **`SequenceMemoryPuzzle.test.tsx`**: real timers with tiny `stepMs`/`successFlashMs` overrides. Covers: the watch phase plays through all steps before the grid becomes interactive; a correct full input sequence calls `onValidated`; a wrong input mid-sequence resets progress and replays the watch phase (no `onValidated` call); at least one test uses real `initNavigation()` and fires actual arrow-key events to confirm D-pad focus moves correctly across the grid, per this repo's established rule for grid components (`EmojiPinKeypad`/`AvatarPicker` set this precedent in Plan 2).
- **`schema.test.ts`** (existing file, extended): a `sequence` value not present in `icons` fails to parse; duplicate `icons` values fail to parse.
- **`puzzleTypeRegistry.test.ts`**: asserts `puzzleTypeRegistry.sequence_memory === SequenceMemoryPuzzle`.
- **`MissionPlayer.test.tsx`** (existing file, extended): a mission containing a `type: "puzzle"` activity renders the puzzle (not the old bare "Done" button, which no longer exists) and advances to the next activity once solved.
