// Daily calorie and macro targets, computed rather than asked for.
//
// A setup form that asks someone to type their own calorie target gets a
// number they half-remember from an app they used once. These are rough by
// design — the scale over three weeks is what actually calibrates them, and
// the app's job is to give a defensible starting point.

// Bodyweight multipliers, kcal per kg. Deliberately blunt: activity-factor
// equations imply a precision that doesn't survive contact with real eating,
// and every one of them still needs correcting against the scale.
// Calibrated against two real cases rather than picked to look tidy:
//   78.5 kg recomp -> 2200 kcal, which is what a coach independently
//                     prescribed for exactly that person
//   63.5 kg gain   -> ~2750 kcal, a real surplus over a ~2400 maintenance
//
// The first pass used 38 for `gain`, which lands a 63.5 kg lifter at 2400 —
// approximately his maintenance. He'd eat to target, gain nothing, and
// reasonably conclude the app was wrong.
const KCAL_PER_KG = {
  gain:   43, // genuine surplus; gaining faster than ~0.5%/week is mostly fat
  recomp: 28, // mild deficit, still enough to fuel six sessions
  lose:   24, // deficit that leaves strength intact
}

// Protein: 1.6–2.2 g/kg covers the useful range in every meta-analysis worth
// reading. Held near the top throughout — it costs nothing and it's the one
// macro where being generous is reliably harmless.
const PROTEIN_PER_KG = { gain: 2.2, recomp: 2.2, lose: 2.4 }

// Fat floor for hormonal health, ~0.9 g/kg. Carbs take whatever's left —
// they're the lever that moves, because they fuel the sessions.
const FAT_PER_KG = 0.9

export function suggestTargets({ weightKg, goal = 'recomp' }) {
  if (!weightKg || weightKg <= 0) return { calories: 2200, protein_g: 170, carbs_g: 220, fat_g: 70 }

  const calories = Math.round((weightKg * (KCAL_PER_KG[goal] ?? KCAL_PER_KG.recomp)) / 50) * 50
  const protein_g = Math.round((weightKg * (PROTEIN_PER_KG[goal] ?? 2.2)) / 5) * 5
  const fat_g = Math.round((weightKg * FAT_PER_KG) / 5) * 5
  const carbs_g = Math.max(0, Math.round((calories - protein_g * 4 - fat_g * 9) / 4 / 5) * 5)

  return { calories, protein_g, carbs_g, fat_g }
}

// Steps and water scale with bodyweight far less than calories do, so these
// stay flat — the program's own guidance, not a computation.
export const DEFAULT_HABIT_TARGETS = { steps_target: 9000, water_target_l: 3.2 }

// Expected rate of change, used to sanity-check progress. Gaining faster than
// ~0.5% bodyweight a week is mostly fat; losing faster than ~1% costs muscle.
export const weeklyRateTarget = (weightKg, goal) => {
  if (goal === 'gain') return { min: weightKg * 0.0025, max: weightKg * 0.005 }
  if (goal === 'lose') return { min: -weightKg * 0.01, max: -weightKg * 0.005 }
  return { min: -weightKg * 0.005, max: 0 }
}
