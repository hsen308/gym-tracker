// The date the programme began — the single input both the return protocol
// (weeks 1–3) and the deload cycle (every 7th week) are computed from.
//
// It lives on the PROFILE, which syncs. It used to be derived per-device from
// the earliest logged workout and cached in `meta`, which is local-only: a
// phone and a laptop holding different history each derived a different week,
// neither agreed with the other, and there was no way to correct either.
//
// Falling back to the earliest workout keeps the zero-setup behaviour for
// anyone who never touches it, but the stored date always wins.
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/dexie'
import { useProfile } from '../app/ProfileProvider'
import { localDateOf } from './time'

export function useProgramStart() {
  const { profile } = useProfile()

  const derived = useLiveQuery(async () => {
    const workouts = await db.workouts.filter((w) => !w.deleted_at).toArray()
    if (!workouts.length) return null
    return workouts.reduce((min, w) => (w.date < min ? w.date : min), workouts[0].date)
  }, [])

  return profile.program_start_date ?? derived ?? null
}

// "I'm on week 5" -> the date week 1 began. Anchored to the start of the
// current week rather than to today, so setting the week on a Thursday
// doesn't put the next boundary three days out of step.
export function startDateForWeek(week, today = new Date()) {
  const daysBack = (Math.max(1, week) - 1) * 7
  const d = new Date(today)
  d.setDate(d.getDate() - daysBack)
  // Monday of that week — the programme's own layout starts there.
  const dayOfWeek = (d.getDay() + 6) % 7 // 0 = Monday
  d.setDate(d.getDate() - dayOfWeek)
  return localDateOf(d)
}
