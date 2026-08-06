// First-run seeding — build-plan.md §4, populated from Hussein-Program.pdf.
// Runs once: if `program_days` is empty in Dexie, write the exercise library,
// program structure and meal presets, then push them through the normal outbox.
//
// Everything here comes from the program PDF: exercise selection, sets, rep
// ranges, RIR targets, rest times, the SI-joint cautions, the setup notes and
// cues (PDF Part Five), and the 17 meals (Part Four).
import { db, newId } from './dexie'

// `tracks` decides which input the logger shows: 'weight_reps' is the default
// stepper trio; 'duration' swaps in a seconds stepper for planks and holds,
// which have no weight and are prescribed in seconds by the program.
const ex = (category) => (name, primary_muscle, secondary_muscles, equipment, extra = {}) => ({
  name, category, primary_muscle, secondary_muscles, equipment,
  is_unilateral: false, si_risk: 'none', tracks: 'weight_reps',
  setup_notes: null, cues: [], ...extra,
})
const push = ex('push'), pull = ex('pull'), legs = ex('legs'), core = ex('core'), forearms = ex('forearms')

export const EXERCISES = [
  // ---- Push ----
  push('Barbell Bench Press', 'chest', ['triceps', 'shoulders'], 'barbell', {
    setup_notes: 'Eyes under the bar. Grip ~1.5× shoulder width. Feet flat, planted.',
    cues: [
      'Shoulder blades back and down into the bench — keep them there the whole set.',
      'Elbows 45–60° from your torso, not flared to 90°.',
      'Bar touches lower chest / nipple line, not your neck.',
      'Slight natural arch; glutes stay on the bench.',
      'Avoid: bouncing off the chest, or flaring the elbows wide.',
    ],
  }),
  push('Incline Dumbbell Press', 'chest', ['shoulders', 'triceps'], 'dumbbell', {
    setup_notes: 'Bench at 30° — not 45°. Higher than 30° turns it into a shoulder press.',
    cues: [
      'Dumbbells travel slightly inward at the top, not straight up parallel.',
      'Lower until you feel a stretch across the upper chest.',
      "Don't clang the dumbbells at the top; stop just short.",
      'Avoid: setting the bench too steep — why people only feel this in their shoulders.',
    ],
  }),
  push('Flat Dumbbell Press', 'chest', ['triceps', 'shoulders'], 'dumbbell', {
    setup_notes: 'Kick the dumbbells up with your knees, then set your shoulder blades.',
    cues: ['Same elbow angle as bench — 45–60°.', 'Deeper stretch than a barbell allows. Use it.', 'Control the negative — 2 seconds down.'],
  }),
  push('Seated Machine Shoulder Press', 'shoulders', ['triceps'], 'machine', {
    setup_notes: 'Backrest as close to vertical as the bench allows (85–90°). Seated, always.',
    cues: ['Brace your abs hard — this keeps load off your lower back and pelvis.', 'Lower to about chin level.', 'Avoid: arching backward to press the weight.'],
  }),
  push('Seated Overhead Press', 'shoulders', ['triceps'], 'barbell', {
    setup_notes: 'Backrest as close to vertical as the bench allows (85–90°). Seated, always.',
    cues: [
      'Brace your abs hard — this is what keeps load off your lower back and pelvis.',
      'Bar path just past your face; finish over the middle of your head, not in front.',
      'Lower to about chin level.',
      'Avoid: arching backward to press — turns it into an incline press and loads your SI joint.',
    ],
  }),
  push('Cable Fly', 'chest', ['shoulders'], 'cable', {
    setup_notes: 'Pulleys at shoulder height or slightly above. One foot forward, small lean.',
    cues: [
      'Soft, fixed elbow bend — lock the angle. If elbows straighten and bend, it\'s a press.',
      'Hands together in front of your sternum, squeeze for a beat.',
      'Let the arms travel back far enough for a real stretch.',
      'Avoid: going heavy and turning it into a pressing motion.',
    ],
  }),
  push('Incline Cable Fly', 'chest', ['shoulders'], 'cable', {
    setup_notes: 'Pulleys set LOW, near the bottom. Hands travel up and inward, finishing around chin height.',
    cues: ['Think "scooping up" — line of pull goes low to high.', 'Same fixed elbow rule as flat fly.'],
  }),
  push('Machine Fly', 'chest', ['shoulders'], 'machine', {
    setup_notes: 'Handles at roughly mid-chest height when seated.',
    cues: ['Fixed elbow angle throughout.', 'Squeeze for a beat at the midpoint.'],
  }),
  push('Dips', 'chest', ['triceps', 'shoulders'], 'bodyweight', {
    setup_notes: 'Chest-focused: lean torso forward ~30°. Triceps-focused: stay upright.',
    cues: ['Lower until upper arms are roughly parallel to the floor. No deeper.', 'Shoulders down and away from your ears at the bottom.', 'Avoid: sinking too deep — that\'s where shoulders get hurt.'],
  }),
  push('Lateral Raise', 'shoulders', [], 'dumbbell', {
    setup_notes: 'Slight forward lean, tiny elbow bend.',
    cues: [
      'Lead with your elbows, not your hands. Elbow stays higher than the wrist.',
      'Stop at shoulder height — higher shifts work to the traps.',
      'Pinky slightly higher than thumb at the top.',
      'Lower slowly — 3 seconds. The negative is where side delts grow.',
      'Avoid: swinging. Go lighter; this is not a heavy exercise.',
    ],
  }),
  push('Cable Lateral Raise', 'shoulders', [], 'cable', {
    setup_notes: 'Pulley at the LOWEST setting, cable running behind your body. Slight forward lean.',
    cues: ['Lead with your elbows, not your hands.', 'Stop at shoulder height.', 'Lower slowly — 3 seconds.'],
  }),
  push('Rope Triceps Pushdown', 'triceps', [], 'cable', {
    setup_notes: 'Pulley at the TOP. Stand close, small forward lean.',
    cues: ['Elbows pinned to your sides — no drifting forward or flaring.', 'Spread the rope apart at the bottom, hold a beat.', 'Only your forearm moves. Upper arm frozen.', 'Avoid: using your whole body to push the weight down.'],
  }),
  push('Triceps Pushdown', 'triceps', [], 'cable', {
    setup_notes: 'Pulley at the TOP. Stand close, small forward lean.',
    cues: ['Elbows pinned to your sides.', 'Only your forearm moves.'],
  }),
  push('Overhead Cable Triceps Extension', 'triceps', [], 'cable', {
    setup_notes: 'Pulley at head height or slightly above. Face away, staggered stance, lean forward.',
    cues: [
      'The overhead position puts the long head on stretch — that\'s the whole point.',
      'Elbows stay narrow and pointed forward, not flaring sideways.',
      'Get a deep stretch behind your head each rep.',
    ],
  }),
  push('Close-Grip Bench Press', 'triceps', ['chest', 'shoulders'], 'barbell', {
    setup_notes: 'Hands SHOULDER WIDTH, not narrower.',
    cues: ['Elbows tucked close to your body.', 'Avoid: hands too narrow — wrecks the wrists for no extra triceps work.'],
  }),
  push('Skullcrusher', 'triceps', [], 'barbell', {
    setup_notes: 'Use an EZ bar. Lower behind your head rather than to your forehead.',
    cues: ['Lowering behind the head keeps tension on the triceps at the top.'],
  }),

  // ---- Pull ----
  pull('Weighted Pull-up', 'lats', ['biceps', 'upper_back'], 'bodyweight', {
    setup_notes: 'Overhand grip, just outside shoulder width.',
    cues: [
      'Start from a dead hang with shoulders pulled down — don\'t hang loose and shrugged.',
      'Drive elbows down toward your hips, not "pull with your hands".',
      'Chest toward the bar, slight backward lean.',
      'Control the way down. Don\'t drop.',
    ],
  }),
  pull('Weighted Chin-up', 'lats', ['biceps'], 'bodyweight', {
    setup_notes: 'Underhand grip, shoulder width (more biceps than a pull-up).',
    cues: ['Dead hang start, shoulders pulled down.', 'Drive elbows down toward your hips.', 'Control the way down.'],
  }),
  pull('Lat Pulldown', 'lats', ['biceps'], 'machine', {
    setup_notes: 'Thigh pad SNUG — tight enough that you can\'t lift off. Grip just outside shoulder width.',
    cues: [
      'Lean back 15–20° and hold that angle. Don\'t rock back and forth.',
      'Pull to your upper chest, elbows driving down and slightly back.',
      'Let the bar go all the way up, shoulder blades rise — full stretch every rep.',
      'Avoid: behind-the-neck pulldowns. Bad shoulder position, no extra benefit.',
    ],
  }),
  pull('Neutral-Grip Pulldown', 'lats', ['biceps'], 'machine', {
    setup_notes: 'Thigh pad snug. Neutral (palms-facing) handle.',
    cues: ['Lean back 15–20° and hold it.', 'Full stretch at the top every rep.'],
  }),
  pull('Wide-Grip Lat Pulldown', 'lats', ['upper_back'], 'machine', {
    setup_notes: 'Grip WIDER than standard — roughly 1.5× shoulder width.',
    cues: ['Wider grip biases upper lats and back width.', 'Shorter range than you think — pull to the collarbone, don\'t force it lower.'],
  }),
  pull('Chest-Supported Row', 'upper_back', ['lats', 'biceps'], 'machine', {
    setup_notes: 'Pad at UPPER CHEST level so your chin clears the top. Feet planted.',
    cues: [
      'Chest stays glued to the pad the whole set — peeling off means the weight is too heavy.',
      'Pull elbows back and slightly down; squeeze shoulder blades at the top.',
      'Full stretch at the bottom, letting the shoulder blades come forward.',
      'This is your safest heavy back movement — chest support means zero load on your SI joint.',
    ],
  }),
  pull('T-Bar Row', 'upper_back', ['lats', 'biceps'], 'barbell', {
    setup_notes: 'Use the chest-supported version. Pad at upper chest level.',
    cues: ['Chest stays on the pad.', 'Pull with the elbows, not the hands.', 'Full stretch at the bottom.'],
  }),
  pull('Machine Row', 'upper_back', ['lats', 'biceps'], 'machine', {
    setup_notes: 'Chest pad at upper chest level, feet planted.',
    cues: ['Chest stays on the pad.', 'Squeeze shoulder blades at the top.'],
  }),
  pull('Seated Cable Row', 'upper_back', ['lats', 'biceps'], 'cable', {
    si_risk: 'caution',
    setup_notes: 'Pulley at low / chest height when seated. Knees slightly bent, chest up.',
    cues: [
      'Torso stays upright and still — no rocking. This matters for your SI joint.',
      'Pull the handle to your lower ribs / navel, elbows close to your sides.',
      'Let the weight stretch your lats forward, but don\'t let your lower back round.',
      'Avoid: heaving backward with your whole torso — that\'s a lower back exercise.',
    ],
  }),
  pull('Single-Arm Cable Row', 'upper_back', ['lats', 'biceps'], 'cable', {
    is_unilateral: true, si_risk: 'caution',
    setup_notes: 'Pulley at chest height. Split stance, torso square.',
    cues: [
      'Keep hips and shoulders square — don\'t twist. Rotating through the pelvis is a trigger for your SI joint.',
      'Let the arm travel far forward for a big stretch, then pull to your hip.',
    ],
  }),
  pull('Straight-Arm Pulldown', 'lats', [], 'cable', {
    setup_notes: 'Pulley at the TOP. Stand back a step, hinge forward slightly at the hips, arms straight.',
    cues: ['Arms stay straight (soft elbow, locked angle) the entire set.', 'Push the bar down in an arc to your thighs.', 'Pure lat isolation — go light and slow.'],
  }),
  pull('Face Pull', 'rear_delts', ['upper_back'], 'cable', {
    setup_notes: 'Rope at upper chest / face height. Step back until there\'s tension at full stretch.',
    cues: [
      'Pull toward your forehead, hands separating, ending in a "double bicep" position.',
      'Elbows stay high — at or above shoulder level.',
      'Externally rotate at the end: thumbs pointing back.',
      'Light weight, 15–20 reps. Shoulder health work, not an ego lift.',
    ],
  }),
  pull('Rear Delt Fly', 'rear_delts', [], 'machine', {
    setup_notes: 'Machine: chest on pad, handles at shoulder height. Cable: pulleys at shoulder height, cables crossed.',
    cues: ['Slight fixed elbow bend. Lead with elbows/pinkies, not hands.', 'Think "spread wide", not "pull back".', 'Stop when arms are in line with your torso.'],
  }),
  pull('Shrug', 'traps', [], 'barbell', {
    setup_notes: 'Dumbbells at your sides or a barbell in front. Arms straight, shoulders relaxed at the start.',
    cues: ['Shrug straight up toward your ears. Pause 1 second at the top.', 'Avoid: rolling your shoulders in circles — zero benefit, adds wear.', 'Traps only; elbows stay locked.'],
  }),
  pull('Barbell Curl', 'biceps', ['forearms'], 'barbell', {
    setup_notes: 'Shoulder-width grip, elbows at your sides, standing tall.',
    cues: ['Elbows stay pinned — they shouldn\'t drift forward.', 'No swinging or leaning back. If you need body English, go lighter.', 'Full extension at the bottom every rep.'],
  }),
  pull('Incline Dumbbell Curl', 'biceps', [], 'dumbbell', {
    setup_notes: 'Bench at 45–60°. Sit back fully, let arms hang straight down behind your torso.',
    cues: [
      'The behind-the-body arm position is the whole point — puts the long head on stretch.',
      'Upper arms stay still; don\'t let the elbows swing forward.',
      'Best bicep builder in the program. Go light and controlled.',
    ],
  }),
  pull('Hammer Curl', 'biceps', ['forearms'], 'dumbbell', {
    setup_notes: 'Neutral grip (thumbs up), dumbbells at your sides.',
    cues: ['Hits the brachialis and brachioradialis — builds arm thickness and forearms.', 'Keep the neutral grip the entire rep. No rotating.'],
  }),
  pull('Cable Curl', 'biceps', [], 'cable', {
    setup_notes: 'Pulley at the LOWEST setting. Stand a step back so there\'s tension even at the bottom.',
    cues: ['Cables keep tension constant through the whole range.', 'Elbows locked at your sides.'],
  }),

  // ---- Legs ----
  legs('Leg Press', 'quads', ['glutes'], 'machine', {
    si_risk: 'caution',
    setup_notes: 'Feet shoulder width, SLIGHTLY HIGHER on the platform than centre. Back and hips flat against the pad.',
    cues: [
      'Stop the descent before your hips tuck under. Lower back or glutes lifting off the pad = too deep. That is the SI joint danger point.',
      'Push evenly through both legs. Never twist to grind a rep.',
      'Drive through mid-foot and heel, not toes.',
      'Don\'t fully lock the knees at the top.',
      'Avoid: chasing depth. Short range in a safe position beats deep range that flares the joint.',
    ],
  }),
  legs('Hack Squat', 'quads', ['glutes'], 'machine', {
    si_risk: 'caution',
    setup_notes: 'Feet mid-platform, shoulder width. Shoulders firmly under the pads.',
    cues: [
      'Test light first. The fixed path stops your pelvis rotating naturally, which irritates some SI joints.',
      'Back flat against the pad the whole time.',
      'Same rule as leg press: stop before the hips tuck.',
      'Swap for Belt Squat or Smith Squat if it doesn\'t feel clean.',
    ],
  }),
  legs('Belt Squat', 'quads', ['glutes'], 'machine', {
    setup_notes: 'Belt around the hips, load hanging below. Zero spinal compression — the ideal squat swap for you.',
    cues: ['Stop before the hips tuck.', 'Push evenly through both legs.'],
  }),
  legs('Smith Machine Squat', 'quads', ['glutes'], 'machine', {
    setup_notes: 'Shorter range than a free squat. Bar on upper traps, feet slightly forward.',
    cues: ['Use a shorter range — stop before the hips tuck.', 'Stay symmetrical; never twist.'],
  }),
  legs('Leg Extension', 'quads', [], 'machine', {
    setup_notes: 'Knee joint lined up with the machine\'s PIVOT POINT. Ankle pad just above the ankle, not on the shin.',
    cues: [
      'Back stays against the pad. Hold the handles.',
      'Pause 1 second at the top, fully contracted.',
      'Lower slowly — 2–3 seconds.',
      'One of your safest heavy movements: almost zero load through the pelvis.',
    ],
  }),
  legs('Seated Leg Curl', 'hamstrings', [], 'machine', {
    setup_notes: 'Knee at the pivot point, pad just above the heel. Strap the thigh pad down snug.',
    cues: [
      'Seated stretches the hamstring more and is generally the better builder — but if the hip position bothers your SI joint, use lying.',
      'Point toes toward your shin for more hamstring involvement.',
    ],
  }),
  legs('Lying Leg Curl', 'hamstrings', [], 'machine', {
    setup_notes: 'Knee at the pivot point, pad just above the heel.',
    cues: ['Keep your hips down on the pad. Don\'t let them lift.', 'Point toes toward your shin for more hamstring involvement.'],
  }),
  legs('Hip Abduction Machine', 'glutes', [], 'machine', {
    setup_notes: 'Sit upright, back against the pad. Slight forward lean targets the glute medius more.',
    cues: [
      'Your most important leg-day exercise — glute medius strength directly stabilizes the pelvis and protects the SI joint.',
      'Push out slowly, pause 1 second, return under control.',
      'Don\'t slam the weights back together.',
    ],
  }),
  legs('Glute Kickback', 'glutes', [], 'cable', {
    is_unilateral: true,
    setup_notes: 'Ankle strap, pulley low. Hold the frame, hips square.',
    cues: ['Finish with a hard glute squeeze; don\'t hyperextend the lower back.', 'Ribs stay down.'],
  }),
  legs('Hip Thrust Machine', 'glutes', ['hamstrings'], 'machine', {
    si_risk: 'caution',
    setup_notes: 'Machine hip thrust preferred over barbell — no bar digging into your hips, easier to keep the pelvis neutral.',
    cues: ['Finish with a hard glute squeeze; don\'t hyperextend your lower back at the top. Ribs stay down.', 'Chin tucked, look forward not up.'],
  }),
  legs('Standing Calf Raise', 'calves', [], 'machine', {
    setup_notes: 'Balls of feet on the platform edge, heels hanging free. Knees near-straight.',
    cues: [
      'Full range is everything — deep stretch at the bottom, all the way up at the top.',
      'Pause 1–2 seconds in the bottom stretch. This is where calves grow.',
      'Standing hits the gastrocnemius. Avoid: fast, bouncy half-reps.',
    ],
  }),
  legs('Seated Calf Raise', 'calves', [], 'machine', {
    setup_notes: 'Balls of feet on the platform edge, heels hanging free. Knees bent 90°.',
    cues: ['Deep stretch at the bottom, pause 1–2 seconds.', 'Seated hits the soleus — that\'s why you need both variations.'],
  }),

  // ---- Core ----
  core('Cable Crunch', 'abs', [], 'cable', {
    setup_notes: 'Rope at the TOP pulley. Kneel facing the machine, rope beside your head, hips fixed.',
    cues: [
      'Curl your ribs toward your pelvis — think "crunch", not "bow forward at the hips".',
      'Hips stay in one place the entire set. If they move, your hip flexors are doing the work.',
      'Add weight over time. Abs respond to load like any other muscle.',
    ],
  }),
  core('Pallof Press', 'abs', [], 'cable', {
    is_unilateral: true,
    setup_notes: 'Cable at chest height. Stand side-on, feet shoulder width, handle at your sternum.',
    cues: [
      'Press the handle straight out and resist the cable\'s pull to rotate you. That resistance is the entire exercise.',
      'Hips and shoulders stay square and locked.',
      'Directly protective for your SI joint — anti-rotation is what a painful SI joint needs. Treat it as therapy.',
    ],
  }),
  core('Side Plank', 'obliques', [], 'bodyweight', {
    is_unilateral: true, tracks: 'duration',
    setup_notes: 'Elbow under your shoulder, body in a straight line, feet stacked or staggered.',
    cues: ['Push hips up and forward. Don\'t let them sag or rotate.', 'Trains the glute medius and QL — both pelvic stabilizers, both directly relevant to you.'],
  }),
  core('Machine Crunch', 'abs', [], 'machine', {
    setup_notes: 'Seat height so the pad sits across your upper chest.',
    cues: ['Curl the ribs toward the pelvis.', 'Add weight over time — train abs like any other muscle.'],
  }),
  core('Hanging Knee Raise', 'abs', ['forearms'], 'bodyweight', {
    setup_notes: 'Dead hang, shoulders pulled down and engaged.',
    cues: [
      'Curl your pelvis up at the top — don\'t just lift the knees, or it becomes a hip flexor exercise.',
      'Zero swinging. Lower with control.',
      'If you can\'t stop swinging, drop to a captain\'s chair or lying raises.',
    ],
  }),
  core('Plank', 'abs', [], 'bodyweight', {
    tracks: 'duration',
    setup_notes: 'Elbows under shoulders, body in a straight line.',
    cues: ['Ribs down, glutes squeezed. Don\'t let the hips sag.'],
  }),

  // ---- Forearms ----
  forearms('Reverse Barbell Curl', 'forearms', ['biceps'], 'barbell', {
    setup_notes: 'Overhand grip; an EZ bar is easier on the wrists.',
    cues: ['Light weight, elbows pinned.', 'Builds the top of the forearm.'],
  }),
  forearms('Wrist Curl', 'forearms', [], 'dumbbell', {
    setup_notes: 'Forearms on a bench or your thighs, wrists hanging past the edge.',
    cues: ['Full range — let the bar roll to your fingertips, then curl back up.'],
  }),
  forearms("Farmer's Hold", 'forearms', ['traps'], 'dumbbell', {
    si_risk: 'caution', tracks: 'duration',
    setup_notes: 'Heavy dumbbells, ONE IN EACH HAND — always double-arm.',
    cues: [
      'Never single-arm. Asymmetric loading is a known SI joint trigger for you.',
      'Stand tall, shoulders down and back, ribs down. Just hold and breathe.',
    ],
  }),
]

export const PROGRAM_DAYS = [
  { code: 'push_a', name: 'Push A', focus: 'Chest', order_index: 1 },
  { code: 'pull_a', name: 'Pull A', focus: 'Vertical', order_index: 2 },
  { code: 'legs_a', name: 'Legs A', focus: 'Quads', order_index: 3 },
  { code: 'push_b', name: 'Push B', focus: 'Shoulders', order_index: 4 },
  { code: 'pull_b', name: 'Pull B', focus: 'Horizontal', order_index: 5 },
  { code: 'legs_b', name: 'Legs B', focus: 'Hamstrings', order_index: 6 },
]

// Core and forearm blocks bolt onto the end of specific sessions (PDF: "they
// take 6–8 minutes and don't need their own day"). Defined once, appended to
// the right days below, so the sets/reps live in exactly one place.
const CORE_A = [
  { exercise_name: 'Cable Crunch', target_sets: 3, rep_min: 12, rep_max: 15, rest_seconds: 60 },
  { exercise_name: 'Pallof Press', target_sets: 3, rep_min: 12, rep_max: 12, rest_seconds: 45, notes: 'Each side' },
  { exercise_name: 'Side Plank', target_sets: 2, rep_min: 30, rep_max: 45, rest_seconds: 45, notes: 'Seconds, each side' },
]
const CORE_B = [
  { exercise_name: 'Machine Crunch', target_sets: 3, rep_min: 12, rep_max: 15, rest_seconds: 60 },
  { exercise_name: 'Hanging Knee Raise', target_sets: 3, rep_min: 10, rep_max: 15, rest_seconds: 60 },
  { exercise_name: 'Plank', target_sets: 2, rep_min: 45, rep_max: 60, rest_seconds: 45, notes: 'Seconds' },
]
const FOREARMS = [
  { exercise_name: 'Reverse Barbell Curl', target_sets: 3, rep_min: 12, rep_max: 15, rest_seconds: 60 },
  { exercise_name: 'Wrist Curl', target_sets: 3, rep_min: 15, rep_max: 20, rest_seconds: 45 },
  { exercise_name: "Farmer's Hold", target_sets: 2, rep_min: 30, rep_max: 45, rest_seconds: 60, notes: 'Seconds, double-arm only' },
]

const DAY_PLANS = {
  push_a: [
    { exercise_name: 'Barbell Bench Press', target_sets: 4, rep_min: 4, rep_max: 6, target_rir_min: 1, target_rir_max: 2, rest_seconds: 180, is_strength_lift: true },
    { exercise_name: 'Incline Dumbbell Press', target_sets: 3, rep_min: 8, rep_max: 12, target_rir_min: 1, target_rir_max: 2, rest_seconds: 120 },
    { exercise_name: 'Seated Machine Shoulder Press', target_sets: 3, rep_min: 8, rep_max: 12, target_rir_min: 1, target_rir_max: 2, rest_seconds: 120 },
    { exercise_name: 'Cable Fly', target_sets: 3, rep_min: 12, rep_max: 15, target_rir_min: 0, target_rir_max: 1, rest_seconds: 90, notes: 'Or Machine Fly' },
    { exercise_name: 'Lateral Raise', target_sets: 4, rep_min: 12, rep_max: 20, target_rir_min: 0, target_rir_max: 1, rest_seconds: 60 },
    { exercise_name: 'Rope Triceps Pushdown', target_sets: 3, rep_min: 10, rep_max: 15, target_rir_min: 0, target_rir_max: 1, rest_seconds: 60 },
    { exercise_name: 'Overhead Cable Triceps Extension', target_sets: 2, rep_min: 12, rep_max: 15, target_rir_min: 0, target_rir_max: 1, rest_seconds: 60 },
    ...CORE_A,
  ],
  pull_a: [
    { exercise_name: 'Weighted Pull-up', target_sets: 4, rep_min: 5, rep_max: 8, target_rir_min: 1, target_rir_max: 2, rest_seconds: 180, is_strength_lift: true, notes: 'Or heavy Lat Pulldown' },
    { exercise_name: 'Chest-Supported Row', target_sets: 3, rep_min: 8, rep_max: 12, target_rir_min: 1, target_rir_max: 2, rest_seconds: 120 },
    { exercise_name: 'Seated Cable Row', target_sets: 3, rep_min: 10, rep_max: 12, target_rir_min: 1, target_rir_max: 2, rest_seconds: 120 },
    { exercise_name: 'Straight-Arm Pulldown', target_sets: 3, rep_min: 12, rep_max: 15, target_rir_min: 0, target_rir_max: 1, rest_seconds: 90 },
    { exercise_name: 'Face Pull', target_sets: 3, rep_min: 15, rep_max: 20, target_rir_min: 0, target_rir_max: 1, rest_seconds: 60 },
    { exercise_name: 'Shrug', target_sets: 3, rep_min: 12, rep_max: 15, target_rir_min: 0, target_rir_max: 1, rest_seconds: 60 },
    { exercise_name: 'Barbell Curl', target_sets: 3, rep_min: 8, rep_max: 12, target_rir_min: 0, target_rir_max: 1, rest_seconds: 60 },
    { exercise_name: 'Incline Dumbbell Curl', target_sets: 2, rep_min: 10, rep_max: 15, target_rir_min: 0, target_rir_max: 1, rest_seconds: 60 },
    ...FOREARMS,
  ],
  legs_a: [
    { exercise_name: 'Leg Press', target_sets: 4, rep_min: 6, rep_max: 8, target_rir_min: 2, target_rir_max: 2, rest_seconds: 180, is_strength_lift: true },
    { exercise_name: 'Leg Extension', target_sets: 4, rep_min: 12, rep_max: 15, target_rir_min: 0, target_rir_max: 1, rest_seconds: 90 },
    { exercise_name: 'Seated Leg Curl', target_sets: 3, rep_min: 10, rep_max: 15, target_rir_min: 0, target_rir_max: 1, rest_seconds: 90 },
    { exercise_name: 'Hip Abduction Machine', target_sets: 3, rep_min: 15, rep_max: 20, target_rir_min: 0, target_rir_max: 1, rest_seconds: 60 },
    { exercise_name: 'Standing Calf Raise', target_sets: 4, rep_min: 10, rep_max: 15, target_rir_min: 0, target_rir_max: 1, rest_seconds: 60 },
    ...CORE_A,
  ],
  push_b: [
    { exercise_name: 'Seated Overhead Press', target_sets: 4, rep_min: 5, rep_max: 6, target_rir_min: 1, target_rir_max: 2, rest_seconds: 180, is_strength_lift: true, notes: 'Barbell or machine — seated, never standing' },
    { exercise_name: 'Flat Dumbbell Press', target_sets: 3, rep_min: 8, rep_max: 12, target_rir_min: 1, target_rir_max: 2, rest_seconds: 120 },
    { exercise_name: 'Incline Cable Fly', target_sets: 3, rep_min: 12, rep_max: 15, target_rir_min: 0, target_rir_max: 1, rest_seconds: 90, notes: 'Or Machine Fly' },
    { exercise_name: 'Cable Lateral Raise', target_sets: 4, rep_min: 12, rep_max: 20, target_rir_min: 0, target_rir_max: 1, rest_seconds: 60 },
    { exercise_name: 'Dips', target_sets: 3, rep_min: 8, rep_max: 12, target_rir_min: 1, target_rir_max: 2, rest_seconds: 120, notes: 'Or dip machine' },
    { exercise_name: 'Close-Grip Bench Press', target_sets: 3, rep_min: 8, rep_max: 12, target_rir_min: 0, target_rir_max: 1, rest_seconds: 90, notes: 'Or Skullcrusher' },
    { exercise_name: 'Triceps Pushdown', target_sets: 2, rep_min: 12, rep_max: 15, target_rir_min: 0, target_rir_max: 1, rest_seconds: 60 },
    ...CORE_B,
  ],
  pull_b: [
    { exercise_name: 'Weighted Chin-up', target_sets: 4, rep_min: 5, rep_max: 8, target_rir_min: 1, target_rir_max: 2, rest_seconds: 180, is_strength_lift: true, notes: 'Or Neutral-Grip Pulldown' },
    { exercise_name: 'T-Bar Row', target_sets: 3, rep_min: 8, rep_max: 12, target_rir_min: 1, target_rir_max: 2, rest_seconds: 120, notes: 'Chest-supported. Or Machine Row' },
    { exercise_name: 'Wide-Grip Lat Pulldown', target_sets: 3, rep_min: 10, rep_max: 12, target_rir_min: 1, target_rir_max: 2, rest_seconds: 120 },
    { exercise_name: 'Single-Arm Cable Row', target_sets: 3, rep_min: 12, rep_max: 15, target_rir_min: 0, target_rir_max: 1, rest_seconds: 90 },
    { exercise_name: 'Rear Delt Fly', target_sets: 3, rep_min: 15, rep_max: 20, target_rir_min: 0, target_rir_max: 1, rest_seconds: 60 },
    { exercise_name: 'Shrug', target_sets: 3, rep_min: 12, rep_max: 15, target_rir_min: 0, target_rir_max: 1, rest_seconds: 60 },
    { exercise_name: 'Hammer Curl', target_sets: 3, rep_min: 10, rep_max: 12, target_rir_min: 0, target_rir_max: 1, rest_seconds: 60 },
    { exercise_name: 'Cable Curl', target_sets: 2, rep_min: 12, rep_max: 15, target_rir_min: 0, target_rir_max: 1, rest_seconds: 60 },
    ...FOREARMS,
  ],
  legs_b: [
    { exercise_name: 'Hack Squat', target_sets: 4, rep_min: 6, rep_max: 8, target_rir_min: 2, target_rir_max: 2, rest_seconds: 180, is_strength_lift: true, notes: 'Test light first — swap for Belt Squat or Smith Squat if it irritates the joint' },
    { exercise_name: 'Lying Leg Curl', target_sets: 4, rep_min: 10, rep_max: 15, target_rir_min: 0, target_rir_max: 1, rest_seconds: 90 },
    { exercise_name: 'Leg Press', target_sets: 3, rep_min: 10, rep_max: 12, target_rir_min: 1, target_rir_max: 2, rest_seconds: 120, notes: 'Feet high, glute bias' },
    { exercise_name: 'Hip Thrust Machine', target_sets: 3, rep_min: 12, rep_max: 15, target_rir_min: 0, target_rir_max: 1, rest_seconds: 90, notes: 'Or Glute Kickback' },
    { exercise_name: 'Leg Extension', target_sets: 3, rep_min: 12, rep_max: 15, target_rir_min: 0, target_rir_max: 1, rest_seconds: 60 },
    { exercise_name: 'Seated Calf Raise', target_sets: 4, rep_min: 12, rep_max: 20, target_rir_min: 0, target_rir_max: 1, rest_seconds: 60 },
  ],
}

// Flattened into the shape program_exercises expects, with order_index derived
// from array position so the PDF's ordering is the source of truth.
export const PROGRAM_EXERCISES = Object.entries(DAY_PLANS).flatMap(([day_code, list]) =>
  list.map((pe, i) => ({ day_code, order_index: i + 1, ...pe })),
)

// PDF Part Four — 17 meals across 4 slots. Macros are the slot's targets
// (the PDF gives per-slot macros, and the options within a slot are built to
// be interchangeable), so swapping option 1 for option 3 keeps the day intact.
const meal = (meal_type, calories, protein_g, carbs_g, fat_g) => (name) => ({ name, meal_type, calories, protein_g, carbs_g, fat_g })
const breakfast = meal('breakfast', 500, 40, 45, 17)
const lunch = meal('lunch', 700, 55, 75, 18)
const prePost = meal('pre_post', 450, 40, 60, 5)
const dinner = meal('dinner', 550, 45, 40, 20)

export const MEAL_PRESETS = [
  breakfast('4 eggs scrambled, 100g labneh, Arabic bread, cucumber + tomato'),
  breakfast('200g Greek yogurt, 50g oats, banana, 15g honey, 10 almonds'),
  breakfast('Foul mudammas with olive oil + lemon, 3 boiled eggs, half bread'),
  breakfast('Small manakish zaatar, 150g labneh, 3 boiled eggs'),

  lunch('200g grilled chicken, 1.5 cups rice, big fattoush'),
  lunch('200g grilled fish (samke), 200g potato, tabbouleh'),
  lunch('Mujadara 1.5 cups + 150g grilled chicken + laban'),
  lunch('180g lean kafta grilled, rice or bread, grilled vegetables, salad'),

  prePost('250g Greek yogurt + 60g oats + honey + banana'),
  prePost('Tuna (1 can in water) + Arabic bread + fruit'),
  prePost('4 boiled eggs + 1 bread + fruit'),
  prePost('150g leftover grilled chicken + 1 bread + dates'),
  prePost('200g labneh + 1 bread + honey + banana'),

  dinner('200g grilled chicken or meat, large salad, 3 tbsp hummus, small bread'),
  dinner('Chicken shawarma plate — no fries, light sauce, extra salad'),
  dinner('3-egg omelette with vegetables + 150g labneh + 1 bread'),
  dinner('200g grilled fish + grilled vegetables + small rice portion'),
]

// Bump when the program above changes. Devices seeded at an older version
// reconcile up to this one on next launch. The original "seed once, only if
// program_days is empty" check was not enough: an early build seeded the six
// day names with an EMPTY exercise list, and that check then permanently
// short-circuited — the days existed, so the real program never loaded and
// every workout screen came up blank.
// 3 — program_exercises ids are now stable across re-seeds, and this pass
//     repairs the dangling references version 2 left behind.
export const SEED_VERSION = 3

// Reconcile, don't wipe and re-create. Exercises are matched BY NAME so their
// ids survive, which matters because every logged set points at one — a
// delete-and-reinsert would orphan your entire training history.
export async function seedIfEmpty(userId) {
  const storedVersion = (await db.meta.get('seed_version'))?.value ?? 0
  const dayCount = await db.program_days.count()
  const programCount = await db.program_exercises.count()
  // Nothing to do only if we're current AND the program actually has content.
  if (storedVersion >= SEED_VERSION && dayCount > 0 && programCount > 0) return

  const now = new Date().toISOString()
  const stamp = (row) => ({ user_id: userId, created_at: now, updated_at: now, deleted_at: null, ...row })

  const [existingExercises, existingDays, existingMeals] = await Promise.all([
    db.exercises.toArray(), db.program_days.toArray(), db.meal_presets.toArray(),
  ])
  const exerciseByName = Object.fromEntries(existingExercises.map((e) => [e.name, e]))
  const dayByCode = Object.fromEntries(existingDays.map((d) => [d.code, d]))
  const mealByName = Object.fromEntries(existingMeals.map((m) => [m.name, m]))

  // Keep the existing id where the row already exists; only mint a new one for
  // genuinely new rows. `deleted_at: null` also un-deletes anything that was
  // soft-deleted by an older build.
  const exerciseRows = EXERCISES.map((e) => ({
    ...stamp(e),
    id: exerciseByName[e.name]?.id ?? newId(),
    created_at: exerciseByName[e.name]?.created_at ?? now,
  }))
  const exerciseIdByName = Object.fromEntries(exerciseRows.map((e) => [e.name, e.id]))

  const dayRows = PROGRAM_DAYS.map((d) => ({
    ...stamp(d),
    id: dayByCode[d.code]?.id ?? newId(),
    created_at: dayByCode[d.code]?.created_at ?? now,
  }))
  const dayIdByCode = Object.fromEntries(dayRows.map((d) => [d.code, d.id]))

  // Custom foods you added yourself are never touched — only the presets that
  // came from the program are reconciled.
  const mealRows = MEAL_PRESETS.map((m) => ({
    ...stamp({ is_custom: false, ...m }),
    id: mealByName[m.name]?.id ?? newId(),
    created_at: mealByName[m.name]?.created_at ?? now,
  }))

  // Fail loudly rather than silently seeding a day with missing exercises —
  // a typo in DAY_PLANS would otherwise produce a workout screen with holes.
  const missing = PROGRAM_EXERCISES.filter((pe) => !exerciseIdByName[pe.exercise_name])
  if (missing.length) throw new Error(`[seed] Program references unknown exercises: ${missing.map((m) => m.exercise_name).join(', ')}`)

  // A slot's identity is (day, position) — that's the natural key, and it's
  // what lets a re-seed keep the SAME id. Minting fresh ids here orphaned
  // every sets.program_exercise_id and workout_exercises.program_exercise_id
  // pointing at the old row: harmless in Dexie, which doesn't enforce foreign
  // keys, but Postgres rejects the orphan and sync dies on it.
  const existingProgramExercises = await db.program_exercises.toArray()
  const slotKey = (dayId, orderIndex) => `${dayId}|${orderIndex}`
  const existingSlot = Object.fromEntries(
    existingProgramExercises.map((p) => [slotKey(p.program_day_id, p.order_index), p]),
  )

  const programExerciseRows = PROGRAM_EXERCISES.map((pe) => {
    const program_day_id = dayIdByCode[pe.day_code]
    const prev = existingSlot[slotKey(program_day_id, pe.order_index)]
    return {
      id: prev?.id ?? newId(),
      user_id: userId,
      program_day_id,
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
      created_at: prev?.created_at ?? now,
      updated_at: now,
      deleted_at: null,
    }
  })

  // Slots the program no longer has (a day got shorter). Soft-deleted, not
  // hard-deleted, so the removal is something sync can actually push.
  const keptIds = new Set(programExerciseRows.map((r) => r.id))
  const retiredRows = existingProgramExercises
    .filter((p) => !keptIds.has(p.id) && !p.deleted_at)
    .map((p) => ({ ...p, deleted_at: now, updated_at: now }))

  const outboxFor = (table, rows) => rows.map((r) => ({ table_name: table, op: 'upsert', row_id: r.id, created_at: now, attempts: 0 }))

  await db.transaction(
    'rw',
    db.exercises, db.program_days, db.program_exercises, db.meal_presets,
    db.sets, db.workout_exercises, db.meta, db.outbox,
    async () => {
      await db.exercises.bulkPut(exerciseRows)
      await db.program_days.bulkPut(dayRows)
      await db.meal_presets.bulkPut(mealRows)
      // Updated in place now, so ids survive and nothing referencing them breaks.
      await db.program_exercises.bulkPut([...programExerciseRows, ...retiredRows])

      // Repair anything already orphaned by the earlier delete-and-recreate.
      // Both columns are nullable by design (01-schema.sql uses ON DELETE SET
      // NULL for sets) — the link is a convenience, and a dangling id is
      // strictly worse than none, because Postgres refuses to store it.
      const liveIds = new Set(programExerciseRows.map((r) => r.id))
      const orphanedSets = await db.sets.filter(
        (s) => s.program_exercise_id && !liveIds.has(s.program_exercise_id),
      ).toArray()
      const orphanedSlots = await db.workout_exercises.filter(
        (w) => w.program_exercise_id && !liveIds.has(w.program_exercise_id),
      ).toArray()

      const repairedSets = orphanedSets.map((s) => ({ ...s, program_exercise_id: null, updated_at: now }))
      const repairedSlots = orphanedSlots.map((w) => ({ ...w, program_exercise_id: null, updated_at: now }))
      if (repairedSets.length) await db.sets.bulkPut(repairedSets)
      if (repairedSlots.length) await db.workout_exercises.bulkPut(repairedSlots)

      await db.meta.put({ key: 'seed_version', value: SEED_VERSION })
      await db.outbox.bulkAdd([
        ...outboxFor('exercises', exerciseRows),
        ...outboxFor('program_days', dayRows),
        ...outboxFor('program_exercises', [...programExerciseRows, ...retiredRows]),
        ...outboxFor('meal_presets', mealRows),
        ...outboxFor('sets', repairedSets),
        ...outboxFor('workout_exercises', repairedSlots),
      ])
    },
  )
}
