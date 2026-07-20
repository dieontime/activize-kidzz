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

## 4. `InterstitialPlayer` Component

`src/components/InterstitialPlayer.tsx`, props `{ pending: boolean }`:

- Calls `useInterstitial(pending)` internally — callers only ever pass a `pending` boolean, never touch the hook or its timing directly.
- `"hidden"` → renders `null`.
- `"showing"` → a fixed-position, full-viewport overlay rendering the picked interstitial activity via `rendererRegistry[activity.renderer]` directly (no `FocusableButton`, no gate timer — `ExercisePlayer` is deliberately not reused here, since its entire purpose is the gate+validate-button flow this spec's "effort-neutral" rule explicitly rules out).
- `"ready"` → same overlay, showing a brief "Ready!" message instead of the loop.

## 5. Wiring Into the Five Gates

- **`App.tsx` boot load**: `MainApp` calls `useInterstitial(content.status === "loading")` directly (not through the component) and renders `<InterstitialPlayer pending={content.status === "loading"} />` whenever that hook's state isn't `"hidden"` — checked *before* the `content.status === "error"` branch. This keeps the interstitial mounted through its own "ready" flash even after `content.status` has already flipped to `"ready"`, which a naive `if (content.status === "loading") return ...` early-return could not do (it would stop being reached the instant status changes). This is the one gate where the interstitial fully replaces the screen — there's no underlying content yet to overlay.
- **`LoginScreen`**: new `const [isPending, setIsPending] = useState(false)`, set `true`/`false` around the `login(...)` call in `onPinDone` via `try/finally` (existing `try/catch` error handling unchanged). Renders `<InterstitialPlayer pending={isPending} />` as an overlay sibling inside `PageShell`.
- **`SignupWizard`**: one shared `isPending` state covers both `checkUsernameAvailable(...)` (in `goUsername`) and `signup(...)` (in `goBand`) — the two are never in flight simultaneously in this wizard's flow. Same overlay pattern.
- **`RecoveryScreen`**: `isPending` around `recoverPin(...)` in `submitNewPin`. Same pattern.

## 6. Testing

- **`useInterstitial`**: table-driven, real timers with tiny `delayMs`/`readyFlashMs` overrides. A fast resolve (pending flips false before `delayMs`) stays `"hidden"` throughout. A slow-resolving pending crosses into `"showing"`, then `"ready"` on resolve, then back to `"hidden"` after the flash window.
- **`InterstitialPlayer`**: renders nothing while hidden; renders the looping activity content while showing; renders "Ready!" during the flash state.
- **`interstitialActivities`**: a sanity test that every bundled entry is a valid `MovementActivity`/`BreathingActivity` shape with a renderer the registry actually handles.
- **Each auth screen**: a test using a deliberately slow-resolving mock of the relevant `lib/auth` function (with a tiny `delayMs` override passed through) confirming the interstitial appears mid-flight and clears after; existing error-path tests stay unchanged.
- **`App.e2e.test.tsx`**: since that file's `useContent` fetch mock resolves near-instantly, the boot interstitial's 300ms default delay means it should *not* appear in the existing e2e run — add a quick assertion that boot proceeds straight to the map without the interstitial ever showing, confirming "no flash on fast loads" holds for the one gate already covered by e2e.
