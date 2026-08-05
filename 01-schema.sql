-- ============================================================
--  GYM TRACKER — SCHEMA
--  Paste into: Supabase → SQL Editor → New query → Run
-- ============================================================

-- ------------------------------------------------------------
-- 1. EXERCISE LIBRARY
-- ------------------------------------------------------------
create table exercises (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references auth.users(id) on delete cascade default auth.uid(),
  name               text not null,
  category           text not null,          -- push | pull | legs | core | forearms
  primary_muscle     text not null,          -- chest, lats, quads, ...
  secondary_muscles  text[] default '{}',
  equipment          text,                   -- barbell | dumbbell | cable | machine | bodyweight
  is_unilateral      boolean default false,
  si_risk            text default 'none',    -- none | caution | avoid
  setup_notes        text,
  cues               text[] default '{}',
  created_at         timestamptz default now()
);

-- ------------------------------------------------------------
-- 2. PROGRAM STRUCTURE
-- ------------------------------------------------------------
create table program_days (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade default auth.uid(),
  code        text not null,                 -- push_a, pull_a, legs_a, ...
  name        text not null,                 -- "Push A"
  focus       text,                          -- "Chest"
  order_index int not null,
  created_at  timestamptz default now()
);

create table program_exercises (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users(id) on delete cascade default auth.uid(),
  program_day_id   uuid not null references program_days(id) on delete cascade,
  exercise_id      uuid not null references exercises(id) on delete restrict,
  order_index      int not null,
  target_sets      int not null,
  rep_min          int not null,
  rep_max          int not null,
  target_rir_min   int,
  target_rir_max   int,
  rest_seconds     int not null default 90,
  is_strength_lift boolean default false,
  notes            text
);

-- ------------------------------------------------------------
-- 3. TRAINING LOG
-- ------------------------------------------------------------
create table workouts (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users(id) on delete cascade default auth.uid(),
  program_day_id uuid references program_days(id) on delete set null,
  date           date not null default current_date,
  started_at     timestamptz default now(),
  finished_at    timestamptz,
  bodyweight_kg  numeric(5,2),
  si_pain_score  int check (si_pain_score between 0 and 10),
  energy         int check (energy between 1 and 5),
  sleep_hours    numeric(3,1),
  notes          text,
  created_at     timestamptz default now()
);

-- The atom of the whole app.
-- NOTE: sets reference exercise_id DIRECTLY, not program_exercise_id.
-- This is what lets you substitute exercises without breaking history.
create table sets (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references auth.users(id) on delete cascade default auth.uid(),
  workout_id          uuid not null references workouts(id) on delete cascade,
  exercise_id         uuid not null references exercises(id) on delete restrict,
  program_exercise_id uuid references program_exercises(id) on delete set null,
  set_number          int not null,
  weight_kg           numeric(6,2),
  reps                int,
  rir                 int,
  is_warmup           boolean default false,
  duration_seconds    int,                   -- for planks / holds
  completed_at        timestamptz default now()
);

-- ------------------------------------------------------------
-- 4. BODY TRACKING
-- ------------------------------------------------------------
create table bodyweight_logs (
  id        uuid primary key default gen_random_uuid(),
  user_id   uuid not null references auth.users(id) on delete cascade default auth.uid(),
  date      date not null default current_date,
  weight_kg numeric(5,2) not null,
  unique (user_id, date)
);

create table measurements (
  id        uuid primary key default gen_random_uuid(),
  user_id   uuid not null references auth.users(id) on delete cascade default auth.uid(),
  date      date not null default current_date,
  waist_cm  numeric(5,2),
  chest_cm  numeric(5,2),
  arm_cm    numeric(5,2),
  thigh_cm  numeric(5,2),
  notes     text,
  unique (user_id, date)
);

-- ------------------------------------------------------------
-- 5. INDEXES  (queries you'll actually run)
-- ------------------------------------------------------------
create index idx_sets_workout        on sets(workout_id);
create index idx_sets_exercise_date  on sets(user_id, exercise_id, completed_at desc);
create index idx_workouts_user_date  on workouts(user_id, date desc);
create index idx_progex_day          on program_exercises(program_day_id, order_index);
create index idx_bw_user_date        on bodyweight_logs(user_id, date desc);

-- ------------------------------------------------------------
-- 6. ROW LEVEL SECURITY
--    Without this, anyone with your project URL can read everything.
-- ------------------------------------------------------------
alter table exercises         enable row level security;
alter table program_days      enable row level security;
alter table program_exercises enable row level security;
alter table workouts          enable row level security;
alter table sets              enable row level security;
alter table bodyweight_logs   enable row level security;
alter table measurements      enable row level security;

-- One policy per table: you can only touch your own rows.
create policy own_rows on exercises
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy own_rows on program_days
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy own_rows on program_exercises
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy own_rows on workouts
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy own_rows on sets
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy own_rows on bodyweight_logs
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy own_rows on measurements
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ------------------------------------------------------------
-- 7. HELPER VIEW — last set performed per exercise
--    This is what pre-fills the logger with last session's numbers.
-- ------------------------------------------------------------
create or replace view last_performance as
select distinct on (user_id, exercise_id)
  user_id,
  exercise_id,
  workout_id,
  weight_kg,
  reps,
  rir,
  set_number,
  completed_at
from sets
where is_warmup = false
order by user_id, exercise_id, completed_at desc;
