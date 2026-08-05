// Shared enums/defaults referenced across features — keeps magic strings in
// one place instead of scattered through components.

export const SI_RISK = { NONE: 'none', CAUTION: 'caution', AVOID: 'avoid' }

export const CATEGORY = { PUSH: 'push', PULL: 'pull', LEGS: 'legs', CORE: 'core', FOREARMS: 'forearms' }

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

// Program's weekly volume guidance, and the evidence-supported band it cites.
export const WEEKLY_SET_BAND = { min: 10, max: 20 }
