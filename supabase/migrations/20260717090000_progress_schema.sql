-- Activize Kidzz — persistence schema (Plan 3)
--
-- progress: one row per profile, summarising current position + streak.
-- Read on every boot (after login/signup), written once per mission
-- completion via a single upsert -- deliberately denormalized so a boot
-- costs one row read instead of aggregating the whole completions log,
-- important on a possibly-flaky TV WiFi connection.
--
-- mission_completions: append-only log, one row per completed mission.
--
-- earned_badges: schema only in this plan -- no code writes to it yet.
-- The badge rule engine that decides when a badge is earned is a later
-- plan's scope; this table exists now so that plan's migration doesn't
-- need to touch `profiles` again.
--
-- RLS: permissive anon/authenticated CRUD on all three tables (unlike
-- `profiles`, which is default-deny). Accepted trade-off: there is no
-- server session to scope RLS by in this app's custom-auth model, so the
-- client is trusted to only query its own profile_id (returned at
-- login/signup, held client-side). None of these tables hold credentials
-- or PII beyond a chosen username/avatar (already in `profiles`) -- must
-- be revisited before any future clinical (Tier C) pivot.

create table if not exists progress (
  profile_id          uuid primary key references profiles(id) on delete cascade,
  world               integer not null default 0,
  node                integer not null default 1,
  streak_count        integer not null default 0,
  longest_streak      integer not null default 0,
  last_completed_date date
);

create table if not exists mission_completions (
  id              uuid primary key default gen_random_uuid(),
  profile_id      uuid not null references profiles(id) on delete cascade,
  mission_id      text not null,
  completed_at    timestamptz not null default now(),
  activities_done integer not null default 0
);

create index if not exists mission_completions_profile_id_idx
  on mission_completions (profile_id);

create table if not exists earned_badges (
  profile_id  uuid not null references profiles(id) on delete cascade,
  badge_id    text not null,
  earned_at   timestamptz not null default now(),
  primary key (profile_id, badge_id)
);

-- =============================================================================
-- RLS — permissive CRUD (see rationale above)
-- =============================================================================

alter table progress enable row level security;
alter table mission_completions enable row level security;
alter table earned_badges enable row level security;

create policy progress_anon_all on progress
  for all to anon, authenticated
  using (true) with check (true);

create policy mission_completions_anon_all on mission_completions
  for all to anon, authenticated
  using (true) with check (true);

create policy earned_badges_anon_all on earned_badges
  for all to anon, authenticated
  using (true) with check (true);

-- =============================================================================
-- Grants
-- =============================================================================

grant select, insert, update on progress to anon, authenticated;
grant select, insert on mission_completions to anon, authenticated;
grant select, insert on earned_badges to anon, authenticated;
