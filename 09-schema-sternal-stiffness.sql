-- ============================================================
--  GYM TRACKER — STERNUM & MORNING STIFFNESS MIGRATION (09)
--  Paste into Supabase → SQL Editor → Run.
-- ============================================================

-- Workouts: sternal / chest wall pain at finish
alter table workouts add column if not exists sternal_pain_score int check (sternal_pain_score between 0 and 10);

-- Daily Logs: 3-zone morning pain & stiffness duration for axial SpA / SAPHO tracking
alter table daily_logs add column if not exists morning_si_pain int check (morning_si_pain between 0 and 10);
alter table daily_logs add column if not exists morning_sternal_pain int check (morning_sternal_pain between 0 and 10);
alter table daily_logs add column if not exists morning_back_pain int check (morning_back_pain between 0 and 10);
alter table daily_logs add column if not exists morning_stiffness_minutes int check (morning_stiffness_minutes >= 0);
