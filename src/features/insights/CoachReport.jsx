// Coach Report v1 — the weekly briefing.
//
// InsightsScreen (Trends) answers "is it working?" with numbers. This one
// keeps the same data but speaks in instructions: what the week's numbers
// mean and the one thing to do next. Same honesty rule as everywhere else —
// an empty report that says "not enough data" beats a confident fake one.
import { useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate } from 'react-router-dom'
import { db } from '../../db/dexie'
import { useProfile } from '../../app/ProfileProvider'
import { weeklyAdherence, overallAdherence, weekKey } from '../../lib/adherence'
import { sessionPointsByExercise, detectStalls } from '../../lib/insights'
import { trendPerWeek } from '../../lib/projection'
import { programPhase } from '../../lib/phase'
import { useProgramStart } from '../../lib/useProgramStart'
import { toDisplay, unitLabel } from '../../lib/units'
import Icon from '../../components/Icon'

const DAY = 86_400_000
const avg = (arr) => arr.reduce((s, v) => s + v, 0) / arr.length

// The three lifts that have actually gone up, ranked by how much. First
// three sessions vs. last three — "up since you started" measured across the
// whole run, the same rule the reminders use.
function rankImproving(pointsByExercise, exerciseById) {
  const rows = []
  for (const [exerciseId, points] of Object.entries(pointsByExercise)) {
    if (points.length < 6) continue
    const early = Math.max(...points.slice(0, 3).map((p) => p.e1rm))
    const late = Math.max(...points.slice(-3).map((p) => p.e1rm))
    const gain = late - early
    if (gain > 0) rows.push({ exerciseId, name: exerciseById[exerciseId]?.name ?? 'Exercise', gain, metric: points[0].metric })
  }
  return rows.sort((a, b) => b.gain - a.gain).slice(0, 3)
}

// One sentence of direction, from the single most important signal. Priority
// is deliberate: an absence dwarfs a stall, a stall dwarfs a trend detail.
function coachNote({ gap, adherence, stalls, waistTrend, lastQuality, streak }) {
  if (gap >= 5) return `You've been out ${gap} days. Don't plan a comeback week — do today's half session.`
  if (adherence == null) return 'No completed week yet, so nothing to judge. Log the first session and this report starts meaning something.'
  if (adherence < 60) return `You're at ${adherence}% of planned sessions. Consistency is the whole game right now — one more session a week moves this more than any exercise choice.`
  if (stalls.length >= 2) return `${stalls.length} lifts flat or sliding. That is the fatigue signal. A lighter accessory week is a plan, not a setback.`
  if (waistTrend != null && waistTrend <= -0.25) return `Waist is dropping about ${Math.abs(waistTrend).toFixed(1)} cm/week. That's the rate to hold — repeat this week, don't tighten it.`
  if (lastQuality != null && lastQuality < 5) return 'Recent sessions scored low. That reads as under-recovery — sleep and protein outrank one more set.'
  if (streak > 0) return `A ${streak}-week streak at 75%+ behind you. Keep the week boring — that is the plan working.`
  return 'Building. A full week at target and this flips to a clean bill.'
}

export default function CoachReport() {
  const navigate = useNavigate()
  const { profile } = useProfile()
  const unit = profile.unit_weight

  const workouts = useLiveQuery(() => db.workouts.filter((w) => !!w.finished_at && !w.deleted_at).toArray(), [])
  const sets = useLiveQuery(() => db.sets.filter((s) => !s.deleted_at).toArray(), [])
  const exercises = useLiveQuery(() => db.exercises.toArray(), [])
  const measurements = useLiveQuery(() => db.measurements.filter((m) => !m.deleted_at).sortBy('date'), [])
  const days = useLiveQuery(() => db.program_days.count(), [])
  const startDate = useProgramStart()

  // Every hook runs up here, unconditionally. The data guard returns early
  // further down, and React counts hooks per render — a conditional call
  // means "Rendered more hooks than during the previous render" the moment
  // the queries resolve. The memos are each null-tolerant for that first
  // paint where every query is still undefined.
  const exerciseById = useMemo(() => (exercises ? Object.fromEntries(exercises.map((e) => [e.id, e])) : {}), [exercises])
  const target = profile.sessions_per_week ?? days ?? 0
  const weeks = useMemo(() => (workouts ? weeklyAdherence(workouts, target) : null), [workouts, target])
  const qualityByWeek = useMemo(() => {
    const by = {}
    for (const w of workouts ?? []) {
      if (w.quality_score == null) continue
      const k = weekKey(w.date)
      ;(by[k] ??= []).push(w.quality_score)
    }
    return by
  }, [workouts])
  const points = useMemo(() => sessionPointsByExercise(sets ?? [], workouts ?? []), [sets, workouts])
  const ranking = useMemo(() => rankImproving(points, exerciseById), [points, exerciseById])
  const stalls = useMemo(() => detectStalls(points, exerciseById), [points, exerciseById])
  const waistTrend = useMemo(
    () => trendPerWeek((measurements ?? []).filter((m) => m.waist_cm != null).map((m) => ({ date: m.date, value: m.waist_cm }))),
    [measurements],
  )

  if (!workouts || !sets || !exercises || !measurements || days === undefined) return null

  const adherence = overallAdherence(weeks)
  const streak = weeks ? (() => {
    let s = 0
    for (let i = weeks.length - 1; i >= 0; i--) {
      if (weeks[i].isCurrent) continue
      if (weeks[i].completed / weeks[i].target >= 0.75) s++
      else break
    }
    return s
  })() : 0

  const qualitySeries = weeks
    .filter((w) => !w.isCurrent)
    .map((w) => ({ week: w.week, value: qualityByWeek[w.week]?.length ? avg(qualityByWeek[w.week]) : null }))
  const doneThisWeek = weeks.length ? weeks[weeks.length - 1].completed : 0
  const lastQuality = [...qualitySeries].reverse().find((x) => x.value != null)?.value ?? null

  const done = workouts.filter((w) => w.finished_at).sort((a, b) => b.date.localeCompare(a.date))
  const last = done[0]
  const gap = last ? Math.floor((new Date().getTime() - new Date(last.date).getTime()) / DAY) : null

  const phase = programPhase(startDate)

  return (
    <div className="container screen">
      <header className="screen-head">
        <div>
          <p className="label">
            {workouts.length} session{workouts.length === 1 ? '' : 's'} logged{phase?.week != null ? ` · week ${phase.week}` : ''}
          </p>
          <h1 className="readout screen-title">COACH</h1>
        </div>
      </header>

      {workouts.length === 0 ? (
        <p className="empty">No session data yet. Finish a workout and the coach has something to say.</p>
      ) : (
        <div className="stack-3">
          <div className="panel insight-block">
            <p className="label">Coach's note</p>
            <p className="quote">{coachNote({ gap, adherence, stalls, waistTrend, lastQuality, streak })}</p>
          </div>

          <div className="panel insight-block">
            <p className="label" style={{ marginBottom: 'var(--space-4)' }}>Week over week · consistency then quality</p>
            {adherence == null || weeks.length === 0 ? (
              <p className="muted" style={{ fontSize: 14, lineHeight: 1.55 }}>
                Nothing to measure until a full week is behind you.
              </p>
            ) : (
              <>
                <div className="row" style={{ justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <span className="readout readout-lg">{adherence}<span className="faint" style={{ fontSize: 20 }}>%</span></span>
                  <span className="muted" style={{ fontSize: 13 }}>{doneThisWeek}/{target} sessions this week</span>
                </div>
                <div className="adherence-bars" style={{ marginTop: 'var(--space-4)' }}>
                  {weeks.map((w) => (
                    <div key={w.week} className={`adherence-bar ${w.isCurrent ? 'is-current' : ''}`} title={`${w.completed}/${w.target}`}>
                      <div className="adherence-fill" style={{ height: `${Math.max(4, w.pct)}%` }} />
                    </div>
                  ))}
                </div>
                <p className="faint" style={{ fontSize: 11, marginTop: 6 }}>
                  Sessions completed each week; rightmost is this week.
                </p>

                {qualitySeries.some((q) => q.value != null) && (
                  <div style={{ marginTop: 'var(--space-5)' }}>
                    <p className="faint" style={{ fontSize: 12, letterSpacing: '0.08em', marginBottom: 'var(--space-3)' }}>SESSION QUALITY (0–10)</p>
                    <div className="adherence-bars">
                      {qualitySeries.map((q) => (
                        <div key={q.week} className="adherence-bar" title={q.value == null ? 'no score' : `${q.value.toFixed(1)}/10`}>
                          <div className="adherence-fill" style={{ height: `${q.value == null ? 3 : (q.value / 10) * 100}%`, opacity: q.value == null ? 0.15 : 1 }} />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          <div className="panel insight-block">
            <p className="label" style={{ marginBottom: 'var(--space-2)' }}>Most improved lifts</p>
            {ranking.length === 0 ? (
              <p className="muted" style={{ fontSize: 14, lineHeight: 1.55 }}>
                Not enough history to rank yet — a lift needs 6 sessions before its trend is read honestly.
              </p>
            ) : (
              <div className="rule-list">
                {ranking.map((r, i) => (
                  <button key={r.exerciseId} className="stat-line pressable" onClick={() => navigate(`/exercise/${r.exerciseId}`)}>
                    <span>
                      <span className="mono faint" style={{ marginRight: 8 }}>{String(i + 1).padStart(2, '0')}</span>
                      {r.name}
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span className="mono" style={{ color: 'var(--signal)' }}>
                        +{r.metric === 'reps' ? Math.round(r.gain) : toDisplay(r.gain, unit)} {r.metric === 'reps' ? 'reps' : unitLabel(unit)}
                      </span>
                      <Icon name="chevron" size={14} className="faint" />
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}