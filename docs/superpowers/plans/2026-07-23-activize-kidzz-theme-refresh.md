# Bold Illustrated Theme Refresh (Plan 11) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the "Soft Storybook" palette with the approved "Jungle Canopy" palette, add CSS-only backdrop art and motion, and fix two latent bugs — a visual-only pass, zero logic/behavior changes.

**Architecture:** Because every existing `storybook-*` Tailwind class (e.g. `bg-storybook-mint`) resolves through a CSS custom property, **most of the ~15 files in the spec's scope need zero code changes** — they automatically pick up the new colors the instant `src/index.css`'s `@theme` block is repointed (Task 1). Only files needing an actual *structural* change (new art, new animation classes, a layout rewrite, or a hardcoded-color bug fix) get their own task. Everything else is verified, not edited, in the final task.

**Tech Stack:** Tailwind v4.3.3 (confirmed via `package.json` — uses `bg-linear-to-*` gradient utilities, **not** the v3 `bg-gradient-to-*` names), pure CSS `@keyframes` (no framer-motion, confirmed not installed anywhere in this codebase).

## Global Constraints

- Visual/styling only — no logic, copy, or behavior changes anywhere in this plan.
- No new npm dependencies (no framer-motion, no image/asset libraries).
- No external image or SVG assets — all art is CSS gradients/shapes/emoji.
- Every `storybook-*` token name stays exactly as-is; only hex values change, plus 2 new tokens (`storybook-paper`, `storybook-paperText`).
- Existing test suite (241 tests, all black-box — confirmed via `grep` that zero test files reference `storybook-`, `toHaveClass`, or any className/style assertion) must stay green with **zero test file edits**.
- `git commit` is blocked by tool permissions this session — stage with `git add` (explicit paths, never `-A`) and print the exact commit command for the user to run. Per standing preference (Plans 6–10), do **not** commit after each task — batch all tasks into exactly ONE final commit, printed only after the final task's full verification passes.
- Bash's working directory resets to a different project between conversation turns in this environment — always use `git -C C:\Repos\activize-kidzz ...` or a single chained `cd C:\Repos\activize-kidzz && ...`.

---

## Task 1: Palette foundation + `FocusableButton` bug fix

**Files:**
- Modify: `src/index.css`
- Modify: `src/components/FocusableButton.tsx`

**Interfaces:**
- Produces: the `storybook-*` Tailwind color tokens (new hex values) that every other file's existing classNames already reference by name — no other task needs to know any new symbol, since nothing new is exported here. Also produces two new global CSS animation classes, `.storybook-pulse` and `.storybook-badge-in`, that Tasks 3 and 4 apply via `className`.

- [ ] **Step 1: Replace the `@theme` block and add animation keyframes/classes in `src/index.css`**

Full replacement content for `src/index.css`:

```css
@import "tailwindcss";
@import "@fontsource/quicksand/400.css";
@import "@fontsource/quicksand/700.css";

@theme {
  --color-storybook-cream: #2E7D5B;
  --color-storybook-ink: #FDF6EC;
  --color-storybook-mint: #FFC93C;
  --color-storybook-mintText: #1B4D3E;
  --color-storybook-peach: #FF6B4B;
  --color-storybook-peachText: #FDF6EC;
  --color-storybook-lavender: #2BA8BD;
  --color-storybook-lavenderText: #FDF6EC;
  --color-storybook-gold: #FFC93C;
  --color-storybook-tan: #8BBFA5;
  --color-storybook-paper: #FBF6EA;
  --color-storybook-paperText: #3A2A1E;
  --font-sans: "Quicksand", ui-sans-serif, system-ui, sans-serif;
}

@keyframes storybook-pulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.08); }
}

@keyframes storybook-badge-in {
  0% { opacity: 0; transform: scale(0.85); }
  100% { opacity: 1; transform: scale(1); }
}

.storybook-pulse {
  animation: storybook-pulse 2s ease-in-out infinite;
}

.storybook-badge-in {
  animation: storybook-badge-in 0.4s ease-out both;
}
```

Every hex value above is copied verbatim from the approved spec table (`docs/superpowers/specs/2026-07-23-activize-kidzz-theme-refresh-design.md`, §2) — do not retype from memory.

- [ ] **Step 2: Fix the hardcoded old-gold shadow in `src/components/FocusableButton.tsx`**

Change:

```ts
const FOCUS_RING =
  "data-[focused=true]:outline data-[focused=true]:outline-4 data-[focused=true]:outline-dashed data-[focused=true]:outline-storybook-gold data-[focused=true]:outline-offset-2 data-[focused=true]:shadow-[0_0_16px_2px_rgba(224,164,88,0.5)]";
```

to:

```ts
// rgba below must match storybook-gold's hex (#FFC93C = rgb(255,201,60)) --
// Tailwind v4 arbitrary box-shadow values can't reference a theme color with
// opacity in one utility, so this has to be kept in sync by hand if the gold
// token ever changes again.
const FOCUS_RING =
  "data-[focused=true]:outline data-[focused=true]:outline-4 data-[focused=true]:outline-dashed data-[focused=true]:outline-storybook-gold data-[focused=true]:outline-offset-2 data-[focused=true]:shadow-[0_0_16px_2px_rgba(255,201,60,0.5)]";
```

Note: the `storybook-pulse` class is deliberately **not** wired into `FocusableButton`'s shared `FOCUS_RING` here, even though the spec's §4 says the pulse is "reused for FocusableButton's existing focus state." Baking a continuous pulse into every focused button app-wide (every auth-screen button, every puzzle icon, every pill button) was never actually shown in any approved mockup — only the JourneyMap's current-mission dot was ever shown pulsing. Task 3 applies `.storybook-pulse` directly to that one specific element instead. This is a deliberate scope-tightening, not an oversight — flagged here so it's visible, not silent.

- [ ] **Step 3: Run the full test suite to confirm zero regressions**

Run: `cd /c/Repos/activize-kidzz && npm test 2>&1 | tail -8`
Expected: `45 test files passed (45)`, `241 tests passed (241)` — same counts as before this plan, since no test asserts on color/className.

- [ ] **Step 4: Type-check**

Run: `cd /c/Repos/activize-kidzz && npx tsc --noEmit`
Expected: no output (clean).

Do **not** commit — this build batches to a single commit at the end of Task 6.

---

## Task 2: `PageShell` backdrop art

**Files:**
- Modify: `src/components/PageShell.tsx`

**Interfaces:**
- Consumes: `storybook-cream` token (Task 1) as the gradient's dark stop.
- Produces: no new exports — `PageShell`'s existing `{children}` prop contract is unchanged, so every screen that renders inside it needs no changes.

- [ ] **Step 1: Add CSS-only backdrop art to `PageShell.tsx`**

Full replacement content for `src/components/PageShell.tsx`:

```tsx
import type { ReactNode } from "react";

interface Props {
  children: ReactNode;
}

export function PageShell({ children }: Props) {
  return (
    <div className="min-h-screen relative overflow-hidden text-storybook-ink font-sans bg-linear-to-b from-[#4CAF78] to-storybook-cream">
      <div className="absolute inset-0 pointer-events-none select-none" aria-hidden="true">
        <div className="absolute -top-8 -right-8 w-36 h-24 rounded-bl-full rounded-tr-full bg-linear-to-br from-[#3D8361] to-storybook-cream opacity-40 rotate-12" />
        <div className="absolute top-4 right-10 w-24 h-16 rounded-bl-full rounded-tr-full bg-linear-to-br from-[#4CAF78] to-[#2E6D50] opacity-30 -rotate-6" />
        <div className="absolute -bottom-10 -left-10 w-40 h-28 rounded-tr-full rounded-bl-full bg-linear-to-tl from-[#2E5D48] to-storybook-cream opacity-40 -rotate-12" />
        <div className="absolute top-0 left-[30%] w-1.5 h-28 rounded-full bg-linear-to-b from-[#4CAF78] to-[#2E6D50] opacity-30 rotate-6" />
        <div className="absolute top-0 left-[60%] w-1.5 h-20 rounded-full bg-linear-to-b from-[#4CAF78] to-[#2E6D50] opacity-30 -rotate-6" />
        <div className="absolute top-[35%] left-[20%] w-1.5 h-1.5 rounded-full bg-storybook-gold shadow-[0_0_8px_3px_rgba(255,201,60,0.6)]" />
        <div className="absolute top-[55%] left-[75%] w-1.5 h-1.5 rounded-full bg-storybook-gold shadow-[0_0_8px_3px_rgba(255,201,60,0.6)]" />
      </div>
      <div className="relative z-10 p-8">
        {children}
      </div>
    </div>
  );
}
```

This matches the "B" (richer layered illustration) art mockup approved during brainstorming: 3 leaf-shaped blobs, 2 vine strips, 2 firefly glow-dots — all pure CSS gradients/shapes, `aria-hidden` so they never appear in the accessibility tree or affect any `getByRole`/`getByText` test query. Content moves into a `relative z-10` wrapper so it always renders above the decorative layer.

- [ ] **Step 2: Run every screen's existing test suite to confirm zero regressions**

Run: `cd /c/Repos/activize-kidzz && npm test 2>&1 | tail -8`
Expected: `241 tests passed (241)` — `PageShell` is used by every screen, so this is the broadest single regression check available; a decorative `aria-hidden` layer changes no queryable role/text anywhere.

Do **not** commit.

---

## Task 3: `JourneyMap` winding path layout

**Files:**
- Modify: `src/screens/JourneyMap.tsx`

**Interfaces:**
- Consumes: `.storybook-pulse` class (Task 1).
- Produces: no new exports — `JourneyMap`'s `Props` (`{ world, missions }`) is unchanged.

- [ ] **Step 1: Replace the flat grid with a winding zig-zag path**

Full replacement content for `src/screens/JourneyMap.tsx`:

```tsx
import { FocusableButton } from "@/components/FocusableButton";
import { PageShell } from "@/components/PageShell";
import { useUiStore } from "@/store/uiStore";
import { useProgressStore } from "@/store/progressStore";
import { missionLockState } from "@/lib/missionLockState";
import { todayDateString } from "@/lib/date";
import type { World, Mission } from "@/content/types";

interface Props {
  world: World;
  missions: Mission[];
}

export function JourneyMap({ world, missions }: Props) {
  const startMission = useUiStore((s) => s.startMission);
  const goToTrophyShelf = useUiStore((s) => s.goToTrophyShelf);
  const progressNode = useProgressStore((s) => s.node);
  const lastCompletedDate = useProgressStore((s) => s.lastCompletedDate);
  const today = todayDateString();

  return (
    <PageShell>
      <h1 className="text-3xl font-bold mb-6">{world.name}</h1>
      <ul className="relative list-none p-0 m-0 mb-6 max-w-md before:content-[''] before:absolute before:left-1/2 before:top-0 before:bottom-0 before:w-1.5 before:-translate-x-1/2 before:bg-storybook-tan before:rounded-full">
        {missions.map((mission, index) => {
          const state = missionLockState(mission.node, progressNode, lastCompletedDate, today);
          const side = index % 2 === 0 ? "mr-auto" : "ml-auto";
          if (state === "locked") {
            return (
              <li key={mission.id} className={`relative z-10 w-2/3 mb-6 ${side}`}>
                <div
                  aria-label={`${mission.title}, locked`}
                  className="w-full rounded-2xl p-4 text-center font-bold bg-storybook-tan text-storybook-ink opacity-60"
                >
                  {mission.title}
                </div>
              </li>
            );
          }
          return (
            <li key={mission.id} className={`relative z-10 w-2/3 mb-6 ${side}`}>
              <FocusableButton
                variant="card"
                className={`w-full bg-storybook-mint text-storybook-mintText ${state === "current" ? "storybook-pulse" : ""}`}
                autoFocus={state === "current"}
                onPress={() => startMission(mission.id)}
              >
                {mission.title}
              </FocusableButton>
            </li>
          );
        })}
      </ul>
      <FocusableButton variant="pill" className="bg-storybook-peach text-storybook-peachText" onPress={goToTrophyShelf}>
        Trophy Shelf
      </FocusableButton>
    </PageShell>
  );
}
```

The `<ul>`'s `before:` pseudo-element draws a centered vertical connector line; each `<li>` alternates `mr-auto`/`ml-auto` at `w-2/3` inside the `max-w-md` container to zig-zag left/right, matching the master spec's original "Candy Crush-style winding path" description. `relative z-10` keeps every mission card above the connector line. The current unlockable mission gets `.storybook-pulse`; locked missions keep their existing `opacity-60` treatment unchanged.

- [ ] **Step 2: Run `JourneyMap`'s existing test suite**

Run: `cd /c/Repos/activize-kidzz && npm test -- src/screens/JourneyMap.test.tsx 2>&1 | tail -10`
Expected: all existing tests pass — they query by `getByText`/`getByRole`/`aria-label`, none assert on grid vs. zig-zag layout classes.

- [ ] **Step 3: Run the full suite**

Run: `cd /c/Repos/activize-kidzz && npm test 2>&1 | tail -8`
Expected: `241 tests passed (241)`.

Do **not** commit.

---

## Task 4: `RewardScreen` + `TrophyShelf` badge-entrance motion

**Files:**
- Modify: `src/screens/RewardScreen.tsx`
- Modify: `src/screens/TrophyShelf.tsx`

**Interfaces:**
- Consumes: `.storybook-badge-in` class (Task 1).
- Produces: no new exports — both components' `Props` are unchanged.

- [ ] **Step 1: Add `.storybook-badge-in` to `RewardScreen.tsx`'s streak/badge lines**

In `src/screens/RewardScreen.tsx`, change:

```tsx
        {streakCount >= 2 && (
          <p className="text-lg font-bold text-storybook-gold mb-4">{streakCount}-day streak!</p>
        )}
        {newlyEarnedBadges.map((badge) => (
          <p key={badge.id} className="text-lg font-bold text-storybook-gold mb-4">
            {badge.emoji} {badge.name}!
          </p>
        ))}
```

to:

```tsx
        {streakCount >= 2 && (
          <p className="text-lg font-bold text-storybook-gold mb-4 storybook-badge-in">{streakCount}-day streak!</p>
        )}
        {newlyEarnedBadges.map((badge) => (
          <p key={badge.id} className="text-lg font-bold text-storybook-gold mb-4 storybook-badge-in">
            {badge.emoji} {badge.name}!
          </p>
        ))}
```

- [ ] **Step 2: Add `.storybook-badge-in` to `TrophyShelf.tsx`'s earned-badge state only**

In `src/screens/TrophyShelf.tsx`, change:

```tsx
                className={`w-full rounded-2xl p-4 text-center font-bold ${
                  earned ? "bg-storybook-mint text-storybook-mintText" : "bg-storybook-tan text-storybook-ink opacity-60"
                }`}
```

to:

```tsx
                className={`w-full rounded-2xl p-4 text-center font-bold ${
                  earned ? "bg-storybook-mint text-storybook-mintText storybook-badge-in" : "bg-storybook-tan text-storybook-ink opacity-60"
                }`}
```

Locked badges don't animate — only earned ones get the entrance motion, since a locked badge isn't a "reveal" moment.

- [ ] **Step 3: Run both screens' existing test suites**

Run: `cd /c/Repos/activize-kidzz && npm test -- src/screens/RewardScreen.test.tsx src/screens/TrophyShelf.test.tsx 2>&1 | tail -10`
Expected: all existing tests pass (queries are by text/role, not by className).

- [ ] **Step 4: Run the full suite**

Run: `cd /c/Repos/activize-kidzz && npm test 2>&1 | tail -8`
Expected: `241 tests passed (241)`.

Do **not** commit.

---

## Task 5: Auth-screen text-input token fix

**Files:**
- Modify: `src/screens/LoginScreen.tsx`
- Modify: `src/screens/SignupWizard.tsx`
- Modify: `src/screens/RecoveryScreen.tsx`

**Interfaces:**
- Consumes: `storybook-paper`/`storybook-paperText` tokens (Task 1).
- Produces: no new exports.

- [ ] **Step 1: Fix `LoginScreen.tsx`'s hardcoded input**

Change:

```tsx
        className="rounded-full px-5 py-3 mb-4 border-2 border-storybook-lavender bg-white text-storybook-ink"
```

to:

```tsx
        className="rounded-full px-5 py-3 mb-4 border-2 border-storybook-lavender bg-storybook-paper text-storybook-paperText"
```

- [ ] **Step 2: Fix `SignupWizard.tsx`'s hardcoded input**

Change (the single input in the `"username"` step):

```tsx
            className="rounded-full px-5 py-3 mb-4 border-2 border-storybook-lavender bg-white text-storybook-ink"
```

to:

```tsx
            className="rounded-full px-5 py-3 mb-4 border-2 border-storybook-lavender bg-storybook-paper text-storybook-paperText"
```

- [ ] **Step 3: Fix `RecoveryScreen.tsx`'s two hardcoded inputs**

Change both occurrences of:

```tsx
          className="rounded-full px-5 py-3 mb-4 border-2 border-storybook-lavender bg-white text-storybook-ink block"
```

to:

```tsx
          className="rounded-full px-5 py-3 mb-4 border-2 border-storybook-lavender bg-storybook-paper text-storybook-paperText block"
```

(This appears twice in the file — the username input and the recovery-code input — both need the same change.)

- [ ] **Step 4: Run all three screens' existing test suites**

Run: `cd /c/Repos/activize-kidzz && npm test -- src/screens/LoginScreen.test.tsx src/screens/SignupWizard.test.tsx src/screens/RecoveryScreen.test.tsx 2>&1 | tail -10`
Expected: all existing tests pass.

- [ ] **Step 5: Run the full suite**

Run: `cd /c/Repos/activize-kidzz && npm test 2>&1 | tail -8`
Expected: `241 tests passed (241)`.

Do **not** commit.

---

## Task 6: Full-app verification + single commit

**Files:** none modified — this task verifies that every remaining file in the spec's scope (`src/screens/MissionPlayer.tsx`, `src/components/ExercisePlayer.tsx`, `src/components/PuzzlePlayer.tsx`, `src/components/puzzles/SequenceMemoryPuzzle.tsx`, `src/components/NarrationButton.tsx`, `src/screens/ProfilePicker.tsx`, `src/components/EmojiPinKeypad.tsx`, `src/components/AvatarPicker.tsx`) correctly picked up the new palette automatically — they only ever reference `storybook-*` classes by name, never a hardcoded hex, so Task 1's `@theme` change is the only thing they needed.

- [ ] **Step 1: Run the complete test suite one final time**

Run: `cd /c/Repos/activize-kidzz && npm test 2>&1 | tail -8`
Expected: `45 test files passed (45)`, `241 tests passed (241)` — identical to the count before this plan started, since zero tests were added or changed across all 5 tasks.

- [ ] **Step 2: Type-check and build**

Run: `cd /c/Repos/activize-kidzz && npx tsc --noEmit && npm run build`
Expected: both succeed with no errors.

- [ ] **Step 3: Manual browser verification across every re-themed screen**

Start the dev server (`npm run dev`), sign up or log in a test profile, and visually confirm — for each screen below, both the auto-repointed colors AND (where applicable) the new structural/motion changes:

- **Login / Signup / Recovery / Profile Picker**: dark jungle-green backdrop with leaf/vine art visible; input fields are a light parchment color (not white, not dark-on-dark); "Make a new player"/"Next" buttons show the coral/turquoise accent colors with readable text.
- **Journey Map**: missions render as a zig-zagging path (not a flat grid), connected by a visible line; the current unlockable mission's card visibly pulses; locked missions stay muted.
- **Mission Player / Exercise Player / Puzzle Player / Narration Button**: backdrop art visible behind the activity; "We did it!" button and puzzle icons show the new accent colors; the narration button is present and still triggers speech (Plan 10 behavior unaffected).
- **Reward Screen**: newly-earned badge/streak lines visibly fade+scale in on screen entry.
- **Trophy Shelf**: earned badges show the entrance motion; locked badges stay muted/static.

Confirm zero console errors throughout (matching the verification bar used in Plans 9 and 10).

- [ ] **Step 4: Stage everything and print the single commit command**

```bash
cd /c/Repos/activize-kidzz && git add src/index.css src/components/FocusableButton.tsx src/components/PageShell.tsx src/screens/JourneyMap.tsx src/screens/RewardScreen.tsx src/screens/TrophyShelf.tsx src/screens/LoginScreen.tsx src/screens/SignupWizard.tsx src/screens/RecoveryScreen.tsx
```

Print for the user to run:

```bash
git -C C:\Repos\activize-kidzz commit -m "feat: Bold Illustrated jungle canopy theme refresh (Plan 11)"
```

---

## Self-Review

**Spec coverage:** §2 (palette) → Task 1. §3 (CSS-only art) → Task 2. §4 (motion) → Task 1 (keyframes/classes) + Task 3 (JourneyMap pulse) + Task 4 (badge entrance). §5 (winding path) → Task 3. §6 (both latent bugs) → Task 1 Step 2 (shadow fix) + Task 5 (all 3 auth-input fixes). §7 (scope) → every file listed is either directly edited (Tasks 1–5) or explicitly verified as needing no edit (Task 6, with the reasoning stated up front in this plan's Architecture section). §8 (non-goals) → respected throughout; no new dependency, no image assets, no logic changes anywhere.

**Placeholder scan:** no TBD/TODO; every step has complete, copy-pasteable code; the one explicit deviation from the spec's literal wording (not baking `.storybook-pulse` into `FocusableButton`'s shared focus ring) is stated with its reasoning, not left vague.

**Type consistency:** `PageShell`'s `Props` (`{ children: ReactNode }`), `JourneyMap`'s `Props` (`{ world: World; missions: Mission[] }`), `RewardScreen`'s `Props` (`{ missionTitle: string; badges: Badge[] }`), and `TrophyShelf`'s `Props` (`{ badges: Badge[] }`) are all unchanged from their current real signatures (verified by reading each file fresh this session) — no task invents a new prop or changes a signature.

**Hex-value transcription check:** every hex in Task 1's `@theme` block and Task 2's gradient/leaf colors was copied directly from the approved spec table and the brainstorming session's final mockup file, not retyped from memory — cross-checked against the spec doc's §2 table line by line.

**Tailwind v4 syntax check:** confirmed `tailwindcss@4.3.3` in `package.json`; used `bg-linear-to-*` (v4 naming) instead of the v3-only `bg-gradient-to-*`, which would silently fail to apply in this version.
