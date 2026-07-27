# Activize Kidzz — Session Handoff

> Read this once at the start of a new session to get full context. It replaces re-deriving history from memory/transcripts. Repo: `C:\Repos\activize-kidzz` (GitHub: `dieontime/activize-kidzz`).

## What this is

Personal kids' brain-activation TV app. Primary age band 6–8 (3–5 later). Runs in a **TV browser** (Fire TV Silk / WebOS / Tizen), **D-pad remote only**, **parent-driven & parent-validated**, no camera. Deploys to the user's personal Netlify (never actually deployed yet — still a gap). Architected so a future clinical ("Tier C") pivot is reachable without rework.

**Stack:** Vite + React + TS (static SPA), Rive via a pluggable `ExercisePlayer` (renderer is data-driven: `rive`/`lottie`/`video`/`react`), Supabase for mutable state only, Zustand, Zod, `@noriginmedia/norigin-spatial-navigation`. Content is fully data-driven (worlds/missions/activities/badges = JSON + assets under `public/content/`; three code registries: renderer/puzzle/badge-rule).

**Master spec:** `docs/superpowers/specs/2026-07-14-activize-kidzz-design.md` — the living design doc; several open items get resolved in-place as later plans close them (search for `~~...~~` strikethroughs).

## Standing conventions — dos and don'ts

- **Never run `git commit` or `git push` yourself.** Stage with `git add` (explicit paths, never `-A`), then print the exact command for the user to run. Never assume "go ahead"/"fix it" means commit — only an explicit "commit this"/"push it" does.
- **Commit cadence: ONE commit per plan**, given only after ALL tasks are complete and fully verified (tests + tsc + build). Do not commit after each task. This has been the default since Plan 6.
- **Don't verify a commit landed** (`git log`/`git status`) after the user says "commited"/"done". Trust it and move straight to the next step. This was an explicit, repeated user correction — resist the reflex especially at skill-to-skill handoff points (e.g. spec-committed → invoking writing-plans).
- **Commands printed for the user** to run manually get **no** `cd`/`-C` path prefix — they keep a terminal open at `C:\Repos\activize-kidzz` already.
- **The agent's own Bash tool calls always need the path**: `cd C:\Repos\activize-kidzz && ...` or `git -C C:\Repos\activize-kidzz ...`, on every single call, with zero exceptions — this matters especially in *other* sessions/repos where cwd can silently reset between turns. (Not applicable if this new session's cwd is natively `activize-kidzz` throughout — but check before assuming.)
- **Every plan gets a real named feature branch** (`planN-<topic>`), even under inline execution — merged and deleted via `finishing-a-development-branch` at the end.
- **Full skill cycle for every new plan:** `superpowers:brainstorming` → `superpowers:writing-plans` → `superpowers:executing-plans` (user has chosen Inline Execution every time so far — always ask, never assume) → `superpowers:finishing-a-development-branch`.
- **Never assume which backlog item comes next** — ask the user, framed as an `AskUserQuestion` with the live backlog as options (done before every plan since Plan 7).
- **Trust real code/tests over memory** — this doc is a snapshot; verify against current files before asserting behavior as fact, especially for anything more than a session or two old.

## Plans complete (1–12) — all merged to `main`, pushed to GitHub

1. **Foundation** — Vite/React/TS scaffold, base architecture.
2. **Auth** — custom `profiles` table + `SECURITY DEFINER` RPCs (signup/login/recover/check-username), `useAuthStore`, ProfilePicker/Login/Signup/Recovery screens.
3. **Frontend design pass ("Soft Storybook")** — Tailwind v4 + Quicksand, `PageShell`, `FocusableButton` variants, first palette.
4. **Persistence** — `progressStore` + mock/Supabase backend switch, `lib/progress.ts` (`loadProgress`/`recordMissionCompletion`), streak math, JourneyMap daily-gate lock states.
5. **Renderers** — `rendererRegistry` (react/lottie/video/rive → real `ReactRenderer` + shared `PlaceholderRenderer`), `ExercisePlayer` gate-timer mechanic.
6. **Rewards engine** — `badgeRuleRegistry` (streak/world_complete/missions_total), `lib/badges.ts`, Trophy Shelf screen.
7. **Interstitials** — no-spinner loading UX for boot + 3 auth network calls, global `interstitialStore` + single `InterstitialPlayer` mounted at `App.tsx` top.
8. **Rive renderer plumbing** — real `@rive-app/react-canvas` dependency, `RiveRenderer.tsx` (expects `/content/rive/<asset>.riv`, falls back to `PlaceholderRenderer` on load error), wired into `rendererRegistry.rive`. **Plumbing only — no real `.riv` file has ever existed in this repo, no activity JSON uses `renderer:"rive"`.**
9. **Sequence-memory puzzle** — first real puzzle mechanic, `useSequenceMemory` Simon-says hook, `puzzleTypeRegistry`, `PuzzlePlayer`.
10. **Richer starter content** — `world-jungle` expanded 1→10 missions, 17 new activity JSON files (movement/breathing/puzzle mix).
11. **Narration playback** — Web Speech API only (no mp3, deviates from master spec's stated primary path), button-triggered only (no auto-play), `NarrationButton` wired into `MissionPlayer` only. `narration` field's meaning changed from "mp3 filename" to literal spoken text across all 18 activity files.
12. **Bold Illustrated theme refresh ("Jungle Canopy")** — repointed all `storybook-*` token hex values (zero renames), pure-CSS art (leaves/vines/fireflies in `PageShell`) and pure-CSS motion (no framer-motion), winding zig-zag Journey Map path. Final palette lives in `src/index.css`'s `@theme` block.
13. **Progress-write resilience + age-band filtering + content licensing** — localStorage retry queue for failed writes (`activize:pendingProgress:<profileId>`, replayed from `loadProgress` on next launch), `useContent.ts` filters each mission's activities by `profile.age_band`, master spec §14's content-licensing item closed (no risk found — generic movement patterns + generic emoji).

245/245 tests passing, tsc clean, build clean, as of the last push (commit `61bb841`).

## Plan 13 — IN PROGRESS: real art (Rive → pivoted to Lottie)

**Spec'd, planned, approved. Execution started, mid-Task-1.** Feature branch `plan13-lottie-renderer` exists and is checked out (plain branch in the main working directory — no separate git worktree, matching every prior plan's pattern; confirmed via `using-git-worktrees` skill this session).

- `lottiefiles-creator` MCP (npx `@lottiefiles/creator-mcp`) confirmed working end-to-end this session: registered in project-scope `.mcp.json` (moved there from local-scope via `claude mcp add lottiefiles-creator -s project -- npx -y @lottiefiles/creator-mcp@latest`), tools `get_rules`/`get_api_doc`/`run_script` all confirmed callable and used.
- Pre-flight investigation against the **live** API (not assumptions) found: multi-scene/precomposition works via `Scene.createSceneLayer`; **no scripted export method exists** — export is a manual Creator-browser-UI action (File → Export → Lottie JSON), confirmed by reading all 4 pages of `get_api_doc`. This is baked into the plan as a hard manual checkpoint in Task 3.
- Design spec: `docs/superpowers/specs/2026-07-27-activize-kidzz-lottie-renderer-design.md` (committed `c13a542`). Scope, per user's explicit choice: **one real asset only** (not a broader conversion pass) — `activity-balloon-breathing`, chosen because its balloon metaphor maps directly to a simple `Ellipse` + keyframed size/color, no character rigging needed.
- Implementation plan: `docs/superpowers/plans/2026-07-27-activize-kidzz-lottie-renderer.md`. 4 tasks: (1) `LottieRenderer.tsx` + global `lottie-react` mock in `setupTests.ts` (mirrors Plan 7's `@rive-app/react-canvas` safety-net pattern exactly) + TDD tests, (2) `rendererRegistry` wiring, (3) script the balloon scene via `run_script` **then stop for the manual export checkpoint**, (4) flip `activity-balloon-breathing.json`'s `renderer` to `"lottie"` + full verification (`npm test` + `tsc --noEmit` + `npm run build`) + the plan's one single commit.
- User chose **Inline Execution** (via `executing-plans`, not `subagent-driven-development`) — consistent with every prior plan.
- Baseline confirmed clean this session: 245/245 tests passing on `plan13-lottie-renderer` before any Task-1 code was written.

### Immediate next step for the new session

Resume at Task 1, Step 1 of `docs/superpowers/plans/2026-07-27-activize-kidzz-lottie-renderer.md` (`npm install lottie-react`). Follow the plan's steps in order — it's fully self-contained (exact code for every step, including the Task 3 `run_script` script). Remember Task 3's manual checkpoint: after scripting the scene, stop and ask the user to export from the Creator browser tab before continuing to Task 4. Remember the repo's commit convention: **one commit for the whole plan**, at the very end of Task 4 only — do not commit after Tasks 1-3.

## Open backlog (not yet sequenced into any plan)

- `recordMissionCompletion` never touches `progress.world` — no code path to ever advance to a second world if one gets added (deliberately deferred multiple times, single-world by design so far).
- Pre-recorded mp3 narration (master spec's stated primary path) — Web Speech API only was chosen instead; mp3 never built.
- No double-submit guard on auth screens during a pending network call.
- No concurrency guard on overlapping mission-completion calls.
- Never actually deployed to Netlify — the real target host has never been exercised this entire build.
- Never tested on a real TV browser/D-pad device (Fire TV Silk/WebOS/Tizen) — only desktop Chrome + jsdom throughout.
- `npm audit`: 5 vulnerabilities (1 critical, 1 high) flagged after Plan 7's `@rive-app/react-canvas` install — unexamined.

## Repo/account quirks worth knowing

- Git identity for this repo: `user.email=mail.daion.paul@gmail.com`, `user.name=Daion Paul` (personal, not Sonatus work email).
- `gh` CLI on this machine authenticates as the Sonatus work account (`daionpaul`) — **different** from `dieontime` (this repo's GitHub owner). A push 403 here was previously fixed via `git credential reject` for `host=github.com` to force a fresh login.
- Supabase CLI is installed, authenticated, linked to project ref `cdyycgyyekykxpkkfysn` (`ACTIVE_HEALTHY`) — `supabase db push` works directly.
- Ledger at `.superpowers/sdd/progress.md` is stale past Plan 3 (Plans 4+ all used Inline Execution, not SDD) — don't rely on it for anything after Plan 3.
