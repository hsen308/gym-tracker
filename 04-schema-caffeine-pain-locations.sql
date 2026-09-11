-- ============================================================
--  GYM TRACKER — CAFFEINE + PAIN LOCATIONS + MUSCLE TAGS
--  Run AFTER the meals/adalimumab migrations in Supabase → SQL Editor.
-- ============================================================

-- Caffeine at the start of a session: a boolean stored on the workout so the
-- session quality score and the coach report can correlate it with SI pain
-- and energy.  Three values: null (not asked), true (yes), false (no).
alter table workouts add column if not exists caffeine boolean;

-- Per-exercise pain location alongside the existing traffic-light level.
-- An array because SI pain frequently radiates to multiple areas.
alter table workout_exercises add column if not exists pain_locations text[] default '{}';