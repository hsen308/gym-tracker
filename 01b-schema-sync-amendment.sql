-- ============================================================
--  GYM TRACKER — SYNC AMENDMENT (build-plan.md §3a)
--  Run AFTER 01-schema.sql, BEFORE using Phase 2 (sync).
--  Extracted verbatim from build-plan.md so there's an actual file to
--  run instead of copy-pasting out of a markdown doc.
-- ============================================================

-- Sync needs change tracking and soft deletes.
-- Without updated_at, pull-sync cannot know what changed.
-- Without deleted_at, deletions never propagate between devices.

do $$
declare t text;
begin
  foreach t in array array[
    'exercises','program_days','program_exercises',
    'workouts','sets','bodyweight_logs','measurements'
  ] loop
    execute format('alter table %I add column if not exists updated_at timestamptz default now()', t);
    execute format('alter table %I add column if not exists deleted_at timestamptz', t);
    execute format('create index if not exists idx_%I_updated on %I(user_id, updated_at desc)', t, t);
  end loop;
end $$;

create or replace function touch_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end $$ language plpgsql;

do $$
declare t text;
begin
  foreach t in array array[
    'exercises','program_days','program_exercises',
    'workouts','sets','bodyweight_logs','measurements'
  ] loop
    execute format('drop trigger if exists trg_touch on %I', t);
    execute format('create trigger trg_touch before update on %I
                    for each row execute function touch_updated_at()', t);
  end loop;
end $$;
