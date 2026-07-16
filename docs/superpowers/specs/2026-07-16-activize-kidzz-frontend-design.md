# Activize Kidzz — Frontend Design Pass (Plan 2.5)

## 1. Goal

Give the app a real visual identity. Right now every screen — Plan 1's gameplay screens (`JourneyMap`, `MissionPlayer`, `RewardScreen`) and Plan 2's auth screens (`LoginScreen`, `SignupWizard`, `RecoveryScreen`, `ProfilePicker`, `EmojiPinKeypad`, `AvatarPicker`) — is bare unstyled HTML. No CSS framework is installed at all (this corrects an assumption from the original design doc, which assumed Tailwind had already been ported in from `kids-quiz-claude`; it hadn't — only auth *logic* was ported verbatim, never styling).

This pass installs Tailwind, defines the visual identity, and applies it across every existing screen. No new features, no new screens, no logic changes.

**Explicitly out of scope** (deferred to a later plan): framer-motion / animated transitions, `PlayfulBackground` or any animated background, Rive art. This pass is static styling only.

## 2. Visual identity

Chosen via visual-companion mockup review, from three directions (Playground Pop / Cosmic Adventure / Soft Storybook) — **Soft Storybook** selected.

**Palette:**

| Token | Hex | Use |
| - | - | - |
| `storybook-cream` | `#FDF6EC` | page background |
| `storybook-ink` | `#5B4636` | primary text |
| `storybook-mint` / `storybook-mintText` | `#BFE3D0` / `#33513F` | accent 1 (e.g. mission cards) |
| `storybook-peach` / `storybook-peachText` | `#F6CBB7` / `#5B3A2A` | accent 2 (e.g. action buttons) |
| `storybook-lavender` / `storybook-lavenderText` | `#D9CFEF` / `#40365B` | accent 3 (e.g. grid cells) |
| `storybook-gold` | `#E0A458` | focus ring / glow accent, used everywhere a `FocusableButton` is focused |
| `storybook-tan` | `#EADFC8` | muted "unfilled" state for the PIN-entry progress dots |

**Typography:** Quicksand (geometric, rounded, calm — chosen over a bouncier "Baloo 2" style and over a storybook-serif-headings pairing), self-hosted via `@fontsource/quicksand` rather than a Google Fonts CDN link, because some Smart TV browsers restrict third-party font requests and self-hosting avoids a render-blocking external hop. Secondary/progress text (e.g. "Activity 2 of 4") is sized up a notch from a typical default — this was flagged directly during review as needing better readability from couch distance.

**Focus treatment (applies to every `FocusableButton` variant uniformly):** dashed gold outline (`storybook-gold`), soft glow shadow, and a scale-up matching the reviewed mockups per variant — `pill` 1.1x, `card` 1.08x, `grid` 1.12x. Consistency of the ring+glow language matters more than the exact scale number — a D-pad user should be able to tell "this is focused" the same way regardless of what shape the button is.

## 3. Technical setup

- Install `tailwindcss` (+ `postcss`, `autoprefixer`) and wire into the existing Vite config.
- Install `@fontsource/quicksand`, imported once in the new `src/index.css`.
- New `src/index.css`: Tailwind's `@tailwind base/components/utilities` directives + the font import. Imported once in `src/main.tsx`.
- `tailwind.config.js`: `theme.extend.colors.storybook = { cream, ink, mint, mintText, peach, peachText, lavender, lavenderText, gold }`, `theme.extend.fontFamily.sans = ["Quicksand", ...defaultSans]`.

## 4. Component architecture

**`FocusableButton`** gains a `variant?: "pill" | "card" | "grid"` prop, default `"pill"`:

- `pill` — rounded-full, padded, used for text action buttons (Next / Done / Clear / Back / OK / "Make a new player" / "Forgot PIN?" / etc.)
- `card` — rounded-2xl block with more padding, used for `JourneyMap` mission entries
- `grid` — compact square-ish cell, used for `EmojiPinKeypad`'s 12 icons and `AvatarPicker`'s 12 avatars (same visual pattern reused across both — both are already 12-item `role="group"` grids)

All three variants share the same focus classes (gold dashed ring + scale + glow) applied via the existing `data-focused` attribute (Tailwind arbitrary-attribute variant: `data-[focused=true]:...`) — no new focus-detection logic, purely a styling addition on top of the existing `useFocusable` wiring.

Screens may pass an optional `className` through `FocusableButton` for one-off accent-color overrides (e.g. which pastel a given mission card uses) — the component owns shape/focus mechanics, screens own color choices for their own content.

**New `PageShell`** component: wraps every screen with the cream background + consistent outer padding, so this isn't repeated in 9+ separate screen files. Existing screens are bare `<div>`/`<section>` root elements today; each gets wrapped in `PageShell` instead.

## 5. Screen-by-screen layout

- **JourneyMap** — missions rendered as a 3-column grid of `card`-variant buttons (emoji + title), replacing the current bare `<ul>`.
- **MissionPlayer** — activity shown inside a lavender content card; progress text ("Activity N of M") sized up; `Done` as a `pill` button.
- **RewardScreen** — unchanged structure, styled with the same card/pill conventions (no new mockup needed — it's the simplest screen).
- **EmojiPinKeypad** — 12 icons as a 4×3 `grid`-variant layout; entered-PIN progress shown as 4 dots (filled = gold, empty = a muted cream/tan); `Clear`/`Done` as `pill` buttons.
- **AvatarPicker** — same 4×3 `grid`-variant pattern as the PIN keypad, reusing the identical layout convention (12 items either way).
- **LoginScreen / SignupWizard / RecoveryScreen / ProfilePicker** — reuse the above pieces (`PageShell`, `pill` buttons, the shared PIN/avatar grids); no new layout patterns needed beyond what's already covered.

## 6. Testing

No logic changes anywhere in this pass — purely `className`/JSX-structure additions plus two new files (`PageShell`, Tailwind config/CSS). Existing tests assert via `getByRole`/`getByText`/`data-focused`, never on class names, so this should carry zero test risk. Full `npm test` + `tsc --noEmit` verification runs at the end of the implementation plan (this also folds in the test-suite verification that was deferred from the end of Plan 2).

## 7. Non-goals (recap)

- No framer-motion / animation
- No `PlayfulBackground` or animated backgrounds
- No Rive art
- No new screens, no new features, no behavior changes
