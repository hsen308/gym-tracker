// Sync engine — build-plan.md §5. Two one-way passes, run back to back:
// push whatever changed locally, then pull whatever changed remotely.
// Neither pass ever blocks a screen; both are called from SyncProvider on
// a timer/event, never from inside a render or a user action.
import { db, newId } from './dexie'
import { supabase, isSupabaseConfigured } from './supabase'

const SYNCED_TABLES = ['exercises', 'program_days', 'program_exercises', 'workouts', 'sets', 'bodyweight_logs', 'measurements', 'meal_presets', 'meal_logs', 'workout_exercises', 'daily_logs', 'profiles']
const MAX_ATTEMPTS = 5

// Drains the outbox in insertion order (`orderBy('seq')` — seq is an
// auto-incrementing primary key, so this is FIFO). On failure it stops
// entirely rather than skipping ahead, per §5: "preserve order, retry the
// whole queue next cycle." An entry only gets skipped once it's failed
// MAX_ATTEMPTS times, at which point it's parked in sync_errors instead of
// blocking every entry behind it forever.
// Put parked entries back in the queue. A row lands in sync_errors when the
// server rejects it five times — which in practice means a schema problem,
// not a transient one. Once that's fixed the rows are no longer queued
// anywhere, so without this they'd stay stranded locally forever.
export async function retrySyncErrors() {
  const errors = await db.sync_errors.toArray()
  if (!errors.length) return 0

  const now = new Date().toISOString()
  await db.transaction('rw', db.outbox, db.sync_errors, async () => {
    for (const e of errors) {
      await db.outbox.add({ table_name: e.table_name, op: 'upsert', row_id: e.row_id, created_at: now, attempts: 0 })
      await db.sync_errors.delete(e.id)
    }
  })
  return errors.length
}

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

    // `updated_at` is deliberately NOT sent. The server stamps it — column
    // default on insert, touch_updated_at trigger on update — so it always
    // means "when the server saw this", which is the only thing a pull
    // watermark can safely compare against.
    //
    // Sending the local clock instead was silently losing rows: a session
    // logged at 10:00 whose upload was stuck behind a failing entry would
    // finally reach the server at 12:00 still carrying updated_at=10:00.
    // Any device that had already pulled past 10:00 filtered it out forever.
    // Two devices with slightly different clocks lose rows the same way.
    const { updated_at, ...payload } = row
    const { error } = await supabase.from(entry.table_name).upsert(payload)
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
const EPOCH = '1970-01-01T00:00:00.000Z'

// Watermarks are PER TABLE. A single shared one meant a table that errored
// (a column the server didn't have yet, say) got skipped while the shared
// watermark still advanced past its rows — so once the schema was fixed,
// those rows were already behind the line and never came down.
export async function pullChanges() {
  if (!isSupabaseConfigured || !navigator.onLine) return

  const stored = (await db.meta.get('pull_watermarks'))?.value ?? {}
  // Migrate the old single watermark, but rewind it: rows may have been
  // pushed carrying a stale client `updated_at` and skipped. Starting these
  // tables from scratch re-reads everything once and heals those gaps.
  const legacy = (await db.meta.get('last_pull_at'))?.value
  const watermarks = { ...stored }

  for (const table of SYNCED_TABLES) {
    const from = watermarks[table] ?? EPOCH
    const { data, error } = await supabase.from(table).select('*').gt('updated_at', from).order('updated_at')
    // Leave this table's watermark untouched on failure so its rows are
    // retried next cycle rather than skipped permanently.
    if (error || !data) continue

    let latest = from
    for (const row of data) {
      await db[table].put(row)
      if (row.updated_at > latest) latest = row.updated_at
    }
    watermarks[table] = latest
  }

  await db.meta.put({ key: 'pull_watermarks', value: watermarks })
  if (legacy) await db.meta.delete('last_pull_at')
}

export async function runSync() {
  await drainOutbox()
  await pullChanges()
}

export async function pendingCount() {
  return db.outbox.count()
}
