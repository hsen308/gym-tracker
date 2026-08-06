// The date the program began — the single input both the return protocol
// (weeks 1–3) and the deload cycle (every 7th week) are computed from.
//
// Derived from the earliest logged workout rather than asked for in a setup
// form: the first session you log IS the start of the program, and a date you
// have to remember to enter is a date that ends up wrong. Once derived it's
// persisted, so the count survives deleting that first workout later.
import { useEffect } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/dexie'

export function useProgramStart() {
  // Strictly READ-ONLY. Dexie runs a liveQuery callback inside a read-only
  // transaction, so a write in here throws ReadOnlyError and takes the whole
  // screen down with it — which is exactly what happened when this hook
  // persisted the derived date inline.
  const start = useLiveQuery(async () => {
    const stored = await db.meta.get('program_started_at')
    if (stored?.value) return stored.value

    const workouts = await db.workouts.filter((w) => !w.deleted_at).toArray()
    if (!workouts.length) return null
    return workouts.reduce((min, w) => (w.date < min ? w.date : min), workouts[0].date)
  }, [])

  // The write lives here instead: an effect runs outside any transaction, so
  // it's free to persist. Guarded on the stored value so it only ever writes
  // once, and re-checked inside in case another tab got there first.
  useEffect(() => {
    if (!start) return
    let cancelled = false
    db.meta.get('program_started_at').then((existing) => {
      if (!cancelled && !existing?.value) db.meta.put({ key: 'program_started_at', value: start })
    })
    return () => { cancelled = true }
  }, [start])

  return start
}
