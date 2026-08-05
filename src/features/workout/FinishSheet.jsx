import { useState } from 'react'
import Sheet from '../../components/Sheet'
import Stepper from '../../components/Stepper'
import Button from '../../components/Button'

export default function FinishSheet({ open, onClose, onFinish }) {
  const [siPain, setSiPain] = useState(0)
  const [energy, setEnergy] = useState(3)
  const [notes, setNotes] = useState('')

  return (
    <Sheet open={open} onClose={onClose}>
      <h2 style={{ fontSize: 18, marginBottom: 20 }}>Finish workout</h2>

      <div className="stack-3" style={{ marginBottom: 20 }}>
        <Stepper label="SI joint pain (0–10)" value={siPain} onChange={setSiPain} step={1} min={0} max={10} />
        <Stepper label="Energy (1–5)" value={energy} onChange={setEnergy} step={1} min={1} max={5} />
      </div>

      <div className="field">
        <label>Notes (optional)</label>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
      </div>

      <Button className="btn-block" onClick={() => onFinish({ si_pain_score: siPain, energy, notes: notes || null })}>
        Finish
      </Button>
    </Sheet>
  )
}
