import "@testing-library/jest-dom/vitest";

// Force the mock auth backend in every test run, regardless of whether a
// local .env with real Supabase credentials happens to exist on disk.
// A real .env (created for Task 16's live-database verification) once
// caused the full suite to silently hit the real network and write test
// fixture usernames into production -- this guarantees it can't recur.
vi.stubEnv("VITE_SUPABASE_URL", "");
vi.stubEnv("VITE_SUPABASE_ANON_KEY", "");

// @rive-app/react-canvas touches canvas/WASM APIs jsdom doesn't provide.
// Mocking it globally means every test that transitively imports
// rendererRegistry.ts (ExercisePlayer, MissionPlayer, App.e2e) only ever
// sees this safe no-op default -- RiveRenderer.test.tsx customizes this
// same mock instance per-test via vi.mocked(useRive), it does not
// register a second, competing vi.mock for the same module.
vi.mock("@rive-app/react-canvas", () => ({
  useRive: vi.fn(() => ({ RiveComponent: () => null })),
}));

// Web Speech API (speechSynthesis) doesn't exist under jsdom. This global
// default mirrors the @rive-app/react-canvas mock above: every test that
// renders NarrationButton/MissionPlayer sees this safe no-op unless it
// deliberately overrides window.speechSynthesis itself (see
// NarrationButton.test.tsx's "unavailable" case).
Object.defineProperty(window, "speechSynthesis", {
  writable: true,
  configurable: true,
  value: { speak: vi.fn(), cancel: vi.fn() } as unknown as SpeechSynthesis,
});
window.SpeechSynthesisUtterance = vi
  .fn()
  .mockImplementation((text: string) => ({ text })) as unknown as typeof SpeechSynthesisUtterance;
