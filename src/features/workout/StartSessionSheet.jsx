import { useState } from 'react'
import Sheet from '../../components/Sheet'
import Button from '../../components/Button'
import { toLocalInputValue, fromLocalInputValue, localDateOf } from '../../lib/time'

// Logging a session after the fact. Sessions get entered from the sofa as
// often as from the gym floor, and a log that always stamps "now" quietly
// files Saturday's training under Sunday.
//
// A native datetime input rather than steppers: this is off the logging path
// (build-plan §9 only bans the keyboard mid-set), and a date picker is
// genuinely the better control for a date.
export default function StartSessionSheet({ open, onClose, onStart }) {
  const [startedAt, setStartedAt] = useState(() => toLocalInputValue(new Date()))

  const submit = () => {
    const start = fromLocalInputValue(startedAt)
    if (!start) return
    onStart({ startedAt: start.toISOString(), date: localDateOf(start) })
  }

  return (
    <Sheet open={open} onClose={onClose}>
      <h2 className="sheet-title">Log a past session</h2>
      <p className="sheet-sub">
        Set when you actually trained. The session opens as normal — you can log every set,
        then set the finish time when you're done.
      </p>
      <label className="field">
        <span className="label">Started at</span>
        <input type="datetime-local" value={startedAt} onChange={(e) => setStartedAt(e.target.value)} />
      </label>
      <Button className="btn-block" style={{ marginTop: 'var(--space-5)' }} onClick={submit}>
        Open session
      </Button>
    </Sheet>
  )
}
