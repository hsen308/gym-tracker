// Phase 3 item 1 (build-plan §7): sessions by date, day name, set count,
// duration, pain score. Reads only from Dexie — history is exactly the
// kind of screen rule #1 exists for for: it must work offline too.
import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate } from 'react-router-dom'
import { format, parseISO } from 'date-fns'
import { db } from '../../db/dexie'
import { formatDuration } from '../../lib/format'

export default function HistoryList() {
  const navigate = useNavigate()

  const workouts = useLiveQuery(async () => {
    const all = await db.workouts.filter((w) => !!w.finished_at && !w.deleted_at).toArray()
    all.sort((a, b) => new Date(b.finished_at) - new Date(a.finished_at))
    return all
  }, [])
  const days = useLiveQuery(() => db.program_days.toArray(), [])
  const setCounts = useLiveQuery(async () => {
    const all = await db.sets.filter((s) => !s.deleted_at).toArray()
    const counts = {}
    for (const s of all) counts[s.workout_id] = (counts[s.workout_id] ?? 0) + 1
    return counts
  }, [])

  if (!workouts || !days || !setCounts) return null
  const dayById = Object.fromEntries(days.map((d) => [d.id, d]))

  return (
    <div className="container history-screen">
      <header className="today-header">
        <span className="stepper-label">History</span>
      </header>

      {workouts.length === 0 ? (
        <p className="muted">No sessions yet. Start today's workout.</p>
      ) : (
        <div className="stack-2">
          {workouts.map((w) => {
            const duration = (new Date(w.finished_at) - new Date(w.started_at)) / 1000
            return (
              <button key={w.id} className="card history-row pressable" onClick={() => navigate(`/history/${w.id}`)}>
                <div>
                  <div style={{ fontWeight: 600 }}>{dayById[w.program_day_id]?.name ?? 'Workout'}</div>
                  <div className="faint" style={{ fontSize: 13 }}>{format(parseISO(w.date), 'EEE, MMM d')}</div>
                </div>
                <div className="history-row-stats">
                  <span className="mono muted">{setCounts[w.id] ?? 0} sets</span>
                  <span className="mono muted">{formatDuration(duration)}</span>
                  {w.si_pain_score > 0 && <span className="mono" style={{ color: 'var(--warn)' }}>Pain {w.si_pain_score}</span>}
                </div>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
