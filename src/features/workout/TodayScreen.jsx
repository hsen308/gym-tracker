// useLiveQuery (dexie-react-hooks) re-runs its callback and re-renders this
// component automatically whenever the Dexie tables it touches change — no
// manual "refetch after I write something" plumbing. This is the reactive
// glue that makes build-plan rule #1 ("write to Dexie, UI updates
// immediately") actually true in practice.
import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate } from 'react-router-dom'
import { format } from 'date-fns'
import { db, newId, upsertRow } from '../../db/dexie'
import { useAuth } from '../../app/AuthProvider'
import { todayLocalDate } from '../../lib/format'
import Button from '../../components/Button'
import OfflineBadge from '../../components/OfflineBadge'
import Icon from '../../components/Icon'

export default function TodayScreen() {
  const { user } = useAuth()
  const navigate = useNavigate()

  const days = useLiveQuery(() => db.program_days.orderBy('order_index').toArray(), [])
  const unfinished = useLiveQuery(() => db.workouts.filter((w) => !w.finished_at && !w.deleted_at).first(), [])
  const lastFinished = useLiveQuery(async () => {
    const all = await db.workouts.filter((w) => !!w.finished_at && !w.deleted_at).toArray()
    all.sort((a, b) => new Date(b.finished_at) - new Date(a.finished_at))
    return all[0]
  }, [])
  const exerciseCounts = useLiveQuery(async () => {
    const all = await db.program_exercises.filter((pe) => !pe.deleted_at).toArray()
    const counts = {}
    for (const pe of all) counts[pe.program_day_id] = (counts[pe.program_day_id] ?? 0) + 1
    return counts
  }, [])

  if (days === undefined || exerciseCounts === undefined) return null // first Dexie read still in flight

  const nextDay = suggestNextDay(days, lastFinished)
  const resumeDay = unfinished ? days.find((d) => d.id === unfinished.program_day_id) : null

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
    await upsertRow('workouts', workout)
    navigate(`/workout/${workout.id}`)
  }

  const featured = resumeDay ?? nextDay

  return (
    <div className="container screen">
      <header className="screen-head">
        <div>
          <p className="label">{format(new Date(), 'EEEE d MMM')}</p>
          <h1 className="readout screen-title">TODAY</h1>
        </div>
        <OfflineBadge />
      </header>

      {featured ? (
        <div className="panel next-card">
          <div>
            <p className="label">{unfinished ? 'In progress' : 'Next session'}</p>
            <p className="readout next-day-name" style={{ marginTop: 8 }}>{featured.name.toUpperCase()}</p>
          </div>
          <div className="next-meta">
            <div>
              <p className="label">Focus</p>
              <p className="mono" style={{ fontSize: 13, marginTop: 4 }}>{featured.focus}</p>
            </div>
            <div>
              <p className="label">Exercises</p>
              <p className="mono" style={{ fontSize: 13, marginTop: 4 }}>{exerciseCounts[featured.id] ?? 0}</p>
            </div>
          </div>
          <Button
            className="btn-block"
            onClick={() => (unfinished ? navigate(`/workout/${unfinished.id}`) : startDay(featured))}
          >
            {unfinished ? `Resume ${featured.name}` : `Start ${featured.name}`}
          </Button>
        </div>
      ) : (
        <p className="empty">No program loaded yet.</p>
      )}

      <h2 className="label section-label">All sessions</h2>
      <div className="panel rule-list">
        {days.map((day, i) => (
          <button key={day.id} className="day-row pressable" onClick={() => startDay(day)}>
            <span className="day-row-index">{String(i + 1).padStart(2, '0')}</span>
            <span className="day-row-name">{day.name}</span>
            <span className="mono faint" style={{ fontSize: 12 }}>{day.focus}</span>
            <Icon name="chevron" size={16} className="faint" />
          </button>
        ))}
      </div>
    </div>
  )
}

// Rotation: whatever day followed the last *finished* workout's day, wrapping
// back to day 0 after the last. Falls back to day 0 with no history, or if
// the referenced day was deleted.
function suggestNextDay(days, lastWorkout) {
  if (!days?.length) return null
  if (!lastWorkout) return days[0]
  const lastIndex = days.findIndex((d) => d.id === lastWorkout.program_day_id)
  if (lastIndex === -1) return days[0]
  return days[(lastIndex + 1) % days.length]
}
