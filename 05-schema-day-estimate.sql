-- ============================================================
--  GYM TRACKER — WHOLE-DAY MACRO ESTIMATE (run after 01…04)
--
--  Weighing every ingredient is not a thing most people sustain, and a
--  tracker that only accepts precise entries just stops getting used.
--  This lets a whole day be logged as one approximate row: rough macros
--  plus a free-text note of what was actually eaten.
--
--  It's still a meal_logs row, so the day's totals, targets and any
--  later analysis all keep working unchanged — it's just flagged so the
--  UI can treat it as "the whole day" rather than one more meal, and
--  edit it in place instead of stacking duplicates.
-- ============================================================

alter table meal_logs
  add column if not exists is_day_estimate boolean not null default false;

alter table meal_logs
  add column if not exists notes text;   -- "chicken + rice, 2 coffees, shawarma at night"

-- One estimate per day, enforced at the database rather than trusted to
-- the client — a second one would silently double the day's totals.
create unique index if not exists uniq_meal_logs_day_estimate
  on meal_logs(user_id, date)
  where is_day_estimate and deleted_at is null;
