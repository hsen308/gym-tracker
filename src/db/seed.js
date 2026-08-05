// First-run seeding — build-plan.md §4. Runs once: if `program_days` is
// empty in Dexie, write the exercise library + program structure, then
// (later, once §5 sync exists) they push to Supabase through the normal
// outbox, same as any other write.
//
// `primary_muscle` / `secondary_muscles` / `equipment` / `is_unilateral`
// below are standard exercise-science categorization (generic knowledge,
// not personal data) — filled in since the plan's exercise list (§4a)
// didn't specify them per-exercise, only the names and si_risk.
//
// `setup_notes` and `cues` are left empty on purpose — the plan is explicit
// that those come from Hussein's program PDF, which isn't in this repo.
// `PROGRAM_EXERCISES` is also empty for the same reason: the plan only
// gives day *names*, not which exercises/sets/reps/RIR/rest go on each day.
// Fill both in once that program is available — nothing else needs to
// change, TodayScreen/ActiveWorkout just read whatever's in this table.
import { db, newId } from './dexie'

const push = (name, primary_muscle, secondary_muscles, equipment, extra = {}) => ({
  name, category: 'push', primary_muscle, secondary_muscles, equipment,
  is_unilateral: false, si_risk: 'none', setup_notes: null, cues: [], ...extra,
})
const pull = (name, primary_muscle, secondary_muscles, equipment, extra = {}) => ({
  name, category: 'pull', primary_muscle, secondary_muscles, equipment,
  is_unilateral: false, si_risk: 'none', setup_notes: null, cues: [], ...extra,
})
const legs = (name, primary_muscle, secondary_muscles, equipment, extra = {}) => ({
  name, category: 'legs', primary_muscle, secondary_muscles, equipment,
  is_unilateral: false, si_risk: 'none', setup_notes: null, cues: [], ...extra,
})
const core = (name, primary_muscle, secondary_muscles, equipment, extra = {}) => ({
  name, category: 'core', primary_muscle, secondary_muscles, equipment,
  is_unilateral: false, si_risk: 'none', setup_notes: null, cues: [], ...extra,
})
const forearms = (name, primary_muscle, secondary_muscles, equipment, extra = {}) => ({
  name, category: 'forearms', primary_muscle, secondary_muscles, equipment,
  is_unilateral: false, si_risk: 'none', setup_notes: null, cues: [], ...extra,
})

export const EXERCISES = [
  // Push
  push('Barbell Bench Press', 'chest', ['triceps', 'shoulders'], 'barbell'),
  push('Incline Dumbbell Press', 'chest', ['shoulders', 'triceps'], 'dumbbell'),
  push('Flat Dumbbell Press', 'chest', ['triceps', 'shoulders'], 'dumbbell'),
  push('Seated Machine Shoulder Press', 'shoulders', ['triceps'], 'machine'),
  push('Seated Overhead Press', 'shoulders', ['triceps'], 'barbell'),
  push('Cable Fly', 'chest', ['shoulders'], 'cable'),
  push('Incline Cable Fly', 'chest', ['shoulders'], 'cable'),
  push('Machine Fly', 'chest', ['shoulders'], 'machine'),
  push('Dips', 'chest', ['triceps', 'shoulders'], 'bodyweight'),
  push('Lateral Raise', 'shoulders', [], 'dumbbell'),
  push('Cable Lateral Raise', 'shoulders', [], 'cable', { is_unilateral: true }),
  push('Rope Triceps Pushdown', 'triceps', [], 'cable'),
  push('Triceps Pushdown', 'triceps', [], 'cable'),
  push('Overhead Cable Triceps Extension', 'triceps', [], 'cable'),
  push('Close-Grip Bench Press', 'triceps', ['chest', 'shoulders'], 'barbell'),
  push('Skullcrusher', 'triceps', [], 'barbell'),

  // Pull
  pull('Weighted Pull-up', 'lats', ['biceps', 'upper_back'], 'bodyweight'),
  pull('Lat Pulldown', 'lats', ['biceps'], 'machine'),
  pull('Weighted Chin-up', 'lats', ['biceps'], 'bodyweight'),
  pull('Neutral-Grip Pulldown', 'lats', ['biceps'], 'machine'),
  pull('Wide-Grip Lat Pulldown', 'lats', ['upper_back'], 'machine'),
  pull('Chest-Supported Row', 'upper_back', ['lats', 'biceps'], 'machine'),
  pull('T-Bar Row', 'upper_back', ['lats', 'biceps'], 'barbell'),
  pull('Machine Row', 'upper_back', ['lats', 'biceps'], 'machine'),
  pull('Seated Cable Row', 'upper_back', ['lats', 'biceps'], 'cable', { si_risk: 'caution' }),
  pull('Single-Arm Cable Row', 'upper_back', ['lats', 'biceps'], 'cable', { is_unilateral: true, si_risk: 'caution' }),
  pull('Straight-Arm Pulldown', 'lats', [], 'cable'),
  pull('Face Pull', 'rear_delts', ['upper_back'], 'cable'),
  pull('Rear Delt Fly', 'rear_delts', [], 'machine'),
  pull('Shrug', 'traps', [], 'barbell'),
  pull('Barbell Curl', 'biceps', ['forearms'], 'barbell'),
  pull('Incline Dumbbell Curl', 'biceps', [], 'dumbbell'),
  pull('Hammer Curl', 'biceps', ['forearms'], 'dumbbell'),
  pull('Cable Curl', 'biceps', [], 'cable'),

  // Legs
  legs('Leg Press', 'quads', ['glutes'], 'machine', { si_risk: 'caution' }),
  legs('Hack Squat', 'quads', ['glutes'], 'machine', { si_risk: 'caution' }),
  legs('Belt Squat', 'quads', ['glutes'], 'machine'),
  legs('Smith Machine Squat', 'quads', ['glutes'], 'machine'),
  legs('Leg Extension', 'quads', [], 'machine'),
  legs('Seated Leg Curl', 'hamstrings', [], 'machine'),
  legs('Lying Leg Curl', 'hamstrings', [], 'machine'),
  legs('Hip Abduction Machine', 'glutes', [], 'machine'),
  legs('Glute Kickback', 'glutes', [], 'cable', { is_unilateral: true }),
  legs('Hip Thrust Machine', 'glutes', ['hamstrings'], 'machine', { si_risk: 'caution' }),
  legs('Standing Calf Raise', 'calves', [], 'machine'),
  legs('Seated Calf Raise', 'calves', [], 'machine'),

  // Core
  core('Cable Crunch', 'abs', [], 'cable'),
  core('Pallof Press', 'abs', [], 'cable'),
  core('Side Plank', 'obliques', [], 'bodyweight', { is_unilateral: true }),
  core('Machine Crunch', 'abs', [], 'machine'),
  core('Hanging Knee Raise', 'abs', ['forearms'], 'bodyweight'),
  core('Plank', 'abs', [], 'bodyweight'),

  // Forearms
  forearms('Reverse Barbell Curl', 'forearms', ['biceps'], 'barbell'),
  forearms('Wrist Curl', 'forearms', [], 'dumbbell'),
  forearms("Farmer's Hold", 'forearms', ['traps'], 'dumbbell'),
]

export const PROGRAM_DAYS = [
  { code: 'push_a', name: 'Push A', focus: 'Chest', order_index: 1 },
  { code: 'pull_a', name: 'Pull A', focus: 'Vertical', order_index: 2 },
  { code: 'legs_a', name: 'Legs A', focus: 'Quads', order_index: 3 },
  { code: 'push_b', name: 'Push B', focus: 'Shoulders', order_index: 4 },
  { code: 'pull_b', name: 'Pull B', focus: 'Horizontal', order_index: 5 },
  { code: 'legs_b', name: 'Legs B', focus: 'Posterior', order_index: 6 },
]

// TODO: fill in from the real program (per day: exercise name, target_sets,
// rep_min/rep_max, target_rir_min/max, rest_seconds, is_strength_lift).
// Shape once populated:
// { day_code: 'push_a', exercise_name: 'Barbell Bench Press', order_index: 1,
//   target_sets: 4, rep_min: 5, rep_max: 8, target_rir_min: 1, target_rir_max: 3,
//   rest_seconds: 180, is_strength_lift: true }
export const PROGRAM_EXERCISES = []

export async function seedIfEmpty(userId) {
  const existing = await db.program_days.count()
  if (existing > 0) return

  const now = new Date().toISOString()
  const exerciseRows = EXERCISES.map((e) => ({ id: newId(), user_id: userId, created_at: now, updated_at: now, deleted_at: null, ...e }))
  const exerciseIdByName = Object.fromEntries(exerciseRows.map((e) => [e.name, e.id]))

  const dayRows = PROGRAM_DAYS.map((d) => ({ id: newId(), user_id: userId, created_at: now, updated_at: now, deleted_at: null, ...d }))
  const dayIdByCode = Object.fromEntries(dayRows.map((d) => [d.code, d.id]))

  const programExerciseRows = PROGRAM_EXERCISES.map((pe) => ({
    id: newId(),
    user_id: userId,
    program_day_id: dayIdByCode[pe.day_code],
    exercise_id: exerciseIdByName[pe.exercise_name],
    order_index: pe.order_index,
    target_sets: pe.target_sets,
    rep_min: pe.rep_min,
    rep_max: pe.rep_max,
    target_rir_min: pe.target_rir_min ?? null,
    target_rir_max: pe.target_rir_max ?? null,
    rest_seconds: pe.rest_seconds ?? 90,
    is_strength_lift: pe.is_strength_lift ?? false,
    notes: pe.notes ?? null,
  }))

  await db.transaction('rw', db.exercises, db.program_days, db.program_exercises, async () => {
    await db.exercises.bulkAdd(exerciseRows)
    await db.program_days.bulkAdd(dayRows)
    if (programExerciseRows.length) await db.program_exercises.bulkAdd(programExerciseRows)
  })

  if (!programExerciseRows.length) {
    console.warn('[seed] Exercise library and program days seeded, but PROGRAM_EXERCISES is empty — TodayScreen/ActiveWorkout will have nothing to show until the real program is filled into src/db/seed.js')
  }
}
