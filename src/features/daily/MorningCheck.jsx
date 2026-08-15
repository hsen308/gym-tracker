import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, newId, upsertRow } from '../../db/dexie'
import { useAuth } from '../../app/AuthProvider'
import { useProfile } from '../../app/ProfileProvider'
import { todayLocalDate } from '../../lib/format'
import { localDateOf } from '../../lib/time'
import { SORE_AREAS } from '../../lib/constants'
import StepperRow from '../../components/StepperRow'
import Sheet from '../../components/Sheet'
import Button from '../../components/Button'
import Icon from '../../components/Icon'

// How you feel the morning AFTER training.
//
// Two things this catches that end-of-session pain can't:
//
//   1. The programme's RED flag is "pain lingering into the next day" —
//      previously unobservable, because pain was only ever recorded when the
//      session ended.
//   2. Ordinary muscle soreness and an irritated joint feel similar at the
//      time and completely different the next morning. Separating them is
//      the difference between "trained hard" and "did damage".
//
// Only shown the day after a session — asking every day gets it ignored.
export default function MorningCheck() {
  const { user } = useAuth()
  const { profile } = useProfile()
  const today = todayLocalDate()

  const log = useLiveQuery(() => db.daily_logs.where('date').equals(today).first(), [today])
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
  const [v, setV] = useState({ morning_si_pain: 0, morning_soreness: 2, sore_areas: [], morning_note: '' })

  useEffect(() => {
    if (!open) return
    setV({
      morning_si_pain: log?.morning_si_pain ?? 0,
      morning_soreness: log?.morning_soreness ?? 2,
      sore_areas: log?.sore_areas ?? [],
      morning_note: log?.morning_note ?? '',
    })
  }, [open, log?.id])

  if (log === undefined || trainedYesterday === undefined) return null
  const answered = log?.morning_si_pain != null || log?.morning_soreness != null
  // Nothing to ask about on a day after a rest day, unless you already
  // answered and might want to correct it.
  if (!trainedYesterday && !answered) return null

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
      morning_si_pain: v.morning_si_pain,
      morning_soreness: v.morning_soreness,
      sore_areas: v.sore_areas,
      morning_note: v.morning_note.trim() || null,
      created_at: log?.created_at ?? now,
      updated_at: now,
      deleted_at: null,
    })
    setOpen(false)
  }

  // The programme's own threshold: pain still there the next morning is the
  // trigger to drop that exercise for the week, not to push through it.
  const red = (log?.morning_si_pain ?? 0) >= 4

  return (
    <>
      <button className={`panel morning-card pressable ${red ? 'is-red' : ''}`} onClick={() => setOpen(true)}>
        <div className="row">
          <span className="label label-strong">This morning</span>
          {answered
            ? <span className="mono faint" style={{ fontSize: 12 }}>Edit</span>
            : <Icon name="chevron" size={16} className="faint" />}
        </div>
        {answered ? (
          <>
            <p className="morning-summary">
              SI {log.morning_si_pain}/10 · soreness {log.morning_soreness}/5
              {log.sore_areas?.length ? ` · ${log.sore_areas.map(labelFor).join(', ')}` : ''}
            </p>
            {log.morning_note && <p className="morning-note">{log.morning_note}</p>}
            {red && (
              <p className="morning-red">
                Pain into the next day is your programme's red flag — drop whatever caused it for the week
                and substitute a machine that doesn't reproduce it.
              </p>
            )}
          </>
        ) : (
          <p className="morning-summary">
            You trained yesterday. How does it feel today? Next-day pain is the signal that matters most.
          </p>
        )}
      </button>

      <Sheet open={open} onClose={() => setOpen(false)}>
        <h2 className="sheet-title">This morning</h2>
        <p className="sheet-sub">
          How you feel today, after yesterday's session. Muscle soreness and joint pain are
          different things — the second one is the one that decides what changes this week.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
          {profile.has_si_joint && (
            <StepperRow
              label="SI joint, this morning" hint="0 = nothing, 4+ = change something"
              value={v.morning_si_pain} onChange={(n) => setV({ ...v, morning_si_pain: n })}
              step={1} min={0} max={10}
              format={(n) => (n === 0 ? 'none' : String(n))}
            />
          )}

          <StepperRow
            label="Muscle soreness" hint="0 = fresh, 5 = can barely move"
            value={v.morning_soreness} onChange={(n) => setV({ ...v, morning_soreness: n })}
            step={1} min={0} max={5}
          />

          <div>
            <p className="label" style={{ marginBottom: 'var(--space-3)' }}>Where</p>
            <div className="area-grid">
              {SORE_AREAS.map((a) => (
                <button
                  key={a.key}
                  className={`area-chip ${v.sore_areas.includes(a.key) ? 'is-active' : ''}`}
                  onClick={() => toggleArea(a.key)}
                >
                  {a.label}
                </button>
              ))}
            </div>
          </div>

          <label className="field">
            <span className="label">What do you think it's from?</span>
            <textarea
              rows={3}
              value={v.morning_note}
              onChange={(e) => setV({ ...v, morning_note: e.target.value })}
              placeholder="Went too heavy on leg press, or hips tucked on the last set"
            />
            <span className="field-hint">
              Your guess at the time is worth more than mine six weeks later.
            </span>
          </label>

          <Button className="btn-block" onClick={save}>Save</Button>
        </div>
      </Sheet>
    </>
  )
}

const labelFor = (key) => SORE_AREAS.find((a) => a.key === key)?.label ?? key
