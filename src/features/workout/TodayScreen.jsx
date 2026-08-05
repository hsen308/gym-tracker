// useLiveQuery (from dexie-react-hooks) re-runs its callback and re-renders
// this component automatically whenever the Dexie tables it touches change
// — no manual "refetch after I write something" plumbing. This is the
// reactive glue that makes build-plan rule #1 ("write to Dexie, UI updates
// immediately") actually true in practice.
import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate } from 'react-router-dom'
import { db, newId } from '../../db/dexie'
import { useAuth } from '../../app/AuthProvider'
import { todayLocalDate } from '../../lib/format'
import Button from '../../components/Button'
import OfflineBadge from '../../components/OfflineBadge'

export default function TodayScreen() {
  const { user } = useAuth()
  const navigate = useNavigate()

  const days = useLiveQuery(() => db.program_days.orderBy('order_index').toArray(), [])
  const unfinished = useLiveQuery(() => db.workouts.filter((w) => !w.finished_at).first(), [])
  const lastFinished = useLiveQuery(async () => {
    const all = await db.workouts.filter((w) => !!w.finished_at).toArray()
    all.sort((a, b) => new Date(b.finished_at) - new Date(a.finished_at))
    return all[0]
  }, [])

  if (days === undefined) return null // still reading from IndexedDB on first paint

  const nextDay = suggestNextDay(days, lastFinished)

  const startDay = async (day) => {
    const now = new Date().toISOString()
    const workout = {
      id: newId(),
      user_id: user.id,
      program_day_id: day.id,
      date: todayLocalDate(),
      started_at: now,
      finished_at: null,
      bodyweight_kg: null,
      si_pain_score: null,
      energy: null,
      sleep_hours: null,
      notes: null,
      created_at: now,
      updated_at: now,
      deleted_at: null,
    }
    await db.workouts.add(workout)
    navigate(`/workout/${workout.id}`)
  }

  return (
    <div className="container today-screen">
      <header className="row today-header">
        <span className="stepper-label">Today</span>
        <OfflineBadge />
      </header>

      {unfinished ? (
        <div className="stack-3" style={{ marginBottom: 'var(--space-7)' }}>
          <p className="muted">You have a session in progress.</p>
          <Button className="btn-block" onClick={() => navigate(`/workout/${unfinished.id}`)}>
            Resume {days.find((d) => d.id === unfinished.program_day_id)?.name ?? 'workout'}
          </Button>
        </div>
      ) : nextDay ? (
        <div style={{ marginBottom: 'var(--space-7)' }}>
          <Button className="btn-block" onClick={() => startDay(nextDay)}>
            Start {nextDay.name}
          </Button>
        </div>
      ) : (
        <p className="muted" style={{ marginBottom: 'var(--space-7)' }}>No sessions yet. Start today's workout.</p>
      )}

      {days.length > 0 && (
        <>
          <h2 className="section-label">Or pick a day</h2>
          <div className="stack-2">
            {days.map((day) => (
              <button key={day.id} className="btn btn-secondary pressable btn-block day-pick" onClick={() => startDay(day)}>
                <span>{day.name}</span>
                <span className="faint">{day.focus}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

// Rotation logic: whatever day followed the last *finished* workout's day,
// wrapping back to day 0 after the last one. Falls back to day 0 if
// there's no history yet, or the referenced day was deleted/swapped.
function suggestNextDay(days, lastWorkout) {
  if (!days?.length) return null
  if (!lastWorkout) return days[0]
  const lastIndex = days.findIndex((d) => d.id === lastWorkout.program_day_id)
  if (lastIndex === -1) return days[0]
  return days[(lastIndex + 1) % days.length]
}
