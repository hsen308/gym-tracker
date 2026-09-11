// useState + useEffect together, for a reason: `draft` is local, per-panel UI
// state — the numbers currently in the steppers, not yet confirmed — so it has
// no business living in Dexie. The effect re-seeds it whenever the "next set
// to log" changes, e.g. right after a confirm bumps the set number.
import { useEffect, useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, getLastPerformanceByExercise } from '../../db/dexie'
import { isPR } from '../../lib/calc'
import { progressionAdvice, warmupRamp } from '../../lib/progression'
import { setsForSession, adjustedWeight } from '../../lib/phase'
import { formatWeight } from '../../lib/format'
import { describeLoad, supportsLoadModes } from '../../lib/loadMode'
import SetRow from './SetRow'
import SetEditor from './SetEditor'
import PainControl from './PainControl'
import Sheet from '../../components/Sheet'
import Icon from '../../components/Icon'

export default function ExercisePanel({
  exercise, programExercise, confirmedSets, workoutId, index, phase, isLight,
  isExpanded, onToggleExpand, onConfirmSet, onUpdateSet, onRemoveSet, onOpenCues,
  onOpenSwap, onOpenAnalytics, isSwapped, painLevel, onPainChange, painLocations, onPainLocationsChange,
}) {
  const isDuration = exercise.tracks === 'duration'
  const isCompound = (programExercise?.rest_seconds ?? 0) >= 120
  // Weeks 1–3 and deload weeks change how many sets today actually calls for;
  // a light session then halves everything that isn't a main lift on top.
  const targetSets = setsForSession(
    programExercise?.target_sets ?? 3, phase, isCompound, !!programExercise?.is_strength_lift, isLight,
  )

  // A drop continues the set before it — counting it separately would
  // report 5 sets when the programme asked for 3.
  const working = confirmedSets.filter((s) => !s.is_warmup && !s.is_drop_set)
  const drops = confirmedSets.filter((s) => s.is_drop_set)
  const warmups = confirmedSets.filter((s) => s.is_warmup)
  const nextSetNumber = working.length + 1

  const [editingSet, setEditingSet] = useState(null)
  const [dropFor, setDropFor] = useState(null)
  const [editDraft, setEditDraft] = useState(null)

  const lastPerformance = useLiveQuery(
    () => getLastPerformanceByExercise(exercise.id, workoutId),
    [exercise.id, workoutId],
  )

  // Every non-warmup set ever logged for this exercise in OTHER sessions —
  // the PR baseline, and the raw material for the progression prompt and the
  // recent-history line.
  const historicalSets = useLiveQuery(
    () => db.sets.where('exercise_id').equals(exercise.id)
      .filter((s) => s.workout_id !== workoutId && !s.is_warmup && !s.deleted_at).toArray(),
    [exercise.id, workoutId],
  )

  const sessions = useMemo(() => {
    if (!historicalSets?.length) return []
    const byWorkout = {}
    for (const s of historicalSets) (byWorkout[s.workout_id] ??= []).push(s)
    return Object.values(byWorkout)
      .map((list) => ({
        at: list.reduce((max, s) => (s.completed_at > max ? s.completed_at : max), list[0].completed_at),
        sets: [...list].sort((a, b) => a.set_number - b.set_number),
      }))
      .sort((a, b) => new Date(b.at) - new Date(a.at))
  }, [historicalSets])

  const advice = useMemo(
    () => progressionAdvice({ lastSets: sessions[0]?.sets, programExercise, exercise }),
    [sessions, programExercise, exercise],
  )

  // What the recommended load becomes after a return/deload week scales it.
  const reducedTarget = useMemo(() => {
    if (!advice?.nextWeight || !phase || phase.loadPct >= 1) return null
    const adjusted = adjustedWeight(advice.nextWeight, phase)
    return adjusted === advice.nextWeight ? null : adjusted
  }, [advice?.nextWeight, phase])

  const [draft, setDraft] = useState(null)
  useEffect(() => {
    setDraft(seedDraft({ nextSetNumber, lastPerformance, working, programExercise, isDuration, advice, phase }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nextSetNumber, lastPerformance, advice?.nextWeight])

  const complete = working.length >= targetSets

  const header = (
    <button
      className={`ex-row pressable ${isExpanded ? 'is-open' : ''} ${complete ? 'is-complete' : ''}`}
      onClick={isExpanded ? onToggleExpand : onToggleExpand}
    >
      <span className="ex-row-index">{String(index).padStart(2, '0')}</span>
      <span className="ex-row-name">
        <span className="ex-row-title">{exercise.name}</span>
        <span className="ex-row-muscle">{muscleLabel(exercise.primary_muscle)}</span>
        {isSwapped && <span className="tag tag-swap">SWAP</span>}
        {programExercise?.is_strength_lift && <span className="tag tag-strength">MAIN LIFT</span>}
        {exercise.si_risk === 'caution' && <span className="tag tag-caution">SI</span>}
      </span>
      <span className={`ex-row-count ${complete ? 'is-done' : ''}`}>
        {complete && <Icon name="check" size={13} strokeWidth={2.5} />}
        {working.length}/{targetSets}
      </span>
    </button>
  )

  if (!isExpanded) return header

  const repTarget = isDuration
    ? `${programExercise.rep_min}–${programExercise.rep_max}s`
    : `${programExercise.rep_min}–${programExercise.rep_max} reps`
  const leftTarget = phase?.rir
    ? ` · leave ${phase.rir} in the tank`
    : programExercise?.target_rir_min != null
      ? ` · leave ${programExercise.target_rir_min}${programExercise.target_rir_max !== programExercise.target_rir_min ? `–${programExercise.target_rir_max}` : ''} in the tank`
      : ''

  const addWarmups = () => {
    const ramp = warmupRamp(draft?.weight_kg, exercise.equipment)
    ramp.forEach((step, i) => onConfirmSet({ ...step, rir: null, is_warmup: true, set_number: i + 1 }))
  }

  // Opens the editor pre-filled at ~75% of the set you just did, rather than
  // logging a guess you'd then have to correct. Carries the parent's set
  // number, because a drop belongs to that set rather than being a new one.
  const addDrop = (parent) => {
    setDropFor(parent)
    setEditDraft({
      weight_kg: Math.max(0, Math.round(((parent.weight_kg ?? 0) * 0.75) / 2.5) * 2.5),
      reps: parent.reps ?? 8,
      rir: 0, // a drop is taken to or near failure — that's the point of it
    })
  }

  // The draft must carry ONLY the fields this exercise actually tracks.
  // Including `duration_seconds: 0` on a weight-based set made the saved row
  // read as a timed hold — SetRow treats "duration is not null" as the
  // signal, and 0 is not null.
  const openEdit = (s) => {
    setEditingSet(s)
    setEditDraft(isDuration
      ? { duration_seconds: s.duration_seconds ?? 0 }
      : { weight_kg: s.weight_kg ?? 0, reps: s.reps ?? 0, rir: s.rir ?? 0, load_mode: s.load_mode ?? 'added' })
  }

  return (
    <div className="ex-panel">
      {header}

      <p className="ex-target">
        {targetSets} × {repTarget}{leftTarget} · {programExercise.rest_seconds}s rest
      </p>
      {programExercise.notes && <p className="ex-note">{programExercise.notes}</p>}

      {/* The progression prompt — the program's central rule, applied for you
          instead of being worked out mid-set. */}
      {advice && (
        <div className={`advice advice-${advice.action}`}>
          <p className="advice-main">{advice.message}</p>
          {advice.detail && <p className="advice-detail">{advice.detail}</p>}
          {/* On a reduced week the advice and the pre-filled weight would
              otherwise contradict each other — "add 2.5kg → 72.5kg" above a
              stepper sitting at 40kg. Say which number applies today. */}
          {reducedTarget != null && (
            <p className="advice-today">
              {phase.kind === 'deload' ? 'Deload' : `Week ${phase.week}`} — work at {formatWeight(reducedTarget)} today.
            </p>
          )}
        </div>
      )}

      {sessions.length > 0 && (
        <p className="ex-history">
          <span className="faint">Last: </span>{summarise(sessions[0].sets, isDuration, exercise)}
        </p>
      )}

      <div className="ex-actions">
        <button className="ex-action pressable" onClick={onOpenCues}>
          <Icon name="info" size={15} /> How to do it
        </button>
        <button className="ex-action pressable" onClick={onOpenSwap}>
          <Icon name="swap" size={15} /> Swap
        </button>
        <button className="ex-action pressable" onClick={onOpenAnalytics}>
          <Icon name="insights" size={15} /> Analytics
        </button>
        {programExercise?.is_strength_lift && !isDuration && warmups.length === 0 && (
          <button className="ex-action pressable" onClick={addWarmups}>
            <Icon name="plus" size={15} /> Warm-up ramp
          </button>
        )}
      </div>

      {(warmups.length > 0 || working.length > 0) && (
        <div className="set-list">
          {warmups.map((s) => (
            <SetRow key={s.id} setNumber={s.set_number} confirmedSet={s} exercise={exercise} isWarmup onEdit={() => openEdit(s)} />
          ))}
          {working.map((s) => (
            <div key={s.id}>
              <SetRow
                setNumber={s.set_number}
                confirmedSet={s}
                exercise={exercise}
                isPR={historicalSets ? isPR(s, historicalSets) : false}
                onEdit={() => openEdit(s)}
              />
              {drops.filter((dp) => dp.set_number === s.set_number).map((dp) => (
                <SetRow key={dp.id} setNumber={dp.set_number} confirmedSet={dp} exercise={exercise} isDrop onEdit={() => openEdit(dp)} />
              ))}
              {!isDuration && (
                <button className="add-drop pressable" onClick={() => addDrop(s)}>
                  + drop set
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {draft && (
        <div className="next-set">
          <p className="next-set-head">
            {complete ? `Extra set · ${nextSetNumber}` : `Set ${nextSetNumber} of ${targetSets}`}
          </p>
          <SetEditor
            draft={draft}
            onChange={setDraft}
            exercise={exercise}
            programExercise={programExercise}
            onSubmit={() => onConfirmSet({ ...draft, set_number: nextSetNumber })}
            submitLabel={complete ? 'Log extra set' : `Log set ${nextSetNumber}`}
          />
        </div>
      )}

      {/* Only on the lifts the program flags — asking after every cable curl
          would train you to ignore it (apple-design §13: over-feedback). */}
      {exercise.si_risk === 'caution' && (
        <PainControl
          value={painLevel}
          onChange={onPainChange}
          painLocations={painLocations}
          onLocationsChange={onPainLocationsChange}
        />
      )}

      <Sheet open={!!dropFor} onClose={() => setDropFor(null)}>
        {dropFor && editDraft && (
          <>
            <h2 className="sheet-title">Drop set · after set {dropFor.set_number}</h2>
            <p className="sheet-sub">
              Straight after the set above, no rest. Counts toward volume but not as another
              working set — three sets with two drops is still three sets.
            </p>
            <SetEditor
              draft={editDraft}
              onChange={setEditDraft}
              exercise={exercise}
              programExercise={programExercise}
              submitLabel="Log drop"
              onSubmit={() => {
                onConfirmSet({ ...editDraft, is_drop_set: true, set_number: dropFor.set_number })
                setDropFor(null)
              }}
            />
          </>
        )}
      </Sheet>

      <Sheet open={!!editingSet} onClose={() => setEditingSet(null)}>
        {editingSet && editDraft && (
          <>
            <h2 className="sheet-title">
              {editingSet.is_warmup ? 'Warm-up set' : `Set ${editingSet.set_number}`} · {exercise.name}
            </h2>
            <SetEditor
              draft={editDraft}
              onChange={setEditDraft}
              exercise={exercise}
              programExercise={programExercise}
              submitLabel="Save changes"
              onSubmit={() => { onUpdateSet(editingSet.id, editDraft); setEditingSet(null) }}
              onDelete={() => { onRemoveSet(editingSet.id); setEditingSet(null) }}
            />
          </>
        )}
      </Sheet>
    </div>
  )
}

const muscleLabel = (primary) => (primary ? primary.replace(/_/g, ' ') : '')

const summarise = (sets, isDuration, exercise) => {
  if (isDuration) return `${sets.map((s) => s.duration_seconds ?? 0).join(' / ')}s`
  // A collapsed panel reading "95 × 12, 11, 11" when one of those sets was
  // bodyweight is worse than no summary at all.
  const modal = supportsLoadModes(exercise)
  const load = (x) => (modal ? describeLoad(x, formatWeight) : formatWeight(x.weight_kg))
  const first = load(sets[0])
  return sets.every((x) => load(x) === first)
    ? `${first} × ${sets.map((x) => x.reps).join(', ')}`
    : sets.map((x) => `${load(x)}×${x.reps}`).join('  ')
}

// Pre-fill priority: the progression rule's recommendation if there is one →
// what you did on this exact set number last time → the previous set in THIS
// session (so an added set inherits sane numbers) → the programmed target, so
// a cold start still lands somewhere sensible rather than at zero.
function seedDraft({ nextSetNumber, lastPerformance, working, programExercise, isDuration, advice, phase }) {
  const last = lastPerformance?.[nextSetNumber]
  const prev = working[working.length - 1]

  if (isDuration) {
    return { duration_seconds: last?.duration_seconds ?? prev?.duration_seconds ?? programExercise?.rep_min ?? 30 }
  }

  // Carry the mode forward — you don't change machines between set 1 and 2.
  const load_mode = prev?.load_mode ?? last?.load_mode ?? 'added'

  // Only take a weight from a set on the SAME curve. Pre-filling 95kg because
  // the previous set was a machine set, when this one is bodyweight, puts a
  // number in the field that means nothing.
  const sameMode = (x) => x && (x.load_mode ?? 'added') === load_mode
  const base = (sameMode(prev) ? prev.weight_kg : null)
    ?? advice?.nextWeight
    ?? (sameMode(last) ? last.weight_kg : null)
    ?? 0

  return {
    weight_kg: load_mode === 'bodyweight' ? 0 : (sameMode(prev) ? base : adjustedWeight(base, phase)),
    reps: last?.reps ?? prev?.reps ?? programExercise?.rep_min ?? 8,
    rir: last?.rir ?? prev?.rir ?? programExercise?.target_rir_max ?? 2,
    load_mode,
  }
}
