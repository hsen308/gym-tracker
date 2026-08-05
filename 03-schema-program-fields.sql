-- ============================================================
--  GYM TRACKER — PROGRAM FIELDS (run after 01, 01b, 02)
--
--  Two columns the original schema didn't anticipate, both needed
--  once the real program from Hussein-Program.pdf was loaded in:
--
--  exercises.tracks     — Plank, Side Plank and Farmer's Hold are
--                         prescribed in SECONDS, not weight × reps.
--                         The logger swaps its input based on this.
--  meal_presets.meal_type — the PDF groups its 17 meals into 4 slots
--                         (breakfast / lunch / pre_post / dinner) and
--                         the options inside a slot are interchangeable.
-- ============================================================

alter table exercises
  add column if not exists tracks text not null default 'weight_reps';  -- weight_reps | duration

alter table meal_presets
  add column if not exists meal_type text;  -- breakfast | lunch | pre_post | dinner

-- program_exercises predates the §3a amendment loop, which only covered the
-- seven original tables — it never got updated_at/deleted_at, so pull-sync
-- could not see changes to it. Fix that here.
alter table program_exercises
  add column if not exists updated_at timestamptz default now();
alter table program_exercises
  add column if not exists deleted_at timestamptz;

create index if not exists idx_program_exercises_updated
  on program_exercises(user_id, updated_at desc);

drop trigger if exists trg_touch on program_exercises;
create trigger trg_touch before update on program_exercises
  for each row execute function touch_updated_at();
