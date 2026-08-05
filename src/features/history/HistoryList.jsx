// Phase 3 item 1 (build-plan §7): sessions by date, day name, set count,
// duration, pain score. Reads only from Dexie — history is exactly the kind
// of screen rule #1 exists for: it must work with no signal too.
import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate } from 'react-router-dom'
import { format, parseISO } from 'date-fns'
import { db } from '../../db/dexie'
import { formatDuration } from '../../lib/format'
import Icon from '../../components/Icon'

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
    <div className="container screen">
      <header className="screen-head">
        <div>
          <p className="label">{workouts.length} session{workouts.length === 1 ? '' : 's'}</p>
          <h1 className="readout screen-title">HISTORY</h1>
        </div>
      </header>

      {workouts.length === 0 ? (
        <p className="empty">No sessions yet. Start today's workout and it'll show up here.</p>
      ) : (
        <div className="rule-list">
          {workouts.map((w) => {
            const duration = (new Date(w.finished_at) - new Date(w.started_at)) / 1000
            return (
              <button key={w.id} className="hist-row pressable" onClick={() => navigate(`/history/${w.id}`)}>
                <span className="hist-date">
                  {format(parseISO(w.date), 'dd MMM').toUpperCase()}<br />
                  <span className="faint">{format(parseISO(w.date), 'yyyy')}</span>
                </span>
                <span className="hist-main">
                  <span className="hist-name">{dayById[w.program_day_id]?.name ?? 'Workout'}</span>
                  <span className="hist-stats">
                    {setCounts[w.id] ?? 0} sets · {formatDuration(duration)}
                    {w.si_pain_score > 0 ? ` · SI ${w.si_pain_score}` : ''}
                  </span>
                </span>
                <Icon name="chevron" size={16} className="faint" />
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
