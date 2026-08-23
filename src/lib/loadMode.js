// What the number in the weight field refers to on a bodyweight exercise.
//
// "Dips" is three different exercises depending on which piece of kit is
// free: parallel bars, parallel bars plus a belt, or the seated machine
// where the stack is the whole load. Logged together they produced one
// curve reading 120, 105, 95, 0, 80 — and every progression suggestion
// drawn from it was noise.
//
// Progression and PRs only ever compare sets that share a mode. Comparing a
// 120 kg machine set against a bodyweight dip is comparing two exercises.

export const LOAD_MODES = [
  {
    key: 'bodyweight',
    label: 'Bodyweight',
    short: 'BW',
    hint: 'Just you, nothing added',
  },
  {
    key: 'added',
    label: 'Added weight',
    short: '+',
    hint: 'Belt, dumbbell or vest — the extra only',
  },
  {
    key: 'machine',
    label: 'Machine',
    short: 'M',
    hint: 'The number on the stack. Nothing to do with what you weigh',
  },
]

// Only offered where it's ambiguous. A barbell bench press is never any of
// these, and showing the choice everywhere would be noise on every set.
export const supportsLoadModes = (exercise) => exercise?.equipment === 'bodyweight'

export const modeOf = (set) => set?.load_mode ?? 'added'

export const labelForMode = (key) => LOAD_MODES.find((m) => m.key === key)?.label ?? key

// How a logged set reads back. A machine set shows its stack; an added set
// shows the plus so it can't be mistaken for a total; bodyweight shows no
// number at all, because there isn't one.
export function describeLoad(set, formatWeight) {
  const mode = modeOf(set)
  if (mode === 'bodyweight') return 'Bodyweight'
  if (mode === 'machine') return formatWeight(set.weight_kg)
  return `+${formatWeight(set.weight_kg)}`
}

// The comparison key. Two sets are only on the same progression curve if
// they share both the exercise AND the mode.
export const curveKey = (set) => `${set.exercise_id}|${modeOf(set)}`
