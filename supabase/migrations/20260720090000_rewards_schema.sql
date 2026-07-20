-- Activize Kidzz — rewards engine schema (Plan 5)
--
-- Adds the running mission-completion counter the missions_total badge
-- rule needs. earned_badges itself (table, RLS, grants) was already
-- created schema-only in Plan 3's migration -- this plan is the first to
-- actually write to it, via the existing permissive anon/authenticated
-- policy and grants, so no RLS/grant changes are needed here.

alter table progress
  add column if not exists total_missions_completed integer not null default 0;
