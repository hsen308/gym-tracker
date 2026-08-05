// Phase 5 (build-plan §7): NOT a general food tracker. Tap a preset meal,
// tap "Ate this" — that's the whole logging path. A small custom-food
// entry covers exceptions; it's implemented as a meal_presets row flagged
// is_custom instead of a separate table, so it's reusable next time too.
import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, newId, upsertRow } from '../../db/dexie'
import { useAuth } from '../../app/AuthProvider'
import { todayLocalDate } from '../../lib/format'
import { MACRO_TARGET } from '../../lib/constants'
import Sheet from '../../components/Sheet'
import Button from '../../components/Button'
import Field from '../../components/Field'

export default function MealsScreen() {
  const { user } = useAuth()
  const today = todayLocalDate()

  const presets = useLiveQuery(() => db.meal_presets.filter((m) => !m.deleted_at).toArray(), [])
  const todayLogs = useLiveQuery(() => db.meal_logs.where('date').equals(today).filter((l) => !l.deleted_at).toArray(), [today])

  const [openMeal, setOpenMeal] = useState(null)
  const [customOpen, setCustomOpen] = useState(false)
  const [customDraft, setCustomDraft] = useState({ name: '', calories: '', protein_g: '', carbs_g: '', fat_g: '' })

  if (!presets || !todayLogs) return null

  const totals = todayLogs.reduce((acc, l) => ({
    calories: acc.calories + l.calories,
    protein_g: acc.protein_g + l.protein_g,
    carbs_g: acc.carbs_g + l.carbs_g,
    fat_g: acc.fat_g + l.fat_g,
  }), { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 })

  const logMeal = async (meal) => {
    const now = new Date().toISOString()
    await upsertRow('meal_logs', {
      id: newId(),
      user_id: user.id,
      date: today,
      meal_preset_id: meal.id ?? null,
      name: meal.name,
      calories: meal.calories,
      protein_g: meal.protein_g,
      carbs_g: meal.carbs_g,
      fat_g: meal.fat_g,
      logged_at: now,
      updated_at: now,
      deleted_at: null,
    })
    setOpenMeal(null)
  }

  const saveCustom = async () => {
    const now = new Date().toISOString()
    const preset = {
      id: newId(),
      user_id: user.id,
      name: customDraft.name || 'Custom food',
      calories: Number(customDraft.calories) || 0,
      protein_g: Number(customDraft.protein_g) || 0,
      carbs_g: Number(customDraft.carbs_g) || 0,
      fat_g: Number(customDraft.fat_g) || 0,
      is_custom: true,
      created_at: now,
      updated_at: now,
      deleted_at: null,
    }
    await upsertRow('meal_presets', preset)
    await logMeal(preset)
    setCustomDraft({ name: '', calories: '', protein_g: '', carbs_g: '', fat_g: '' })
    setCustomOpen(false)
  }

  return (
    <div className="container meals-screen">
      <header className="today-header"><span className="stepper-label">Meals</span></header>

      <div className="card macro-summary">
        <MacroBar label="Calories" value={totals.calories} target={MACRO_TARGET.calories} unit="kcal" />
        <MacroBar label="Protein" value={totals.protein_g} target={MACRO_TARGET.protein_g} unit="g" />
        <MacroBar label="Carbs" value={totals.carbs_g} target={MACRO_TARGET.carbs_g} unit="g" />
        <MacroBar label="Fat" value={totals.fat_g} target={MACRO_TARGET.fat_g} unit="g" />
      </div>

      <h2 className="section-label" style={{ marginTop: 'var(--space-6)' }}>Meals</h2>
      <div className="stack-2">
        {presets.map((m) => (
          <button key={m.id} className="card meal-row pressable" onClick={() => setOpenMeal(m)}>
            <span>{m.name}</span>
            <span className="mono muted">{m.calories} kcal</span>
          </button>
        ))}
        <button className="btn btn-secondary pressable btn-block" onClick={() => setCustomOpen(true)}>+ Custom food</button>
      </div>

      {todayLogs.length > 0 && (
        <>
          <h2 className="section-label" style={{ marginTop: 'var(--space-6)' }}>Logged today</h2>
          <div className="stack-2">
            {todayLogs.map((l) => (
              <div key={l.id} className="row card meal-row">
                <span>{l.name}</span>
                <span className="mono muted">{l.calories} kcal</span>
              </div>
            ))}
          </div>
        </>
      )}

      <Sheet open={!!openMeal} onClose={() => setOpenMeal(null)}>
        {openMeal && (
          <>
            <h2 style={{ fontSize: 18, marginBottom: 8 }}>{openMeal.name}</h2>
            <p className="muted mono" style={{ marginBottom: 20 }}>
              {openMeal.calories} kcal · {openMeal.protein_g}p · {openMeal.carbs_g}c · {openMeal.fat_g}f
            </p>
            <Button className="btn-block" onClick={() => logMeal(openMeal)}>Ate this</Button>
          </>
        )}
      </Sheet>

      <Sheet open={customOpen} onClose={() => setCustomOpen(false)}>
        <h2 style={{ fontSize: 18, marginBottom: 20 }}>Custom food</h2>
        <div className="stack-3">
          <Field label="Name" value={customDraft.name} onChange={(e) => setCustomDraft({ ...customDraft, name: e.target.value })} />
          <Field label="Calories" type="number" inputMode="numeric" value={customDraft.calories} onChange={(e) => setCustomDraft({ ...customDraft, calories: e.target.value })} />
          <Field label="Protein (g)" type="number" inputMode="numeric" value={customDraft.protein_g} onChange={(e) => setCustomDraft({ ...customDraft, protein_g: e.target.value })} />
          <Field label="Carbs (g)" type="number" inputMode="numeric" value={customDraft.carbs_g} onChange={(e) => setCustomDraft({ ...customDraft, carbs_g: e.target.value })} />
          <Field label="Fat (g)" type="number" inputMode="numeric" value={customDraft.fat_g} onChange={(e) => setCustomDraft({ ...customDraft, fat_g: e.target.value })} />
        </div>
        <Button className="btn-block" style={{ marginTop: 20 }} onClick={saveCustom}>Save & log</Button>
      </Sheet>
    </div>
  )
}

function MacroBar({ label, value, target, unit }) {
  const pct = Math.min(100, (value / target) * 100)
  return (
    <div className="macro-bar">
      <div className="row" style={{ marginBottom: 4 }}>
        <span className="muted" style={{ fontSize: 13 }}>{label}</span>
        <span className="mono" style={{ fontSize: 13 }}>{value}/{target}{unit}</span>
      </div>
      <div className="macro-bar-track"><div className="macro-bar-fill" style={{ width: `${pct}%` }} /></div>
    </div>
  )
}
