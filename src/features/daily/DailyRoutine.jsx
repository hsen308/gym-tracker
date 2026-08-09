// The program's 5-minute daily SI routine, which it is emphatic about:
// "do this every day, including rest days… weak glutes and poor core control
// are the main modifiable driver of SI joint pain. Ten minutes a day here
// will do more for your training longevity than any exercise-selection tweak."
//
// It lives on Today rather than inside a workout precisely because it isn't
// tied to training days.
import { useLiveQuery } from 'dexie-react-hooks'
import { db, newId, upsertRow } from '../../db/dexie'
import { useAuth } from '../../app/AuthProvider'
import { todayLocalDate } from '../../lib/format'
import { SI_ROUTINE } from '../../lib/constants'
import { useProfile } from '../../app/ProfileProvider'
import Icon from '../../components/Icon'

export default function DailyRoutine() {
  const { user } = useAuth()
  const today = todayLocalDate()
  const { profile } = useProfile()
  const log = useLiveQuery(() => db.daily_logs.where('date').equals(today).first(), [today])

  // Only for accounts whose profile flags the joint. Showing a pelvic
  // stability routine to someone with no back problem is noise, and noise on
  // the home screen is how people learn to ignore the whole screen.
  if (!profile.has_si_joint) return null

  const done = !!log?.si_routine

  const toggle = async () => {
    const now = new Date().toISOString()
    await upsertRow('daily_logs', {
      id: log?.id ?? newId(),
      user_id: user.id,
      date: today,
      si_routine: !done,
      steps: log?.steps ?? null,
      cardio_minutes: log?.cardio_minutes ?? null,
      water_litres: log?.water_litres ?? null,
      created_at: log?.created_at ?? now,
      updated_at: now,
      deleted_at: null,
    })
  }

  return (
    <section className="panel routine">
      <button className="routine-head pressable" onClick={toggle} aria-pressed={done}>
        <span className={`routine-check ${done ? 'is-done' : ''}`}>
          {done && <Icon name="check" size={14} strokeWidth={2.5} />}
        </span>
        <span style={{ flex: 1, textAlign: 'left' }}>
          <span className="label">Daily SI routine · 5 min</span>
          <span className="routine-state">{done ? 'Done today' : 'Not done today'}</span>
        </span>
      </button>
      {!done && (
        <ul className="routine-list">
          {SI_ROUTINE.map((m) => (
            <li key={m.name}>
              <span>{m.name}</span>
              <span className="mono faint">{m.sets}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
