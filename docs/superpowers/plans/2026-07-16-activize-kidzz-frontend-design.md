# Activize Kidzz — Frontend Design Pass (Plan 2.5) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Install Tailwind CSS and apply the approved "Soft Storybook" visual identity across every existing screen and shared component, with zero logic changes.

**Architecture:** Tailwind utility classes driven by a small `storybook` color-token palette defined once in `tailwind.config.cjs`. A new `FocusableButton` `variant` prop (`"pill" | "card" | "grid"`) centralizes the D-pad focus treatment so every button in the app gets the identical dashed-gold-ring-plus-glow affordance regardless of shape. A new `PageShell` wrapper centralizes the cream page background + padding so individual screens don't each repeat it.

**Tech Stack:** Tailwind CSS v3 (PostCSS + Autoprefixer), `@fontsource/quicksand` (self-hosted webfont — no CDN dependency), existing Vite + React + TypeScript + Vitest stack. No new runtime dependencies beyond styling.

## Global Constraints

- No logic changes to any screen or component in this plan — only `className`/JSX-structure additions, plus two brand-new files (`PageShell`, and the Tailwind config/CSS).
- No new screens, no new features, no animation — framer-motion, `PlayfulBackground`/animated backgrounds, and Rive art are explicitly out of scope (deferred to a later plan).
- Every pre-existing test file's assertions stay unchanged — this is a pure visual pass verified by re-running existing tests, not by writing new ones (see per-task rationale: styling has no black-box behavior to assert on, per this codebase's own convention of testing via `getByRole`/`getByText`/`data-focused`, never class names).
- Mission/avatar/PIN content stays exactly as currently modeled — no decorative content (e.g. per-mission emoji) gets invented, since the underlying `Mission`/`Activity` types don't carry that data and adding it would be a content-model change, not styling.
- Full `npm test` + `npx tsc --noEmit` + `npm run build` verification runs at the end (Task 13) — this also covers the test-suite verification that was deferred from the end of Plan 2.

---

### Task 1: Install and configure Tailwind CSS + Quicksand font

**Files:**
- Modify: `package.json` / `package-lock.json` (via npm install)
- Create: `tailwind.config.cjs`
- Create: `postcss.config.cjs`
- Create: `src/index.css`
- Modify: `src/main.tsx`

**Interfaces:**
- Produces: the `storybook` Tailwind color namespace (`storybook-cream`, `storybook-ink`, `storybook-mint`, `storybook-mintText`, `storybook-peach`, `storybook-peachText`, `storybook-lavender`, `storybook-lavenderText`, `storybook-gold`, `storybook-tan`) and `font-sans` = Quicksand, consumed by every later task.

- [ ] **Step 1: Install dependencies**

```bash
npm install -D tailwindcss postcss autoprefixer
npm install @fontsource/quicksand
```

- [ ] **Step 2: Generate the default Tailwind + PostCSS config**

```bash
npx tailwindcss init -p
```

Expected: creates `tailwind.config.js` and `postcss.config.js` at the repo root.

- [ ] **Step 3: Rename both configs to `.cjs`**

`package.json` has `"type": "module"`, so a plain `.js` file using `module.exports` fails to load under Node's ESM resolution. `.cjs` forces CommonJS regardless of that setting — the standard fix for this exact situation.

```bash
mv tailwind.config.js tailwind.config.cjs
mv postcss.config.js postcss.config.cjs
```

- [ ] **Step 4: Replace `tailwind.config.cjs` content**

```js
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        storybook: {
          cream: "#FDF6EC",
          ink: "#5B4636",
          mint: "#BFE3D0",
          mintText: "#33513F",
          peach: "#F6CBB7",
          peachText: "#5B3A2A",
          lavender: "#D9CFEF",
          lavenderText: "#40365B",
          gold: "#E0A458",
          tan: "#EADFC8",
        },
      },
      fontFamily: {
        sans: ["Quicksand", "ui-sans-serif", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};
```

- [ ] **Step 5: Confirm `postcss.config.cjs` content**

`tailwindcss init -p` already generates the right content — just verify it reads exactly this after the rename:

```js
module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
```

- [ ] **Step 6: Create `src/index.css`**

`@import` rules must precede all other statements in a stylesheet, so the font imports come before the Tailwind directives.

```css
@import "@fontsource/quicksand/400.css";
@import "@fontsource/quicksand/700.css";

@tailwind base;
@tailwind components;
@tailwind utilities;
```

- [ ] **Step 7: Import the stylesheet once, in `src/main.tsx`**

```tsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "@/App";
import "@/index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
```

- [ ] **Step 8: Verify nothing broke and the pipeline compiles end-to-end**

Run: `npm test`
Expected: all existing tests still pass (same pass count as before this task).

Run: `npx tsc --noEmit`
Expected: no errors.

Run: `npm run build`
Expected: build succeeds — this is what actually confirms the Tailwind/PostCSS/font pipeline compiles correctly (there's no unit-testable behavior in config files themselves).

- [ ] **Step 9: Commit**

```bash
git add package.json package-lock.json tailwind.config.cjs postcss.config.cjs src/index.css src/main.tsx
git commit -m "feat: install Tailwind CSS + Quicksand, define Storybook palette tokens"
```

---

### Task 2: PageShell layout wrapper

**Files:**
- Create: `src/components/PageShell.tsx`
- Test: `src/components/PageShell.test.tsx`

**Interfaces:**
- Consumes: `storybook-cream`/`storybook-ink`/`font-sans` tokens from Task 1.
- Produces: `PageShell({ children: ReactNode })` — consumed by Tasks 6-12 (every top-level screen).

- [ ] **Step 1: Write the failing test**

```tsx
import { render, screen } from "@testing-library/react";
import { PageShell } from "./PageShell";

describe("PageShell", () => {
  it("renders its children", () => {
    render(
      <PageShell>
        <p>Hello there</p>
      </PageShell>,
    );
    expect(screen.getByText("Hello there")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/PageShell.test.tsx`
Expected: FAIL — `Cannot find module './PageShell'`

- [ ] **Step 3: Implement**

```tsx
import type { ReactNode } from "react";

interface Props {
  children: ReactNode;
}

export function PageShell({ children }: Props) {
  return (
    <div className="min-h-screen bg-storybook-cream text-storybook-ink font-sans p-8">
      {children}
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/PageShell.test.tsx`
Expected: PASS (1 test)

- [ ] **Step 5: Commit**

```bash
git add src/components/PageShell.tsx src/components/PageShell.test.tsx
git commit -m "feat: add PageShell layout wrapper"
```

---

### Task 3: FocusableButton variant prop + shared focus treatment

**Files:**
- Modify: `src/components/FocusableButton.tsx`

**Interfaces:**
- Consumes: `storybook-gold` token from Task 1.
- Produces: `FocusableButton({ onPress, children, focusKey?, autoFocus?, variant?: "pill"|"card"|"grid", className? })` — the `variant`/`className` props are new; all existing props are unchanged. Consumed by every task from here on.

**Note on testing:** this change is purely cosmetic (className selection based on a new prop) — there's no new black-box behavior to assert (per this codebase's convention: test via role/text/`data-focused`, never class names). Passing an unrecognized prop wouldn't have failed the existing suite either way, so there's no legitimate RED step to manufacture here. The regression guard is simply re-running the existing suite after the change.

- [ ] **Step 1: Replace the full file content**

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
}: Props) {
  const { ref, focused, focusSelf } = useFocusable({ focusKey, onEnterPress: onPress });

  useEffect(() => {
    if (autoFocus) focusSelf();
  }, [autoFocus, focusSelf]);

  return (
    <button
      ref={ref}
      data-focused={focused}
      onClick={onPress}
      className={`border-none cursor-pointer transition-transform duration-150 ${VARIANT_CLASSES[variant]} ${className ?? ""}`}
    >
      {children}
    </button>
  );
}
```

- [ ] **Step 2: Run the existing suite to confirm no regressions**

Run: `npx vitest run src/components/FocusableButton.test.tsx`
Expected: PASS (4 tests — same as before this task; default `variant="pill"` means every existing usage renders exactly as it did behaviorally).

- [ ] **Step 3: Commit**

```bash
git add src/components/FocusableButton.tsx
git commit -m "feat: add pill/card/grid variants to FocusableButton"
```

---

### Task 4: Style EmojiPinKeypad (4x3 grid + PIN progress dots)

**Files:**
- Modify: `src/components/EmojiPinKeypad.tsx`

**Interfaces:**
- Consumes: `FocusableButton` `variant="grid"`/`variant="pill"` from Task 3; `storybook-lavender`/`storybook-peach`/`storybook-gold`/`storybook-tan` tokens from Task 1.

**Note on testing:** pure styling — no props, state, or callback behavior changes. One visual-content change: the "entered pin" area switches from echoing the actual tapped emoji to abstract progress dots (approved in the design spec, §5) — no test asserts on that area's content (confirmed by reading `EmojiPinKeypad.test.tsx`), so this is safe.

- [ ] **Step 1: Replace the full file content**

```tsx
import { useState } from "react";
import { FocusableButton } from "@/components/FocusableButton";

export const PIN_ICONS = ["🐱", "🐶", "🐰", "🐼", "⚡", "🌈", "🌟", "🌙", "🍕", "🍔", "🍩", "🍎"] as const;
export type PinIcon = (typeof PIN_ICONS)[number];
export const PIN_LENGTH = 4;

interface Props {
  onComplete: (pin: PinIcon[]) => void;
}

export function EmojiPinKeypad({ onComplete }: Props) {
  const [entered, setEntered] = useState<PinIcon[]>([]);

  const tap = (icon: PinIcon) => {
    if (entered.length >= PIN_LENGTH) return;
    setEntered([...entered, icon]);
  };

  const clear = () => setEntered([]);
  const done = () => {
    if (entered.length === PIN_LENGTH) onComplete(entered);
  };

  return (
    <div>
      <div role="group" aria-label="pin icons" className="grid grid-cols-4 gap-3 max-w-xs mb-4">
        {PIN_ICONS.map((icon, index) => (
          <FocusableButton
            key={icon}
            variant="grid"
            className="bg-storybook-lavender text-storybook-lavenderText"
            focusKey={`pin-icon-${icon}`}
            autoFocus={index === 0}
            onPress={() => tap(icon)}
          >
            {icon}
          </FocusableButton>
        ))}
      </div>
      <div aria-label="entered pin" className="flex gap-3 mb-4">
        {Array.from({ length: PIN_LENGTH }).map((_, i) => (
          <span
            key={i}
            className={`w-4 h-4 rounded-full ${i < entered.length ? "bg-storybook-gold" : "bg-storybook-tan"}`}
          />
        ))}
      </div>
      <div className="flex gap-3">
        <FocusableButton variant="pill" className="bg-storybook-peach text-storybook-peachText" onPress={clear}>
          Clear
        </FocusableButton>
        <FocusableButton variant="pill" className="bg-storybook-peach text-storybook-peachText" onPress={done}>
          Done
        </FocusableButton>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Run the existing suite to confirm no regressions**

Run: `npx vitest run src/components/EmojiPinKeypad.test.tsx`
Expected: PASS (7 tests)

- [ ] **Step 3: Commit**

```bash
git add src/components/EmojiPinKeypad.tsx
git commit -m "style: apply Storybook grid layout to EmojiPinKeypad"
```

---

### Task 5: Style AvatarPicker (same 4x3 grid pattern)

**Files:**
- Modify: `src/components/AvatarPicker.tsx`

**Interfaces:**
- Consumes: `FocusableButton` `variant="grid"` from Task 3; `storybook-mint` tokens from Task 1.

- [ ] **Step 1: Replace the full file content**

```tsx
import { FocusableButton } from "@/components/FocusableButton";

export const AVATARS = [
  "avatar_cat", "avatar_dog", "avatar_fox", "avatar_owl",
  "avatar_robot", "avatar_unicorn", "avatar_dragon", "avatar_dino",
  "avatar_panda", "avatar_lion", "avatar_bear", "avatar_frog",
] as const;

export type AvatarId = (typeof AVATARS)[number];

export const AVATAR_EMOJI: Record<AvatarId, string> = {
  avatar_cat: "🐱", avatar_dog: "🐶", avatar_fox: "🦊", avatar_owl: "🦉",
  avatar_robot: "🤖", avatar_unicorn: "🦄", avatar_dragon: "🐲", avatar_dino: "🦖",
  avatar_panda: "🐼", avatar_lion: "🦁", avatar_bear: "🐻", avatar_frog: "🐸",
};

export function avatarEmoji(id: string | null | undefined): string {
  if (!id) return "👤";
  return (AVATAR_EMOJI as Record<string, string>)[id] ?? "👤";
}

interface Props {
  onPick: (a: AvatarId) => void;
  selected?: AvatarId;
}

export function AvatarPicker({ onPick }: Props) {
  return (
    <div role="group" aria-label="avatars" className="grid grid-cols-4 gap-3 max-w-xs">
      {AVATARS.map((a, index) => (
        <FocusableButton
          key={a}
          variant="grid"
          className="bg-storybook-mint text-storybook-mintText"
          focusKey={`avatar-${a}`}
          autoFocus={index === 0}
          onPress={() => onPick(a)}
        >
          {AVATAR_EMOJI[a]}
        </FocusableButton>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Run the existing suite to confirm no regressions**

Run: `npx vitest run src/components/AvatarPicker.test.tsx`
Expected: PASS (6 tests)

- [ ] **Step 3: Commit**

```bash
git add src/components/AvatarPicker.tsx
git commit -m "style: apply Storybook grid layout to AvatarPicker"
```

---

### Task 6: Style JourneyMap (missions as a 3-column card grid)

**Files:**
- Modify: `src/screens/JourneyMap.tsx`

**Interfaces:**
- Consumes: `PageShell` from Task 2; `FocusableButton` `variant="card"` from Task 3; `storybook-mint` tokens from Task 1.

- [ ] **Step 1: Replace the full file content**

```tsx
import { FocusableButton } from "@/components/FocusableButton";
import { PageShell } from "@/components/PageShell";
import { useUiStore } from "@/store/uiStore";
import type { World, Mission } from "@/content/types";

interface Props {
  world: World;
  missions: Mission[];
}

export function JourneyMap({ world, missions }: Props) {
  const startMission = useUiStore((s) => s.startMission);
  return (
    <PageShell>
      <h1 className="text-3xl font-bold mb-6">{world.name}</h1>
      <ul className="grid grid-cols-3 gap-4 list-none p-0 m-0">
        {missions.map((mission, index) => (
          <li key={mission.id}>
            <FocusableButton
              variant="card"
              className="w-full bg-storybook-mint text-storybook-mintText"
              autoFocus={index === 0}
              onPress={() => startMission(mission.id)}
            >
              {mission.title}
            </FocusableButton>
          </li>
        ))}
      </ul>
    </PageShell>
  );
}
```

- [ ] **Step 2: Run the existing suite to confirm no regressions**

Run: `npx vitest run src/screens/JourneyMap.test.tsx`
Expected: PASS (3 tests)

- [ ] **Step 3: Commit**

```bash
git add src/screens/JourneyMap.tsx
git commit -m "style: apply Storybook card grid to JourneyMap"
```

---

### Task 7: Style MissionPlayer (activity card + bigger progress text)

**Files:**
- Modify: `src/screens/MissionPlayer.tsx`

**Interfaces:**
- Consumes: `PageShell` from Task 2; `FocusableButton` `variant="pill"` from Task 3; `storybook-lavender`/`storybook-peach` tokens from Task 1.

- [ ] **Step 1: Replace the full file content**

```tsx
import { useEffect, useState } from "react";
import { FocusableButton } from "@/components/FocusableButton";
import { PageShell } from "@/components/PageShell";
import { useUiStore } from "@/store/uiStore";
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
    if (activities.length === 0) goToReward();
  }, [activities, goToReward]);

  const onDone = () => {
    if (index + 1 >= activities.length) goToReward();
    else setIndex((i) => i + 1);
  };

  if (!activity) return null;

  return (
    <PageShell>
      <section aria-label={mission.title}>
        <p className="text-lg opacity-80 mb-4">
          Activity {index + 1} of {activities.length}
        </p>
        <div className="bg-storybook-lavender text-storybook-lavenderText rounded-2xl p-6 mb-6">
          <h2 className="text-2xl font-bold mb-2">{activity.title}</h2>
          {activity.type === "movement" && <p className="text-lg">{activity.instructions}</p>}
        </div>
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
      </section>
    </PageShell>
  );
}
```

- [ ] **Step 2: Run the existing suite to confirm no regressions**

Run: `npx vitest run src/screens/MissionPlayer.test.tsx`
Expected: PASS (5 tests)

- [ ] **Step 3: Commit**

```bash
git add src/screens/MissionPlayer.tsx
git commit -m "style: apply Storybook activity card to MissionPlayer"
```

---

### Task 8: Style RewardScreen

**Files:**
- Modify: `src/screens/RewardScreen.tsx`

**Interfaces:**
- Consumes: `PageShell` from Task 2; `FocusableButton` `variant="pill"` from Task 3; `storybook-peach` tokens from Task 1.

- [ ] **Step 1: Replace the full file content**

```tsx
import { FocusableButton } from "@/components/FocusableButton";
import { PageShell } from "@/components/PageShell";
import { useUiStore } from "@/store/uiStore";

interface Props {
  missionTitle: string;
}

export function RewardScreen({ missionTitle }: Props) {
  const goToMap = useUiStore((s) => s.goToMap);
  return (
    <PageShell>
      <section className="text-center">
        <h1 className="text-3xl font-bold mb-4">You did it!</h1>
        <p className="text-lg mb-8">{missionTitle} complete — you earned a star!</p>
        <FocusableButton variant="pill" className="bg-storybook-peach text-storybook-peachText" autoFocus onPress={goToMap}>
          Back to Map
        </FocusableButton>
      </section>
    </PageShell>
  );
}
```

- [ ] **Step 2: Run the existing suite to confirm no regressions**

Run: `npx vitest run src/screens/RewardScreen.test.tsx`
Expected: PASS (3 tests)

- [ ] **Step 3: Commit**

```bash
git add src/screens/RewardScreen.tsx
git commit -m "style: apply Storybook look to RewardScreen"
```

---

### Task 9: Style LoginScreen

**Files:**
- Modify: `src/screens/LoginScreen.tsx`

**Interfaces:**
- Consumes: `PageShell` from Task 2; `FocusableButton` `variant="pill"` from Task 3; already-styled `EmojiPinKeypad` from Task 4; `storybook-peach`/`storybook-lavender` tokens from Task 1.

- [ ] **Step 1: Replace the full file content**

```tsx
import { useState } from "react";
import { EmojiPinKeypad, type PinIcon } from "@/components/EmojiPinKeypad";
import { login } from "@/lib/auth";
import { FocusableButton } from "@/components/FocusableButton";
import { PageShell } from "@/components/PageShell";
import { useAuthStore } from "@/store/authStore";

export function LoginScreen() {
  const completeAuthFlow = useAuthStore((s) => s.completeAuthFlow);
  const setAuthScreen = useAuthStore((s) => s.setAuthScreen);
  const [username, setUsername] = useState("");
  const [error, setError] = useState<string | null>(null);

  const onPinDone = async (pin: PinIcon[]) => {
    try {
      await login(username, pin);
      completeAuthFlow();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    }
  };

  return (
    <PageShell>
      <h1 className="text-3xl font-bold mb-6">Welcome back!</h1>
      <input
        className="rounded-full px-5 py-3 mb-4 border-2 border-storybook-lavender bg-white text-storybook-ink"
        placeholder="Your silly name"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
      />
      {username.length >= 3 && <EmojiPinKeypad onComplete={onPinDone} />}
      {error && <p className="text-lg text-red-700 mb-4">{error}</p>}
      <div className="flex gap-3 mt-4">
        <FocusableButton variant="pill" className="bg-storybook-peach text-storybook-peachText" autoFocus onPress={() => setAuthScreen("signup")}>
          Make a new player
        </FocusableButton>
        <FocusableButton variant="pill" className="bg-storybook-lavender text-storybook-lavenderText" onPress={() => setAuthScreen("recovery")}>
          Forgot PIN?
        </FocusableButton>
      </div>
    </PageShell>
  );
}
```

- [ ] **Step 2: Run the existing suite to confirm no regressions**

Run: `npx vitest run src/screens/LoginScreen.test.tsx`
Expected: PASS (6 tests)

- [ ] **Step 3: Commit**

```bash
git add src/screens/LoginScreen.tsx
git commit -m "style: apply Storybook look to LoginScreen"
```

---

### Task 10: Style SignupWizard

**Files:**
- Modify: `src/screens/SignupWizard.tsx`

**Interfaces:**
- Consumes: `PageShell` from Task 2; `FocusableButton` variants from Task 3; already-styled `EmojiPinKeypad`/`AvatarPicker` from Tasks 4-5; `storybook-mint`/`storybook-peach`/`storybook-lavender` tokens from Task 1.

- [ ] **Step 1: Replace the full file content**

```tsx
import { useState } from "react";
import { EmojiPinKeypad, type PinIcon } from "@/components/EmojiPinKeypad";
import { AvatarPicker, type AvatarId } from "@/components/AvatarPicker";
import { containsProfanity } from "@/lib/profanity";
import { suggestUsernames } from "@/lib/usernameSuggestor";
import { signup, checkUsernameAvailable } from "@/lib/auth";
import { FocusableButton } from "@/components/FocusableButton";
import { PageShell } from "@/components/PageShell";
import { useAuthStore } from "@/store/authStore";

type Step = "username" | "pin" | "avatar" | "band" | "recovery";

export function SignupWizard() {
  const completeAuthFlow = useAuthStore((s) => s.completeAuthFlow);
  const [step, setStep] = useState<Step>("username");
  const [username, setUsername] = useState("");
  const [usernameError, setUsernameError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [pin, setPin] = useState<PinIcon[]>([]);
  const [avatar, setAvatar] = useState<AvatarId | null>(null);
  const [recoveryCode, setRecoveryCode] = useState<string | null>(null);

  const goUsername = async () => {
    if (username.length < 3) {
      setUsernameError("Pick at least 3 letters");
      return;
    }
    if (containsProfanity(username)) {
      setUsernameError("Try another name");
      setSuggestions(suggestUsernames(username, 3));
      return;
    }
    const ok = await checkUsernameAvailable(username);
    if (!ok) {
      setUsernameError("That name is already taken");
      setSuggestions(suggestUsernames(username, 3));
      return;
    }
    setUsernameError(null);
    setSuggestions([]);
    setStep("pin");
  };

  const goPinDone = (icons: PinIcon[]) => {
    setPin(icons);
    setStep("avatar");
  };

  const goAvatar = () => {
    if (avatar) setStep("band");
  };

  const goBand = async (band: "3-5" | "6-8") => {
    if (!avatar) return;
    const result = await signup({ username, pin, avatar, age_band: band });
    setRecoveryCode(result.recoveryCode);
    setStep("recovery");
  };

  if (step === "recovery" && recoveryCode) {
    return (
      <PageShell>
        <h2 className="text-2xl font-bold mb-2">Save this code!</h2>
        <p className="text-lg mb-4">Show it to a parent. If you forget your PIN, this gets you back in.</p>
        <div className="text-2xl font-bold bg-storybook-lavender text-storybook-lavenderText rounded-2xl p-4 mb-6 inline-block">
          {recoveryCode}
        </div>
        <div>
          <FocusableButton variant="pill" className="bg-storybook-peach text-storybook-peachText" autoFocus onPress={completeAuthFlow}>
            OK, got it
          </FocusableButton>
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell>
      {step === "username" && (
        <>
          <h2 className="text-2xl font-bold mb-4">Pick a silly name!</h2>
          <input
            className="rounded-full px-5 py-3 mb-4 border-2 border-storybook-lavender bg-white text-storybook-ink"
            placeholder="Your silly name"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
          {usernameError && <p className="text-lg text-red-700 mb-4">{usernameError}</p>}
          {suggestions.length > 0 && (
            <div className="flex gap-3 mb-4">
              {suggestions.map((s) => (
                <FocusableButton
                  key={s}
                  variant="pill"
                  className="bg-storybook-mint text-storybook-mintText"
                  onPress={() => { setUsername(s); setSuggestions([]); setUsernameError(null); }}
                >
                  {s}
                </FocusableButton>
              ))}
            </div>
          )}
          <FocusableButton variant="pill" className="bg-storybook-peach text-storybook-peachText" autoFocus onPress={goUsername}>
            Next
          </FocusableButton>
        </>
      )}
      {step === "pin" && (
        <>
          <h2 className="text-2xl font-bold mb-4">Pick 4 icons for your PIN</h2>
          <EmojiPinKeypad onComplete={goPinDone} />
        </>
      )}
      {step === "avatar" && (
        <>
          <h2 className="text-2xl font-bold mb-4">Pick your face!</h2>
          <AvatarPicker onPick={setAvatar} selected={avatar ?? undefined} />
          <FocusableButton variant="pill" className="bg-storybook-peach text-storybook-peachText mt-4" focusKey="avatar-next" onPress={goAvatar}>
            Next
          </FocusableButton>
        </>
      )}
      {step === "band" && (
        <>
          <h2 className="text-2xl font-bold mb-4">How old are you?</h2>
          <div className="flex gap-3">
            <FocusableButton variant="pill" className="bg-storybook-mint text-storybook-mintText" autoFocus onPress={() => goBand("3-5")}>
              3-5
            </FocusableButton>
            <FocusableButton variant="pill" className="bg-storybook-lavender text-storybook-lavenderText" onPress={() => goBand("6-8")}>
              6-8
            </FocusableButton>
          </div>
        </>
      )}
    </PageShell>
  );
}
```

- [ ] **Step 2: Run the existing suite to confirm no regressions**

Run: `npx vitest run src/screens/SignupWizard.test.tsx`
Expected: PASS (3 tests)

- [ ] **Step 3: Commit**

```bash
git add src/screens/SignupWizard.tsx
git commit -m "style: apply Storybook look to SignupWizard"
```

---

### Task 11: Style RecoveryScreen

**Files:**
- Modify: `src/screens/RecoveryScreen.tsx`

**Interfaces:**
- Consumes: `PageShell` from Task 2; `FocusableButton` `variant="pill"` from Task 3; already-styled `EmojiPinKeypad` from Task 4; `storybook-peach`/`storybook-lavender` tokens from Task 1.

- [ ] **Step 1: Replace the full file content**

```tsx
import { useState } from "react";
import { EmojiPinKeypad, type PinIcon } from "@/components/EmojiPinKeypad";
import { recoverPin } from "@/lib/auth";
import { FocusableButton } from "@/components/FocusableButton";
import { PageShell } from "@/components/PageShell";
import { useAuthStore } from "@/store/authStore";

type Stage = "creds" | "newpin" | "done";

export function RecoveryScreen() {
  const setAuthScreen = useAuthStore((s) => s.setAuthScreen);
  const [stage, setStage] = useState<Stage>("creds");
  const [username, setUsername] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [newRecovery, setNewRecovery] = useState<string | null>(null);

  const submitNewPin = async (pin: PinIcon[]) => {
    try {
      const result = await recoverPin(username, code, pin);
      setNewRecovery(result.recoveryCode);
      setStage("done");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Recovery failed");
      setStage("creds");
    }
  };

  if (stage === "creds") {
    return (
      <PageShell>
        <h1 className="text-3xl font-bold mb-6">Forgot your PIN?</h1>
        <input
          className="rounded-full px-5 py-3 mb-4 border-2 border-storybook-lavender bg-white text-storybook-ink block"
          placeholder="Your silly name"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />
        <input
          className="rounded-full px-5 py-3 mb-4 border-2 border-storybook-lavender bg-white text-storybook-ink block"
          placeholder="Recovery code (PURPLE-FROG-1234)"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
        />
        {error && <p className="text-lg text-red-700 mb-4">{error}</p>}
        <div className="flex gap-3">
          <FocusableButton variant="pill" className="bg-storybook-peach text-storybook-peachText" autoFocus onPress={() => setStage("newpin")}>
            Next
          </FocusableButton>
          <FocusableButton variant="pill" className="bg-storybook-lavender text-storybook-lavenderText" onPress={() => setAuthScreen("login")}>
            Back to login
          </FocusableButton>
        </div>
      </PageShell>
    );
  }
  if (stage === "newpin") {
    return (
      <PageShell>
        <h2 className="text-2xl font-bold mb-4">Pick a new PIN</h2>
        <EmojiPinKeypad onComplete={submitNewPin} />
        <FocusableButton variant="pill" className="bg-storybook-lavender text-storybook-lavenderText mt-4" onPress={() => setStage("creds")}>
          Back
        </FocusableButton>
      </PageShell>
    );
  }
  return (
    <PageShell>
      <h2 className="text-2xl font-bold mb-4">All set!</h2>
      <p className="text-lg mb-2">Your new recovery code:</p>
      <div className="text-2xl font-bold bg-storybook-lavender text-storybook-lavenderText rounded-2xl p-4 mb-4 inline-block">
        {newRecovery}
      </div>
      <p className="text-lg mb-6">Show this to a parent. The old code no longer works.</p>
      <div>
        <FocusableButton variant="pill" className="bg-storybook-peach text-storybook-peachText" autoFocus onPress={() => setAuthScreen("login")}>
          OK, log in
        </FocusableButton>
      </div>
    </PageShell>
  );
}
```

- [ ] **Step 2: Run the existing suite to confirm no regressions**

Run: `npx vitest run src/screens/RecoveryScreen.test.tsx`
Expected: PASS (3 tests)

- [ ] **Step 3: Commit**

```bash
git add src/screens/RecoveryScreen.tsx
git commit -m "style: apply Storybook look to RecoveryScreen"
```

---

### Task 12: Style ProfilePicker

**Files:**
- Modify: `src/screens/ProfilePicker.tsx`

**Interfaces:**
- Consumes: `PageShell` from Task 2; `FocusableButton` `variant="grid"`/`variant="pill"` from Task 3; already-styled `EmojiPinKeypad` from Task 4; `storybook-mint`/`storybook-peach` tokens from Task 1.

- [ ] **Step 1: Replace the full file content**

```tsx
import { useState } from "react";
import { EmojiPinKeypad, type PinIcon } from "@/components/EmojiPinKeypad";
import { avatarEmoji } from "@/components/AvatarPicker";
import { getKnownProfiles } from "@/lib/knownProfiles";
import { login } from "@/lib/auth";
import { FocusableButton } from "@/components/FocusableButton";
import { PageShell } from "@/components/PageShell";
import { useAuthStore } from "@/store/authStore";

export function ProfilePicker() {
  const completeAuthFlow = useAuthStore((s) => s.completeAuthFlow);
  const setAuthScreen = useAuthStore((s) => s.setAuthScreen);
  const [pickedUsername, setPickedUsername] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const profiles = getKnownProfiles();

  const onPinDone = async (pin: PinIcon[]) => {
    if (!pickedUsername) return;
    try {
      await login(pickedUsername, pin);
      completeAuthFlow();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    }
  };

  if (pickedUsername) {
    return (
      <PageShell>
        <h1 className="text-3xl font-bold mb-6">Hi, {pickedUsername}!</h1>
        <EmojiPinKeypad onComplete={onPinDone} />
        {error && <p className="text-lg text-red-700 mt-4">{error}</p>}
      </PageShell>
    );
  }

  return (
    <PageShell>
      <h1 className="text-3xl font-bold mb-6">Who's playing?</h1>
      <div role="group" aria-label="known profiles" className="grid grid-cols-4 gap-3 max-w-xs mb-6">
        {profiles.map((p, index) => (
          <FocusableButton
            key={p.profileId}
            variant="grid"
            className="bg-storybook-mint text-storybook-mintText"
            focusKey={`profile-${p.profileId}`}
            autoFocus={index === 0}
            onPress={() => setPickedUsername(p.username)}
          >
            {avatarEmoji(p.avatar)}
          </FocusableButton>
        ))}
      </div>
      <FocusableButton
        variant="pill"
        className="bg-storybook-peach text-storybook-peachText"
        autoFocus={profiles.length === 0}
        onPress={() => setAuthScreen("login")}
      >
        Use a different name
      </FocusableButton>
    </PageShell>
  );
}
```

- [ ] **Step 2: Run the existing suite to confirm no regressions**

Run: `npx vitest run src/screens/ProfilePicker.test.tsx`
Expected: PASS (4 tests)

- [ ] **Step 3: Commit**

```bash
git add src/screens/ProfilePicker.tsx
git commit -m "style: apply Storybook look to ProfilePicker"
```

---

### Task 13: Full-suite verification

**Files:** none (verification only — no code changes)

- [ ] **Step 1: Run the full test suite**

Run: `npm test`
Expected: PASS, zero failures. This also satisfies the test-suite verification that was deferred from the end of Plan 2.

- [ ] **Step 2: Run the type checker**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Run a production build**

Run: `npm run build`
Expected: build succeeds.

No commit for this task — it makes no file changes. (A manual `npm run dev` visual check in a browser is recommended as a human follow-up once this plan lands, since no automated tool in this plan can judge "does it actually look like Soft Storybook" — that's outside what a text-based implementer/reviewer can verify.)
