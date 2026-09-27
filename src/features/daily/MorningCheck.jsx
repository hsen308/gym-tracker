import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, newId, upsertRow } from '../../db/dexie'
import { useAuth } from '../../app/AuthProvider'
import { useProfile } from '../../app/ProfileProvider'
import { todayLocalDate } from '../../lib/format'
import { localDateOf } from '../../lib/time'
import { SORE_AREAS, STIFFNESS_OPTIONS } from '../../lib/constants'
import StepperRow from '../../components/StepperRow'
import Sheet from '../../components/Sheet'
import Button from '../../components/Button'
import Icon from '../../components/Icon'

// Daily morning check: joint pain across the 3 key inflammatory zones
// (sternum/chest, SI joint, upper/mid back) + morning stiffness duration.
// Available every morning (workout or rest day) to track disease activity.
export default function MorningCheck() {
  const { user } = useAuth()
  const { profile } = useProfile()
  const today = todayLocalDate()

  const log = useLiveQuery(
    async () => (await db.daily_logs.where('date').equals(today).first()) ?? null,
    [today],
  )
  const trainedYesterday = useLiveQuery(async () => {
    const y = new Date()
    y.setDate(y.getDate() - 1)
    const yesterday = localDateOf(y)
    const count = await db.workouts
      .filter((w) => w.date === yesterday && !!w.finished_at && !w.deleted_at)
      .count()
    return count > 0
  }, [today])

  const [open, setOpen] = useState(false)
  const [v, setV] = useState({
    morning_sternal_pain: 0,
    morning_si_pain: 0,
    morning_back_pain: 0,
    morning_stiffness_minutes: 0,
    morning_soreness: 1,
    sore_areas: [],
    morning_note: '',
  })

  useEffect(() => {
    if (!open) return
    setV({
      morning_sternal_pain: log?.morning_sternal_pain ?? 0,
      morning_si_pain: log?.morning_si_pain ?? 0,
      morning_back_pain: log?.morning_back_pain ?? 0,
      morning_stiffness_minutes: log?.morning_stiffness_minutes ?? 0,
      morning_soreness: log?.morning_soreness ?? 1,
      sore_areas: log?.sore_areas ?? [],
      morning_note: log?.morning_note ?? '',
    })
  }, [open, log?.id])

  if (log === undefined || trainedYesterday === undefined) return null
  const answered = log?.morning_si_pain != null || log?.morning_sternal_pain != null || log?.morning_stiffness_minutes != null

  const toggleArea = (key) =>
    setV((p) => ({
      ...p,
      sore_areas: p.sore_areas.includes(key) ? p.sore_areas.filter((a) => a !== key) : [...p.sore_areas, key],
    }))

  const save = async () => {
    const now = new Date().toISOString()
    await upsertRow('daily_logs', {
      id: log?.id ?? newId(),
      user_id: user.id,
      date: today,
      si_routine: log?.si_routine ?? false,
      steps: log?.steps ?? null,
      cardio_minutes: log?.cardio_minutes ?? null,
      water_litres: log?.water_litres ?? null,
      morning_sternal_pain: v.morning_sternal_pain,
      morning_si_pain: v.morning_si_pain,
      morning_back_pain: v.morning_back_pain,
      morning_stiffness_minutes: v.morning_stiffness_minutes,
      morning_soreness: v.morning_soreness,
      sore_areas: v.sore_areas,
      morning_note: v.morning_note.trim() || null,
      created_at: log?.created_at ?? now,
      updated_at: now,
      deleted_at: null,
    })
    setOpen(false)
  }

  // Active inflammatory flare signals: any joint >= 4, or stiffness >= 30m
  const maxPain = Math.max(log?.morning_sternal_pain ?? 0, log?.morning_si_pain ?? 0, log?.morning_back_pain ?? 0)
  const red = maxPain >= 4 || (log?.morning_stiffness_minutes ?? 0) >= 30

  const summaryParts = []
  if (log?.morning_sternal_pain > 0) summaryParts.push(`Sternum ${log.morning_sternal_pain}/10`)
  if (log?.morning_si_pain > 0) summaryParts.push(`SI ${log.morning_si_pain}/10`)
  if (log?.morning_back_pain > 0) summaryParts.push(`Back ${log.morning_back_pain}/10`)
  if (log?.morning_stiffness_minutes > 0) summaryParts.push(`Stiffness ~${log.morning_stiffness_minutes}m`)
  if (!summaryParts.length && answered) summaryParts.push('Joints calm · feeling good')

  return (
    <>
      <button className={`panel morning-card pressable ${red ? 'is-red' : ''}`} onClick={() => setOpen(true)}>
        <div className="row">
          <span className="label label-strong">Daily Morning Check</span>
          {answered
            ? <span className="mono faint" style={{ fontSize: 12 }}>Edit</span>
            : <Icon name="chevron" size={16} className="faint" />}
        </div>
        {answered ? (
          <>
            <p className="morning-summary">
              {summaryParts.join(' · ')}
              {log.sore_areas?.length ? ` · ${log.sore_areas.map(labelFor).join(', ')}` : ''}
            </p>
            {log.morning_note && <p className="morning-note">{log.morning_note}</p>}
            {red && (
              <p className="morning-red">
                Active flare detected. Avoid heavy sternal/clavicle compression and pelvic shearing today.
              </p>
            )}
          </>
        ) : (
          <p className="morning-summary">
            {trainedYesterday ? 'Trained yesterday. How do your sternum, back, and stiffness feel this morning?' : 'How do your sternum, back, and morning stiffness feel today?'}
          </p>
        )}
      </button>

      <Sheet open={open} onClose={() => setOpen(false)}>
        <h2 className="sheet-title">Morning Check-in</h2>
        <p className="sheet-sub">
          Record pain and stiffness across the 3 key areas. Takes 10 seconds and tracks real inflammatory control.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
          <StepperRow
            label="Sternum & Clavicle (Chest wall)" hint="0 = none, 4+ = avoid dips/bench"
            value={v.morning_sternal_pain} onChange={(n) => setV({ ...v, morning_sternal_pain: n })}
            step={1} min={0} max={10}
            format={(n) => (n === 0 ? 'none' : String(n))}
          />

          <StepperRow
            label="SI Joint (Pelvis / Lower back)" hint="0 = none, 4+ = reduce load"
            value={v.morning_si_pain} onChange={(n) => setV({ ...v, morning_si_pain: n })}
            step={1} min={0} max={10}
            format={(n) => (n === 0 ? 'none' : String(n))}
          />

          <StepperRow
            label="Upper / Interscapular back" hint="0 = none, 10 = severe"
            value={v.morning_back_pain} onChange={(n) => setV({ ...v, morning_back_pain: n })}
            step={1} min={0} max={10}
            format={(n) => (n === 0 ? 'none' : String(n))}
          />

          <div>
            <p className="label" style={{ marginBottom: 'var(--space-2)' }}>Morning stiffness duration</p>
            <p className="field-hint" style={{ marginBottom: 'var(--space-2)' }}>Key marker of active spondyloarthritis inflammation</p>
            <div className="area-grid">
              {STIFFNESS_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  className={`area-chip ${v.morning_stiffness_minutes === opt.value ? 'is-active' : ''}`}
                  onClick={() => setV({ ...v, morning_stiffness_minutes: opt.value })}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <StepperRow
            label="Muscle soreness" hint="0 = fresh, 5 = sore everywhere"
            value={v.morning_soreness} onChange={(n) => setV({ ...v, morning_soreness: n })}
            step={1} min={0} max={5}
          />

          <div>
            <p className="label" style={{ marginBottom: 'var(--space-3)' }}>Tender / sore areas</p>
            <div className="area-grid">
              {SORE_AREAS.map((a) => (
                <button
                  key={a.key}
                  type="button"
                  className={`area-chip ${v.sore_areas.includes(a.key) ? 'is-active' : ''}`}
                  onClick={() => toggleArea(a.key)}
                >
                  {a.label}
                </button>
              ))}
            </div>
          </div>

          <label className="field">
            <span className="label">Notes / triggers</span>
            <textarea
              rows={2}
              value={v.morning_note}
              onChange={(e) => setV({ ...v, morning_note: e.target.value })}
              placeholder="e.g., Slept poorly, had sweets last night, or felt sharp on coughing"
            />
          </label>

          <Button className="btn-block" onClick={save}>Save Check-in</Button>
        </div>
      </Sheet>
    </>
  )
}

const labelFor = (key) => SORE_AREAS.find((a) => a.key === key)?.label ?? key
