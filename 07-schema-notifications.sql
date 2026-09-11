-- ============================================================
--  GYM TRACKER — NOTIFICATIONS v2
--  Run AFTER the other migrations in Supabase → SQL Editor.
--
--  1. daily_logs.creatine_taken — the tap-to-confirm the evening reminder
--     reads, so you're only ever nudged about creatine you haven't taken.
--  2. push_subscriptions.last_sent_tag — what the last push from THIS slot
--     was, so two crons in a day never send the same type twice (the
--     "never two of the same" rule), and so the 2/day cap is enforceable.
-- ============================================================

alter table daily_logs add column if not exists creatine_taken boolean not null default false;

alter table push_subscriptions add column if not exists last_sent_tag text;