// useLiveQuery (dexie-react-hooks) re-runs its callback and re-renders this
// component automatically whenever the Dexie tables it touches change — no
// manual "refetch after I write something" plumbing. This is the reactive
// glue that makes build-plan rule #1 ("write to Dexie, UI updates
// immediately") actually true in practice.
import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate } from 'react-router-dom'
import { format } from 'date-fns'
import { db } from '../../db/dexie'
import Button from '../../components/Button'
import OfflineBadge from '../../components/OfflineBadge'
import Icon from '../../components/Icon'
import InstallPrompt from '../../components/InstallPrompt'
import DailyRoutine from '../daily/DailyRoutine'
import { programPhase, weeksToDeload } from '../../lib/phase'
import { useProgramStart } from '../../lib/useProgramStart'

export default function TodayScreen() {
  const navigate = useNavigate()

  const days = useLiveQuery(() => db.program_days.orderBy('order_index').toArray(), [])
  const unfinished = useLiveQuery(
    () => db.workouts.filter((w) => !w.finished_at && !w.skipped_at && !w.deleted_at).first(),
    [],
  )
  const lastFinished = useLiveQuery(async () => {
    const all = await db.workouts
      .filter((w) => (!!w.finished_at || !!w.skipped_at) && !w.deleted_at)
      .toArray()
    const at = (w) => w.finished_at ?? w.skipped_at
    all.sort((a, b) => new Date(at(b)) - new Date(at(a)))
    return all[0]
  }, [])
  const exerciseCounts = useLiveQuery(async () => {
    const all = await db.program_exercises.filter((pe) => !pe.deleted_at).toArray()
    const counts = {}
    for (const pe of all) counts[pe.program_day_id] = (counts[pe.program_day_id] ?? 0) + 1
    return counts
  }, [])

  const programStart = useProgramStart()
  const phase = programPhase(programStart)

  if (days === undefined || exerciseCounts === undefined) return null // first Dexie read still in flight

  const nextDay = suggestNextDay(days, lastFinished)
  const resumeDay = unfinished ? days.find((d) => d.id === unfinished.program_day_id) : null
  const featured = resumeDay ?? nextDay
  const toDeload = weeksToDeload(phase?.week)

  return (
    <div className="container screen">
      <header className="screen-head">
        <div>
          <p className="label">{format(new Date(), 'EEEE d MMMM')}</p>
          <h1 className="readout screen-title">TODAY</h1>
        </div>
        <OfflineBadge />
      </header>

      <InstallPrompt />

      {featured ? (
        <div className="panel next-card">
          <div>
            <p className="label label-strong">{unfinished ? 'In progress' : 'Up next'}</p>
            <p className="readout next-day-name">{featured.name.toUpperCase()}</p>
            <p className="next-focus">{featured.focus} · {exerciseCounts[featured.id] ?? 0} exercises</p>
          </div>

          {phase?.note && <p className="phase-note">{phase.note}</p>}

          {/* Opening a day now PREVIEWS it. Starting is a separate, explicit
              tap on the preview screen — checking what's on Push A shouldn't
              leave a half-finished session behind. */}
          {unfinished ? (
            <Button className="btn-block" onClick={() => navigate(`/workout/${unfinished.id}`)}>
              Resume {featured.name}
            </Button>
          ) : (
            <Button className="btn-block" onClick={() => navigate(`/day/${featured.id}`)}>
              View {featured.name}
            </Button>
          )}
        </div>
      ) : (
        <p className="empty">No program loaded yet.</p>
      )}

      <div style={{ marginTop: 'var(--space-4)' }}>
        <DailyRoutine />
      </div>

      <div className="row section-label">
        <h2 className="label">All sessions</h2>
        {phase?.week != null && (
          <span className="label">
            Week {phase.week}{toDeload === 0 ? ' · deload' : toDeload === 1 ? ' · deload next' : ''}
          </span>
        )}
      </div>
      <div className="panel rule-list">
        {days.map((day, i) => (
          <button key={day.id} className="day-row pressable" onClick={() => navigate(`/day/${day.id}`)}>
            <span className="day-row-index">{String(i + 1).padStart(2, '0')}</span>
            <span className="day-row-main">
              <span className="day-row-name">{day.name}</span>
              <span className="day-row-focus">{day.focus} · {exerciseCounts[day.id] ?? 0} exercises</span>
            </span>
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
