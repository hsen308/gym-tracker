import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate, useParams } from 'react-router-dom'
import { db, newId, upsertRow } from '../../db/dexie'
import { useAuth } from '../../app/AuthProvider'
import { adjustedSets, programPhase } from '../../lib/phase'
import { useProgramStart } from '../../lib/useProgramStart'
import { todayLocalDate } from '../../lib/format'
import Button from '../../components/Button'
import Icon from '../../components/Icon'
import Sheet from '../../components/Sheet'
import StartSessionSheet from './StartSessionSheet'

// Looking at a day is not the same as starting it. Opening a day used to
// create a workout immediately, which meant you could not check what was on
// Push A without leaving a half-finished session behind. This screen is
// read-only; starting is a deliberate, separate tap.
export default function DayPreview() {
  const { dayId } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()

  const day = useLiveQuery(() => db.program_days.get(dayId), [dayId])
  const programExercises = useLiveQuery(
    () => db.program_exercises.where('program_day_id').equals(dayId).filter((pe) => !pe.deleted_at).sortBy('order_index'),
    [dayId],
  )
  const exercises = useLiveQuery(() => db.exercises.filter((e) => !e.deleted_at).toArray(), [])
  const unfinished = useLiveQuery(() => db.workouts.filter((w) => !w.finished_at && !w.deleted_at).first(), [])

  const [cueExercise, setCueExercise] = useState(null)
  const [startOpen, setStartOpen] = useState(false)

  const programStart = useProgramStart()
  const phase = useMemo(() => programPhase(programStart), [programStart])

  if (!day || !programExercises || !exercises) return null
  const exerciseById = Object.fromEntries(exercises.map((e) => [e.id, e]))

  const totalSets = programExercises.reduce(
    (n, pe) => n + adjustedSets(pe.target_sets, phase, (pe.rest_seconds ?? 0) >= 120), 0,
  )
  const estMinutes = Math.round(
    programExercises.reduce((m, pe) => {
      const sets = adjustedSets(pe.target_sets, phase, (pe.rest_seconds ?? 0) >= 120)
      return m + sets * ((pe.rest_seconds ?? 90) + 40) // rest plus roughly the set itself
    }, 0) / 60,
  )

  const startSession = async ({ startedAt, date }) => {
    const now = new Date().toISOString()
    const workout = {
      id: newId(),
      user_id: user.id,
      program_day_id: day.id,
      date: date ?? todayLocalDate(),
      started_at: startedAt ?? now,
      finished_at: null,
      bodyweight_kg: null,
      si_pain_score: null,
      energy: null,
      sleep_hours: null,
      notes: null,
      created_at: now,
      updated_at: now,
      deleted_at: null,
    }
    await upsertRow('workouts', workout)
    navigate(`/workout/${workout.id}`)
  }

  // Records the miss without opening a session. Skipping used to mean either
  // starting a workout and abandoning it — which is where the empty sessions
  // came from — or logging nothing at all, which quietly overstates adherence.
  const markSkipped = async () => {
    const now = new Date().toISOString()
    await upsertRow('workouts', {
      id: newId(),
      user_id: user.id,
      program_day_id: day.id,
      date: todayLocalDate(),
      started_at: now,
      finished_at: null,
      skipped_at: now,
      bodyweight_kg: null, si_pain_score: null, energy: null, sleep_hours: null, notes: null,
      created_at: now, updated_at: now, deleted_at: null,
    })
    navigate('/')
  }

  const resumeThisDay = unfinished?.program_day_id === day.id ? unfinished : null

  return (
    <div className="container screen has-sticky-action">
      <header className="screen-head">
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginLeft: -12 }}>
          <button className="btn btn-ghost btn-icon pressable" onClick={() => navigate('/')} aria-label="back">
            <Icon name="back" size={20} />
          </button>
          <div>
            <p className="label">{day.focus}</p>
            <h1 className="readout screen-title">{day.name.toUpperCase()}</h1>
          </div>
        </div>
      </header>

      <div className="stat-strip">
        <div><p className="label">Exercises</p><p className="stat-strip-value">{programExercises.length}</p></div>
        <div><p className="label">Work sets</p><p className="stat-strip-value">{totalSets}</p></div>
        <div><p className="label">Approx.</p><p className="stat-strip-value">{estMinutes}<span className="stat-unit"> min</span></p></div>
      </div>

      {phase?.title && (
        <div className="phase-banner">
          <p className="label label-strong">{phase.title}</p>
          <p className="phase-note">{phase.note}</p>
        </div>
      )}

      <h2 className="label section-label">The session</h2>
      <div className="panel rule-list">
        {programExercises.map((pe, i) => {
          const ex = exerciseById[pe.exercise_id]
          if (!ex) return null
          const sets = adjustedSets(pe.target_sets, phase, (pe.rest_seconds ?? 0) >= 120)
          const isDuration = ex.tracks === 'duration'
          return (
            <button key={pe.id} className="preview-row pressable" onClick={() => setCueExercise(ex)}>
              <span className="preview-index">{String(i + 1).padStart(2, '0')}</span>
              <span className="preview-main">
                <span className="preview-name">
                  {ex.name}
                  {pe.is_strength_lift && <span className="tag tag-strength">MAIN LIFT</span>}
                  {ex.si_risk === 'caution' && <span className="tag tag-caution">SI</span>}
                </span>
                <span className="preview-target">
                  {sets} × {pe.rep_min}–{pe.rep_max}{isDuration ? 's' : ' reps'} · {pe.rest_seconds}s rest
                  {pe.notes ? ` · ${pe.notes}` : ''}
                </span>
              </span>
              <Icon name="chevron" size={16} className="faint" />
            </button>
          )
        })}
      </div>

      {/* Sticky so it's reachable without scrolling back up a long session. */}
      <div className="sticky-action">
        {resumeThisDay ? (
          <Button className="btn-block" onClick={() => navigate(`/workout/${resumeThisDay.id}`)}>
            Resume this session
          </Button>
        ) : (
          <>
            <Button className="btn-block" onClick={() => startSession({})}>Start session now</Button>
            <div className="preview-secondary">
              <button className="link-action pressable" onClick={() => setStartOpen(true)}>
                <Icon name="timer" size={15} /> Log one I already did
              </button>
              <button className="link-action pressable" onClick={markSkipped}>
                Mark skipped
              </button>
            </div>
          </>
        )}
      </div>

      <StartSessionSheet
        open={startOpen}
        onClose={() => setStartOpen(false)}
        onStart={(v) => { setStartOpen(false); startSession(v) }}
      />

      <Sheet open={!!cueExercise} onClose={() => setCueExercise(null)}>
        {cueExercise && <ExerciseCues exercise={cueExercise} />}
      </Sheet>
    </div>
  )
}

// Shared by the preview and the live logging screen — the same reference,
// reachable both before you go and while you're mid-set.
export function ExerciseCues({ exercise }) {
  return (
    <>
      <h2 className="sheet-title">{exercise.name}</h2>
      {exercise.si_risk === 'caution' && (
        <div className="callout callout-warn">
          <p className="label label-strong">SI joint caution</p>
          <p>Stop before the hips tuck, stay symmetrical, never twist to grind a rep. If it aches, cut the range and drop 20%.</p>
        </div>
      )}
      {exercise.setup_notes && (
        <>
          <p className="label section-label" style={{ marginTop: 0 }}>Setup</p>
          <p style={{ fontSize: 15, lineHeight: 1.6 }}>{exercise.setup_notes}</p>
        </>
      )}
      {exercise.cues?.length > 0 && (
        <>
          <p className="label section-label">Cues</p>
          <ul className="cue-list">
            {exercise.cues.map((c, i) => <li key={i}>{c}</li>)}
          </ul>
        </>
      )}
    </>
  )
}
