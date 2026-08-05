# Gym Tracker — Build Plan

**Spec for Claude Code.** Execute phases in order. Do not start a phase until the previous one meets its acceptance criteria.

---

## 0. Context

A personal training-log PWA for one user. It replaces a note app for logging workouts, tracks bodyweight and measurements, and eventually surfaces analytics — including a feature no commercial app has: correlating SI-joint pain against specific exercises and loads.

**The user is a second-year CS student, comfortable with HTML/CSS/JS and Git, new to React.** Write idiomatic React but favour clarity over cleverness. Prefer explicit code over abstraction. Add short comments where a React concept appears for the first time (hooks, context, effects, refs) — not tutorial prose, just a line explaining why it's there.

### Non-negotiable constraints

1. **Every write goes to IndexedDB first.** Supabase is a sync target, never the source of truth during a session. No screen may read directly from Supabase at runtime.
2. **The app must fully function with airplane mode on.** Gym basements have no signal.
3. **Logging one set must take ≤3 seconds, one-handed, without careful looking.** This is the primary design constraint. If a feature adds taps to the logging path, it does not belong on that screen.
4. **All timers are timestamp-based.** Store `started_at`, compute elapsed on read. Never `setInterval` counters — they break on screen lock, which happens every set.
5. **Never block the UI on a network call.** Ever.

---

## 1. Stack

```
React 18 + Vite
react-router-dom v6
Dexie 4              — IndexedDB wrapper
@supabase/supabase-js v2
vite-plugin-pwa      — service worker + manifest
date-fns             — date math
recharts             — charts (Phase 3+ only, lazy loaded)
```

No component library. No Tailwind. Plain CSS with CSS custom properties — the design is small and specific enough that a framework adds weight without benefit.

**Env vars** (`.env.local`, gitignored):
```
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

---

## 2. Repo structure

```
/src
  main.jsx
  App.jsx
  /app
    router.jsx
    AuthProvider.jsx
    SyncProvider.jsx
  /db
    dexie.js            local schema + outbox
    supabase.js         client
    sync.js             push/pull engine
    seed.js             first-run program seeding
  /features
    /auth
      LoginScreen.jsx
    /workout
      TodayScreen.jsx        pick / resume session
      ActiveWorkout.jsx      the main screen
      ExercisePanel.jsx      one exercise, its sets
      SetRow.jsx
      RestTimer.jsx
      FinishSheet.jsx        pain / energy / notes on finish
    /history
      HistoryList.jsx
      WorkoutDetail.jsx
      ExerciseHistory.jsx
    /body
      BodyScreen.jsx
    /insights
      InsightsScreen.jsx
    /settings
      SettingsScreen.jsx     export, sign out
  /components
    Button.jsx  Stepper.jsx  Sheet.jsx  Field.jsx  Toast.jsx  OfflineBadge.jsx
  /lib
    calc.js       e1RM, volume, regression
    format.js     weights, durations, dates
    constants.js
  /styles
    tokens.css
    global.css
```

---

## 3. Data model

The Supabase schema is already written and run (`01-schema.sql`). Two amendments are required before Phase 2 — apply them now so they're not a migration later.

### 3a. Schema amendment (run in Supabase SQL Editor)

```sql
-- Sync needs change tracking and soft deletes.
-- Without updated_at, pull-sync cannot know what changed.
-- Without deleted_at, deletions never propagate between devices.

do $$
declare t text;
begin
  foreach t in array array[
    'exercises','program_days','program_exercises',
    'workouts','sets','bodyweight_logs','measurements'
  ] loop
    execute format('alter table %I add column if not exists updated_at timestamptz default now()', t);
    execute format('alter table %I add column if not exists deleted_at timestamptz', t);
    execute format('create index if not exists idx_%I_updated on %I(user_id, updated_at desc)', t, t);
  end loop;
end $$;

create or replace function touch_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end $$ language plpgsql;

do $$
declare t text;
begin
  foreach t in array array[
    'exercises','program_days','program_exercises',
    'workouts','sets','bodyweight_logs','measurements'
  ] loop
    execute format('drop trigger if exists trg_touch on %I', t);
    execute format('create trigger trg_touch before update on %I
                    for each row execute function touch_updated_at()', t);
  end loop;
end $$;
```

### 3b. Local Dexie schema

Mirror the server tables, plus an outbox and a meta table.

```js
db.version(1).stores({
  exercises:         'id, category, primary_muscle, updated_at',
  program_days:      'id, order_index',
  program_exercises: 'id, program_day_id, exercise_id, order_index',
  workouts:          'id, date, program_day_id, updated_at',
  sets:              'id, workout_id, exercise_id, completed_at',
  bodyweight_logs:   'id, date',
  measurements:      'id, date',
  outbox:            '++seq, table_name, op, row_id, created_at',
  meta:              'key'   // { key:'last_pull_at', value: ISO string }
});
```

**IDs are generated client-side** with `crypto.randomUUID()`. Never wait for the server to assign one — that would mean a network round trip per set.

---

## 4. Seed data

On first successful login, if `program_days` is empty, seed the program. Seed data lives in `/src/db/seed.js` as plain JS objects and is written to Dexie, then pushed through the normal outbox.

### 4a. Exercise library

Every exercise needs: `name`, `category`, `primary_muscle`, `secondary_muscles[]`, `equipment`, `is_unilateral`, `si_risk`, `setup_notes`, `cues[]`.

`si_risk` values: `none` | `caution` | `avoid`.
- `caution` — hack squat, leg press, seated cable row, single-arm cable row, hip thrust
- The setup notes and cues come from the user's program PDF. They render in the logging screen behind a tap on the exercise name, so the cue is available at the moment it matters.

Exercises to seed (48 total):

**Push:** Barbell Bench Press · Incline Dumbbell Press · Flat Dumbbell Press · Seated Machine Shoulder Press · Seated Overhead Press · Cable Fly · Incline Cable Fly · Machine Fly · Dips · Lateral Raise · Cable Lateral Raise · Rope Triceps Pushdown · Triceps Pushdown · Overhead Cable Triceps Extension · Close-Grip Bench Press · Skullcrusher

**Pull:** Weighted Pull-up · Lat Pulldown · Weighted Chin-up · Neutral-Grip Pulldown · Wide-Grip Lat Pulldown · Chest-Supported Row · T-Bar Row · Machine Row · Seated Cable Row · Single-Arm Cable Row · Straight-Arm Pulldown · Face Pull · Rear Delt Fly · Shrug · Barbell Curl · Incline Dumbbell Curl · Hammer Curl · Cable Curl

**Legs:** Leg Press · Hack Squat · Belt Squat · Smith Machine Squat · Leg Extension · Seated Leg Curl · Lying Leg Curl · Hip Abduction Machine · Glute Kickback · Hip Thrust Machine · Standing Calf Raise · Seated Calf Raise

**Core/Forearms:** Cable Crunch · Pallof Press · Side Plank · Machine Crunch · Hanging Knee Raise · Plank · Reverse Barbell Curl · Wrist Curl · Farmer's Hold

### 4b. Program days

Six days: `push_a` (Chest), `pull_a` (Vertical), `legs_a` (Quads), `push_b` (Shoulders), `pull_b` (Horizontal), `legs_b` (Posterior).

Each day's exercise list, sets, rep ranges, RIR targets and rest times come from the program PDF. Core blocks append to Push A, Legs A (Block A) and Push B (Block B); forearms append to Pull A and Pull B.

**Rest defaults:** strength lift 180s · compound accessory 120s · isolation 60–90s.

Mark the first exercise of each day `is_strength_lift = true`.

---

## 5. Sync architecture

### Write path
```
User action
  → write row to Dexie                (UI updates immediately)
  → append { table, op, row_id } to outbox
  → return
```
The UI never awaits the network.

### Push
Drain the outbox in insertion order. For each entry, read the current row from Dexie and `upsert` it to Supabase. On success, delete the outbox entry. On failure, increment `attempts` and stop draining — preserve order, retry the whole queue next cycle. After 5 failed attempts on one entry, move it to a `sync_errors` table and surface it in Settings rather than blocking forever.

### Pull
Read `meta.last_pull_at`. For each table, `select * where updated_at > last_pull_at`. Write into Dexie. Set `last_pull_at` to the max `updated_at` seen.

**Conflict rule:** last-write-wins by `updated_at`. Single user, so this is sufficient — do not build anything more elaborate.

### When sync runs
- App foreground (`visibilitychange`)
- `online` event
- Every 60s while online and app is visible
- Manual pull-to-refresh in Settings

**Never on a timer while backgrounded** — iOS Safari has no Background Sync API and the code will simply not run. Design for sync-on-open.

### Sync status
A single `OfflineBadge` in the header: `Synced` · `Offline · N pending` · `Syncing`. Nothing more.

---

## 6. Design system

### 6a. Direction

The subject is a *scale readout* — the instrument character of a loaded barbell and a stopwatch. The screen is read one-handed, mid-rest, breathing hard, under bright gym light or in a dark basement. Legibility at arm's length is the entire aesthetic.

Numbers are the hero. Everything else recedes.

### 6b. Tokens (`tokens.css`)

```css
:root {
  /* Surface — deep slate, not pure black; less smear under gym lighting */
  --bg:          #14181F;
  --surface:     #1C222C;
  --surface-alt: #242C38;
  --line:        #313B4A;

  /* Text */
  --text:        #E9EDF3;
  --text-muted:  #8B97A8;
  --text-faint:  #5C6879;

  /* Signal — amber reads as load/effort; used ONLY for the active set
     and the primary action. Never decorative. */
  --signal:      #FF7A2F;
  --signal-dim:  #C25A1E;

  /* States */
  --pr:          #47D39B;   /* personal record */
  --warn:        #E4B33C;   /* SI joint caution */
  --danger:      #E05252;

  --radius:      10px;
  --tap:         56px;      /* minimum tap target height */
}
```

### 6c. Type

```
Display / numerals  Archivo        700–800, tabular figures
Body / UI           IBM Plex Sans  400–600
Data / timers       IBM Plex Mono  500
```

Load from Google Fonts, subset to latin. **Always `font-variant-numeric: tabular-nums`** on any changing number — otherwise weights and timers jitter as digits change width, which looks broken.

Scale: `11 / 13 / 15 / 18 / 24 / 40 / 64`. The 64 is reserved for the rest timer and the active set's weight.

### 6d. Signature element

**The rest timer is the bottom third of the screen.** A full-width bar that drains right-to-left, with the countdown in 64px tabular mono centred on it. When it hits zero the bar flashes `--signal` once and the phone vibrates (`navigator.vibrate(200)`).

It's readable from a rack ten metres away and requires no interaction. That's the one place boldness is spent — everything else stays quiet.

### 6e. Layout rules

- Every interactive element ≥ `--tap` (56px) tall.
- **All primary controls in the bottom half of the screen.** Thumb reach is the constraint, not visual balance.
- No modals that require a precise close tap; use bottom sheets that dismiss on swipe-down.
- Respect `prefers-reduced-motion` — disable the bar drain animation, keep the numeral countdown.
- Visible keyboard focus rings. Don't remove outlines.

### 6f. Copy

Active voice, sentence case, no filler. The button that starts a workout says `Start Push A` and produces a screen headed `Push A`. Errors state what happened and what to do: `Couldn't sync — your sets are saved on this phone and will upload when you're back online.` Empty states invite action: `No sessions yet. Start today's workout.`

---

## 7. Phases

### Phase 1 — Log a workout (SHIP THIS)

**Scope:** auth, local DB, seeding, the active workout screen. Nothing else.

Build:
1. Vite + React scaffold, PWA plugin configured, manifest with icons, installable to home screen.
2. `AuthProvider` — Supabase email magic-link or password login. Session persisted. Route guard.
3. Dexie schema + seed on first login.
4. `TodayScreen` — suggests the next day in rotation based on the last completed workout; a list to override; resumes an unfinished session if one exists.
5. `ActiveWorkout` — the core screen:
   - Header: day name, elapsed session time, offline badge.
   - One `ExercisePanel` per programmed exercise, current one expanded, others collapsed to a single line showing `3/4 sets`.
   - Each `SetRow`: set number, weight stepper, reps stepper, RIR stepper, confirm button.
   - **Pre-fill every set with the same set number from the last time this exercise was performed.** Most sets are one tap to confirm.
   - Steppers only. No keyboard on the logging path. Weight steps 2.5kg (long-press 5kg), reps 1, RIR 1.
   - Confirming a set writes to Dexie and starts the rest timer with that exercise's `rest_seconds`.
   - Tapping the exercise name opens a sheet with its setup notes and cues.
   - Exercises with `si_risk = 'caution'` show a small `--warn` dot; the sheet leads with the SI note.
   - Add-set and remove-set. Swap-exercise picker filtered to the same `primary_muscle`.
6. `RestTimer` — timestamp-based, persists across reload and screen lock, skip button.
7. `FinishSheet` — SI pain 0–10, energy 1–5, optional note, finish. Writes `finished_at`.

**Acceptance criteria:**
- [ ] Airplane mode on, cold app launch: full workout logs end to end with zero errors.
- [ ] Force-quit mid-workout, reopen: session resumes with all sets and correct timer state.
- [ ] Logging one set is measurably ≤3 seconds and reachable one-handed.
- [ ] Installed to iOS home screen and opens without browser chrome.
- [ ] No screen reads from Supabase at runtime.

**Then stop. Use it for three weeks before Phase 2.** Real usage will change the requirements for everything below, and guesses made now will be wrong.

---

### Phase 2 — Sync and export

1. Outbox drain + pull sync per §5.
2. `sync_errors` surfaced in Settings.
3. **JSON export** — full dump of all tables to a downloaded file. Build this even though sync exists; it is the insurance policy.
4. JSON import (restore).

**Acceptance criteria:**
- [ ] Log offline, go online, data appears in Supabase.
- [ ] Clear site data, reinstall, log in: full history restores from server.
- [ ] Export produces a file that import fully restores.
- [ ] Outbox survives force-quit.

**Why export matters:** iOS Safari evicts IndexedDB after ~7 days without use unless the PWA is installed to the home screen. Sync mitigates this; export is the backstop.

---

### Phase 3 — History and per-lift progress

1. `HistoryList` — sessions by date, day name, set count, duration, pain score.
2. `WorkoutDetail` — full session readout.
3. `ExerciseHistory` — every session for one lift, with an e1RM line chart and PR markers.

---

### Phase 4 — Body tracking

1. Bodyweight entry, one tap from home.
2. **7-day moving average line, with raw points faint behind it.** Never present raw daily weight as the headline number.
3. Measurements: waist, chest, arm, thigh.
4. Trend readout: kg/week over a trailing 21 days via linear regression.

---

### Phase 5 — Meal presets

Do **not** build a general food tracker. Seed the ~17 meals already defined in the user's program with their macros. Logging is: tap meal → tap "ate this". Add a small custom-food table for exceptions and a daily macro total against target (2200 / 170p / 220c / 70f).

---

### Phase 6 — Insights

1. **Weekly sets per muscle** against the 10–20 band.
2. **Stall detection** — flag lifts whose e1RM regression slope over the last 4 sessions is ≤ 0.
3. **Deload countdown** — week N of 7.
4. **Calorie auto-adjust** — if the bodyweight trend is flat for 21 days, suggest −175 kcal. If e1RM is falling on two or more lifts *and* energy scores are low, suggest +175 kcal.
5. **SI joint correlation** — for each exercise, mean pain score of sessions containing it vs. sessions without. Also correlate pain against load on `si_risk = 'caution'` lifts.
   - **Require ≥12 sessions containing the exercise before displaying anything.** Below that, show "not enough data yet."
   - Present as a signal to investigate, never a verdict. Label it plainly: `Sessions with Hack Squat average 1.8 points higher pain.` No causal language.

---

## 8. Algorithms (`lib/calc.js`)

```js
// Estimated 1RM, Epley adjusted for reps left in reserve.
// Comparable across different rep/effort combinations — this is the
// real progress signal, not top-set weight.
export const e1rm = ({ weight_kg, reps, rir = 0 }) =>
  weight_kg * (1 + (reps + rir) / 30);

// Weekly volume: a set counts fully for its primary muscle,
// half for each secondary. Matches how the meta-analyses count.
export const setContribution = (exercise) => [
  [exercise.primary_muscle, 1.0],
  ...exercise.secondary_muscles.map(m => [m, 0.5])
];

// Least-squares slope. Used for bodyweight trend and stall detection.
export const slope = (points) => {
  const n = points.length;
  if (n < 2) return 0;
  const mx = points.reduce((s,p) => s + p.x, 0) / n;
  const my = points.reduce((s,p) => s + p.y, 0) / n;
  const num = points.reduce((s,p) => s + (p.x - mx) * (p.y - my), 0);
  const den = points.reduce((s,p) => s + (p.x - mx) ** 2, 0);
  return den === 0 ? 0 : num / den;
};

export const movingAverage = (series, window = 7) =>
  series.map((_, i) => {
    const slice = series.slice(Math.max(0, i - window + 1), i + 1);
    return { ...series[i], avg: slice.reduce((s,d) => s + d.value, 0) / slice.length };
  });
```

**PR detection:** a set is a PR if its `e1rm` exceeds all previous non-warmup sets for that exercise. Compute on confirm, show a `--pr` flash. Do not compute PRs across substituted exercises.

---

## 9. Known traps

| Trap | Handling |
|---|---|
| iOS Safari evicts IndexedDB after ~7 days unused | Prompt to install to home screen on first run; ship sync in Phase 2; export from Phase 2 |
| No Background Sync API on iOS | Sync on app open and visibility change only. Never rely on background execution |
| `setInterval` timers die on screen lock | All timers store `started_at` and compute elapsed on read |
| Screen sleeps mid-session | Request a `WakeLock` during an active workout; release on finish. Feature-detect — it doesn't exist on iOS Safari, so fail silently |
| Double-tap on confirm creates duplicate sets | Disable the button for 400ms after tap; dedupe by client-generated UUID on upsert |
| Sweaty thumbs mis-tap | 56px minimum targets; destructive actions require a swipe, not a tap |
| Number inputs summon the keyboard | Steppers everywhere on the logging path. `inputMode="decimal"` only in Settings |
| Timezone drift on `date` columns | Store workout `date` as a local-date string, not a UTC timestamp. A 11pm session belongs to that day |

---

## 10. Execution order

```
[x] 01-schema.sql            already run
[ ] §3a schema amendment     run before Phase 2
[ ] Phase 1                  → USE FOR 3 WEEKS
[ ] Phase 2
[ ] Phase 3 … 6              re-scope from real usage
```

Commit at the end of each numbered item within a phase. Keep the working tree clean; no half-finished screens on `main`.

---

## 11. What not to build

- Social features, sharing, friends
- Multi-user or coach mode
- A general food database
- Exercise videos or animations
- Apple Health / Google Fit integration
- Anything requiring a backend beyond Supabase
- Dark/light theme toggle — it's a dark app, that's the decision

Every one of these is a plausible-sounding way to never ship Phase 1.
