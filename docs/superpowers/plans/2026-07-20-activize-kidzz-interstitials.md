# Activize Kidzz — Interstitials (Plan 6) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace every existing "spinner" (or missing loading feedback) with a looping micro-exercise interstitial that appears after ~300ms of pending and dismisses with a brief "Ready!" flash, across five async gates: the boot-time content load, and the three currently-silent auth network calls (login, signup, PIN recovery).

**Architecture:** A single `InterstitialPlayer` (no props) is mounted once at the top of `App.tsx`, reading a global `interstitialStore`'s `pending` flag — never a per-screen local prop, because in 4 of the 5 gates the async call *succeeding* also triggers a navigation/step change that would otherwise unmount a locally-scoped player before its "Ready!" flash could complete. A `useInterstitial(pending, opts)` hook owns the actual delay/flash timing state machine; interstitial content itself is a small bundle of hardcoded activities (not CDN-fetched), since it must be available before any fetch resolves and during auth screens that render before content loading even starts.

**Tech Stack:** No new dependencies. Existing Vite + React + TS + Vitest + Zustand stack.

## Global Constraints

- Interstitial content (`content/interstitialActivities.ts`) is bundled directly in code, never fetched or parsed through `schema.ts` — see spec §2 for why.
- `InterstitialPlayer` takes **no props** — it reads `useInterstitialStore` itself. Every call site only ever calls `setPending`/`reset`, never renders the player directly (it's mounted exactly once, in `App.tsx`).
- `ExercisePlayer` is deliberately not reused for interstitials — its entire purpose is the gate-timer + validate-button flow, which directly contradicts this spec's "effort-neutral, no parent validation" rule.
- All new async-timing tests use real timers with tiny (or, for `InterstitialPlayer`, the real 300ms/400ms default) delays and generous `waitFor` timeouts — no fake timers, matching this codebase's established precedent (fake timers + `waitFor` are known to deadlock here).
- A known, accepted edge case: if `useContent`'s fetch fails (not just succeeds) after the interstitial has already started showing, the "Ready!" flash still displays briefly before the error screen — the interstitial's pending signal is `content.status === "loading"`, not success-specific. Not fixed in this plan; harmless in practice.
- Full `npm test` + `npx tsc --noEmit` + `npm run build` verification runs at the end (Task 9).

---

### Task 1: Interstitial content bundle

**Files:**
- Create: `src/content/interstitialActivities.ts`
- Create: `src/content/interstitialActivities.test.ts`

**Interfaces:**
- Produces: `interstitialActivities: (MovementActivity | BreathingActivity)[]` — consumed by Task 2 (`useInterstitial`).

- [ ] **Step 1: Write the failing tests**

```typescript
import { interstitialActivities } from "./interstitialActivities";

describe("interstitialActivities", () => {
  it("has at least 3 bundled activities", () => {
    expect(interstitialActivities.length).toBeGreaterThanOrEqual(3);
  });

  it("gives every activity a unique id", () => {
    const ids = interstitialActivities.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("only uses renderer kinds the registry actually handles", () => {
    const validRenderers = ["rive", "lottie", "video", "react"];
    for (const activity of interstitialActivities) {
      expect(validRenderers).toContain(activity.renderer);
    }
  });

  it("only uses movement or breathing types", () => {
    for (const activity of interstitialActivities) {
      expect(["movement", "breathing"]).toContain(activity.type);
    }
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/content/interstitialActivities.test.ts`
Expected: FAIL — `Cannot find module './interstitialActivities'`

- [ ] **Step 3: Implement `src/content/interstitialActivities.ts`**

```typescript
import type { MovementActivity, BreathingActivity } from "./types";

// Bundled directly in code (not CDN-fetched) -- this content must be
// available before any content fetch resolves (it covers the
// content-fetch async gate itself) and during auth screens, which render
// before useContent ever mounts.
export const interstitialActivities: (MovementActivity | BreathingActivity)[] = [
  {
    id: "interstitial-follow-dot",
    type: "movement",
    title: "Follow the Dot",
    ageBands: ["3-5", "6-8"],
    narration: "",
    renderer: "react",
    asset: "follow-dot",
    pacing: { reps: 1, tempoMs: 1000 },
    instructions: "Follow the dot with your eyes!",
  },
  {
    id: "interstitial-palm-switch",
    type: "movement",
    title: "Palm Switches",
    ageBands: ["3-5", "6-8"],
    narration: "",
    renderer: "react",
    asset: "palm-switch",
    pacing: { reps: 1, tempoMs: 1000 },
    instructions: "Switch your palms up and down!",
  },
  {
    id: "interstitial-belly-breath",
    type: "breathing",
    title: "Belly Breaths",
    ageBands: ["3-5", "6-8"],
    narration: "",
    renderer: "react",
    asset: "belly-breath",
    cycles: 1,
  },
];
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/content/interstitialActivities.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add src/content/interstitialActivities.ts src/content/interstitialActivities.test.ts
git commit -m "feat: add bundled interstitial activity content"
```

---

### Task 2: `useInterstitial` timing hook

**Files:**
- Create: `src/lib/useInterstitial.ts`
- Create: `src/lib/useInterstitial.test.ts`

**Interfaces:**
- Consumes: `interstitialActivities` (Task 1).
- Produces: `useInterstitial(pending: boolean, opts?: { delayMs?: number; readyFlashMs?: number }): InterstitialResult` where `InterstitialResult = { state: "hidden" } | { state: "showing"; activity: MovementActivity | BreathingActivity } | { state: "ready" }` — consumed by Task 4 (`InterstitialPlayer`).

- [ ] **Step 1: Write the failing tests**

```typescript
import { renderHook, waitFor } from "@testing-library/react";
import { useInterstitial } from "./useInterstitial";
import { interstitialActivities } from "@/content/interstitialActivities";

describe("useInterstitial", () => {
  it("starts hidden", () => {
    const { result } = renderHook(() => useInterstitial(false, { delayMs: 10, readyFlashMs: 10 }));
    expect(result.current.state).toBe("hidden");
  });

  it("stays hidden throughout a fast resolve (pending flips false before delayMs)", async () => {
    const { result, rerender } = renderHook(
      ({ pending }) => useInterstitial(pending, { delayMs: 50, readyFlashMs: 10 }),
      { initialProps: { pending: true } },
    );
    rerender({ pending: false });
    await new Promise((resolve) => setTimeout(resolve, 80)); // outlive the delay window
    expect(result.current.state).toBe("hidden");
  });

  it("shows after delayMs elapses while still pending", async () => {
    const { result } = renderHook(() => useInterstitial(true, { delayMs: 10, readyFlashMs: 10 }));
    await waitFor(() => expect(result.current.state).toBe("showing"));
    const current = result.current;
    expect(current.state).toBe("showing");
    if (current.state !== "showing") throw new Error("unreachable");
    expect(interstitialActivities.map((a) => a.id)).toContain(current.activity.id);
  });

  it("flashes ready then hides once pending resolves after showing", async () => {
    const { result, rerender } = renderHook(
      ({ pending }) => useInterstitial(pending, { delayMs: 10, readyFlashMs: 10 }),
      { initialProps: { pending: true } },
    );
    await waitFor(() => expect(result.current.state).toBe("showing"));
    rerender({ pending: false });
    await waitFor(() => expect(result.current.state).toBe("ready"));
    await waitFor(() => expect(result.current.state).toBe("hidden"));
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/lib/useInterstitial.test.ts`
Expected: FAIL — `Cannot find module './useInterstitial'`

- [ ] **Step 3: Implement `src/lib/useInterstitial.ts`**

```typescript
import { useEffect, useState } from "react";
import { interstitialActivities } from "@/content/interstitialActivities";
import type { MovementActivity, BreathingActivity } from "@/content/types";

export type InterstitialResult =
  | { state: "hidden" }
  | { state: "showing"; activity: MovementActivity | BreathingActivity }
  | { state: "ready" };

function pickRandomActivity(): MovementActivity | BreathingActivity {
  return interstitialActivities[Math.floor(Math.random() * interstitialActivities.length)];
}

export function useInterstitial(
  pending: boolean,
  opts?: { delayMs?: number; readyFlashMs?: number },
): InterstitialResult {
  const delayMs = opts?.delayMs ?? 300;
  const readyFlashMs = opts?.readyFlashMs ?? 400;
  const [state, setState] = useState<"hidden" | "showing" | "ready">("hidden");
  const [activity, setActivity] = useState<MovementActivity | BreathingActivity | null>(null);

  useEffect(() => {
    if (pending) {
      const timer = setTimeout(() => {
        setActivity(pickRandomActivity());
        setState("showing");
      }, delayMs);
      return () => clearTimeout(timer);
    }
    setState((current) => (current === "showing" ? "ready" : current));
  }, [pending, delayMs]);

  useEffect(() => {
    if (state !== "ready") return;
    const timer = setTimeout(() => setState("hidden"), readyFlashMs);
    return () => clearTimeout(timer);
  }, [state, readyFlashMs]);

  if (state === "showing") return { state, activity: activity as MovementActivity | BreathingActivity };
  if (state === "ready") return { state: "ready" };
  return { state: "hidden" };
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/lib/useInterstitial.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/useInterstitial.ts src/lib/useInterstitial.test.ts
git commit -m "feat: add useInterstitial timing hook"
```

---

### Task 3: `interstitialStore` (global pending state)

**Files:**
- Create: `src/store/interstitialStore.ts`
- Create: `src/store/interstitialStore.test.ts`

**Interfaces:**
- Produces: `useInterstitialStore` — `{ pending: boolean; setPending: (pending: boolean) => void; reset: () => void }` — consumed by Task 4 (`InterstitialPlayer`) and Tasks 5–8 (each async gate).

- [ ] **Step 1: Write the failing tests**

```typescript
import { useInterstitialStore } from "./interstitialStore";

describe("useInterstitialStore", () => {
  afterEach(() => useInterstitialStore.getState().reset());

  it("starts with pending false", () => {
    expect(useInterstitialStore.getState().pending).toBe(false);
  });

  it("setPending updates the flag", () => {
    useInterstitialStore.getState().setPending(true);
    expect(useInterstitialStore.getState().pending).toBe(true);
  });

  it("reset returns pending to false", () => {
    useInterstitialStore.getState().setPending(true);
    useInterstitialStore.getState().reset();
    expect(useInterstitialStore.getState().pending).toBe(false);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/store/interstitialStore.test.ts`
Expected: FAIL — `Cannot find module './interstitialStore'`

- [ ] **Step 3: Implement `src/store/interstitialStore.ts`**

```typescript
import { create } from "zustand";

interface InterstitialStoreState {
  pending: boolean;
  setPending: (pending: boolean) => void;
  reset: () => void;
}

export const useInterstitialStore = create<InterstitialStoreState>((set) => ({
  pending: false,
  setPending: (pending) => set({ pending }),
  reset: () => set({ pending: false }),
}));
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/store/interstitialStore.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add src/store/interstitialStore.ts src/store/interstitialStore.test.ts
git commit -m "feat: add global interstitialStore"
```

---

### Task 4: `InterstitialPlayer` component

**Files:**
- Create: `src/components/InterstitialPlayer.tsx`
- Create: `src/components/InterstitialPlayer.test.tsx`

**Interfaces:**
- Consumes: `useInterstitial` (Task 2), `useInterstitialStore` (Task 3), `rendererRegistry` (existing).
- Produces: `InterstitialPlayer` (no props) — consumed by Task 5 (`App.tsx`).

- [ ] **Step 1: Write the failing tests**

```tsx
import { render, screen, waitFor } from "@testing-library/react";
import { InterstitialPlayer } from "./InterstitialPlayer";
import { useInterstitialStore } from "@/store/interstitialStore";

describe("InterstitialPlayer", () => {
  afterEach(() => useInterstitialStore.getState().reset());

  it("renders nothing while not pending", () => {
    render(<InterstitialPlayer />);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("shows a loading overlay once pending outlasts the default delay", async () => {
    render(<InterstitialPlayer />);
    useInterstitialStore.getState().setPending(true);
    await waitFor(() => expect(screen.getByRole("status", { name: /loading/i })).toBeInTheDocument(), { timeout: 1000 });
  });

  it("shows a Ready! flash after pending resolves, then hides", async () => {
    render(<InterstitialPlayer />);
    useInterstitialStore.getState().setPending(true);
    await waitFor(() => expect(screen.getByRole("status", { name: /loading/i })).toBeInTheDocument(), { timeout: 1000 });
    useInterstitialStore.getState().setPending(false);
    await waitFor(() => expect(screen.getByRole("status", { name: /ready/i })).toBeInTheDocument());
    await waitFor(() => expect(screen.queryByRole("status")).not.toBeInTheDocument(), { timeout: 1000 });
  }, 10000);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/components/InterstitialPlayer.test.tsx`
Expected: FAIL — `Cannot find module './InterstitialPlayer'`

- [ ] **Step 3: Implement `src/components/InterstitialPlayer.tsx`**

```tsx
import { useInterstitial } from "@/lib/useInterstitial";
import { useInterstitialStore } from "@/store/interstitialStore";
import { rendererRegistry } from "@/content/rendererRegistry";

export function InterstitialPlayer() {
  const pending = useInterstitialStore((s) => s.pending);
  const result = useInterstitial(pending);

  if (result.state === "hidden") return null;

  if (result.state === "ready") {
    return (
      <div role="status" aria-label="Ready" className="fixed inset-0 z-50 flex items-center justify-center bg-storybook-cream">
        <p className="text-2xl font-bold">Ready!</p>
      </div>
    );
  }

  const Renderer = rendererRegistry[result.activity.renderer];

  return (
    <div role="status" aria-label="Loading" className="fixed inset-0 z-50 flex items-center justify-center bg-storybook-cream">
      <Renderer activity={result.activity} />
    </div>
  );
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/components/InterstitialPlayer.test.tsx`
Expected: PASS (3 tests, takes ~1.5s real wall-clock time due to the real 300ms/400ms default delays — this is intentional, matching the actual production timing)

- [ ] **Step 5: Commit**

```bash
git add src/components/InterstitialPlayer.tsx src/components/InterstitialPlayer.test.tsx
git commit -m "feat: add InterstitialPlayer component"
```

---

### Task 5: Wire into `App.tsx` (boot load)

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/App.e2e.test.tsx`

**Interfaces:**
- Consumes: `InterstitialPlayer` (Task 4), `useInterstitialStore` (Task 3).

- [ ] **Step 1: Replace `src/App.tsx`'s full content**

```tsx
import { useEffect, type ReactNode } from "react";
import { initNavigation } from "@/navigation/initNavigation";
import { useContent } from "@/content/useContent";
import { useUiStore } from "@/store/uiStore";
import { useAuthStore } from "@/store/authStore";
import { useInterstitialStore } from "@/store/interstitialStore";
import { InterstitialPlayer } from "@/components/InterstitialPlayer";
import { JourneyMap } from "@/screens/JourneyMap";
import { MissionPlayer } from "@/screens/MissionPlayer";
import { RewardScreen } from "@/screens/RewardScreen";
import { TrophyShelf } from "@/screens/TrophyShelf";
import { ProfilePicker } from "@/screens/ProfilePicker";
import { LoginScreen } from "@/screens/LoginScreen";
import { SignupWizard } from "@/screens/SignupWizard";
import { RecoveryScreen } from "@/screens/RecoveryScreen";
import { FocusableButton } from "@/components/FocusableButton";

export default function App() {
  useEffect(() => initNavigation(), []);
  const authScreen = useAuthStore((s) => s.authScreen);

  let screen: ReactNode;
  if (authScreen === "profilePicker") screen = <ProfilePicker />;
  else if (authScreen === "login") screen = <LoginScreen />;
  else if (authScreen === "signup") screen = <SignupWizard />;
  else if (authScreen === "recovery") screen = <RecoveryScreen />;
  else screen = <MainApp />;

  return (
    <>
      <InterstitialPlayer />
      {screen}
    </>
  );
}

function MainApp() {
  const content = useContent();
  const screen = useUiStore((s) => s.screen);
  const activeMissionId = useUiStore((s) => s.activeMissionId);

  useEffect(() => {
    useInterstitialStore.getState().setPending(content.status === "loading");
  }, [content.status]);

  if (content.status === "loading") return null;
  if (content.status === "error" || !content.world) {
    return (
      <div>
        <p>Let's try again</p>
        <FocusableButton autoFocus onPress={content.retry}>
          Retry
        </FocusableButton>
      </div>
    );
  }

  const activeMission = content.missions.find((m) => m.id === activeMissionId) ?? null;

  if (screen === "mission" && activeMission) {
    return (
      <MissionPlayer
        mission={activeMission}
        activities={content.activitiesByMission[activeMission.id] ?? []}
        badges={content.badges}
        worldId={content.world.id}
        totalMissionsInWorld={content.world.missionIds.length}
      />
    );
  }
  if (screen === "reward") {
    return <RewardScreen missionTitle={activeMission?.title ?? "Today's mission"} badges={content.badges} />;
  }
  if (screen === "trophyShelf") {
    return <TrophyShelf badges={content.badges} />;
  }
  return <JourneyMap world={content.world} missions={content.missions} />;
}
```

- [ ] **Step 2: Add the interstitial-store reset and a new "no flash on fast load" test to `src/App.e2e.test.tsx`**

Add the import (alongside the other imports at the top):

```tsx
import { useInterstitialStore } from "@/store/interstitialStore";
```

Add one line to the existing `beforeEach`:

Before:
```tsx
beforeEach(() => {
  useUiStore.getState().goToMap();
  useProgressStore.getState().reset();
  window.localStorage.clear();
```
After:
```tsx
beforeEach(() => {
  useUiStore.getState().goToMap();
  useProgressStore.getState().reset();
  useInterstitialStore.getState().reset();
  window.localStorage.clear();
```

Add this new test inside `describe("App end-to-end", ...)`, anywhere among the other tests:

```tsx
  it("does not show an interstitial when content loads faster than the delay threshold", async () => {
    render(<App />);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    await waitFor(() => expect(screen.getByText(/jungle jump/i)).toBeInTheDocument());
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });
```

- [ ] **Step 3: Run the e2e suite to verify it passes**

Run: `npx vitest run src/App.e2e.test.tsx`
Expected: PASS (6 tests — the original 5 plus 1 new)

- [ ] **Step 4: Commit**

```bash
git add src/App.tsx src/App.e2e.test.tsx
git commit -m "feat: show boot-load interstitial via global InterstitialPlayer"
```

---

### Task 6: Wire into `LoginScreen`

**Files:**
- Modify: `src/screens/LoginScreen.tsx`
- Modify: `src/screens/LoginScreen.test.tsx`

**Interfaces:**
- Consumes: `useInterstitialStore` (Task 3).

- [ ] **Step 1: Add the interstitial-store reset and a new pending-flag test to `src/screens/LoginScreen.test.tsx`**

Add these two imports (alongside the existing ones at the top):

```tsx
import { useInterstitialStore } from "@/store/interstitialStore";
import { backend } from "@/services/backend";
```

Add one line to the existing `beforeEach`:

Before:
```tsx
beforeEach(async () => {
  mockBackend.reset();
  useAuthStore.getState().logout();
```
After:
```tsx
beforeEach(async () => {
  mockBackend.reset();
  useAuthStore.getState().logout();
  useInterstitialStore.getState().reset();
```

Add this new test at the end of the `describe("LoginScreen", ...)` block:

```tsx
  it("sets the interstitial pending flag while logging in, and clears it after", async () => {
    const loginSpy = vi.spyOn(backend, "login").mockImplementationOnce(
      (username, pin) => new Promise((resolve, reject) => {
        setTimeout(() => mockBackend.login(username, pin).then(resolve, reject), 50);
      }),
    );
    const user = userEvent.setup();
    render(<LoginScreen />);
    await user.type(screen.getByPlaceholderText(/silly name/i), "SpeedyOtter");
    await user.click(screen.getByRole("button", { name: PIN_ICONS[0] }));
    await user.click(screen.getByRole("button", { name: PIN_ICONS[1] }));
    await user.click(screen.getByRole("button", { name: PIN_ICONS[2] }));
    await user.click(screen.getByRole("button", { name: PIN_ICONS[3] }));
    await user.click(screen.getByRole("button", { name: /done/i }));

    await waitFor(() => expect(useInterstitialStore.getState().pending).toBe(true));
    await waitFor(() => expect(useInterstitialStore.getState().pending).toBe(false));
    loginSpy.mockRestore();
  });
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/screens/LoginScreen.test.tsx`
Expected: FAIL — the new test times out waiting for `pending` to become `true` (`LoginScreen` never sets it); the original 6 tests still pass.

- [ ] **Step 3: Implement the wiring in `src/screens/LoginScreen.tsx`** — replace the file's full content:

```tsx
import { useState } from "react";
import { EmojiPinKeypad, type PinIcon } from "@/components/EmojiPinKeypad";
import { login } from "@/lib/auth";
import { FocusableButton } from "@/components/FocusableButton";
import { PageShell } from "@/components/PageShell";
import { useAuthStore } from "@/store/authStore";
import { useInterstitialStore } from "@/store/interstitialStore";

export function LoginScreen() {
  const completeAuthFlow = useAuthStore((s) => s.completeAuthFlow);
  const setAuthScreen = useAuthStore((s) => s.setAuthScreen);
  const [username, setUsername] = useState("");
  const [error, setError] = useState<string | null>(null);

  const onPinDone = async (pin: PinIcon[]) => {
    useInterstitialStore.getState().setPending(true);
    try {
      await login(username, pin);
      completeAuthFlow();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      useInterstitialStore.getState().setPending(false);
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

- [ ] **Step 4: Run to verify all tests pass**

Run: `npx vitest run src/screens/LoginScreen.test.tsx`
Expected: PASS (7 tests)

- [ ] **Step 5: Commit**

```bash
git add src/screens/LoginScreen.tsx src/screens/LoginScreen.test.tsx
git commit -m "feat: set interstitial pending flag during login"
```

---

### Task 7: Wire into `SignupWizard`

**Files:**
- Modify: `src/screens/SignupWizard.tsx`
- Modify: `src/screens/SignupWizard.test.tsx`

**Interfaces:**
- Consumes: `useInterstitialStore` (Task 3).

- [ ] **Step 1: Add the interstitial-store reset and a new pending-flag test to `src/screens/SignupWizard.test.tsx`**

Add these two imports:

```tsx
import { useInterstitialStore } from "@/store/interstitialStore";
import { backend } from "@/services/backend";
```

Add one line to the existing `beforeEach`:

Before:
```tsx
beforeEach(() => {
  mockBackend.reset();
  useAuthStore.getState().logout();
  useAuthStore.getState().setAuthScreen("signup");
});
```
After:
```tsx
beforeEach(() => {
  mockBackend.reset();
  useAuthStore.getState().logout();
  useAuthStore.getState().setAuthScreen("signup");
  useInterstitialStore.getState().reset();
});
```

Add this new test at the end of the `describe("SignupWizard", ...)` block:

```tsx
  it("sets the interstitial pending flag while checking username availability, and clears it after", async () => {
    const checkSpy = vi.spyOn(backend, "checkUsernameAvailable").mockImplementationOnce(
      (username) => new Promise((resolve, reject) => {
        setTimeout(() => mockBackend.checkUsernameAvailable(username).then(resolve, reject), 50);
      }),
    );
    const user = userEvent.setup();
    render(<SignupWizard />);
    await user.type(screen.getByPlaceholderText(/silly name/i), "SpeedyOtter");
    await user.click(screen.getByRole("button", { name: /next/i }));

    await waitFor(() => expect(useInterstitialStore.getState().pending).toBe(true));
    await waitFor(() => expect(useInterstitialStore.getState().pending).toBe(false));
    checkSpy.mockRestore();
  });
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/screens/SignupWizard.test.tsx`
Expected: FAIL — the new test times out waiting for `pending` to become `true`; the original 3 tests still pass.

- [ ] **Step 3: Implement the wiring in `src/screens/SignupWizard.tsx`**

Add the import (alongside the existing ones):

```tsx
import { useInterstitialStore } from "@/store/interstitialStore";
```

Replace `goUsername`:

Before:
```tsx
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
```
After:
```tsx
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
    useInterstitialStore.getState().setPending(true);
    try {
      const ok = await checkUsernameAvailable(username);
      if (!ok) {
        setUsernameError("That name is already taken");
        setSuggestions(suggestUsernames(username, 3));
        return;
      }
      setUsernameError(null);
      setSuggestions([]);
      setStep("pin");
    } finally {
      useInterstitialStore.getState().setPending(false);
    }
  };
```

Replace `goBand`:

Before:
```tsx
  const goBand = async (band: "3-5" | "6-8") => {
    if (!avatar) return;
    const result = await signup({ username, pin, avatar, age_band: band });
    setRecoveryCode(result.recoveryCode);
    setStep("recovery");
  };
```
After:
```tsx
  const goBand = async (band: "3-5" | "6-8") => {
    if (!avatar) return;
    useInterstitialStore.getState().setPending(true);
    try {
      const result = await signup({ username, pin, avatar, age_band: band });
      setRecoveryCode(result.recoveryCode);
      setStep("recovery");
    } finally {
      useInterstitialStore.getState().setPending(false);
    }
  };
```

- [ ] **Step 4: Run to verify all tests pass**

Run: `npx vitest run src/screens/SignupWizard.test.tsx`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add src/screens/SignupWizard.tsx src/screens/SignupWizard.test.tsx
git commit -m "feat: set interstitial pending flag during signup"
```

---

### Task 8: Wire into `RecoveryScreen`

**Files:**
- Modify: `src/screens/RecoveryScreen.tsx`
- Modify: `src/screens/RecoveryScreen.test.tsx`

**Interfaces:**
- Consumes: `useInterstitialStore` (Task 3).

- [ ] **Step 1: Add the interstitial-store reset and a new pending-flag test to `src/screens/RecoveryScreen.test.tsx`**

Add these two imports:

```tsx
import { useInterstitialStore } from "@/store/interstitialStore";
import { backend } from "@/services/backend";
```

Add one line to the existing `beforeEach`:

Before:
```tsx
  beforeEach(async () => {
    mockBackend.reset();
    useAuthStore.getState().logout();
    useAuthStore.getState().setAuthScreen("recovery");
```
After:
```tsx
  beforeEach(async () => {
    mockBackend.reset();
    useAuthStore.getState().logout();
    useAuthStore.getState().setAuthScreen("recovery");
    useInterstitialStore.getState().reset();
```

Add this new test at the end of the `describe("RecoveryScreen", ...)` block:

```tsx
  it("sets the interstitial pending flag while recovering the PIN, and clears it after", async () => {
    const recoverSpy = vi.spyOn(backend, "recoverPin").mockImplementationOnce(
      (username, code, pin) => new Promise((resolve, reject) => {
        setTimeout(() => mockBackend.recoverPin(username, code, pin).then(resolve, reject), 50);
      }),
    );
    const user = userEvent.setup();
    render(<RecoveryScreen />);
    await user.type(screen.getByPlaceholderText(/silly name/i), "SpeedyOtter");
    await user.type(screen.getByPlaceholderText(/recovery code/i), recoveryCode);
    await user.click(screen.getByRole("button", { name: /next/i }));

    await waitFor(() => expect(screen.getByRole("button", { name: PIN_ICONS[0] })).toBeInTheDocument());
    await user.click(screen.getByRole("button", { name: PIN_ICONS[4] }));
    await user.click(screen.getByRole("button", { name: PIN_ICONS[5] }));
    await user.click(screen.getByRole("button", { name: PIN_ICONS[6] }));
    await user.click(screen.getByRole("button", { name: PIN_ICONS[7] }));
    await user.click(screen.getByRole("button", { name: /done/i }));

    await waitFor(() => expect(useInterstitialStore.getState().pending).toBe(true));
    await waitFor(() => expect(useInterstitialStore.getState().pending).toBe(false));
    recoverSpy.mockRestore();
  });
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/screens/RecoveryScreen.test.tsx`
Expected: FAIL — the new test times out waiting for `pending` to become `true`; the original 3 tests still pass.

- [ ] **Step 3: Implement the wiring in `src/screens/RecoveryScreen.tsx`**

Add the import (alongside the existing ones):

```tsx
import { useInterstitialStore } from "@/store/interstitialStore";
```

Replace `submitNewPin`:

Before:
```tsx
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
```
After:
```tsx
  const submitNewPin = async (pin: PinIcon[]) => {
    useInterstitialStore.getState().setPending(true);
    try {
      const result = await recoverPin(username, code, pin);
      setNewRecovery(result.recoveryCode);
      setStage("done");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Recovery failed");
      setStage("creds");
    } finally {
      useInterstitialStore.getState().setPending(false);
    }
  };
```

- [ ] **Step 4: Run to verify all tests pass**

Run: `npx vitest run src/screens/RecoveryScreen.test.tsx`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add src/screens/RecoveryScreen.tsx src/screens/RecoveryScreen.test.tsx
git commit -m "feat: set interstitial pending flag during PIN recovery"
```

---

### Task 9: Full-suite verification

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
