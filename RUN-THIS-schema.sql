-- ============================================================
--  GYM TRACKER — CURRENT SCHEMA (run this one file)
--
--  Everything here is idempotent: safe to run again if you've already
--  run it, and safe to re-run if a later step fails.
--
--  Paste into Supabase → SQL Editor → Run.
-- ============================================================

-- ------------------------------------------------------------
-- 1. program_exercises — the table the original schema left behind
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
-- ------------------------------------------------------------
alter table exercises     add column if not exists tracks text not null default 'weight_reps';
alter table meal_presets  add column if not exists meal_type text;

-- ------------------------------------------------------------
-- 3. Whole-day macro estimate
-- ------------------------------------------------------------
alter table meal_logs add column if not exists is_day_estimate boolean not null default false;
alter table meal_logs add column if not exists notes text;

create unique index if not exists uniq_meal_logs_day_estimate
  on meal_logs(user_id, date)
  where is_day_estimate and deleted_at is null;

-- ------------------------------------------------------------
-- 4. Coaching tables
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
-- 5. profiles — what makes the app belong to ONE person
--
--    Everything personal used to be a constant in the source: the
--    2200 kcal target, the 9000-step goal, the daily SI-joint routine,
--    kilograms, and a single hardcoded programme. A second account got
--    all of it whether it applied to them or not.
--
--    One row per user. RLS keeps them apart, same as every other table.
-- ------------------------------------------------------------
create table if not exists profiles (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null unique references auth.users(id) on delete cascade default auth.uid(),
  display_name      text,

  -- Which programme was seeded for this account. Adding a template is a
  -- code change; this records which one applies.
  program_template  text not null default 'ppl_si_recomp',

  -- Display units only. Weights are ALWAYS stored in kg, and converted at
  -- the edges — storing display units would make every historical number
  -- ambiguous the moment someone switched.
  unit_weight       text not null default 'kg',   -- kg | lb
  unit_height       text not null default 'cm',   -- cm | ft

  goal              text,        -- recomp | gain | lose
  height_cm         numeric(5,1),
  target_weight_kg  numeric(5,2),

  -- Daily targets, previously hardcoded in constants.js.
  calories          int  not null default 2200,
  protein_g         int  not null default 170,
  carbs_g           int  not null default 220,
  fat_g             int  not null default 70,
  steps_target      int  not null default 9000,
  water_target_l    numeric(3,1) not null default 3.2,

  -- Drives the daily SI routine card and the caution treatment on lifts.
  -- Off by default: most people don't have sacroiliitis.
  has_si_joint      boolean not null default false,

  created_at        timestamptz default now(),
  updated_at        timestamptz default now(),
  deleted_at        timestamptz
);

create index if not exists idx_profiles_updated on profiles(user_id, updated_at desc);

alter table profiles enable row level security;

drop policy if exists own_rows on profiles;
create policy own_rows on profiles
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop trigger if exists trg_touch on profiles;
create trigger trg_touch before update on profiles
  for each row execute function touch_updated_at();

-- ------------------------------------------------------------
-- 6. Tell PostgREST to re-read the schema
-- ------------------------------------------------------------
notify pgrst, 'reload schema';
