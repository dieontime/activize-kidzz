# Activize Kidzz — Interstitials (Plan 6)

## 1. Goal

Implement the master spec's "no spinners" loading rule (§9a): whenever an async gate is pending longer than ~300ms, a looping micro-exercise interstitial shows instead of a spinner or blank text, dismissing with a brief "Ready!" flash once the gate resolves.

**Explicitly in scope:** the one existing spinner-equivalent (`App.tsx`'s boot-time `<p>Getting ready…</p>` while `useContent` loads) plus the three auth-flow network calls that currently have zero loading-state feedback at all (`LoginScreen`'s `login`, `SignupWizard`'s `checkUsernameAvailable`/`signup`, `RecoveryScreen`'s `recoverPin`) — five async gates total.

**Explicitly out of scope:** real Rive art / `@rive-app` integration (no `.riv` assets or dependency exist yet — deferred to its own future plan, same deferral pattern as Plan 4's renderer placeholders). Loading states for anything not listed above (e.g. hypothetical future per-mission asset loads). Double-submit guarding during the pending window (e.g. mashing D-pad Enter on "Next" while `checkUsernameAvailable` is in flight) — a pre-existing gap unrelated to whether a visual interstitial is shown, not introduced or required by this plan.

## 2. Interstitial Content

Interstitial content is bundled directly in code, not fetched from the CDN — two reasons: the boot-load interstitial exists to cover the very fetch that would otherwise supply this content (a circular dependency if it were itself fetched), and the auth screens (`LoginScreen`/`SignupWizard`/`RecoveryScreen`) render *before* `useContent` ever mounts (they're siblings of `MainApp` in `App.tsx`, gated on `authScreen`, not children of it), so CDN content isn't available during login/signup at all.

- `src/content/interstitialActivities.ts`: a small static array (3–4) of `MovementActivity`/`BreathingActivity`-shaped objects (reusing the existing `Activity` type from `content/types.ts`), e.g. "Follow the Dot," "Palm Switches," "Belly Breaths." All `renderer: "react"`. These bypass `schema.ts`/`parseActivity` entirely — they're plain TS objects, never JSON, never validated, never fetched. A comment at the top of the file states the rationale above.

## 3. `useInterstitial` Timing Hook

`src/lib/useInterstitial.ts`:

```ts
export type InterstitialState = "hidden" | "showing" | "ready";

export function useInterstitial(
  pending: boolean,
  opts?: { delayMs?: number; readyFlashMs?: number },
): InterstitialState
```

- Defaults: `delayMs = 300`, `readyFlashMs = 400` — both overridable so tests can pass tiny values and use real timers (the proven pattern from `ExercisePlayer`/`MissionPlayer` in this codebase; fake timers + `waitFor` are known to deadlock here).
- State machine: `pending` true for longer than `delayMs` → `"showing"`. `pending` flips false while `"showing"` → `"ready"` for `readyFlashMs`, then `"hidden"`. `pending` flips false *before* `delayMs` elapses (fast load) → stays `"hidden"` for the whole cycle, no flash ever shown — the ready-flash is only earned once the interstitial actually appeared (spec's "no flash on fast loads" rule).
- Picks one interstitial activity at random from the bundle each time it transitions into `"showing"` (not on every render).

## 4. Global Pending State + `InterstitialPlayer` Component

**Why global, not local:** in 4 of the 5 gates, the async call *succeeding* also triggers a navigation/step change that unmounts whatever component would be holding a locally-scoped `InterstitialPlayer` in the very same tick the pending flag flips to `false` — `LoginScreen`'s `login()` success swaps `App.tsx` straight to `<MainApp/>`; `SignupWizard`'s `signup()` success moves `step` to `"recovery"`, a different early-return branch; `RecoveryScreen`'s `recoverPin()` success moves `stage` to `"done"`, likewise a different branch; and `App.tsx`'s own boot load has the analogous problem with its `content.status === "loading"` early return. In every one of these cases a locally-scoped player would never get to show its "Ready!" flash — the subtree holding it disappears before the flash timer can complete. Mounting one player at a fixed point that never unmounts, driven by global state, sidesteps this uniformly.

- `src/store/interstitialStore.ts`: `useInterstitialStore` — `{ pending: boolean; setPending: (p: boolean) => void }`, matching the existing `uiStore`/`progressStore`/`authStore` pattern.
- `src/components/InterstitialPlayer.tsx`: **no props** — reads `useInterstitialStore((s) => s.pending)` itself and calls `useInterstitial(pending)` internally.
  - `"hidden"` → renders `null`.
  - `"showing"` → a fixed-position, full-viewport overlay rendering the picked interstitial activity via `rendererRegistry[activity.renderer]` directly (no `FocusableButton`, no gate timer — `ExercisePlayer` is deliberately not reused here, since its entire purpose is the gate+validate-button flow this spec's "effort-neutral" rule explicitly rules out).
  - `"ready"` → same overlay, showing a brief "Ready!" message instead of the loop.
- Mounted **exactly once**, at the very top of `App.tsx`'s outer `App` function — above the `authScreen`-gated branching, as a sibling of whichever screen is currently rendered — so it persists across every screen transition in the app, auth or otherwise.

## 5. Wiring Into the Five Gates

- **`App.tsx` boot load**: `MainApp` gets a `useEffect` syncing `content.status === "loading"` into `useInterstitialStore.getState().setPending(...)` whenever `content.status` changes.
- **`LoginScreen`**: `useInterstitialStore.getState().setPending(true/false)` around the `login(...)` call in `onPinDone` via `try/finally` (existing `try/catch` error handling unchanged).
- **`SignupWizard`**: the same store calls wrap both `checkUsernameAvailable(...)` (in `goUsername`) and `signup(...)` (in `goBand`) — the two are never in flight simultaneously in this wizard's flow.
- **`RecoveryScreen`**: the same store calls wrap `recoverPin(...)` in `submitNewPin`.
- None of the four screen-level call sites render `InterstitialPlayer` themselves anymore — they only ever call `setPending`.

## 6. Testing

- **`useInterstitial`**: table-driven, real timers with tiny `delayMs`/`readyFlashMs` overrides. A fast resolve (pending flips false before `delayMs`) stays `"hidden"` throughout. A slow-resolving pending crosses into `"showing"`, then `"ready"` on resolve, then back to `"hidden"` after the flash window.
- **`InterstitialPlayer`**: driven by setting `useInterstitialStore`'s `pending` directly (it's a global store, not a prop) — renders nothing while hidden; renders the looping activity content while showing; renders "Ready!" during the flash state.
- **`interstitialActivities`**: a sanity test that every bundled entry is a valid `MovementActivity`/`BreathingActivity` shape with a renderer the registry actually handles.
- **Each auth screen**: a test using a deliberately slow-resolving mock of the relevant `backend` method (mirroring the `vi.spyOn(progressBackend, ...)` pattern already used in `lib/badges.test.ts`) confirming `useInterstitialStore`'s `pending` flag is set during the call and cleared after; existing error-path tests stay unchanged.
- **`App.e2e.test.tsx`**: since that file's `useContent` fetch mock resolves near-instantly, the boot interstitial's 300ms default delay means it should *not* appear in the existing e2e run — add a quick assertion that boot proceeds straight to the map without the interstitial ever showing, confirming "no flash on fast loads" holds for the one gate already covered by e2e.
