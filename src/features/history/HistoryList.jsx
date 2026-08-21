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

  // EVERY session, not just finished ones. Filtering on finished_at left
  // abandoned and empty sessions with nowhere to appear — so there was no
  // way to reach them to delete or skip them, and they quietly skewed the
  // day rotation forever.
  const workouts = useLiveQuery(async () => {
    const all = await db.workouts.filter((w) => !w.deleted_at).toArray()
    // By training day, not by when it was typed up — a session logged three
    // days late belongs where it happened, not at the top of the list.
    all.sort((a, b) => (b.date.localeCompare(a.date)) || (new Date(b.updated_at ?? 0) - new Date(a.updated_at ?? 0)))
    return all
  }, [])
  const days = useLiveQuery(() => db.program_days.toArray(), [])
  const setCounts = useLiveQuery(async () => {
    const all = await db.sets.filter((s) => !s.deleted_at && !s.is_warmup).toArray()
    const counts = {}
    for (const s of all) counts[s.workout_id] = (counts[s.workout_id] ?? 0) + 1
    return counts
  }, [])

  if (!workouts || !days || !setCounts) return null
  const dayById = Object.fromEntries(days.map((d) => [d.id, d]))

  const completed = workouts.filter((w) => w.finished_at && !w.skipped_at).length
  const needsTidying = workouts.filter((w) => !w.finished_at && !w.skipped_at && !(setCounts[w.id] > 0)).length

  return (
    <div className="container screen">
      <header className="screen-head">
        <div>
          <p className="label">{completed} completed</p>
          <h1 className="readout screen-title">HISTORY</h1>
        </div>
      </header>

      {needsTidying > 0 && (
        <div className="callout callout-warn" style={{ marginBottom: 'var(--space-4)' }}>
          <p className="label label-strong">{needsTidying} empty session{needsTidying === 1 ? '' : 's'}</p>
          <p>Opened but never logged. Tap one to delete it, or mark it skipped if you missed that day.</p>
        </div>
      )}

      {workouts.length === 0 ? (
        <p className="empty">No sessions yet. Start today's workout and it'll show up here.</p>
      ) : (
        <div className="rule-list">
          {workouts.map((w) => {
            const setCount = setCounts[w.id] ?? 0
            const duration = w.finished_at ? (new Date(w.finished_at) - new Date(w.started_at)) / 1000 : null
            const skipped = !!w.skipped_at
            const unfinished = !w.finished_at && !skipped

            return (
              <button key={w.id} className="hist-row pressable" onClick={() => navigate(`/history/${w.id}`)}>
                <span className="hist-date">
                  {format(parseISO(w.date), 'dd MMM').toUpperCase()}<br />
                  <span className="faint">{format(parseISO(w.date), 'yyyy')}</span>
                </span>
                <span className="hist-main">
                  <span className="hist-name">
                    {dayById[w.program_day_id]?.name ?? 'Workout'}
                    {skipped && <span className="tag tag-caution" style={{ marginLeft: 6 }}>SKIPPED</span>}
                    {unfinished && setCount === 0 && <span className="tag tag-swap" style={{ marginLeft: 6 }}>EMPTY</span>}
                    {unfinished && setCount > 0 && <span className="tag tag-swap" style={{ marginLeft: 6 }}>UNFINISHED</span>}
                  </span>
                  <span className="hist-stats">
                    {skipped
                      ? 'Not trained'
                      : `${setCount} set${setCount === 1 ? '' : 's'}${duration != null ? ` · ${formatDuration(duration)}` : ''}${w.si_pain_score > 0 ? ` · SI ${w.si_pain_score}` : ''}`}
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
