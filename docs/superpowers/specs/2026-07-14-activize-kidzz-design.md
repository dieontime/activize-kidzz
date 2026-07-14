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

## 7. Auth Model (reused from `kids-quiz-claude`)

Reuse the author's proven kid-auth pattern verbatim, **adding D-pad/spatial navigation** (the source components are click-only today).

- **Kid identity = username** (chosen, min 3 letters, profanity-filtered, uniqueness-checked via `checkUsernameAvailable()`, with `suggestUsernames()` fallbacks).
- **Daily secret = 4-emoji PIN** via `EmojiPinKeypad`. Emoji set (12): 🐱🐶🐰🐼⚡🌈🌟🌙🍕🍔🍩🍎. **Order matters** (`PinIcon[]`). Low-friction daily unlock.
- **Real backup = parent-held recovery code** (`WORD-WORD-1234`), shown at signup and after each reset; resets the PIN via `recoverPin(username, code, pin)`; old code invalidated on reset. This is what makes the weak PIN acceptable.
- **age_band captured at signup** → drives content tiering (`6-8` now, `3-5` later).
- **Each kid = one Supabase Auth user.** `username → app-owned email` (never receives mail); `emoji PIN → derived password`; recovery code stored hashed to enable PIN reset. RLS keys every row to `auth.uid()`.
- **Lockout** after ~5 wrong PINs → route to recovery. Session (JWT) persisted so daily use is avatar + PIN only.

**Components to port:** `EmojiPinKeypad`, `SignupWizard` (`username→pin→avatar→band→recovery`), `RecoveryScreen`, `lib/auth.ts`.

**Security posture (stated explicitly):** 12 emojis × 4 slots = 20,736 combinations — a *weak* secret, acceptable for Tier A (game progress, low threat) because recovery is gated by a stronger parent-held code + lockout + Supabase auth rate-limiting. **Must be hardened for Tier C** (any health-related data).

**Porting dependency:** `lib/auth.ts` (the actual username→email / PIN→password derivation and recovery handling) has not yet been reviewed; needed at implementation time, or the same scheme re-derived.

## 8. Data Model (Supabase)

All tables RLS-scoped to `auth.uid()`. The DB stores only *references* (IDs) and *integers* — so content can grow unbounded with no schema change.

```
profiles
  id             uuid  PK  = auth.uid()
  username       text  unique
  avatar         text
  age_band       text        -- '6-8' now; '3-5' later
  created_at     timestamptz

progress                      -- one row per profile
  profile_id     uuid  PK/FK → profiles.id
  world          int
  node           int
  streak_count   int
  longest_streak int
  last_completed_date date    -- date, not timestamp, for streak math

mission_completions           -- append-only log
  id             uuid  PK
  profile_id     uuid  FK
  mission_id     text          -- refs static content
  completed_at   timestamptz
  activities_done int

earned_badges
  profile_id     uuid  FK
  badge_id       text          -- refs static content
  earned_at      timestamptz
  PRIMARY KEY (profile_id, badge_id)
```

- **RLS:** every table — `USING (profile_id = auth.uid())` (`id = auth.uid()` for `profiles`). A kid reads/writes only their own rows.
- **Streak logic** (client-side, persisted in the completion upsert): compare `last_completed_date` to today — same day = no-op; yesterday = `streak_count++`; older gap = reset to 1; update `longest_streak`.
- **Write pattern:** load the whole day's mission up front; write progress as a **single upsert at mission-complete** (network-blip resilient).

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

## 12. Out of Scope (YAGNI for Tier A)

Camera / pose tracking; phone-pairing auth; real 3D; clinical protocols / health claims; multi-language; payments; app-store packaging. All reachable later without rework because content is data-driven and state lives in Postgres + RLS.

## 13. Future — Path to Tier C (clinical)

The following are *designed for* but not *built now*: validated exercise protocols as a content layer (same data model, tagged), stronger auth (harden beyond emoji PIN), health-data privacy controls / region pinning, evidence-backed claims scrutiny. No code changes to the core loop, DB schema, or UI are expected — only additive content + auth hardening.

## 14. Open Items / Dependencies

- **`lib/auth.ts`** from `kids-quiz-claude` — review or re-derive the username→email / PIN→password / recovery-code scheme at implementation time.
- Confirm the spatial-navigation library choice (`norigin` vs LRUD) during scaffolding.
- Source and license-check the starter movement/puzzle content.
- Rive authoring: who produces the `.riv` art (self vs artist); early activities may ship as Lottie/video via the pluggable renderer until Rive art exists.
