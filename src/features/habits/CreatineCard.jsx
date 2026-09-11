// Tap-to-confirm creatine, once a day. The confirmation is what the evening
// reminder reads: telling you to take creatine every single day — creatine
// taken or not — is how a reminder becomes noise. State lives on today's
// daily_logs row, exactly like the routine and the steps.
import { useLiveQuery } from 'dexie-react-hooks'
import { db, newId, upsertRow } from '../../db/dexie'
import { useAuth } from '../../app/AuthProvider'
import { useProfile } from '../../app/ProfileProvider'
import { todayLocalDate } from '../../lib/format'
import Icon from '../../components/Icon'

export default function CreatineCard() {
  const { user } = useAuth()
  const { profile } = useProfile()
  const today = todayLocalDate()

  // Only someone who has started creatine gets the card at all.
  if (!profile.creatine_started_on) return null

  const log = useLiveQuery(
    async () => (await db.daily_logs.where('date').equals(today).first()) ?? null,
    [today],
  )
  const taken = !!log?.creatine_taken

  const toggle = async () => {
    if (log === undefined) return // first Dexie read still resolving
    const now = new Date().toISOString()
    await upsertRow('daily_logs', {
      id: log?.id ?? newId(),
      user_id: user.id,
      date: today,
      si_routine: log?.si_routine ?? null,
      steps: log?.steps ?? null,
      cardio_minutes: log?.cardio_minutes ?? null,
      water_litres: log?.water_litres ?? null,
      creatine_taken: !taken,
      created_at: log?.created_at ?? now,
      updated_at: now,
      deleted_at: null,
    })
  }

  return (
    <section className="panel routine" style={{ marginTop: 'var(--space-4)' }}>
      <button className="routine-head pressable" onClick={toggle} aria-pressed={taken}>
        <span className={`routine-check ${taken ? 'is-done' : ''}`}>
          {taken && <Icon name="check" size={14} strokeWidth={2.5} />}
        </span>
        <span style={{ flex: 1, textAlign: 'left' }}>
          <span className="label">Creatine</span>
          <span className="routine-state">{taken ? 'Taken today' : 'Not taken yet'}</span>
        </span>
      </button>
    </section>
  )
}