// What the number in the weight field actually means.
//
// "60 kg" on a dumbbell press is ambiguous in a way that quietly ruins a
// training log: one dumbbell or the pair? Six months later you cannot tell,
// and every e1RM and PR computed from it is guesswork. So the logging screen
// states the basis next to the field, every time, and the answer is derived
// from the exercise's equipment rather than left to memory.
//
// The convention below is the standard one: dumbbells are logged per hand,
// barbells as the whole loaded bar, machines as whatever the pin says.

const MODES = {
  dumbbell: {
    hint: 'per dumbbell',
    help: 'The weight of ONE dumbbell, not the pair. A 22.5 kg dumbbell in each hand is logged as 22.5.',
  },
  barbell: {
    hint: 'total, bar included',
    help: 'Everything on the bar plus the bar itself (20 kg for a standard Olympic bar).',
  },
  machine: {
    hint: 'stack',
    help: 'The number next to the pin, exactly as the machine reads it.',
  },
  cable: {
    hint: 'stack',
    help: 'The number next to the pin, exactly as the machine reads it.',
  },
  bodyweight: {
    hint: 'added weight',
    help: 'Extra weight only — belt, dumbbell or vest. Leave at 0 for bodyweight alone.',
  },
}

export const weightMode = (exercise) => MODES[exercise?.equipment] ?? { hint: null, help: null }

// "Reps in reserve" is the correct term and it is what the program uses, but
// it reads as jargon mid-set. The app says "reps left" everywhere in the UI
// and keeps `rir` as the column name, so the data stays portable.
export const REPS_LEFT_LABEL = 'reps left'
export const REPS_LEFT_HELP = 'How many more reps you could have done before failing. 0 means you went to failure.'
