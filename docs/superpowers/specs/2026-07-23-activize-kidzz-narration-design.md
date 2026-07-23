# Narration Playback (Plan 10) — Design Spec

## 1. Goal

Every activity JSON already carries a `narration` field, and the master spec calls voice narration "essential" for the primary 6–8 age tier — but nothing in the app has ever read it aloud. This plan adds a button-triggered, Web-Speech-API-only narration path, scoped to the per-activity screen inside `MissionPlayer`.

## 2. Explicit Deviation From the Master Spec

The master spec (`2026-07-14-activize-kidzz-design.md`, §5) states pre-recorded mp3 is the *primary* narration path and Web Speech API is a *dev-only fallback*, because TV-browser TTS is considered unreliable for production. No audio files exist anywhere in this repo (no `assets/audio` directory, nothing sourced or recorded).

For this plan, the user explicitly chose **Web Speech API only** — no mp3 playback, no audio asset pipeline. This ships a working narration experience today with zero external assets, at the cost of TTS voice quality/reliability on some TV browsers. Real mp3 playback remains a future candidate if TTS proves inadequate on a real device (this build has never been tested on a real TV browser — a pre-existing, separately tracked gap).

## 3. Content Model Change

`narration` changes meaning from "mp3 filename" to "the literal line to speak aloud."

- Before: `"narration": "cross-crawl.mp3"`
- After: `"narration": "Let's do a cross crawl! Touch your right hand to your left knee, then switch."`

No schema change: `narration: z.string()` in `src/content/schema.ts` is already unconstrained (no filename/extension format check). All 18 activity files under `public/content/activities/` get their `narration` value rewritten with real, simple, child-safe spoken copy matching each activity's actual instructions/theme. `src/content/__fixtures__/*` (the automated-test-only fixture set) is left untouched, matching the precedent set in Plan 9 — fixtures are a separate, minimal set that doesn't need to track real content conventions.

## 4. Architecture

**Single integration point, not duplicated per activity type.** `MissionPlayer.tsx` already holds `activity: Activity` in scope regardless of whether it renders `ExercisePlayer` or `PuzzlePlayer` — `activity.narration` and `activity.title` are available on every variant via `ActivityBase`. A single `NarrationButton` is rendered once in `MissionPlayer`, next to the activity title, rather than being wired separately into `ExercisePlayer` and `PuzzlePlayer`.

### `src/components/NarrationButton.tsx` (new)

```tsx
interface Props {
  text: string;
}

export function NarrationButton({ text }: Props) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) {
    return null;
  }

  const speak = () => {
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(new SpeechSynthesisUtterance(text));
  };

  return (
    <FocusableButton onPress={speak} variant="pill">
      🔊 Read it
    </FocusableButton>
  );
}
```

- Feature-detected: on a browser/engine without `speechSynthesis` (some older TV browser stacks), the button renders nothing at all — no dead control a kid can press with zero effect.
- `cancel()` before every `speak()` call means repeated presses restart cleanly instead of queuing/stacking overlapping utterances — the only state-machine behavior this needs, so no dedicated hook (unlike `useInterstitial`/`useSequenceMemory`) is warranted for something this small.
- Default voice, default pitch, rate ~0.9 (slightly slower than natural, no UI to change it, no persistence) — hardcoded, revisit only if real-device testing shows it's wrong.

### `src/screens/MissionPlayer.tsx` (modified)

Add `<NarrationButton text={activity.narration} />` next to the existing `<h2>{activity.title}</h2>`. No changes to `ExercisePlayer` or `PuzzlePlayer`.

## 5. Testing

`window.speechSynthesis` and `SpeechSynthesisUtterance` don't exist under jsdom. A global mock is added to `src/setupTests.ts` (same established pattern as the existing Rive `useRive` global mock from Plan 7), so every test that transitively renders `MissionPlayer` continues to work without individually mocking speech:

```ts
Object.defineProperty(window, "speechSynthesis", {
  writable: true,
  value: { speak: vi.fn(), cancel: vi.fn() },
});
window.SpeechSynthesisUtterance = vi.fn().mockImplementation((text: string) => ({ text }));
```

- `NarrationButton.test.tsx`: pressing the button calls `speechSynthesis.speak` with an utterance carrying the given `text`; a second press calls `cancel()` before `speak()` again; when `speechSynthesis` is deliberately removed from `window` for one test, the component renders nothing.
- `MissionPlayer.test.tsx`: extended with one test confirming a "🔊 Read it" button is present for an activity and pressing it triggers `speechSynthesis.speak` — an integration-level check, not re-testing `NarrationButton`'s internals.

## 6. Non-Goals (explicitly out of scope for this plan)

- Pre-recorded mp3 playback (the master spec's stated primary path) — deferred; would need a real audio-asset pipeline this build doesn't have.
- Auto-play on activity mount — button-triggered only, an explicit user choice (also sidesteps browser autoplay-policy restrictions some engines place on `speechSynthesis` without a user gesture).
- Mute toggle, voice/rate/pitch settings UI, or any per-profile persistence of narration preferences.
- Narration anywhere outside the per-activity screen — no `JourneyMap`, `RewardScreen`, or auth-screen narration.
- Real TV-browser/D-pad device verification of actual TTS quality — this build has never run on real TV hardware (pre-existing, separately tracked backlog item).
