-- ============================================================
--  GYM TRACKER — CURRENT SCHEMA (run this one file)
--
--  Supersedes 03, 04 and 05. Everything here is idempotent: safe to run
--  again if you've already run some of them, and safe to re-run if a
--  later step fails.
--
--  Paste into Supabase → SQL Editor → Run.
-- ============================================================

-- ------------------------------------------------------------
-- 1. program_exercises — the table the original schema left behind
--
--    Every other table got created_at / updated_at / deleted_at.
--    program_exercises got none of them, so pushing a row failed with
--    "Could not find the 'created_at' column in the schema cache" and
--    the whole seeded program never reached the cloud.
-- ------------------------------------------------------------
alter table program_exercises add column if not exists created_at timestamptz default now();
alter table program_exercises add column if not exists updated_at timestamptz default now();
alter table program_exercises add column if not exists deleted_at timestamptz;

create index if not exists idx_program_exercises_updated
  on program_exercises(user_id, updated_at desc);

drop trigger if exists trg_touch on program_exercises;
create trigger trg_touch before update on program_exercises
  for each row execute function touch_updated_at();

-- ------------------------------------------------------------
-- 2. exercises.tracks + meal_presets.meal_type
--
--    Plank, Side Plank and Farmer's Hold are prescribed in SECONDS, not
--    weight × reps. meal_type groups the 17 meals into the program's
--    four interchangeable slots.
-- ------------------------------------------------------------
alter table exercises     add column if not exists tracks text not null default 'weight_reps';
alter table meal_presets  add column if not exists meal_type text;

-- ------------------------------------------------------------
-- 3. Whole-day macro estimate
--
--    One approximate row per day plus a note of what was actually eaten,
--    for days you didn't weigh anything.
-- ------------------------------------------------------------
alter table meal_logs add column if not exists is_day_estimate boolean not null default false;
alter table meal_logs add column if not exists notes text;

-- One estimate per day, enforced here rather than trusted to the client:
-- a second one would silently double the day's totals.
create unique index if not exists uniq_meal_logs_day_estimate
  on meal_logs(user_id, date)
  where is_day_estimate and deleted_at is null;

-- ------------------------------------------------------------
-- 4. Coaching tables
--
--    workout_exercises — per-session, per-slot state: a substituted
--      exercise, and the traffic-light pain reading for that lift.
--    daily_logs — the habits the program prescribes outside the gym:
--      the 5-minute SI routine, steps, cardio, water.
-- ------------------------------------------------------------
create table if not exists workout_exercises (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references auth.users(id) on delete cascade default auth.uid(),
  workout_id          uuid not null references workouts(id) on delete cascade,
  program_exercise_id uuid references program_exercises(id) on delete cascade,
  swapped_exercise_id uuid references exercises(id) on delete set null,
  pain_level          text check (pain_level in ('green','yellow','red')),
  created_at          timestamptz default now(),
  updated_at          timestamptz default now(),
  deleted_at          timestamptz,
  unique (workout_id, program_exercise_id)
);

create table if not exists daily_logs (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users(id) on delete cascade default auth.uid(),
  date           date not null default current_date,
  si_routine     boolean default false,
  steps          int,
  cardio_minutes int,
  water_litres   numeric(4,2),
  created_at     timestamptz default now(),
  updated_at     timestamptz default now(),
  deleted_at     timestamptz,
  unique (user_id, date)
);

create index if not exists idx_workout_exercises_workout on workout_exercises(workout_id);
create index if not exists idx_workout_exercises_updated on workout_exercises(user_id, updated_at desc);
create index if not exists idx_daily_logs_user_date      on daily_logs(user_id, date desc);
create index if not exists idx_daily_logs_updated        on daily_logs(user_id, updated_at desc);

alter table workout_exercises enable row level security;
alter table daily_logs        enable row level security;

drop policy if exists own_rows on workout_exercises;
create policy own_rows on workout_exercises
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists own_rows on daily_logs;
create policy own_rows on daily_logs
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop trigger if exists trg_touch on workout_exercises;
create trigger trg_touch before update on workout_exercises
  for each row execute function touch_updated_at();

drop trigger if exists trg_touch on daily_logs;
create trigger trg_touch before update on daily_logs
  for each row execute function touch_updated_at();

-- ------------------------------------------------------------
-- 5. Tell PostgREST to re-read the schema
--
--    Without this the API can keep serving a cached schema for a minute
--    or so and still report the columns above as missing.
-- ------------------------------------------------------------
notify pgrst, 'reload schema';
