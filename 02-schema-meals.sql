-- ============================================================
--  GYM TRACKER — MEALS SCHEMA (Phase 5 addition)
--  Not part of the original 01-schema.sql. Run this in
--  Supabase → SQL Editor AFTER 01-schema.sql and the §3a amendment
--  from build-plan.md have both been run.
--
--  build-plan §Phase 5: "Do not build a general food tracker. Seed the
--  ~17 meals already defined in the user's program with their macros."
--  meal_presets is that seeded list (plus anything logged as a custom
--  food is added here too — see MealsScreen.jsx). meal_logs is a log
--  entry per "I ate this" tap; macros are copied onto the row at log
--  time so editing a preset later doesn't rewrite history.
-- ============================================================

create table meal_presets (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade default auth.uid(),
  name        text not null,
  calories    int not null,
  protein_g   int not null default 0,
  carbs_g     int not null default 0,
  fat_g       int not null default 0,
  is_custom   boolean default false,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now(),
  deleted_at  timestamptz
);

create table meal_logs (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade default auth.uid(),
  date            date not null default current_date,
  meal_preset_id  uuid references meal_presets(id) on delete set null,
  name            text not null,
  calories        int not null,
  protein_g       int not null default 0,
  carbs_g         int not null default 0,
  fat_g           int not null default 0,
  logged_at       timestamptz default now(),
  created_at      timestamptz default now(),
  updated_at      timestamptz default now(),
  deleted_at      timestamptz
);

create index idx_meal_presets_user   on meal_presets(user_id, updated_at desc);
create index idx_meal_logs_user_date on meal_logs(user_id, date desc);

alter table meal_presets enable row level security;
alter table meal_logs    enable row level security;

create policy own_rows on meal_presets
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy own_rows on meal_logs
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create trigger trg_touch before update on meal_presets
  for each row execute function touch_updated_at();
create trigger trg_touch before update on meal_logs
  for each row execute function touch_updated_at();
