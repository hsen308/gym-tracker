// The habit ring: sessions done versus sessions the programme asked for,
// drawn as a ring with the streak it has bought you next to it.
//
// The ring shows overall percentage across recent COMPLETE weeks — the current
// week is always partial and would drag every Monday down for no reason. The
// streak counts consecutive weeks at ≥75%, which is the honest unit for
// consistency: a run of good weeks rather than a run of gym-ticked days.
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../db/dexie'
import { weeklyAdherence, overallAdherence, weekStreak } from '../../lib/adherence'

export default function HabitCard() {
  const workouts = useLiveQuery(() => db.workouts.filter((w) => !w.deleted_at).toArray(), [])
  const sessionsPerWeek = useLiveQuery(
    () => db.program_days.filter((d) => !d.deleted_at).count(),
    [],
  )

  // First Dexie read still in flight — wait for a real value.
  if (workouts === undefined || sessionsPerWeek === undefined || sessionsPerWeek === 0) return null

  const weeks = weeklyAdherence(workouts, sessionsPerWeek, 8)
  const overall = overallAdherence(weeks)
  const streak = weekStreak(weeks)
  const current = weeks.find((w) => w.isCurrent)

  // Ring has to show something once you've finished a session; before that,
  // this week's partial progress is the only honest number there is.
  const ringPct = overall ?? current?.pct ?? 0

  return (
    <div className="panel habit-card">
      <Ring pct={ringPct} />
      <div className="habit-main">
        <p className="label label-strong">SESSION HABIT</p>
        {streak > 0 ? (
          <p className="habit-streak">{streak}-week streak at ≥75% of sessions</p>
        ) : (
          <p className="habit-streak">No streak yet</p>
        )}
        {current && (
          <p className="habit-sub">
            {overall != null
              ? `${current.completed}/${current.target} this week · ${overall}% over the last 8`
              : `${current.completed}/${current.target} sessions this week`}
          </p>
        )}
        {overall == null && !current?.completed && (
          <p className="habit-sub">Finish your first session and the ring starts filling</p>
        )}
      </div>
    </div>
  )
}

function Ring({ pct }) {
  const r = 30
  const c = 2 * Math.PI * r
  const filled = Math.max(0, Math.min(100, pct))
  return (
    <svg width="76" height="76" viewBox="0 0 76 76" aria-label={`${filled}% of sessions completed`}>
      <circle cx="38" cy="38" r={r} className="ring-track" />
      <circle
        cx="38" cy="38" r={r}
        className="ring-fill"
        strokeDasharray={c}
        strokeDashoffset={c * (1 - filled / 100)}
      />
      <text x="50%" y="50%" textAnchor="middle" dy="0.35em" className="ring-label">
        {filled}%
      </text>
    </svg>
  )
}