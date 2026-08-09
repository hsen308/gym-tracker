// Weights are ALWAYS stored in kilograms and converted at the edges.
//
// Storing whatever unit the user happened to prefer would make every
// historical number ambiguous the moment they switched — "100" in a two-year
// log would mean nothing without knowing the setting on the day it was typed.
// One canonical unit in the database, conversion at display and input only.

export const LB_PER_KG = 2.2046226218

export const kgToLb = (kg) => (kg == null ? null : kg * LB_PER_KG)
export const lbToKg = (lb) => (lb == null ? null : lb / LB_PER_KG)

// Increments people actually load. A 2.5 kg jump is the smallest pair of
// plates in a metric gym; 5 lb is its imperial equivalent, and the smallest
// useful jump on a dumbbell rack in North America.
export const STEP = {
  kg: { small: 2.5, large: 5,  bodyweight: 0.1, bodyweightLarge: 0.5 },
  lb: { small: 5,   large: 10, bodyweight: 0.2, bodyweightLarge: 1 },
}

// Round to something the gym can actually produce, in the display unit,
// then convert back. Rounding in kg and converting would show 47.4 lb.
export const roundToLoadable = (kg, unit) => {
  if (kg == null) return null
  if (unit === 'lb') {
    const lb = kgToLb(kg)
    return lbToKg(Math.round(lb / 5) * 5)
  }
  return Math.round(kg / 2.5) * 2.5
}

const trim = (n) => (Math.abs(n % 1) < 0.05 ? Math.round(n) : Number(n.toFixed(1)))

// The display value for a stored kg figure, in the user's unit.
export const toDisplay = (kg, unit) => (kg == null ? null : trim(unit === 'lb' ? kgToLb(kg) : kg))

// The stored kg value for something the user typed in their unit.
export const fromDisplay = (value, unit) => (value == null ? null : unit === 'lb' ? lbToKg(value) : value)

export const unitLabel = (unit) => (unit === 'lb' ? 'lb' : 'kg')

// "60kg" / "135lb" — the one formatter every weight goes through.
export const formatWeightIn = (kg, unit) =>
  kg == null ? '—' : `${toDisplay(kg, unit)}${unitLabel(unit)}`

// Height is only ever shown, never used in a calculation, so a plain
// formatter is enough.
export const formatHeight = (cm, unit) => {
  if (cm == null) return '—'
  if (unit !== 'ft') return `${Math.round(cm)} cm`
  const totalIn = cm / 2.54
  return `${Math.floor(totalIn / 12)}'${Math.round(totalIn % 12)}"`
}

export const feetInchesToCm = (ft, inch = 0) => (ft * 12 + inch) * 2.54
