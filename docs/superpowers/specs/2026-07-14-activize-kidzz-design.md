# Activize Kidzz — Design Spec

| | |
|---|---|
| **Status** | Draft — awaiting user review |
| **Date** | 2026-07-14 |
| **Author** | Daion Paul (with Claude) |
| **Repo** | `C:\Repos\activize-kidzz` |

---

## 1. Overview

A fun, daily "brain-activation" app for children — movement + cognitive micro-exercises framed as a game journey. Aimed at kids who are hyperactive, have trouble settling/sleeping, or struggle with short-term recall. A child completes a short daily "mission" of paced physical mimicry exercises and light puzzles; a parent is present to support, monitor, and validate.

**Deployment reality:** runs in a **browser on a TV** (Smart-TV built-in browser / Fire TV Silk / WebOS / Tizen), controlled by a **D-pad remote**, with the **parent driving** primarily. Deployed to the author's personal **Netlify** account.

**Product stance:** ships now as a **personal app (Tier A)** — a handful of families, no app store. Architected so a future **clinical/therapeutic pivot (Tier C)** is reachable without re-architecture. No clinical machinery, no health claims are built now.

## 2. Target Users & Constraints

- **Primary age tier: 6–8** (early readers). Simple words + voice narration, 2-step instructions, ~7-minute sessions.
- **Secondary tier (future): 3–5** (pre-readers). Kept in mind; enabled later purely by adding age-tagged content, no architecture change.
- **Parent is a first-class participant** — supports, monitors, and validates each activity. Not a bystander.
- **Device:** TV browser, 10-foot UI, viewed from across the room. Target the *weakest* common browser engine (Fire TV Silk).
- **Input:** D-pad remote only — arrows + OK + back. No touch, no pointer, no hover. Focus/spatial navigation throughout. Assume basic remotes without a pointer.
- **Consequences:** large text, voice narration essential, light bundle, GPU-friendly 2D animation (no 3D), no keyboard-dependent flows in daily use.

## 3. Core Product Loop — the Daily Mission

**One day = one ~7-minute mission of 5 activities:**

1. **Wake-up move** (1) — cross-lateral warm-up (e.g. cross-crawl, palm switches).
2. **Body moves** (2) — bilateral / gross-motor mimicry.
3. **Brain puzzle** (1) — memory sequence or simple riddle.
4. **Calm-down** (1) — breathing / stretch.
5. **Reward screen** — badge + star, advance one step on the journey map, update streak.

**Per-activity flow:** animated character **demonstrates** (paced so the child can follow) → child **mimics** → **parent presses OK to validate** → next. The app never watches the child (no camera). Interactivity comes from the child physically moving + parent-in-the-loop confirmation.

## 4. Gamification

- **Linear journey map** (Candy Crush-style winding path). Each completed daily mission = **one step forward**.
- **Themed worlds** every ~6 steps (Jungle → Space → Ocean → …).
- **Rewards:** daily badge + star on completion; **streaks** (3-day, 7-day); **world-completion** trophy badges shown on a **Trophy Shelf**.
- **Design rule — no failure, no losing.** Progress is **effort-based, not performance-based**. Showing up and doing the activities advances the map. A wrong puzzle answer = gentle retry with a hint, never a game-over. (Failure states train avoidance — the opposite of the goal for hyperactive/anxious kids.)

## 5. Architecture & Stack

- **Vite + React + TypeScript**, static SPA → **Netlify**.
- **Rive** for exercise animations, wrapped in a **pluggable `ExercisePlayer`**: each activity's `renderer` is data (`"rive" | "lottie" | "video" | "react"`), so early activities can ship as Lottie/video and upgrade to Rive without app changes.
- **3D (Three.js) ruled out** — production cost of rigged 3D + stutter risk on TV-stick browsers. Depth faked with 2.5D/CSS layering if desired.
- **Supabase** (Postgres + Auth + RLS) — **mutable per-user state only**. Client talks directly via `supabase-js`; no serverless functions yet.
- **Static content** (mission/exercise JSON, `.riv`, narration audio, badge art) on **Netlify/CDN**, never in the DB.
- **Spatial navigation** library (`@noriginmedia/norigin-spatial-navigation` or LRUD) for D-pad focus.
- **Narration:** pre-recorded mp3 per instruction (primary); Web Speech API only as a dev fallback (TV-browser TTS unreliable).
- **State:** Zustand. **Testing:** Vitest + React Testing Library (black-box).

## 6. Screen Map & Navigation (10-foot UI, D-pad, parent drives)

```
Boot
 ├─ Profile Picker (cached avatars on this TV)  ← daily entry, no typing
 │    └─ Emoji PIN  → Home
 ├─ Login (username + emoji PIN)                ← cold / new TV
 ├─ Signup Wizard (username→pin→avatar→age_band→recovery code)  [parent-gated]
 └─ Recovery (username + recovery code → new PIN)

Home = Journey Map
 └─ "Start Today's Mission" (focused by default)
      └─ Mission Player  → 5 activities in sequence
           • MovementActivity (ExercisePlayer: demo → child mimics → parent OK → next)
           • PuzzleActivity   (memory / riddle; gentle retry, never game-over)
           • BreathingActivity (calm-down)
           └─ Reward Screen (badge + star + map step advances + streak)

Trophy Shelf (achievements / badges)
Parent Area [gated: hold-OK / simple math]  → manage & create profiles, recovery code, settings
```

- **Daily UX:** known TV → avatar picker + emoji PIN (zero typing). New TV / first run → username entry (with generated suggestions to minimize typing) or recovery.
- Every interactive element is focusable; focus wraps; no dead ends; default focus lands on the primary action.

**Auth state architecture (Plan 2):** a dedicated `useAuthStore` (separate from the gameplay `useUiStore`) holds `{ authScreen: "profilePicker"|"login"|"signup"|"recovery"; activeProfile: {id,username,avatar,age_band} | null }`. `App.tsx` gates on `activeProfile`: `null` renders whichever `authScreen` is active; once set, the existing Plan 1 flow (JourneyMap/MissionPlayer/RewardScreen) renders unchanged.

**"Known profiles on this TV" cache:** a small `localStorage`-backed list of `{ profileId, username, avatar }` (not a session/token — just enough to skip re-typing a username), populated on every successful signup/login. Cache non-empty → boot to Profile Picker (avatar grid → picking one reveals an inline emoji PIN, mirroring `LoginScreen`'s own inline-reveal pattern → real `login()` call). Cache empty (cold/new TV) → boot straight to Login (full username + PIN, with links to Signup/Recovery). No session token persists across app restarts — every launch re-authenticates for real; the fast path is never re-typing a username, not skipping the PIN.

## 7. Auth Model (ported verbatim from `kids-quiz-claude`)

**Correction from the original draft of this spec:** the reference repo does **not** use Supabase Auth (`auth.users`/JWT sign-in). Its real mechanism, confirmed by reading `src/lib/auth.ts`, `src/services/{backend,supabaseBackend,mockBackend}.ts`, and `supabase/migrations/0001_initial_schema.sql`:

- **Kid identity = a custom `profiles` row** (`id uuid`, `username`, `avatar`, `age_band`, `pin_hash`, `salt`, `recovery_hash`, `failed_attempts`, `locked_until`) — not a Supabase Auth user. `profiles.id` is the effective foreign key everywhere (in place of `auth.uid()`).
- **Credential validation happens entirely inside `SECURITY DEFINER` Postgres RPC functions** — `rpc_check_username_available`, `rpc_signup`, `rpc_login`, `rpc_recover_pin` — which alone can read `pin_hash`/`salt`/`recovery_hash`. The RPC layer *is* the security boundary, not RLS.
- **Daily secret = 4-emoji PIN** via `EmojiPinKeypad` (12-emoji set 🐱🐶🐰🐼⚡🌈🌟🌙🍕🍔🍩🍎, order matters, `PinIcon[]`). Hashed server-side as `SHA-256(pin + salt)`.
- **Real backup = parent-held recovery code** (`WORD-WORD-1234`, e.g. `PURPLE-FROG-1234`), shown at signup and after every reset; `rpc_recover_pin` verifies it, rotates both the PIN and the recovery code. This is what makes the weak PIN acceptable.
- **Lockout ladder** on `failed_attempts`: 5 wrong → 1 min, 8 → 5 min, 10 → 24 h (`locked_until`, enforced inside the RPCs). Applies to both login and recovery attempts.
- **Session = an opaque client-side token** (`sb-<profile_id>-<random>`, not a verifiable JWT) held in a Zustand store. Fine for this trust level — a kid never touches raw credentials, and no route needs server-verified auth beyond "does this profile_id belong to this device."
- **`backend.ts` env-driven switch:** `mockBackend` (in-memory, used in tests / no Supabase configured) vs `supabaseBackend` (real RPC calls) selected by whether `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` are set. Reused as-is — it's exactly our "no network in tests" testing constraint, already solved.
- **age_band values renamed:** the reference hardcodes `'5-6' | '7-9'` (button labels, RPC check, DB constraint). We rename these to our own `'3-5' | '6-8'` during the port — a mechanical string substitution across the UI, type union, RPC validation, and migration; no logic changes.

**Files to port (from `dieontime/kids-quiz-claude`), verbatim at the logic layer:**
- `src/lib/auth.ts`, `src/lib/profanity.ts`, `src/lib/usernameSuggestor.ts`
- `src/services/backend.ts`, `src/services/mockBackend.ts`, `src/services/supabaseBackend.ts`
- `src/features/auth/EmojiPinKeypad.tsx`, `SignupWizard.tsx`, `LoginScreen.tsx`, `RecoveryScreen.tsx`, `AvatarPicker.tsx` (+ their existing tests, ported and adapted)
- `supabase/migrations/0001_initial_schema.sql` — reuse the `profiles` table + RPC pattern verbatim (age_band renamed, RLS tightened — see §8); replace the quiz-specific tables (`answered_questions`, `quiz_history`, `module_progress`) with activize-kidzz's own (`progress`, `mission_completions`, `earned_badges`, §8).

**Adapted, not ported verbatim:** the reference's `BigButton` (plain `onClick`, no D-pad support) is replaced by our own `FocusableButton` (built in Plan 1 Task 4) everywhere it appears in the ported screens — this is the "add D-pad/spatial navigation" work. `PlayfulBackground` can likely be reused as-is (purely visual); revisit at the `/frontend-design` pass (Plan 6).

Two more adaptations surfaced reading the actual reference source (not just summaries):
- **No router:** `LoginScreen`/`SignupWizard`/`RecoveryScreen` use `react-router-dom`'s `useNavigate()`/`<Link>` in the reference. This app has no router at all ("URLs are meaningless on a TV") — every `useNavigate`/`<Link>` becomes a `useAuthStore`/`useUiStore` screen transition instead.
- **`framer-motion` kept for `whileTap`, dropped for `whileHover`:** `EmojiPinKeypad` and `AvatarPicker` use `framer-motion` for tap-scale feedback (kept — still fires on synthetic activation regardless of input method) and hover-scale (`AvatarPicker`'s `whileHover`, dropped outright — hover is meaningless with no pointer; real focus-visual polish is `/frontend-design`'s job in Plan 6, not this plan's).

**New in this app, not from the reference:** the Profile Picker screen (avatar grid + inline PIN) — the reference has no "remembered device" concept, since it's built for mouse/touch, not a shared TV.

**First real multi-element D-pad navigation:** every Plan 1 screen had exactly one focusable button (autoFocus + Enter only). `EmojiPinKeypad` (12 emoji in a 4-column grid + Clear/Done) and `AvatarPicker` (12 avatars in a grid) are the first screens needing genuine arrow-key movement *between* elements. The spatial-nav library computes this geometrically from each `FocusableButton`'s real on-screen position — no explicit grid-index wiring needed, just rendering each option as its own `FocusableButton`. See §11 for how this gets tested.

**Security posture:** 12 emojis × 4 slots = 20,736 combinations — a *weak* secret, acceptable for Tier A (game progress, low threat) because recovery is gated by a stronger parent-held code + lockout + the RPC boundary. **Must be hardened for Tier C** (any health-related data).

**Hardening beyond the reference implementation:** the reference repo's own migration comments flag its `profiles` RLS as *temporarily* permissive (`anon_all`), which lets the anon key `SELECT pin_hash, salt` directly and offline-brute-force the PIN (fast SHA-256, no key-stretching). Since the RPCs run `SECURITY DEFINER` and don't need a permissive policy to function, our migration **omits any anon/authenticated policy on `profiles` entirely** (default-deny) — same UX, strictly more secure, no extra effort. See §8.

## 8. Data Model (Supabase)

**Correction from the original draft:** there is no `auth.uid()` here — see §7. `profiles.id` (a plain `uuid`, generated by `rpc_signup`) is the foreign key every other table hangs off. The DB stores only *references* (IDs) and *integers* — so content can grow unbounded with no schema change.

```sql
profiles                        -- ported verbatim from kids-quiz-claude (age_band renamed)
  id              uuid  PK default gen_random_uuid()
  username        text  not null            -- case-insensitive unique index
  avatar          text  not null
  age_band        text  not null check (age_band in ('3-5', '6-8'))
  pin_hash        text  not null            -- sha256(pin || salt)
  salt            text  not null
  recovery_hash   text  not null            -- sha256(recovery_code || salt)
  failed_attempts integer not null default 0
  locked_until    timestamptz
  created_at      timestamptz not null default now()

progress                        -- activize-kidzz-specific; one row per profile
  profile_id     uuid  PK/FK → profiles.id on delete cascade
  world          int
  node           int
  streak_count   int
  longest_streak int
  last_completed_date date    -- date, not timestamp, for streak math

mission_completions             -- activize-kidzz-specific; append-only log
  id             uuid  PK
  profile_id     uuid  FK → profiles.id on delete cascade
  mission_id     text          -- refs static content
  completed_at   timestamptz
  activities_done int

earned_badges                   -- activize-kidzz-specific
  profile_id     uuid  FK → profiles.id on delete cascade
  badge_id       text          -- refs static content
  earned_at      timestamptz
  PRIMARY KEY (profile_id, badge_id)
```

**Security model (matches the reference repo, with one hardening):**
- **`profiles`:** no anon/authenticated RLS policy at all (default-deny). Only the `SECURITY DEFINER` RPCs (`rpc_signup`, `rpc_login`, `rpc_recover_pin`, `rpc_check_username_available`) touch this table — they run with elevated privilege and bypass RLS by design, so a policy would only ever *weaken* things (as it does in the reference repo, which flags its own `anon_all` policy on `profiles` as temporary). This is stricter than the reference implementation and costs nothing.
- **`progress` / `mission_completions` / `earned_badges`:** permissive `anon`/`authenticated` CRUD (mirroring the reference's `module_progress`/`quiz_history` pattern), since there's no server session to scope RLS by — the client is trusted to only query its own `profile_id` (the id returned at login/signup, held client-side). **Accepted trade-off, stated explicitly:** anyone with the anon key could technically read/write another profile's *game progress* directly via the REST API. Not acceptable for health data — must be revisited before Tier C. Acceptable now because these tables hold no credentials and no PII beyond a chosen username/avatar.
- **Streak logic** (client-side, persisted in the completion upsert): compare `last_completed_date` to today — same day = no-op; yesterday = `streak_count++`; older gap = reset to 1; update `longest_streak`.
- **Write pattern:** load the whole day's mission up front; write progress as a **single upsert at mission-complete** (network-blip resilient).

**Migration sequencing:** Plan 2 creates and applies (via `supabase db push` against the already-linked `activize-kidzz` project) only the `profiles` table + auth RPCs. `progress` / `mission_completions` / `earned_badges` are Plan 3's migration — a logged-in profile has nowhere to store game progress until then, which is intentional (auth and persistence are separate plans, separate migrations).

## 9. Content Model (data-driven, additive-only)

**Principle: content is data + assets, never code.** New content grows unbounded with **no architecture, DB, or UI change**.

**Content = versioned JSON on the CDN** (not in the DB, not bundled — so adding content needs no migration and no redeploy):

```
content/  (CDN, fetched at runtime via manifest)
  manifest.json          { version, worldIds[], badgeIds[] }
  worlds/01-jungle.json  { id, order, theme, name, missionIds[], art }
  missions/m-001.json    { id, worldId, node, title, activityIds[] (ordered) }
  activities/
    ex-cross-crawl.json  { id, type:'movement', ageBands:['6-8'],
                           renderer:'rive', asset:'cross-crawl.riv',
                           narration:'cross-crawl.mp3',
                           pacing:{reps:6,tempoMs:1200}, instructions }
    pz-memory-01.json    { id, type:'puzzle', puzzleType:'memory-sequence',
                           data:{...}, narration, ageBands:['6-8'] }
    br-belly.json        { id, type:'breathing', ... }
  badges/b-streak-7.json { id, name, art, rule:{kind:'streak', value:7} }
```

**Three code-level extension registries** — touched only for a genuinely new *mechanic*, never for new content:

| Registry | Keyed by | Add new content | Add new mechanic |
|---|---|---|---|
| `rendererRegistry` | `renderer` (`rive`/`lottie`/`video`/`react`) | pure data | rare: new renderer = 1 component |
| `puzzleRegistry` | `puzzleType` (`memory-sequence`/`riddle`/`pattern`…) | pure data | rare: new puzzle type = 1 component |
| `badgeRuleRegistry` | `rule.kind` (`streak`/`world_complete`/`missions_total`…) | pure data | rare: new rule kind = 1 function |

**"Adding X" story:**
- **New world / mission / exercise / puzzle / badge** (existing renderer/puzzleType/rule kind) → drop a JSON file + assets on the CDN, bump `manifest.version`. **Zero code, zero DB, zero UI.**
- **3–5 age tier** → add activities tagged `ageBands:['3-5']`; mission builder filters by the profile's `age_band`.

**Loading & resilience:** fetch `manifest.json` on boot, cache in memory + localStorage; lazy-load world/mission JSON on demand; keep last-good content cached so a CDN blip never bricks a session.

**Starter content:** small seed set from established child-development movement patterns (cross-lateral / bilateral coordination / midline-crossing, breathing) + simple working-memory and pattern puzzles — authored as data, **no clinical claims**.

### 9a. Loading screens = micro brain-activation "interstitials"

- No spinners. Whenever an async gate is pending (manifest fetch, mission asset load, Supabase round-trip), an **`InterstitialPlayer`** overlay runs a **short, loopable micro-exercise** (follow-the-dot eye tracking, palm switches, finger taps, belly-breathing) with gentle audio.
- **Same registry, no new UI:** interstitials are activities tagged `interstitial: true` (or a `content/interstitials/` pool), rendered by the existing `ExercisePlayer`. Adding more = pure data.
- **Rules:** only show if load exceeds ~300ms (no flash on fast loads); **loop** until the promise resolves, then a quick "ready!" hand-off; **effort-neutral** — no parent validation, no progress/streak impact.

## 10. Resilience & Error Handling

The kid never sees a broken screen.

- **Content fetch fails** → last-good cached content (localStorage); if none, a friendly "Let's try again" card with a big D-pad-focusable retry button.
- **Asset (`.riv`/audio) fails** → skip to a static illustration + text/voice instruction; never crash the mission.
- **Progress write fails** (Wi-Fi blip at mission end) → queue the completion upsert in localStorage, retry on next launch/online; kid sees the reward immediately (optimistic UI).
- **Auth:** lockout after ~5 wrong PINs → recovery flow; session persisted for daily avatar + PIN entry.
- **Gameplay:** no fail states — wrong puzzle answer = gentle retry with a hint.

## 11. Testing Strategy

Vitest + React Testing Library, **black-box** (test behavior, real rendered text, Supabase mocked at the boundary via mock `supabase-js` / MSW, content from fixture JSON).

- **Auth:** signup → login → recovery → lockout.
- **Mission flow:** activity sequencing, parent-OK gating, reward + **streak math** (same-day / yesterday / gap).
- **Badge rule engine:** each `rule.kind` evaluator, table-driven.
- **D-pad navigation:** focus moves correctly, wraps, no dead ends, default focus on primary action.
- **Resilience:** content-fetch failure → cached fallback; progress-write failure → queued + retried.
- **Interstitial:** appears only after ~300ms, loops, dismisses on resolve, no progress impact.
- **Arrow-key grid navigation (Plan 2):** `EmojiPinKeypad`/`AvatarPicker` need at least one test that calls the real `initNavigation()`, fires actual `ArrowRight`/`ArrowDown` keydown events, and asserts focus (`data-focused`) moved to the geometrically-correct adjacent button — not just that clicking works. Extends the real-library-assertion pattern Plan 1's final review established; the first screens in this app with more than one focusable element.
- **Auth backend tests use `mockBackend` only** (env vars unset) — zero real network/Supabase calls in the automated suite, matching "no network in tests." The one exception is a manual verification pass after `supabase db push`: sign up a throwaway profile via the real UI, confirm the row lands in `profiles` with a hashed (not plaintext) PIN, confirm a direct anon-key `SELECT * FROM profiles` returns nothing (proving the hardened default-deny RLS), then log in and recover-PIN through the real RPCs.

## 12. Out of Scope (YAGNI for Tier A)

Camera / pose tracking; phone-pairing auth; real 3D; clinical protocols / health claims; multi-language; payments; app-store packaging. All reachable later without rework because content is data-driven and state lives in Postgres + RLS.

## 13. Future — Path to Tier C (clinical)

The following are *designed for* but not *built now*: validated exercise protocols as a content layer (same data model, tagged), stronger auth (harden beyond emoji PIN), health-data privacy controls / region pinning, evidence-backed claims scrutiny. No code changes to the core loop, DB schema, or UI are expected — only additive content + auth hardening.

## 14. Open Items / Dependencies

- ~~`lib/auth.ts` unreviewed~~ — **resolved.** Reviewed along with `backend.ts`, `supabaseBackend.ts`, `mockBackend.ts`, and `supabase/migrations/0001_initial_schema.sql`; the real mechanism (custom `profiles` table + `SECURITY DEFINER` RPCs, no Supabase Auth) is now documented in §7–§8.
- ~~Confirm spatial-navigation library choice~~ — **resolved.** `@noriginmedia/norigin-spatial-navigation`, built in Plan 1 Task 4.
- ~~Supabase CLI not yet set up locally~~ — **resolved.** Confirmed 2026-07-15: `activize-kidzz` project (ref `cdyycgyyekykxpkkfysn`) is linked and `ACTIVE_HEALTHY`; migrations apply via `supabase db push` with no credentials passing through this session.
- **Repo pushed to GitHub:** `https://github.com/dieontime/activize-kidzz`, branch `main` (Plan 1 merged 2026-07-15).
- Source and license-check the starter movement/puzzle content.
- Rive authoring: who produces the `.riv` art (self vs artist); early activities may ship as Lottie/video via the pluggable renderer until Rive art exists.
