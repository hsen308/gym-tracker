// Shared enums/defaults referenced across features — keeps magic strings in
// one place instead of scattered through components.

// (SI_RISK and CATEGORY enums lived here but nothing ever imported them —
// those values are only ever written in seed.js and compared inline. Removed
// rather than left as decoration.)

// Program's universal rest rules: heavy strength 3 min, compound accessory
// 2 min, isolation 60–90s.
export const REST_SECONDS = { STRENGTH: 180, COMPOUND_ACCESSORY: 120, ISOLATION: 75 }

// Program: "+2.5 kg upper body, +5 kg lower body" — tap steps 2.5, hold steps 5.
export const WEIGHT_STEP_KG = 2.5
export const WEIGHT_STEP_KG_LONG_PRESS = 5

export const HOLD_TO_DELETE_MS = 650

export const MIN_SESSIONS_FOR_CORRELATION = 12 // §7 Phase 6 — SI correlation stays hidden below this

// Program Part Four: 2,200 kcal · 170p / 220c / 70f.
export const MACRO_TARGET = { calories: 2200, protein_g: 170, carbs_g: 220, fat_g: 70 }

// The program's four meal slots, with each slot's target macros.
export const MEAL_SLOTS = [
  { key: 'breakfast', label: 'Breakfast', macros: '500 kcal · 40p/45c/17f' },
  { key: 'lunch',     label: 'Lunch',     macros: '700 kcal · 55p/75c/18f' },
  { key: 'pre_post',  label: 'Pre / post-workout', macros: '450 kcal · 40p/60c/5f' },
  { key: 'dinner',    label: 'Dinner',    macros: '550 kcal · 45p/40c/20f' },
]

// Program: deload every 7th week.
export const DELOAD_CYCLE_WEEKS = 7

// Program Part Three — the daily 5-minute SI routine, every day including
// rest days. Fixed content, so it lives here rather than in the database.
export const SI_ROUTINE = [
  { name: 'Glute bridge', sets: '2 × 15', why: 'Glute activation, pelvis-friendly' },
  { name: 'Side-lying clamshell', sets: '2 × 15 e/s', why: 'Glute medius = pelvic stability' },
  { name: 'Dead bug', sets: '2 × 10 e/s', why: 'Core control, no spinal load' },
  { name: 'Cat-cow (gentle)', sets: '10 slow', why: 'Mobility, no force' },
]

// Program Part Four practical rules — the daily targets worth a readout.
export const DAILY_TARGETS = { steps: 9000, water_litres: 3.2, sleep_hours: 8 }

// Program's weekly volume guidance, and the evidence-supported band it cites.
export const WEEKLY_SET_BAND = { min: 10, max: 20 }
