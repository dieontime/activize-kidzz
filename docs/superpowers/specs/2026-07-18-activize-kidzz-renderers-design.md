# Activize Kidzz — Renderers (Plan 4)

## 1. Goal

Implement the pluggable exercise renderer the master spec already designed (§5, §9): a `rendererRegistry` mapping each Movement/Breathing activity's `renderer` field (`"rive"|"lottie"|"video"|"react"`) to a component, plus the demo → mimic → parent-validates flow (spec §3). Currently `MissionPlayer` just shows plain instruction text and an always-enabled Done button — no renderer swapping, no gating.

**Explicitly out of scope:** Puzzle activities (separate registry, separate interaction model — a different plan). Real Lottie/video/Rive implementations — only `"react"` gets real content this plan; the other three renderer kinds resolve to one shared placeholder (mirrors Plan 3's schema-only `earned_badges`). No new dependencies installed.

## 2. Architecture

- `src/content/rendererRegistry.ts` — `Record<Renderer, ComponentType<{ activity: MovementActivity | BreathingActivity }>>`. `"react"` → `ReactRenderer`; `"lottie"|"video"|"rive"` → one shared `PlaceholderRenderer`.
- `src/components/renderers/ReactRenderer.tsx` — real content. Movement: shows `instructions` with a looping CSS animation for `pacing.reps` reps at `pacing.tempoMs` tempo. Breathing: a looping expand/contract animation for `cycles` cycles.
- `src/components/renderers/PlaceholderRenderer.tsx` — static "more to come" visual, same props shape (interchangeable with `ReactRenderer`).
- `src/components/ExercisePlayer.tsx` — new. Owns the gate timer and the "We did it!" button. Computes gate duration: movement = `pacing.reps * pacing.tempoMs`; breathing = `cycles * BREATH_CYCLE_MS` (new exported constant, `4000`). Looks up the renderer via the registry, renders it inside the existing lavender card styling, and renders one `FocusableButton` below it (`autoFocus`, always focusable so the D-pad cursor is never stranded; `disabled={!ready}` until the gate timer fires).
- `FocusableButton` gains one new optional prop: `disabled?: boolean` (default `false` — zero behavior change for all existing call sites). While `true`: still focusable/`autoFocus`-able, but `onEnterPress`/`onClick` are no-ops.
- `MissionPlayer.tsx`: keeps its title heading, progress text, and `key={activity.id}`-based remount/refocus pattern. For `activity.type` `"movement"` or `"breathing"`, renders `<ExercisePlayer key={activity.id} activity={activity} onValidated={onDone} />` (which now owns the card + button entirely). For any other type (`"puzzle"` — no content exists yet) keeps today's plain fallback unchanged, still labeled "Done" — a deliberate, temporary inconsistency with the new "We did it!" label, since puzzles get their own overhaul later.

## 3. Testing

- `rendererRegistry.test.ts`: `"react"` → `ReactRenderer`; `"lottie"/"video"/"rive"` → `PlaceholderRenderer`.
- `ExercisePlayer.test.tsx` (fake timers): button starts disabled, enables after the computed duration for both movement and breathing; correct renderer renders per `activity.renderer`; `onValidated` fires on press once enabled.
- `FocusableButton.test.tsx`: new tests for `disabled` (stays focusable, no-ops `onPress` while disabled, fires once re-enabled); all existing tests remain valid unchanged (default `false`).
- `MissionPlayer.test.tsx`: existing `/done/i` button assertions for the movement fixture renamed to `/we did it/i`; new tests confirming the button is initially disabled and the mission can't be completed before the gate elapses.
