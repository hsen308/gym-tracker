-- ============================================================
--  GYM TRACKER — COACHING TABLES (run after 01, 01b, 02, 03)
--
--  Two tables that let the app act on the program rather than just
--  record against it.
-- ============================================================

-- Per-workout, per-programmed-slot state. Two things vary session to
-- session without changing the program itself:
--   swapped_exercise_id — you substituted something (the program plans for
--     this explicitly: "if leg press bothers you, use a Belt Squat", "hack
--     squat — swap if it doesn't feel clean"). sets still record the real
--     exercise_id, so history stays correct across a swap.
--   pain_level — the program's traffic-light rule is per exercise, during
--     the set. Capturing it only once at the end of a session throws away
--     exactly the signal the SI-joint correlation needs.
create table workout_exercises (
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

-- One row per calendar day for the habits the program prescribes outside
-- the gym: the 5-minute SI routine ("do this every day, including rest
-- days"), step count, low-intensity cardio, water.
create table daily_logs (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users(id) on delete cascade default auth.uid(),
  date           date not null default current_date,
  si_routine     boolean default false,
  steps          int,
  cardio_minutes int,
  water_litres   numeric(3,1),
  created_at     timestamptz default now(),
  updated_at     timestamptz default now(),
  deleted_at     timestamptz,
  unique (user_id, date)
);

create index idx_workout_exercises_workout on workout_exercises(workout_id);
create index idx_workout_exercises_updated on workout_exercises(user_id, updated_at desc);
create index idx_daily_logs_user_date      on daily_logs(user_id, date desc);
create index idx_daily_logs_updated        on daily_logs(user_id, updated_at desc);

alter table workout_exercises enable row level security;
alter table daily_logs        enable row level security;

create policy own_rows on workout_exercises
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy own_rows on daily_logs
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create trigger trg_touch before update on workout_exercises
  for each row execute function touch_updated_at();
create trigger trg_touch before update on daily_logs
  for each row execute function touch_updated_at();
