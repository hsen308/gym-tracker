// The date the program began — the single input both the return protocol
// (weeks 1–3) and the deload cycle (every 7th week) are computed from.
//
// Set once, automatically, from the earliest workout on record rather than
// asked for in a setup form: the first session you log IS the start of the
// program, and a date you have to remember to enter is a date that ends up
// wrong. Stored in meta so it survives even if that first workout is later
// deleted.
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/dexie'

export function useProgramStart() {
  return useLiveQuery(async () => {
    const stored = await db.meta.get('program_started_at')
    if (stored?.value) return stored.value

    const workouts = await db.workouts.filter((w) => !w.deleted_at).toArray()
    if (!workouts.length) return null
    const earliest = workouts.reduce((min, w) => (w.date < min ? w.date : min), workouts[0].date)
    await db.meta.put({ key: 'program_started_at', value: earliest })
    return earliest
  }, [])
}
