-- ============================================================
--  GYM TRACKER — LIGHT SESSION MODE
--  Run AFTER the other migrations in Supabase → SQL Editor.
--
--  A "lighter" version of a day keeps the main lifts at full volume and
--  halves the sets of everything else, chosen at session start. One
--  boolean on the workout records the choice so the active session can
--  render the reduced targets and switch back to full mid-session.
-- ============================================================

alter table workouts add column if not exists is_light boolean not null default false;