// The out-of-gym prescriptions the program is explicit about but the app
// was silently ignoring: 8–10k steps/day ("burns real calories without
// adding recovery cost like extra cardio does"), 2–3 low-intensity cardio
// sessions of 20–30 min, and 3–3.5 L of water.
//
// Steppers rather than text inputs, to stay consistent with the rest of the
// app and keep the keyboard off screen.
import { useEffect, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, newId, upsertRow } from '../../db/dexie'
import { useAuth } from '../../app/AuthProvider'
import { todayLocalDate } from '../../lib/format'
import { DAILY_TARGETS } from '../../lib/constants'
import StepperRow from '../../components/StepperRow'

export default function DailyHabits() {
  const { user } = useAuth()
  const today = todayLocalDate()
  const log = useLiveQuery(() => db.daily_logs.where('date').equals(today).first(), [today])

  // Steppers move the number on screen immediately and write to the database
  // once you stop, rather than on every tap. Writing per tap meant a Dexie
  // put plus a sync-queue entry for each nudge — which is what made these
  // feel sluggish and unresponsive.
  const [pending, setPending] = useState({})
  const timer = useRef(null)
  const pendingRef = useRef({})

  useEffect(() => () => clearTimeout(timer.current), [])

  const value = (field) => pending[field] ?? log?.[field] ?? 0

  // `undefined` = the Dexie read hasn't landed yet; `null` row = no entry for
  // today, which is a legitimate zero state rather than "still loading".
  if (log === undefined) return null

  const commit = async () => {
    const fields = pendingRef.current
    pendingRef.current = {}
    if (!Object.keys(fields).length) return
    const now = new Date().toISOString()
    await upsertRow('daily_logs', {
      id: log?.id ?? newId(),
      user_id: user.id,
      date: today,
      si_routine: log?.si_routine ?? false,
      steps: log?.steps ?? null,
      cardio_minutes: log?.cardio_minutes ?? null,
      water_litres: log?.water_litres ?? null,
      created_at: log?.created_at ?? now,
      updated_at: now,
      deleted_at: null,
      ...fields,
    })
    setPending({})
  }

  const patch = (fields) => {
    pendingRef.current = { ...pendingRef.current, ...fields }
    setPending((p) => ({ ...p, ...fields }))
    clearTimeout(timer.current)
    timer.current = setTimeout(commit, 600)
  }

  return (
    <div className="panel" style={{ padding: 'var(--space-5)', display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
      <StepperRow
        label="Steps" hint={`target ${DAILY_TARGETS.steps.toLocaleString()}`}
        value={value('steps')} step={500} longPressStep={2000} min={0} max={60000}
        format={(v) => v.toLocaleString()}
        onChange={(steps) => patch({ steps })}
      />
      <StepperRow
        label="Cardio" hint="low-intensity minutes"
        value={value('cardio_minutes')} step={5} longPressStep={10} min={0} max={180}
        format={(v) => `${v} min`}
        onChange={(cardio_minutes) => patch({ cardio_minutes })}
      />
      <StepperRow
        label="Water" hint={`target ${DAILY_TARGETS.water_litres} L`}
        value={value('water_litres')} step={0.25} longPressStep={0.5} min={0} max={8}
        format={(v) => `${v} L`}
        onChange={(water_litres) => patch({ water_litres })}
      />
    </div>
  )
}
