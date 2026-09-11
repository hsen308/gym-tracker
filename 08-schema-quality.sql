-- ============================================================
--  GYM TRACKER — SESSION QUALITY SCORE
--  Run AFTER the other migrations in Supabase → SQL Editor.
--
--  A 0–10 number computed at finish time, persisted on the workout
--  so history and the Coach Report can read it back without recomputing.
--
--  Formula (weights per spec):
--    energy       40%   energy 1–5 → 0–1
--    % target sets 30%   working sets done ÷ session target (capped 100%)
--    SI pain      20%   inverse: pain 10 → 0, pain 0 → 1
--    caffeine     10%   yes = 1, no = 0; if never asked, the other three
--                       are renormalised to 100%.
-- ============================================================

alter table workouts add column if not exists quality_score numeric(3,1);

comment on column workouts.quality_score is
  'Session quality 0-10, computed at finish. Null for sessions finished before the field existed.';