// Dexie is a thin, promise-based wrapper around IndexedDB — the browser's
// built-in database. Without Dexie you'd be writing raw IndexedDB, which is
// a notoriously clunky, callback-based API. Dexie makes it feel like a
// normal async JS object store.
//
// This IS the app's real database during a session (build-plan.md §0 rule 1).
// Supabase is a sync target, written to later — never read from at runtime.
import Dexie from 'dexie'

export const db = new Dexie('gym-tracker')

// `db.version(1).stores(...)` declares the tables ("object stores" in
// IndexedDB terms) and which fields are indexed for fast lookups.
// The string after each table name lists: primary key first, then indexes.
// e.g. 'id, workout_id, exercise_id, completed_at' on `sets` means you can
// query sets by id (primary key), or filter by workout_id/exercise_id/date
// without scanning every row.
db.version(1).stores({
  exercises: 'id, category, primary_muscle, updated_at',
  program_days: 'id, order_index',
  program_exercises: 'id, program_day_id, exercise_id, order_index',
  workouts: 'id, date, program_day_id, updated_at',
  sets: 'id, workout_id, exercise_id, completed_at',
  bodyweight_logs: 'id, date',
  measurements: 'id, date',
  // Phase 5 — not in 01-schema.sql originally; see 02-schema-meals.sql.
  meal_presets: 'id, updated_at',
  meal_logs: 'id, date, meal_preset_id',
  // Phase 2 tables — defined now so no schema migration is needed later.
  outbox: '++seq, table_name, op, row_id, created_at', // pending pushes to Supabase
  meta: 'key', // e.g. { key: 'last_pull_at', value: ISO string }
  sync_errors: 'id, table_name, row_id, failed_at', // an outbox entry that failed 5x — build-plan §5
  // Local-only, deliberately never synced to Supabase: which exercise's
  // rest timer is running, keyed by workout so it survives a reload.
  // It's ephemeral UI state, not training data — nothing in 01-schema.sql
  // corresponds to it and nothing should.
  active_rest: 'workout_id',
})

// v2 — per-slot session state and daily habits.
db.version(2).stores({
  // One row per (workout, programmed slot). Holds the two things that vary
  // per session without changing the program: a substituted exercise, and
  // the traffic-light pain reading for that lift. Compound index so the
  // logging screen can look a slot up directly.
  workout_exercises: 'id, workout_id, [workout_id+program_exercise_id]',
  // One row per calendar day: the program's daily SI routine plus the habits
  // it prescribes (steps, cardio, water). Keyed by local date string.
  daily_logs: 'id, &date',
})

// v3 — profiles. One row per user holding everything that used to be a
// constant in the source: macro targets, step/water goals, display units,
// which programme was seeded, and whether the SI-joint material applies.
// Without this the app only ever fits one person.
db.version(3).stores({
  profiles: 'id, &user_id',
})

// IDs are generated on-device, never assigned by a server — a set confirmed
// with the phone in airplane mode still needs a permanent, unique id right
// then. crypto.randomUUID() is a browser built-in; collision odds are
// astronomically small, so two offline devices can never clash.
export const newId = () => crypto.randomUUID()

// "What did I do last time?" — this is what pre-fills the logger so most
// sets are one tap to confirm (build-plan §7 item 5). Mirrors the
// `last_performance` view in 01-schema.sql, but computed locally since
// this screen never reads from Supabase at runtime (rule #1).
export async function getLastPerformanceByExercise(exerciseId, excludeWorkoutId) {
  const rows = await db.sets
    .where('exercise_id')
    .equals(exerciseId)
    .filter((s) => s.workout_id !== excludeWorkoutId && !s.is_warmup && !s.deleted_at)
    .toArray()
  rows.sort((a, b) => new Date(b.completed_at) - new Date(a.completed_at))
  const bySetNumber = {}
  for (const r of rows) {
    if (!(r.set_number in bySetNumber)) bySetNumber[r.set_number] = r
  }
  return bySetNumber
}

// --- Write helpers: every user-data write goes through one of these three,
// so "write locally + queue for Supabase" (build-plan §5) can't be
// forgotten at a call site. Local write and outbox entry happen together;
// the UI never waits for either — both are plain IndexedDB writes.
const SYNCED_TABLES = new Set(['exercises', 'program_days', 'program_exercises', 'workouts', 'sets', 'bodyweight_logs', 'measurements', 'meal_presets', 'meal_logs', 'workout_exercises', 'daily_logs', 'profiles'])

async function queuePush(table, rowId) {
  if (!SYNCED_TABLES.has(table)) return // e.g. active_rest — local-only, never synced

  // One pending entry per row is enough. The drain reads the CURRENT row out
  // of Dexie when it uploads, so a single queued entry already covers every
  // edit made to that row before it goes up.
  //
  // Without this, each nudge of a stepper queued its own upload: a few taps
  // on steps or water enqueued dozens of identical pushes of the same row,
  // which is most of what "73 changes waiting to upload" actually was.
  //
  // The existing entry is kept rather than replaced, so its position in the
  // queue survives — order matters when a row references another (a workout
  // has to land before its sets).
  const already = await db.outbox.where('row_id').equals(rowId).first()
  if (already && already.table_name === table) return

  await db.outbox.add({ table_name: table, op: 'upsert', row_id: rowId, created_at: new Date().toISOString(), attempts: 0 })
}

export async function upsertRow(table, row) {
  await db[table].put(row)
  await queuePush(table, row.id)
}

export async function updateRow(table, id, patch) {
  await db[table].update(id, patch)
  await queuePush(table, id)
}

// Soft delete only — build-plan §3a: "without deleted_at, deletions never
// propagate between devices." The row stays in Dexie with deleted_at set;
// every read that lists rows for a human to see must filter it back out.
export async function softDeleteRow(table, id) {
  const now = new Date().toISOString()
  await db[table].update(id, { deleted_at: now, updated_at: now })
  await queuePush(table, id)
}

export default db
