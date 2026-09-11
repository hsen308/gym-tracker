// Quick caffeine yes/no asked once at the top of a session. Three states:
// null = not asked yet, true = took caffeine, false = didn't.
//
// Stored on the workout row so the session quality score (todo #8) and
// the coach report can correlate caffeine with SI pain and energy.
// One tap to answer; the card collapses to a single line once it's saved.
import { useProfile } from '../../app/ProfileProvider'
import { updateRow } from '../../db/dexie'

export default function CaffeinePrompt({ workout, onSaved }) {
  const { profile } = useProfile()
  // Only shown when caffeine has not been recorded yet.
  if (workout.caffeine != null) {
    const label = workout.caffeine ? 'Caffeine taken' : 'No caffeine'
    return (
      <p className="muted" style={{ fontSize: 12, lineHeight: 1.4 }}>
        {label}
      </p>
    )
  }

  const answer = async (yes) => {
    await updateRow('workouts', workout.id, { caffeine: yes, updated_at: new Date().toISOString() })
    onSaved?.()
  }

  return (
    <div className="panel med-card" style={{ marginBottom: 'var(--space-4)' }}>
      <p className="label label-strong" style={{ marginBottom: 'var(--space-3)' }}>Caffeine today?</p>
      <div className="pain-buttons">
        <button className="pain-btn pressable is-yes" onClick={() => answer(true)}>Yes</button>
        <button className="pain-btn pressable is-no" onClick={() => answer(false)}>No</button>
      </div>
    </div>
  )
}