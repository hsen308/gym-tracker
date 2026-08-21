// Phase 5 (build-plan §7): NOT a general food tracker. Tap a preset meal,
// tap "Ate this" — that's the whole logging path. The 17 presets come from
// the program's meal plan, grouped into its four slots; options within a slot
// are built to be interchangeable, so swapping one for another keeps the day
// intact. A custom entry covers exceptions and is stored as a meal_presets
// row flagged is_custom, so it's reusable next time.
import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, newId, upsertRow, softDeleteRow } from '../../db/dexie'
import { useAuth } from '../../app/AuthProvider'
import { todayLocalDate } from '../../lib/format'
import { MEAL_SLOTS } from '../../lib/constants'
import { useProfile } from '../../app/ProfileProvider'
import Sheet from '../../components/Sheet'
import Button from '../../components/Button'
import Field from '../../components/Field'
import Icon from '../../components/Icon'
import DayEstimateSheet from './DayEstimateSheet'
import ScanFoodSheet from './ScanFoodSheet'

export default function MealsScreen() {
  const { user } = useAuth()
  // Targets are per person now, not a constant in the source.
  const { profile } = useProfile()
  const MACRO_TARGET = profile
  const today = todayLocalDate()

  const presets = useLiveQuery(() => db.meal_presets.filter((m) => !m.deleted_at).toArray(), [])
  const todayLogs = useLiveQuery(
    () => db.meal_logs.where('date').equals(today).filter((l) => !l.deleted_at).toArray(),
    [today],
  )

  const [openMeal, setOpenMeal] = useState(null)
  const [customOpen, setCustomOpen] = useState(false)
  const [estimateOpen, setEstimateOpen] = useState(false)
  const [scanOpen, setScanOpen] = useState(false)
  const [draft, setDraft] = useState({ name: '', calories: '', protein_g: '', carbs_g: '', fat_g: '' })

  if (!presets || !todayLogs) return null

  // A whole-day estimate stands in for the individual meals rather than
  // adding to them, so the two modes can't silently double a day's totals.
  const dayEstimate = todayLogs.find((l) => l.is_day_estimate)
  const mealLogs = todayLogs.filter((l) => !l.is_day_estimate)

  const totals = todayLogs.reduce((a, l) => ({
    calories: a.calories + l.calories, protein_g: a.protein_g + l.protein_g,
    carbs_g: a.carbs_g + l.carbs_g, fat_g: a.fat_g + l.fat_g,
  }), { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 })

  const bySlot = {}
  for (const p of presets) (bySlot[p.meal_type ?? 'custom'] ??= []).push(p)

  const saveEstimate = async (v) => {
    const now = new Date().toISOString()
    const forDate = v.date ?? today
    // The row for THAT day, not today's — otherwise logging Saturday at 1am
    // on Sunday would overwrite Sunday.
    const prior = await db.meal_logs
      .where('date').equals(forDate)
      .filter((l) => l.is_day_estimate && !l.deleted_at)
      .first()
    await upsertRow('meal_logs', {
      id: prior?.id ?? newId(),
      user_id: user.id,
      date: forDate,
      meal_preset_id: null,
      name: 'Whole day (estimate)',
      calories: v.calories, protein_g: v.protein_g, carbs_g: v.carbs_g, fat_g: v.fat_g,
      notes: v.notes.trim() || null,
      is_day_estimate: true,
      logged_at: prior?.logged_at ?? now,
      created_at: prior?.created_at ?? now,
      updated_at: now,
      deleted_at: null,
    })
    setEstimateOpen(false)
  }

  const logMeal = async (meal) => {
    const now = new Date().toISOString()
    await upsertRow('meal_logs', {
      id: newId(), user_id: user.id, date: today,
      meal_preset_id: meal.id ?? null, name: meal.name,
      calories: meal.calories, protein_g: meal.protein_g, carbs_g: meal.carbs_g, fat_g: meal.fat_g,
      logged_at: now, created_at: now, updated_at: now, deleted_at: null,
    })
    setOpenMeal(null)
  }

  const saveCustom = async () => {
    const now = new Date().toISOString()
    const preset = {
      id: newId(), user_id: user.id,
      name: draft.name.trim() || 'Custom food',
      calories: Number(draft.calories) || 0, protein_g: Number(draft.protein_g) || 0,
      carbs_g: Number(draft.carbs_g) || 0, fat_g: Number(draft.fat_g) || 0,
      meal_type: 'custom', is_custom: true,
      created_at: now, updated_at: now, deleted_at: null,
    }
    await upsertRow('meal_presets', preset)
    await logMeal(preset)
    setDraft({ name: '', calories: '', protein_g: '', carbs_g: '', fat_g: '' })
    setCustomOpen(false)
  }

  return (
    <div className="container screen">
      <header className="screen-head">
        <div>
          <p className="label">
            {dayEstimate ? 'Estimated for the day' : `${mealLogs.length} logged today`}
          </p>
          <h1 className="readout screen-title">MEALS</h1>
        </div>
      </header>

      <div className="panel macro-block">
        <div>
          <p className="label">Calories</p>
          <div className="macro-hero">
            <span className="readout readout-lg">{totals.calories}</span>
            <span className="macro-hero-target">/ {MACRO_TARGET.calories} kcal</span>
          </div>
        </div>
        <MacroLine label="Protein" value={totals.protein_g} target={MACRO_TARGET.protein_g} />
        <MacroLine label="Carbs" value={totals.carbs_g} target={MACRO_TARGET.carbs_g} />
        <MacroLine label="Fat" value={totals.fat_g} target={MACRO_TARGET.fat_g} />
      </div>

      {/* Offered first, and prominently: on most days this is the realistic
          way the day gets logged at all. Tapping through four presets is the
          exception, not the default. */}
      {dayEstimate ? (
        <button className="panel estimate-card pressable" onClick={() => setEstimateOpen(true)}>
          <div className="row">
            <span className="label label-strong">Today, estimated</span>
            <span className="mono faint" style={{ fontSize: 12 }}>Edit</span>
          </div>
          <p className="estimate-macros">
            {dayEstimate.calories} kcal · {dayEstimate.protein_g}p · {dayEstimate.carbs_g}c · {dayEstimate.fat_g}f
          </p>
          {dayEstimate.notes && <p className="estimate-notes">{dayEstimate.notes}</p>}
        </button>
      ) : (
        <Button className="btn-block" style={{ marginTop: 'var(--space-4)' }} onClick={() => setEstimateOpen(true)}>
          Estimate the whole day
        </Button>
      )}

      {MEAL_SLOTS.map((slot) => (
        bySlot[slot.key]?.length ? (
          <section key={slot.key}>
            <div className="meal-slot section-label">
              <h2 className="label label-strong">{slot.label}</h2>
              <span className="mono faint" style={{ fontSize: 11 }}>{slot.macros}</span>
            </div>
            <div className="panel rule-list">
              {bySlot[slot.key].map((m) => (
                <button key={m.id} className="meal-row pressable" style={{ padding: 'var(--space-4)' }} onClick={() => setOpenMeal(m)}>
                  <span className="meal-name">{m.name}</span>
                  <span className="meal-kcal">{m.calories}</span>
                </button>
              ))}
            </div>
          </section>
        ) : null
      ))}

      {bySlot.custom?.length > 0 && (
        <section>
          <h2 className="label label-strong section-label">Custom</h2>
          <div className="panel rule-list">
            {bySlot.custom.map((m) => (
              <button key={m.id} className="meal-row pressable" style={{ padding: 'var(--space-4)' }} onClick={() => setOpenMeal(m)}>
                <span className="meal-name">{m.name}</span>
                <span className="meal-kcal">{m.calories}</span>
              </button>
            ))}
          </div>
        </section>
      )}

      <div className="stack-2" style={{ marginTop: 'var(--space-5)' }}>
        <Button variant="secondary" className="btn-block" onClick={() => setScanOpen(true)}>
          <Icon name="scan" size={18} /> Scan a barcode
        </Button>
        <Button variant="secondary" className="btn-block" onClick={() => setCustomOpen(true)}>
          <Icon name="plus" size={18} /> Custom food
        </Button>
      </div>

      {mealLogs.length > 0 && (
        <>
          <h2 className="label label-strong section-label">Logged today</h2>
          <div className="panel rule-list">
            {mealLogs.map((l) => (
              <div key={l.id} className="meal-row" style={{ padding: 'var(--space-3) var(--space-4)' }}>
                <span className="meal-name">{l.name}</span>
                <span className="meal-kcal">{l.calories}</span>
                <button className="btn btn-ghost pressable" style={{ minHeight: 32, padding: 4 }} onClick={() => softDeleteRow('meal_logs', l.id)} aria-label={`remove ${l.name}`}>
                  <Icon name="close" size={16} />
                </button>
              </div>
            ))}
          </div>
        </>
      )}

      {/* A scanned item is logged directly rather than saved as a preset —
          you rarely eat the same packaged thing twice, and the preset list is
          the programme's meals, not a shopping history. */}
      <ScanFoodSheet open={scanOpen} onClose={() => setScanOpen(false)} onLog={logMeal} />

      <DayEstimateSheet
        open={estimateOpen}
        onClose={() => setEstimateOpen(false)}
        onSave={saveEstimate}
        onDelete={(row) => { if (row) softDeleteRow('meal_logs', row.id); setEstimateOpen(false) }}
      />

      <Sheet open={!!openMeal} onClose={() => setOpenMeal(null)}>
        {openMeal && (
          <>
            <h2 className="sheet-title">{openMeal.name}</h2>
            <p className="mono muted" style={{ fontSize: 13, marginBottom: 'var(--space-5)' }}>
              {openMeal.calories} kcal · {openMeal.protein_g}p · {openMeal.carbs_g}c · {openMeal.fat_g}f
            </p>
            <Button className="btn-block" onClick={() => logMeal(openMeal)}>Ate this</Button>
          </>
        )}
      </Sheet>

      <Sheet open={customOpen} onClose={() => setCustomOpen(false)}>
        <h2 className="sheet-title">Custom food</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          <Field label="Name" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
          <Field label="Calories" type="number" inputMode="numeric" value={draft.calories} onChange={(e) => setDraft({ ...draft, calories: e.target.value })} />
          <Field label="Protein · g" type="number" inputMode="numeric" value={draft.protein_g} onChange={(e) => setDraft({ ...draft, protein_g: e.target.value })} />
          <Field label="Carbs · g" type="number" inputMode="numeric" value={draft.carbs_g} onChange={(e) => setDraft({ ...draft, carbs_g: e.target.value })} />
          <Field label="Fat · g" type="number" inputMode="numeric" value={draft.fat_g} onChange={(e) => setDraft({ ...draft, fat_g: e.target.value })} />
          <Button className="btn-block" onClick={saveCustom}>Save & log</Button>
        </div>
      </Sheet>
    </div>
  )
}

function MacroLine({ label, value, target }) {
  const pct = Math.min(100, (value / target) * 100)
  const over = value > target
  return (
    <div className="macro-line">
      <div className="row">
        <span className="label">{label}</span>
        <span className="mono" style={{ fontSize: 12 }}>{value} / {target} g</span>
      </div>
      <div className="macro-track"><div className={`macro-fill ${over ? 'is-over' : ''}`} style={{ width: `${pct}%` }} /></div>
    </div>
  )
}
