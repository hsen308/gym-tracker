import { useState } from 'react'
import StepperRow from '../../components/StepperRow'
import Button from '../../components/Button'
import Sheet from '../../components/Sheet'
import { formatWeight } from '../../lib/format'
import { formatPlates } from '../../lib/plates'
import { weightMode, REPS_LEFT_LABEL, REPS_LEFT_HELP } from '../../lib/weightMode'
import { WEIGHT_STEP_KG, WEIGHT_STEP_KG_LONG_PRESS } from '../../lib/constants'

// The set input, shared by "log the next set" and "edit a set I already
// logged". Editing matters more than it looks: entering a session after
// getting home from the gym means typos are certain, and hold-to-delete
// followed by re-entry is a bad answer to a wrong digit.
export default function SetEditor({
  draft, onChange, exercise, programExercise, onSubmit, submitLabel = 'Log set',
  onDelete, compact,
}) {
  const [help, setHelp] = useState(null)
  const isDuration = exercise?.tracks === 'duration'
  const mode = weightMode(exercise)
  const plates = !isDuration && exercise?.equipment === 'barbell' ? formatPlates(draft.weight_kg) : null

  // build-plan §9: "double-tap on confirm creates duplicate sets."
  const [busy, setBusy] = useState(false)
  const submit = () => {
    if (busy) return
    setBusy(true)
    onSubmit()
    setTimeout(() => setBusy(false), 400)
  }

  const repTarget = programExercise
    ? `target ${programExercise.rep_min}–${programExercise.rep_max}${isDuration ? 's' : ''}`
    : null

  return (
    <div className={`set-editor ${compact ? 'is-compact' : ''}`}>
      {isDuration ? (
        <StepperRow
          label="Hold" hint={repTarget ? `${repTarget}econds` : 'seconds'}
          value={draft.duration_seconds} step={5} longPressStep={15} min={0}
          format={(v) => `${v}s`}
          onChange={(duration_seconds) => onChange({ ...draft, duration_seconds })}
        />
      ) : (
        <>
          <StepperRow
            label="Weight"
            hint={mode.hint}
            onHelp={mode.help ? () => setHelp({ title: 'What weight to enter', body: mode.help }) : undefined}
            value={draft.weight_kg}
            step={WEIGHT_STEP_KG} longPressStep={WEIGHT_STEP_KG_LONG_PRESS} min={0}
            format={formatWeight}
            onChange={(weight_kg) => onChange({ ...draft, weight_kg })}
          />
          {plates && <p className="plate-hint">{plates === 'bar only' ? 'Empty bar' : `${plates} per side`}</p>}

          <StepperRow
            label="Reps" hint={repTarget}
            value={draft.reps} step={1} min={0}
            onChange={(reps) => onChange({ ...draft, reps })}
          />

          <StepperRow
            label="Reps left"
            hint="could you have done more?"
            onHelp={() => setHelp({ title: REPS_LEFT_LABEL, body: REPS_LEFT_HELP })}
            value={draft.rir} step={1} min={0} max={10}
            format={(v) => (v === 0 ? 'failure' : String(v))}
            onChange={(rir) => onChange({ ...draft, rir })}
          />
        </>
      )}

      <div className="set-editor-actions">
        {onDelete && (
          <Button variant="danger" onClick={onDelete}>Delete</Button>
        )}
        <Button className="btn-block" onClick={submit} disabled={busy}>{submitLabel}</Button>
      </div>

      <Sheet open={!!help} onClose={() => setHelp(null)}>
        {help && (
          <>
            <h2 className="sheet-title">{help.title}</h2>
            <p style={{ fontSize: 15, lineHeight: 1.6 }}>{help.body}</p>
          </>
        )}
      </Sheet>
    </div>
  )
}
