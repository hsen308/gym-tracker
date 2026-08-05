// Phase 6 (build-plan §7) — the analytics that only make sense once real
// history exists. Everything reads from Dexie; nothing is computed server-side.
import { useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate } from 'react-router-dom'
import { db } from '../../db/dexie'
import { weightTrend } from '../../lib/calc'
import {
  weeklySetsPerMuscle, sessionPointsByExercise, detectStalls,
  calorieAdjustSuggestion, siCorrelation,
} from '../../lib/insights'
import { programPhase, weeksToDeload } from '../../lib/phase'
import { useProgramStart } from '../../lib/useProgramStart'
import { MIN_SESSIONS_FOR_CORRELATION, WEEKLY_SET_BAND, DELOAD_CYCLE_WEEKS } from '../../lib/constants'
import Icon from '../../components/Icon'

export default function InsightsScreen() {
  const navigate = useNavigate()
  const sets = useLiveQuery(() => db.sets.filter((s) => !s.deleted_at).toArray(), [])
  const workouts = useLiveQuery(() => db.workouts.filter((w) => !!w.finished_at && !w.deleted_at).toArray(), [])
  const exercises = useLiveQuery(() => db.exercises.toArray(), [])
  const bwLogs = useLiveQuery(() => db.bodyweight_logs.filter((l) => !l.deleted_at).sortBy('date'), [])

  const ready = sets && workouts && exercises && bwLogs
  const exerciseById = useMemo(() => Object.fromEntries((exercises ?? []).map((e) => [e.id, e])), [exercises])

  const weeklySets = useMemo(() => (ready ? weeklySetsPerMuscle(sets, exerciseById) : {}), [ready, sets, exerciseById])
  const pointsByExercise = useMemo(() => (ready ? sessionPointsByExercise(sets, workouts) : {}), [ready, sets, workouts])
  const stalls = useMemo(() => (ready ? detectStalls(pointsByExercise, exerciseById) : []), [ready, pointsByExercise, exerciseById])
  const correlations = useMemo(() => (ready ? siCorrelation(workouts, sets, exerciseById) : []), [ready, workouts, sets, exerciseById])

  const programStart = useProgramStart()
  const phase = programPhase(programStart)
  const week = phase?.week ?? null
  const toDeload = weeksToDeload(week)

  const trend = ready ? weightTrend(bwLogs) : null
  const avgEnergy = useMemo(() => {
    if (!workouts?.length) return null
    const recent = [...workouts].sort((a, b) => new Date(b.finished_at) - new Date(a.finished_at)).slice(0, 5)
    const withEnergy = recent.filter((w) => w.energy != null)
    return withEnergy.length ? withEnergy.reduce((s, w) => s + w.energy, 0) / withEnergy.length : null
  }, [workouts])
  const calorieSuggestion = ready
    ? calorieAdjustSuggestion({ weightTrendKgPerWeek: trend, stalledLiftCount: stalls.length, avgEnergy })
    : null

  if (!ready) return null

  const muscleRows = Object.entries(weeklySets).sort((a, b) => b[1] - a[1])

  return (
    <div className="container screen">
      <header className="screen-head">
        <div>
          <p className="label">{workouts.length} session{workouts.length === 1 ? '' : 's'} logged</p>
          <h1 className="readout screen-title">TRENDS</h1>
        </div>
      </header>

      {workouts.length === 0 ? (
        <p className="empty">Log a few workouts first. These read real history — with none, they'd just be guesses.</p>
      ) : (
        <div className="stack-3">
          {week != null && (
            <div className="panel insight-block">
              <p className="label">Programme week</p>
              <p className="readout readout-lg" style={{ marginTop: 8 }}>
                WEEK {week}
                <span className="faint" style={{ fontSize: 20 }}>
                  {' '}/ {DELOAD_CYCLE_WEEKS}-week block
                </span>
              </p>
              <p className="muted" style={{ fontSize: 13, marginTop: 8, lineHeight: 1.5 }}>
                {phase.kind === 'deload'
                  ? 'Deload week. Same exercises, half the sets, ~60% of the weight. No hard sets.'
                  : toDeload === 1
                    ? 'Deload next week.'
                    : `${toDeload} weeks to deload.`}
              </p>
              {phase.kind === 'return' && <p className="muted" style={{ fontSize: 13, marginTop: 6, lineHeight: 1.5 }}>{phase.note}</p>}
            </div>
          )}

          <div className="panel insight-block">
            <p className="label" style={{ marginBottom: 'var(--space-4)' }}>
              Weekly sets · target {WEEKLY_SET_BAND.min}–{WEEKLY_SET_BAND.max}
            </p>
            {muscleRows.length === 0 ? (
              <p className="muted" style={{ fontSize: 14 }}>No sets in the last 7 days.</p>
            ) : (
              <div className="stack-3">
                {muscleRows.map(([muscle, count]) => <VolumeRow key={muscle} muscle={muscle} count={count} />)}
              </div>
            )}
          </div>

          <div className="panel insight-block">
            <p className="label" style={{ marginBottom: 'var(--space-2)' }}>Stalling lifts</p>
            {stalls.length === 0 ? (
              <p className="muted" style={{ fontSize: 14 }}>Nothing stalling. Every lift with 4+ sessions is trending up.</p>
            ) : (
              <div className="rule-list">
                {stalls.map((s) => (
                  <button key={s.exerciseId} className="stat-line pressable" onClick={() => navigate(`/exercise/${s.exerciseId}`)}>
                    <span>{s.name}</span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span className="mono faint" style={{ fontSize: 12 }}>flat / down</span>
                      <Icon name="chevron" size={14} className="faint" />
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {calorieSuggestion && (
            <div className="panel insight-block">
              <p className="label">Calorie suggestion</p>
              <p className="readout readout-md" style={{ marginTop: 8 }}>
                {calorieSuggestion.delta > 0 ? '+' : ''}{calorieSuggestion.delta} kcal/day
              </p>
              <p className="muted" style={{ fontSize: 13, marginTop: 8, lineHeight: 1.5 }}>{calorieSuggestion.reason}</p>
            </div>
          )}

          <div className="panel insight-block">
            <p className="label" style={{ marginBottom: 'var(--space-2)' }}>SI joint signal</p>
            {correlations.length === 0 ? (
              <p className="muted" style={{ fontSize: 14, lineHeight: 1.55 }}>
                Not enough data yet. An exercise needs {MIN_SESSIONS_FOR_CORRELATION}+ logged sessions before this can say anything worth reading.
              </p>
            ) : (
              <>
                <div className="stack-3">
                  {correlations.slice(0, 5).map((c) => (
                    <p key={c.exerciseId} className="muted" style={{ fontSize: 14, lineHeight: 1.5 }}>
                      Sessions with <span style={{ color: 'var(--text)' }}>{c.name}</span> average{' '}
                      <span className="mono" style={{ color: 'var(--text)' }}>{c.diff > 0 ? '+' : ''}{c.diff.toFixed(1)}</span>{' '}
                      points {c.diff >= 0 ? 'higher' : 'lower'} pain. <span className="faint">({c.sessionsWith} sessions)</span>
                    </p>
                  ))}
                </div>
                {/* build-plan §7: "Present as a signal to investigate, never a
                    verdict." The disclaimer is part of the feature. */}
                <p className="faint" style={{ fontSize: 12, marginTop: 'var(--space-4)', lineHeight: 1.5 }}>
                  A correlation, not a cause. Use it to decide what to test, not what to cut.
                </p>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// In-band volume reads as a solid bar; out-of-band as a faint one, with a
// tick at the 10-set minimum so "under-target" is visible without colour.
function VolumeRow({ muscle, count }) {
  const pct = Math.min(100, (count / WEEKLY_SET_BAND.max) * 100)
  const minPct = (WEEKLY_SET_BAND.min / WEEKLY_SET_BAND.max) * 100
  const inBand = count >= WEEKLY_SET_BAND.min && count <= WEEKLY_SET_BAND.max
  return (
    <div className="vol-row">
      <div className="vol-head">
        <span className="vol-muscle">{muscle.replace(/_/g, ' ')}</span>
        <span className="vol-count" style={{ color: inBand ? 'var(--text)' : 'var(--text-faint)' }}>{count}</span>
      </div>
      <div className="vol-track">
        <div className={`vol-fill ${inBand ? 'in-band' : ''}`} style={{ width: `${pct}%` }} />
        <div className="vol-min" style={{ left: `${minPct}%` }} />
      </div>
    </div>
  )
}
