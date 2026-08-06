import { useEffect, useState } from 'react'
import Sheet from '../../components/Sheet'
import StepperRow from '../../components/StepperRow'
import Button from '../../components/Button'
import { MACRO_TARGET } from '../../lib/constants'

// Log a whole day in one go, roughly.
//
// The preset list assumes you ate a known meal and tapped it. Real days
// aren't like that — you eat something not on the list, you don't weigh it,
// and the choice becomes "log nothing" or "pretend to a precision you don't
// have". This is the third option: an honest estimate plus a note of what it
// actually was, which is still enough for the weekly trend to mean something.
//
// Protein gets a step of 5g and calories 50 deliberately: finer granularity
// than that is false precision on a guess.
export default function DayEstimateSheet({ open, onClose, existing, onSave, onDelete }) {
  const [v, setV] = useState({ calories: MACRO_TARGET.calories, protein_g: MACRO_TARGET.protein_g, carbs_g: MACRO_TARGET.carbs_g, fat_g: MACRO_TARGET.fat_g, notes: '' })

  // Seed from an existing estimate so reopening edits rather than restarts;
  // otherwise fall back to the day's targets, which is a far better starting
  // guess than zero on a day you actually tried to hit them.
  useEffect(() => {
    if (!open) return
    setV(existing
      ? {
          calories: existing.calories, protein_g: existing.protein_g,
          carbs_g: existing.carbs_g, fat_g: existing.fat_g, notes: existing.notes ?? '',
        }
      : { ...MACRO_TARGET, notes: '' })
  }, [open, existing?.id])

  return (
    <Sheet open={open} onClose={onClose}>
      <h2 className="sheet-title">{existing ? "Edit today's estimate" : 'Estimate the whole day'}</h2>
      <p className="sheet-sub">
        Roughly what you ate today. Starts at your targets — nudge from there. An honest
        estimate beats an empty day.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
        <StepperRow
          label="Calories" hint={`target ${MACRO_TARGET.calories}`}
          value={v.calories} step={50} longPressStep={200} min={0} max={8000}
          format={(n) => `${n} kcal`}
          onChange={(calories) => setV({ ...v, calories })}
        />
        <StepperRow
          label="Protein" hint={`target ${MACRO_TARGET.protein_g} g`}
          value={v.protein_g} step={5} longPressStep={20} min={0} max={500}
          format={(n) => `${n} g`}
          onChange={(protein_g) => setV({ ...v, protein_g })}
        />
        <StepperRow
          label="Carbs" hint={`target ${MACRO_TARGET.carbs_g} g`}
          value={v.carbs_g} step={10} longPressStep={40} min={0} max={800}
          format={(n) => `${n} g`}
          onChange={(carbs_g) => setV({ ...v, carbs_g })}
        />
        <StepperRow
          label="Fat" hint={`target ${MACRO_TARGET.fat_g} g`}
          value={v.fat_g} step={5} longPressStep={20} min={0} max={300}
          format={(n) => `${n} g`}
          onChange={(fat_g) => setV({ ...v, fat_g })}
        />

        <label className="field">
          <span className="label">What you ate</span>
          <textarea
            rows={4}
            value={v.notes}
            onChange={(e) => setV({ ...v, notes: e.target.value })}
            placeholder="Eggs and labneh, chicken and rice, shawarma at night, 2 coffees"
          />
          <span className="field-hint">
            The main things, not every ingredient. This is what makes the number readable in a month.
          </span>
        </label>

        <Button className="btn-block" onClick={() => onSave(v)}>
          {existing ? 'Save estimate' : 'Log the day'}
        </Button>
        {existing && (
          <Button variant="danger" className="btn-block" onClick={onDelete}>
            Remove estimate
          </Button>
        )}
      </div>
    </Sheet>
  )
}
