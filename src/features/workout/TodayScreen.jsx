import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate } from 'react-router-dom'
import { format } from 'date-fns'
import { db } from '../../db/dexie'
import Button from '../../components/Button'
import OfflineBadge from '../../components/OfflineBadge'
import Icon from '../../components/Icon'
import InstallPrompt from '../../components/InstallPrompt'
import DailyRoutine from '../daily/DailyRoutine'
import MorningCheck from '../daily/MorningCheck'
import HabitCard from '../daily/HabitCard'
import AdalimumabCard from '../medication/AdalimumabCard'
import CreatineCard from '../habits/CreatineCard'
import { programPhase, weeksToDeload } from '../../lib/phase'
import { useProgramStart } from '../../lib/useProgramStart'

export default function TodayScreen() {
  const navigate = useNavigate()
  const [checksOpen, setChecksOpen] = useState(false)
  const days = useLiveQuery(() => db.program_days.orderBy('order_index').toArray(), [])
  const unfinished = useLiveQuery(
    () => db.workouts.filter((w) => !w.finished_at && !w.skipped_at && !w.deleted_at).first(),
    [],
  )
  const lastFinished = useLiveQuery(async () => {
    const all = await db.workouts.filter((w) => (!!w.finished_at || !!w.skipped_at) && !w.deleted_at).toArray()
    all.sort((a, b) => (b.date.localeCompare(a.date)) || (new Date(b.updated_at ?? 0) - new Date(a.updated_at ?? 0)))
    return all[0]
  }, [])
  const exerciseCounts = useLiveQuery(async () => {
    const all = await db.program_exercises.filter((pe) => !pe.deleted_at).toArray()
    return all.reduce((counts, pe) => ({ ...counts, [pe.program_day_id]: (counts[pe.program_day_id] ?? 0) + 1 }), {})
  }, [])

  const programStart = useProgramStart()
  const phase = programPhase(programStart)
  if (days === undefined || exerciseCounts === undefined) return null

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
            <p className="next-focus">{featured.focus} - {exerciseCounts[featured.id] ?? 0} exercises</p>
          </div>
          {phase?.note && <p className="phase-note">{phase.note}</p>}
          <Button className="btn-block" onClick={() => navigate(unfinished ? `/workout/${unfinished.id}` : `/day/${featured.id}`)}>
            {unfinished ? `Resume ${featured.name}` : `View ${featured.name}`}
          </Button>
        </div>
      ) : <p className="empty">No program loaded yet.</p>}

      <button className="panel coach-card pressable" onClick={() => navigate('/coach')}>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span className="label">Coach's report</span>
          <span className="coach-card-line">{phase?.week != null ? `Week ${phase.week}` : 'Program'} - what the numbers say, in one line</span>
        </span>
        <Icon name="chevron" size={16} className="faint" />
      </button>

      <section style={{ marginTop: 'var(--space-5)' }}>
        <div className="row section-label" style={{ marginBottom: checksOpen ? 'var(--space-3)' : 0 }}>
          <h2 className="label">Daily health</h2>
          <button type="button" className="btn btn-ghost pressable" style={{ minHeight: 32, padding: 4 }} onClick={() => setChecksOpen((open) => !open)} aria-label="toggle daily health" aria-expanded={checksOpen}>
            <Icon name="chevron" size={16} className="faint" />
          </button>
        </div>
        {checksOpen && (
          <div className="stack-3">
            <MorningCheck />
            <HabitCard />
            <AdalimumabCard />
            <DailyRoutine />
            <CreatineCard />
          </div>
        )}
      </section>

      <div className="row section-label" style={{ marginTop: 'var(--space-5)' }}>
        <h2 className="label">All sessions</h2>
        {phase?.week != null && <span className="label">Week {phase.week}{toDeload === 0 ? ' - deload' : toDeload === 1 ? ' - deload next' : ''}</span>}
      </div>
      <div className="panel rule-list">
        {days.map((day, i) => (
          <button key={day.id} className="day-row pressable" onClick={() => navigate(`/day/${day.id}`)}>
            <span className="day-row-index">{String(i + 1).padStart(2, '0')}</span>
            <span className="day-row-main">
              <span className="day-row-name">{day.name}</span>
              <span className="day-row-focus">{day.focus} - {exerciseCounts[day.id] ?? 0} exercises</span>
            </span>
            <Icon name="chevron" size={16} className="faint" />
          </button>
        ))}
      </div>
    </div>
  )
}

function suggestNextDay(days, lastWorkout) {
  if (!days?.length) return null
  if (!lastWorkout) return days[0]
  const lastIndex = days.findIndex((d) => d.id === lastWorkout.program_day_id)
  return lastIndex === -1 ? days[0] : days[(lastIndex + 1) % days.length]
}