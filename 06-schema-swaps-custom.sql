-- ============================================================
--  GYM TRACKER — PERSISTENT SWAPS + CUSTOM EXERCISES
--  Run AFTER the other migrations in Supabase → SQL Editor.
--
--  1. Exercises you create in the app are flagged is_custom, purely so the
--     library knows which rows are yours to edit later.
--  2. program_exercises.swap_to_exercise_id is the "remember this swap"
--     default: when set, every future session schedules that exercise in the
--     slot before you've made a session-specific choice.
-- ============================================================

alter table exercises add column if not exists is_custom boolean not null default false;

alter table program_exercises
  add column if not exists swap_to_exercise_id uuid references exercises(id);