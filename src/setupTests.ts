import "@testing-library/jest-dom/vitest";

// Force the mock auth backend in every test run, regardless of whether a
// local .env with real Supabase credentials happens to exist on disk.
// A real .env (created for Task 16's live-database verification) once
// caused the full suite to silently hit the real network and write test
// fixture usernames into production -- this guarantees it can't recur.
vi.stubEnv("VITE_SUPABASE_URL", "");
vi.stubEnv("VITE_SUPABASE_ANON_KEY", "");
