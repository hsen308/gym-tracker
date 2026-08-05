// Sync engine — build-plan.md §5. Two one-way passes, run back to back:
// push whatever changed locally, then pull whatever changed remotely.
// Neither pass ever blocks a screen; both are called from SyncProvider on
// a timer/event, never from inside a render or a user action.
import { db, newId } from './dexie'
import { supabase, isSupabaseConfigured } from './supabase'

const SYNCED_TABLES = ['exercises', 'program_days', 'program_exercises', 'workouts', 'sets', 'bodyweight_logs', 'measurements', 'meal_presets', 'meal_logs', 'workout_exercises', 'daily_logs']
const MAX_ATTEMPTS = 5

// Drains the outbox in insertion order (`orderBy('seq')` — seq is an
// auto-incrementing primary key, so this is FIFO). On failure it stops
// entirely rather than skipping ahead, per §5: "preserve order, retry the
// whole queue next cycle." An entry only gets skipped once it's failed
// MAX_ATTEMPTS times, at which point it's parked in sync_errors instead of
// blocking every entry behind it forever.
export async function drainOutbox() {
  if (!isSupabaseConfigured || !navigator.onLine) return

  for (;;) {
    const entry = await db.outbox.orderBy('seq').first()
    if (!entry) return // queue empty

    const row = await db[entry.table_name]?.get(entry.row_id)
    if (!row) {
      // Row no longer exists locally (shouldn't happen — deletes are soft —
      // but don't let a stale reference wedge the queue).
      await db.outbox.delete(entry.seq)
      continue
    }

    const { error } = await supabase.from(entry.table_name).upsert(row)
    if (!error) {
      await db.outbox.delete(entry.seq)
      continue
    }

    const attempts = (entry.attempts ?? 0) + 1
    if (attempts >= MAX_ATTEMPTS) {
      await db.sync_errors.add({
        id: newId(),
        table_name: entry.table_name,
        row_id: entry.row_id,
        message: error.message ?? String(error),
        failed_at: new Date().toISOString(),
      })
      await db.outbox.delete(entry.seq) // parked in sync_errors; let the rest of the queue proceed
      continue
    }
    await db.outbox.update(entry.seq, { attempts })
    return // stop draining — preserve order, retry from the front next cycle
  }
}

// Pulls anything changed on the server since the last successful pull.
// Conflict rule (§5): last-write-wins by updated_at — a local `put()`
// unconditionally overwrites, single-user so nothing more elaborate is needed.
export async function pullChanges() {
  if (!isSupabaseConfigured || !navigator.onLine) return

  const metaRow = await db.meta.get('last_pull_at')
  let watermark = metaRow?.value ?? '1970-01-01T00:00:00.000Z'

  for (const table of SYNCED_TABLES) {
    const { data, error } = await supabase.from(table).select('*').gt('updated_at', watermark)
    if (error || !data) continue
    for (const row of data) {
      await db[table].put(row)
      if (row.updated_at > watermark) watermark = row.updated_at
    }
  }
  await db.meta.put({ key: 'last_pull_at', value: watermark })
}

export async function runSync() {
  await drainOutbox()
  await pullChanges()
}

export async function pendingCount() {
  return db.outbox.count()
}
