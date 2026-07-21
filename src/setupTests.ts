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
