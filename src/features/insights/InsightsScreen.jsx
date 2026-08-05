// Phase 6 (build-plan §7) — the analytics that only make sense once real
// history exists. Every number here reads from Dexie only; nothing is
// computed on the server.
import { useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate } from 'react-router-dom'
import { db } from '../../db/dexie'
import { weightTrend } from '../../lib/calc'
import {
  weeklySetsPerMuscle, sessionPointsByExercise, detectStalls,
  deloadWeek, calorieAdjustSuggestion, siCorrelation,
} from '../../lib/insights'
import { MIN_SESSIONS_FOR_CORRELATION } from '../../lib/constants'

const MUSCLE_TARGET = { min: 10, max: 20 }

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

  const firstWorkoutDate = useMemo(() => {
    if (!workouts?.length) return null
    return workouts.reduce((min, w) => (w.date < min ? w.date : min), workouts[0].date)
  }, [workouts])
  const week = deloadWeek(firstWorkoutDate)

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

  return (
    <div className="container insights-screen">
      <header className="today-header"><span className="stepper-label">Insights</span></header>

      {workouts.length === 0 ? (
        <p className="muted">Log a few workouts first — insights need real history to say anything useful.</p>
      ) : (
        <div className="stack-3">
          {week != null && (
            <div className="card insight-card">
              <h2 className="section-label">Deload countdown</h2>
              <p className="numeral" style={{ fontSize: 32 }}>Week {week}<span className="muted" style={{ fontSize: 16 }}> of 7</span></p>
            </div>
          )}

          <div className="card insight-card">
            <h2 className="section-label">Weekly sets per muscle</h2>
            <div className="stack-2">
              {Object.entries(weeklySets).sort((a, b) => b[1] - a[1]).map(([muscle, count]) => (
                <MuscleBar key={muscle} muscle={muscle} count={count} />
              ))}
              {Object.keys(weeklySets).length === 0 && <p className="muted" style={{ fontSize: 14 }}>No sets logged in the last 7 days.</p>}
            </div>
          </div>

          <div className="card insight-card">
            <h2 className="section-label">Stalling lifts</h2>
            {stalls.length === 0 ? (
              <p className="muted" style={{ fontSize: 14 }}>Nothing stalling — every lift with enough history is trending up.</p>
            ) : (
              <div className="stack-2">
                {stalls.map((s) => (
                  <button key={s.exerciseId} className="row pressable" style={{ width: '100%', textAlign: 'left' }} onClick={() => navigate(`/exercise/${s.exerciseId}`)}>
                    <span>{s.name}</span>
                    <span className="mono" style={{ color: 'var(--warn)' }}>flat / down</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {calorieSuggestion && (
            <div className="card insight-card">
              <h2 className="section-label">Calorie suggestion</h2>
              <p style={{ fontSize: 15, marginBottom: 4 }}>
                {calorieSuggestion.delta > 0 ? '+' : ''}{calorieSuggestion.delta} kcal/day
              </p>
              <p className="muted" style={{ fontSize: 13 }}>{calorieSuggestion.reason}</p>
            </div>
          )}

          <div className="card insight-card">
            <h2 className="section-label">SI joint signal</h2>
            {correlations.length === 0 ? (
              <p className="muted" style={{ fontSize: 14 }}>Not enough data yet — needs {MIN_SESSIONS_FOR_CORRELATION}+ sessions with a given exercise logged.</p>
            ) : (
              <div className="stack-2">
                {correlations.slice(0, 5).map((c) => (
                  <p key={c.exerciseId} className="muted" style={{ fontSize: 14 }}>
                    Sessions with <strong style={{ color: 'var(--text)' }}>{c.name}</strong> average{' '}
                    <span style={{ color: c.diff > 0 ? 'var(--warn)' : 'var(--text)' }}>{c.diff > 0 ? '+' : ''}{c.diff.toFixed(1)}</span> points {c.diff >= 0 ? 'higher' : 'lower'} pain.
                  </p>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function MuscleBar({ muscle, count }) {
  const pct = Math.min(100, (count / MUSCLE_TARGET.max) * 100)
  const inBand = count >= MUSCLE_TARGET.min && count <= MUSCLE_TARGET.max
  return (
    <div>
      <div className="row" style={{ marginBottom: 4 }}>
        <span className="muted" style={{ fontSize: 13, textTransform: 'capitalize' }}>{muscle.replace('_', ' ')}</span>
        <span className="mono" style={{ fontSize: 13, color: inBand ? 'var(--pr)' : 'var(--text-muted)' }}>{count} sets</span>
      </div>
      <div className="macro-bar-track"><div className="macro-bar-fill" style={{ width: `${pct}%`, background: inBand ? 'var(--pr)' : 'var(--signal)' }} /></div>
    </div>
  )
}
