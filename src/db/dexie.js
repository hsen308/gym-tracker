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
  // Phase 2 tables — defined now so no schema migration is needed later.
  outbox: '++seq, table_name, op, row_id, created_at', // pending pushes to Supabase
  meta: 'key', // e.g. { key: 'last_pull_at', value: ISO string }
  // Local-only, deliberately never synced to Supabase: which exercise's
  // rest timer is running, keyed by workout so it survives a reload.
  // It's ephemeral UI state, not training data — nothing in 01-schema.sql
  // corresponds to it and nothing should.
  active_rest: 'workout_id',
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
    .filter((s) => s.workout_id !== excludeWorkoutId && !s.is_warmup)
    .toArray()
  rows.sort((a, b) => new Date(b.completed_at) - new Date(a.completed_at))
  const bySetNumber = {}
  for (const r of rows) {
    if (!(r.set_number in bySetNumber)) bySetNumber[r.set_number] = r
  }
  return bySetNumber
}

export default db
