import { useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { format } from 'date-fns'
import { db } from '../../db/dexie'
import { useProfile } from '../../app/ProfileProvider'
import { movingAverage } from '../../lib/calc'
import { trendPerWeek, weeksToTarget, addWeeks, rateVerdict } from '../../lib/projection'
import { weeklyAdherence, overallAdherence, weekStreak } from '../../lib/adherence'
import { toDisplay, unitLabel } from '../../lib/units'

// The "is this working?" panel.
//
// Everything here is computed from data already being logged; none of it
// needed new inputs. It exists because a cut that IS working looks identical
// day to day to one that isn't — the difference only appears in a trend line
// and an adherence count, and not seeing that difference is the single most
// common reason a working plan gets abandoned.
export default function ProgressPanel() {
  const { profile } = useProfile()
  const unit = profile.unit_weight

  const bwLogs = useLiveQuery(() => db.bodyweight_logs.filter((l) => !l.deleted_at).sortBy('date'), [])
  const measurements = useLiveQuery(() => db.measurements.filter((m) => !m.deleted_at).sortBy('date'), [])
  const workouts = useLiveQuery(() => db.workouts.filter((w) => !w.deleted_at).toArray(), [])
  const days = useLiveQuery(() => db.program_days.count(), [])

  const weightPoints = useMemo(
    () => (bwLogs ?? []).map((l) => ({ date: l.date, value: l.weight_kg })),
    [bwLogs],
  )
  const waistPoints = useMemo(
    () => (measurements ?? []).filter((m) => m.waist_cm != null).map((m) => ({ date: m.date, value: m.waist_cm })),
    [measurements],
  )

  const weightTrend = useMemo(() => trendPerWeek(weightPoints), [weightPoints])
  const waistTrend = useMemo(() => trendPerWeek(waistPoints), [waistPoints])

  const avg = useMemo(() => {
    const m = movingAverage(weightPoints, 7)
    return m.length ? m[m.length - 1].avg : null
  }, [weightPoints])

  const weeks = useMemo(
    () => weeklyAdherence(workouts ?? [], days ?? 0),
    [workouts, days],
  )
  const adherence = overallAdherence(weeks)
  const streak = weekStreak(weeks)

  const verdict = rateVerdict(weightTrend, avg, profile.goal)
  const toGoal = weeksToTarget(avg, profile.target_weight_kg, weightTrend)

  if (!bwLogs || !workouts) return null

  const latestWaist = waistPoints.length ? waistPoints[waistPoints.length - 1].value : null

  return (
    <>
      {/* Adherence first, deliberately. For anyone whose history is "on and
          off", this is the number that explains the other numbers. */}
      <div className="panel insight-block">
        <p className="label">Consistency · last 8 weeks</p>
        {adherence == null ? (
          <p className="muted" style={{ fontSize: 14, marginTop: 8, lineHeight: 1.55 }}>
            Nothing to measure yet. This fills in as weeks go by, and it's the number that
            matters most — a good programme done 50% of the time loses to an average one done 90%.
          </p>
        ) : (
          <>
            <p className="readout readout-lg" style={{ marginTop: 8 }}>
              {adherence}<span className="faint" style={{ fontSize: 20 }}>%</span>
            </p>
            <p className="muted" style={{ fontSize: 13, marginTop: 6, lineHeight: 1.5 }}>
              {streak > 0
                ? `${streak} straight week${streak === 1 ? '' : 's'} at 75% or better.`
                : 'No full week at 75% yet. That is the thing to fix before anything else.'}
            </p>
            <div className="adherence-bars">
              {weeks.map((w) => (
                <div key={w.week} className={`adherence-bar ${w.isCurrent ? 'is-current' : ''}`} title={`${w.completed}/${w.target}`}>
                  <div className="adherence-fill" style={{ height: `${Math.max(4, w.pct)}%` }} />
                </div>
              ))}
            </div>
            <p className="faint" style={{ fontSize: 11, marginTop: 6 }}>
              Sessions completed each week. Rightmost is this week, still in progress.
            </p>
          </>
        )}
      </div>

      {/* Waist, not the scale. On a recomp the scale barely moves for weeks
          while the waist drops — reading progress off the scale is how
          people conclude a working plan is failing. */}
      <div className="panel insight-block">
        <p className="label">Waist · the belly-fat number</p>
        {latestWaist == null ? (
          <p className="muted" style={{ fontSize: 14, marginTop: 8, lineHeight: 1.55 }}>
            Not measured yet. Measure at the navel, first thing, once a week — this moves when
            the scale doesn't, and it's the honest read on belly fat.
          </p>
        ) : (
          <>
            <p className="readout readout-lg" style={{ marginTop: 8 }}>
              {latestWaist}<span className="faint" style={{ fontSize: 20 }}> cm</span>
            </p>
            <p className="muted" style={{ fontSize: 13, marginTop: 6 }}>
              {waistTrend == null
                ? 'Measure weekly for a month and a trend appears here.'
                : `${waistTrend >= 0 ? '+' : ''}${waistTrend.toFixed(2)} cm/week over the last 4 weeks.`}
            </p>
          </>
        )}
      </div>

      <div className="panel insight-block">
        <p className="label">Bodyweight trend</p>
        {weightTrend == null ? (
          <p className="muted" style={{ fontSize: 14, marginTop: 8, lineHeight: 1.55 }}>
            Weigh in at least four times over four weeks and the trend appears here. Daily
            readings swing 1–2 kg on water alone — only the line means anything.
          </p>
        ) : (
          <>
            <p className="readout readout-lg" style={{ marginTop: 8 }}>
              {weightTrend >= 0 ? '+' : ''}{toDisplay(weightTrend, unit)}
              <span className="faint" style={{ fontSize: 20 }}> {unitLabel(unit)}/week</span>
            </p>
            {verdict && <p className={`verdict verdict-${verdict.state}`}>{verdict.text}</p>}
            {toGoal != null && profile.target_weight_kg && (
              <p className="muted" style={{ fontSize: 13, marginTop: 'var(--space-3)', lineHeight: 1.5 }}>
                At this rate you reach {toDisplay(profile.target_weight_kg, unit)} {unitLabel(unit)} in{' '}
                <strong>{toGoal} week{toGoal === 1 ? '' : 's'}</strong> — around {format(addWeeks(toGoal), 'MMMM yyyy')}.
              </p>
            )}
            {toGoal == null && profile.target_weight_kg && verdict?.state !== 'good' && (
              <p className="muted" style={{ fontSize: 13, marginTop: 'var(--space-3)', lineHeight: 1.5 }}>
                Not moving toward {toDisplay(profile.target_weight_kg, unit)} {unitLabel(unit)} at the moment,
                so there's no honest date to give you.
              </p>
            )}
          </>
        )}
      </div>
    </>
  )
}
