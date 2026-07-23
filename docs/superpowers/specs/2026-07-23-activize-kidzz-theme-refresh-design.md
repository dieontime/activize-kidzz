# Bold Illustrated Theme Refresh (Plan 11) — Design Spec

## 1. Goal

Since Plan 2.5 (the app's only prior visual-design pass, 2026-07-16), every subsequent plan (3–10) added pure function with zero visual iteration. The app is fully playable but visually flat: `PageShell` is a solid color, `JourneyMap` is a plain 3-column button grid, `RewardScreen` is text + a button. This plan replaces the "Soft Storybook" palette with a bolder "Jungle Canopy" identity, adds real backdrop art (CSS-only) and motion (CSS-only) across the whole app, and fixes two latent bugs found along the way.

This was **not** an explicitly broken commitment — a full transcript search confirmed only *animation/motion* work (framer-motion, `PlayfulBackground`) was ever explicitly deferred to "the later plan already scoped for them" (the master spec's original Plan 6 slot, never actually reached once Plan 2.5 was inserted early). The palette itself was chosen decisively in Plan 2.5. This plan revisits both anyway, per explicit user direction now.

## 2. Direction: "Jungle Canopy" (Bold Illustrated)

Chosen over "Enhanced Soft Storybook" (same palette + added art/motion) via the visual companion. Iterated three times on user feedback (too dark → lightened; low-contrast third accent → fixed; brown didn't fit → replaced with turquoise).

**Final palette — same `storybook-*` token names, new hex values, zero renames needed in any consuming file:**

| Token | New value | Old value | Role |
|---|---|---|---|
| `storybook-cream` | `#2E7D5B` | `#FDF6EC` | page background (base; screens layer a `linear-gradient(180deg, #4CAF78 0%, #2E7D5B 100%)` on top via `PageShell`) |
| `storybook-ink` | `#FDF6EC` | `#5B4636` | primary text (was the old bg color — roles swapped) |
| `storybook-mint` | `#FFC93C` | `#BFE3D0` | accent 1 — "done"/success state (completed mission cards, earned badges) |
| `storybook-mintText` | `#1B4D3E` | `#33513F` | text on `storybook-mint` |
| `storybook-peach` | `#FF6B4B` | `#F6CBB7` | accent 2 — primary action buttons ("We did it!", "Next", "Back to Map") |
| `storybook-peachText` | `#FDF6EC` | `#5B3A2A` | text on `storybook-peach` |
| `storybook-lavender` | `#2BA8BD` | `#D9CFEF` | accent 3 — secondary buttons/surfaces (tropical turquoise; was brown in an earlier iteration, rejected for not fitting the jungle backdrop) |
| `storybook-lavenderText` | `#FDF6EC` | `#40365B` | text on `storybook-lavender` |
| `storybook-gold` | `#FFC93C` | `#E0A458` | highlight text (streak count, badge names), focus-ring color |
| `storybook-tan` | `#8BBFA5` | `#EADFC8` | locked/muted state background (paired with existing `opacity-60`/`opacity-70` classes already in code) |
| `storybook-paper` **(new)** | `#FBF6EA` | — | text-input field background |
| `storybook-paperText` **(new)** | `#3A2A1E` | — | text-input field text |

`storybook-paper`/`storybook-paperText` are new because `LoginScreen.tsx`, `RecoveryScreen.tsx`, and `SignupWizard.tsx` currently hardcode `bg-white` on every text input (never tokenized) — invisible on the old cream background, but would look like a jarring white box floating on the new dark-green backdrop.

## 3. Art: Pure CSS Only

No external image assets, no sourcing/licensing pipeline (this reopens nothing from the content-licensing backlog item). Backdrop art is layered CSS gradients + shapes (leaves, vines, fireflies) via `::before`/`::after` pseudo-elements and absolutely-positioned decorative `div`s, applied once in `PageShell` so every screen inherits it automatically. `World.art` (a real field on the `World` type, never read by any code) stays unused — a real per-world asset pipeline is out of scope here and belongs to the future "second world" plan, since only `world-jungle` exists today.

## 4. Motion: Pure CSS Only

No new dependency (no framer-motion). Two simple, single-property animation patterns, applied via `@keyframes` in `index.css`:
- **Pulse** — a gentle `scale(1) → scale(1.08) → scale(1)` loop on the current/focused mission dot in `JourneyMap`, and reused for `FocusableButton`'s existing focus state.
- **Scale/fade-in** — a one-shot entrance (`opacity 0→1`, `scale 0.85→1`) on newly-earned badges in `RewardScreen` and `TrophyShelf`.

Explicitly not building: staggered multi-element choreography, spring-physics easing curves, or gesture-driven animation — the kind of thing framer-motion would be for, rejected as unnecessary for this scope.

## 5. JourneyMap: Winding Path Layout

Replaces the current flat `<ul className="grid grid-cols-3 gap-4">` with a vertical zig-zag path: each mission item alternates left/right horizontal offset (e.g. `ml-0`/`ml-auto` on alternating list items within a max-width container), connected by a vertical connector line behind the dots, matching the master spec's original "Candy Crush-style winding path" description (§4) — never actually built until now (the shipped version has always been a plain grid). Locked missions keep their existing muted/`opacity-60` treatment; the current unlockable mission gets the new pulse animation.

## 6. Component Fixes Found During Design

Two latent bugs, unrelated to the theme swap itself but touched by this pass since both files are already being edited:

1. **`FocusableButton.tsx`'s focus ring hardcodes the *old* gold as a raw `rgba(224,164,88,0.5)`** inside a Tailwind arbitrary-value box-shadow (`shadow-[0_0_16px_2px_rgba(224,164,88,0.5)]`) instead of referencing the `storybook-gold` token — so it would silently keep glowing the *old* orange-gold even after the token changes to `#FFC93C`. Fixed by updating the literal rgba to match the new gold (`rgba(255,201,60,0.5)`), with a code comment noting it must be kept in sync manually if the gold token ever changes again (Tailwind v4 arbitrary box-shadow syntax doesn't cleanly support referencing a theme color with opacity in one utility here).
2. **Hardcoded `bg-white` text inputs** in `LoginScreen.tsx`, `RecoveryScreen.tsx`, `SignupWizard.tsx` — replaced with `bg-storybook-paper text-storybook-paperText` (see §2).

## 7. Scope — Files Touched

`src/index.css` (palette + new `@keyframes`), `src/components/PageShell.tsx` (backdrop art), `src/components/FocusableButton.tsx` (focus-ring fix + pulse reuse), `src/screens/JourneyMap.tsx` (winding path layout), `src/screens/MissionPlayer.tsx`, `src/screens/RewardScreen.tsx` (badge entrance motion), `src/screens/TrophyShelf.tsx` (badge entrance motion), `src/components/ExercisePlayer.tsx`, `src/components/PuzzlePlayer.tsx`/`src/components/puzzles/SequenceMemoryPuzzle.tsx`, `src/components/NarrationButton.tsx`, `src/screens/LoginScreen.tsx`, `src/screens/SignupWizard.tsx`, `src/screens/RecoveryScreen.tsx`, `src/screens/ProfilePicker.tsx`, `src/components/EmojiPinKeypad.tsx`, `src/components/AvatarPicker.tsx` — all re-themed in one pass, per explicit user choice (whole app, not just gameplay screens).

## 8. Non-Goals

- No real sourced/generated/commissioned art (pure CSS only, see §3).
- No framer-motion or any new animation dependency (see §4).
- No second-world content or a world-advance mechanism (unrelated backlog item).
- No changes to badge/activity emoji choices — only their container styling changes.
- No changes to any screen's logic, copy, or behavior — visual/styling only.
