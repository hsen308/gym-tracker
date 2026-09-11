import { useEffect, useState } from 'react'
import Sheet from '../../components/Sheet'
import StepperRow from '../../components/StepperRow'
import Button from '../../components/Button'
import { toLocalInputValue, fromLocalInputValue } from '../../lib/time'

// SI pain 0–10 and energy 1–5 are the two inputs Phase 6's correlation and
// calorie-adjust logic run on — the whole reason the finish step exists.
export default function FinishSheet({ open, onClose, onFinish, startedAt, workout, targetSets, doneSets }) {
  const [siPain, setSiPain] = useState(0)
  const [energy, setEnergy] = useState(3)
  // The program calls sleep "genuinely as important as the diet", and the
  // schema has had a column for it since day one — it was just never asked for.
  const [sleep, setSleep] = useState(8)
  const [notes, setNotes] = useState('')
  const [finishedAt, setFinishedAt] = useState('')
  const [editTime, setEditTime] = useState(false)
  const [saving, setSaving] = useState(false)

  // Default the finish time to now each time the sheet opens, so a session
  // typed up later starts from a sensible value rather than a stale one.
  useEffect(() => {
    if (open) { setFinishedAt(toLocalInputValue(new Date())); setEditTime(false) }
  }, [open])

  // The 0–10 quality score. Weights per spec: energy 40%, % target sets
  // 30%, SI pain inverse 20%, caffeine 10%. Caffeine is asked once at the
  // start (stored on the workout); a session that never got the question
  // has no caffeine data, so instead of inventing a 0.5 the known
  // components are renormalised to 100%.
  const setRatio = targetSets > 0 ? Math.min(1, (doneSets ?? 0) / targetSets) : 0
  const qualityScore = () => {
    const energyPts = (energy - 1) / 4
    const setsPts = setRatio
    const painPts = (10 - siPain) / 10
    if (workout?.caffeine == null) {
      const raw = (0.4 * energyPts + 0.3 * setsPts + 0.2 * painPts) / 0.9
      return Math.round(raw * 10) / 10
    }
    const caffeinePts = workout.caffeine ? 1 : 0
    const raw = 0.4 * energyPts + 0.3 * setsPts + 0.2 * painPts + 0.1 * caffeinePts
    return Math.round(raw * 10) / 10
  }

  const finish = () => {
    if (saving) return
    const end = editTime ? fromLocalInputValue(finishedAt) : null
    setSaving(true)
    onFinish({
      si_pain_score: siPain,
      energy,
      sleep_hours: sleep,
      notes: notes.trim() || null,
      quality_score: qualityScore(),
      finishedAt: end ? end.toISOString() : undefined,
    })
  }

  const startLabel = startedAt ? new Date(startedAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : null

  return (
    <Sheet open={open} onClose={onClose}>
      <h2 className="sheet-title">Finish session</h2>

      <div className="quality-readout">
        <span className="label">Session quality</span>
        <span className="readout">{qualityScore().toFixed(1)}<span className="quality-max">/10</span></span>
      </div>

      <div className="stack-5" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
        <StepperRow
          label="SI joint pain" hint="0 = none, 10 = worst"
          value={siPain} onChange={setSiPain} step={1} min={0} max={10}
          format={(v) => (v === 0 ? 'none' : String(v))}
        />
        <StepperRow
          label="Energy" hint="how the session felt, 1–5"
          value={energy} onChange={setEnergy} step={1} min={1} max={5}
        />
        <StepperRow
          label="Sleep last night" hint="hours"
          value={sleep} onChange={setSleep} step={0.5} min={0} max={14}
          format={(v) => `${v}h`}
        />

        <label className="field">
          <span className="label">Notes</span>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} placeholder="Optional" />
        </label>

        {/* Tucked behind a toggle: finishing now is the common case and
            shouldn't cost a date picker, but a session typed up afterwards
            needs a real end time or its duration is nonsense. */}
        {editTime ? (
          <label className="field">
            <span className="label">Finished at</span>
            <input type="datetime-local" value={finishedAt} onChange={(e) => setFinishedAt(e.target.value)} />
            {startLabel && <span className="field-hint">Started {startLabel}</span>}
          </label>
        ) : (
          <button className="link-action pressable" onClick={() => setEditTime(true)}>
            Finished at a different time?
          </button>
        )}

        <Button className="btn-block" onClick={finish} disabled={saving}>
          {saving ? 'Saving…' : 'Finish session'}
        </Button>
      </div>
    </Sheet>
  )
}
