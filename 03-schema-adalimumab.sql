-- ============================================================
--  GYM TRACKER — ADALIMUMAB DOSING (addition)
--  Run AFTER 01-schema.sql (and the meals files, if present) in
--  Supabase → SQL Editor.
--
--  The dose schedule lives on the profile, exactly like creatine:
--  one row already exists per user, so a date plus an interval is all
--  the tracking needs. There is no dedicated table — a dose is not a
--  repeated, queryable history (yet); it's one date that moves forward
--  each time it's taken.
-- ============================================================

alter table profiles add column if not exists adalimumab_last_injection date;
alter table profiles add column if not exists adalimumab_interval_days int not null default 15;

comment on column profiles.adalimumab_last_injection is
  'Date of the last 40 mg dose. Null until one has been logged.';
comment on column profiles.adalimumab_interval_days is
  'How often a dose is due, in days. Programmed rhythm is every 14–15.';