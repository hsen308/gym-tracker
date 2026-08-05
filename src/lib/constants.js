// Shared enums/defaults referenced across features — keeps magic strings
// in one place instead of scattered through components.

export const SI_RISK = { NONE: 'none', CAUTION: 'caution', AVOID: 'avoid' }

export const CATEGORY = { PUSH: 'push', PULL: 'pull', LEGS: 'legs', CORE: 'core', FOREARMS: 'forearms' }

// build-plan §4b rest defaults
export const REST_SECONDS = { STRENGTH: 180, COMPOUND_ACCESSORY: 120, ISOLATION: 75 }

export const WEIGHT_STEP_KG = 2.5
export const WEIGHT_STEP_KG_LONG_PRESS = 5

export const MIN_SESSIONS_FOR_CORRELATION = 12 // §7 Phase 6 — don't show SI correlation before this

// §7 Phase 5 — daily macro target, given explicitly in the plan.
export const MACRO_TARGET = { calories: 2200, protein_g: 170, carbs_g: 220, fat_g: 70 }
