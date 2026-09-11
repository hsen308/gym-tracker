// Portion sheet for a single quick food. The list lives on MealsScreen so it
// renders inline; this sheet handles the stepper-scales-macros part.
//
// Logged directly to meal_logs (no meal_presets row), because the portion
// varies — a preset only makes sense at one fixed portion, and "3 boiled eggs"
// is a different meal from "2 boiled eggs" by a third of its calories.
import { useEffect, useState } from 'react'
import { db, newId, upsertRow } from '../../db/dexie'
import { useAuth } from '../../app/AuthProvider'
import { todayLocalDate } from '../../lib/format'
import Sheet from '../../components/Sheet'
import StepperRow from '../../components/StepperRow'
import Button from '../../components/Button'

export default function QuickFoodSheet({ food, onClose }) {
  const { user } = useAuth()
  const today = todayLocalDate()
  const [count, setCount] = useState(1)

  // Open on a fresh portion every time.
  useEffect(() => { if (food) setCount(1) }, [food?.id])

  if (!food) return null

  const macros = {
    calories: Math.round(food.perUnit.calories * count),
    protein_g: Math.round(food.perUnit.protein_g * count),
    carbs_g: Math.round(food.perUnit.carbs_g * count),
    fat_g: Math.round(food.perUnit.fat_g * count),
  }

  const logFood = async () => {
    const now = new Date().toISOString()
    const unitLabel = food.unit === 'g' ? 'g' : `${food.unit}${count === 1 ? '' : 's'}`
    await upsertRow('meal_logs', {
      id: newId(),
      user_id: user.id,
      date: today,
      meal_preset_id: null,
      name: `${count}${food.unit === 'g' ? '' : ' '}${unitLabel} ${food.name}`,
      calories: macros.calories,
      protein_g: macros.protein_g,
      carbs_g: macros.carbs_g,
      fat_g: macros.fat_g,
      logged_at: now,
      created_at: now,
      updated_at: now,
      deleted_at: null,
    })
    onClose()
  }

  return (
    <Sheet open={!!food} onClose={onClose}>
      <h2 className="sheet-title">{food.name}</h2>
      <p className="muted" style={{ fontSize: 13, marginBottom: 'var(--space-5)' }}>
        {food.note}. Set the portion — macros adjust automatically.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
        <StepperRow
          label="Amount"
          hint={`in ${food.unit}s`}
          value={count}
          onChange={setCount}
          step={food.step}
          longPressStep={food.longPressStep}
          min={1}
          max={2000}
          format={(v) => `${v} ${food.unit}${v === 1 ? '' : 's'}`}
        />

        <div className="panel macro-block">
          <div>
            <p className="label">Calories</p>
            <div className="macro-hero">
              <span className="readout readout-lg">{macros.calories}</span>
              <span className="macro-hero-target">kcal</span>
            </div>
          </div>
          <p className="muted" style={{ fontSize: 13 }}>
            {macros.protein_g}p · {macros.carbs_g}c · {macros.fat_g}f
          </p>
        </div>

        <Button className="btn-block" onClick={logFood}>
          Log this
        </Button>
      </div>
    </Sheet>
  )
}