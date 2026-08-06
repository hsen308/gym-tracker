import { useEffect, useState } from 'react'
import Sheet from '../../components/Sheet'
import Button from '../../components/Button'
import { toLocalInputValue, fromLocalInputValue, localDateOf } from '../../lib/time'

// Correct a session's clock — either mid-session (you forgot to hit start
// until the third set) or afterwards (you logged the whole thing at home).
// Editing the start also moves the workout's `date`, so a session entered at
// 1am for yesterday's training files under the right day.
export default function SessionTimeSheet({ open, onClose, workout, onSave }) {
  const [startedAt, setStartedAt] = useState('')
  const [finishedAt, setFinishedAt] = useState('')
  const [error, setError] = useState('')

  // Re-seed whenever a different workout (or a changed time) comes in —
  // otherwise reopening the sheet shows whatever was typed last time.
  useEffect(() => {
    if (!open || !workout) return
    setStartedAt(toLocalInputValue(workout.started_at))
    setFinishedAt(workout.finished_at ? toLocalInputValue(workout.finished_at) : '')
    setError('')
  }, [open, workout?.id, workout?.started_at, workout?.finished_at])

  const submit = () => {
    const start = fromLocalInputValue(startedAt)
    if (!start) return setError('Pick a start time.')
    const end = finishedAt ? fromLocalInputValue(finishedAt) : null
    if (end && end < start) return setError("The finish time is before the start time.")
    onSave({
      started_at: start.toISOString(),
      date: localDateOf(start),
      ...(workout.finished_at || end ? { finished_at: end ? end.toISOString() : null } : {}),
    })
    onClose()
  }

  return (
    <Sheet open={open} onClose={onClose}>
      <h2 className="sheet-title">Session time</h2>
      <p className="sheet-sub">The date this session counts under follows the start time.</p>

      <div className="stack-4" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
        <label className="field">
          <span className="label">Started</span>
          <input type="datetime-local" value={startedAt} onChange={(e) => setStartedAt(e.target.value)} />
        </label>
        {/* Only offered once there's an end to talk about — an unfinished
            session's finish time is set by the Finish button, not here. */}
        {workout?.finished_at && (
          <label className="field">
            <span className="label">Finished</span>
            <input type="datetime-local" value={finishedAt} onChange={(e) => setFinishedAt(e.target.value)} />
          </label>
        )}
      </div>

      {error && <p className="form-error">{error}</p>}

      <Button className="btn-block" style={{ marginTop: 'var(--space-5)' }} onClick={submit}>Save</Button>
    </Sheet>
  )
}
