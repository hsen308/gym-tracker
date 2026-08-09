// JSON export/import — build-plan §Phase 2 item 3: "Build this even though
// sync exists; it is the insurance policy." iOS Safari can evict IndexedDB
// after ~7 days unused if the PWA isn't installed to the home screen (§9);
// this is the backstop sync alone doesn't cover.
import { db } from './dexie'

const DATA_TABLES = ['exercises', 'program_days', 'program_exercises', 'workouts', 'sets', 'bodyweight_logs', 'measurements', 'meal_presets', 'meal_logs', 'workout_exercises', 'daily_logs', 'profiles']
const EXPORT_VERSION = 1

export async function exportAll() {
  const payload = { version: EXPORT_VERSION, exported_at: new Date().toISOString(), tables: {} }
  for (const table of DATA_TABLES) {
    payload.tables[table] = await db[table].toArray()
  }
  return payload
}

// Triggers a real file download — no server round trip, just a Blob URL.
export async function downloadExport() {
  const payload = await exportAll()
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `gym-tracker-export-${payload.exported_at.slice(0, 10)}.json`
  a.click()
  URL.revokeObjectURL(url)
}

// Restores from a previously exported file. `put` (not `add`) makes this
// safe to re-run — importing the same file twice overwrites rows with
// themselves instead of throwing on duplicate ids. Every imported row is
// also re-queued to the outbox: harmless if it's already on the server
// (an upsert of identical data), necessary if this is a fresh device that
// hasn't synced yet.
export async function importAll(payload) {
  if (!payload?.tables) throw new Error('Not a valid export file')
  const now = new Date().toISOString()

  await db.transaction('rw', [...DATA_TABLES.map((t) => db[t]), db.outbox], async () => {
    for (const table of DATA_TABLES) {
      const rows = payload.tables[table]
      if (!Array.isArray(rows) || !rows.length) continue
      await db[table].bulkPut(rows)
      await db.outbox.bulkAdd(
        rows.map((r) => ({ table_name: table, op: 'upsert', row_id: r.id, created_at: now, attempts: 0 })),
      )
    }
  })
}

export function readFileAsJson(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      try { resolve(JSON.parse(reader.result)) }
      catch { reject(new Error('That file is not valid JSON')) }
    }
    reader.onerror = () => reject(reader.error)
    reader.readAsText(file)
  })
}
