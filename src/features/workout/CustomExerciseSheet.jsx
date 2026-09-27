import { useEffect, useState } from 'react'
import { newId, upsertRow } from '../../db/dexie'
import Sheet from '../../components/Sheet'
import Button from '../../components/Button'

const MUSCLES = [
  'chest', 'shoulders', 'triceps', 'lats', 'upper_back', 'rear_delts', 'traps',
  'biceps', 'quads', 'hamstrings', 'glutes', 'calves', 'abs', 'obliques', 'forearms',
]

const EQUIPMENT = ['barbell', 'dumbbell', 'cable', 'machine', 'bodyweight']

const CATEGORY_BY_MUSCLE = {
  chest: 'push', shoulders: 'push', triceps: 'push',
  lats: 'pull', upper_back: 'pull', rear_delts: 'pull', traps: 'pull', biceps: 'pull', forearms: 'pull',
  quads: 'legs', hamstrings: 'legs', glutes: 'legs', calves: 'legs',
  abs: 'core', obliques: 'core',
}

export default function CustomExerciseSheet({ open, onClose, onCreated, user, initialDraft }) {
  const [name, setName] = useState('')
  const [muscle, setMuscle] = useState(null)
  const [equipment, setEquipment] = useState('bodyweight')

  useEffect(() => {
    if (!open) return
    setName(initialDraft?.name ?? '')
    setMuscle(initialDraft?.muscle ?? null)
    setEquipment(initialDraft?.equipment ?? 'bodyweight')
  }, [open, initialDraft?.name, initialDraft?.muscle, initialDraft?.equipment])

  const reset = () => { setName(''); setMuscle(null); setEquipment('bodyweight') }
  const save = async () => {
    if (!name.trim() || !muscle || !user) return
    const now = new Date().toISOString()
    const exercise = {
      id: newId(), user_id: user.id, name: name.trim(),
      category: CATEGORY_BY_MUSCLE[muscle] ?? 'push', primary_muscle: muscle,
      secondary_muscles: [], equipment, is_unilateral: false, si_risk: 'none', sternal_risk: 'none',
      tracks: 'weight_reps', setup_notes: null, cues: [], is_custom: true,
      created_at: now, updated_at: now, deleted_at: null,
    }
    await upsertRow('exercises', exercise)
    reset()
    onCreated(exercise)
  }

  return (
    <Sheet open={open} onClose={() => { reset(); onClose() }}>
      <h2 className="sheet-title">New exercise</h2>
      <p className="muted" style={{ fontSize: 13, marginBottom: 'var(--space-5)', lineHeight: 1.5 }}>
        Add the name, target muscle, and equipment. You can refine it later.
      </p>
      <label className="field">
        <span className="label">Name</span>
        <input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Belt Squat" onKeyDown={(e) => { if (e.key === 'Enter') save() }} />
      </label>
      <div className="field">
        <span className="label">Primary muscle</span>
        <div className="area-grid">
          {MUSCLES.map((m) => <button key={m} className={`area-chip ${muscle === m ? 'is-active' : ''}`} onClick={() => setMuscle(m)}>{m.replace(/_/g, ' ')}</button>)}
        </div>
      </div>
      <div className="field">
        <span className="label">Equipment</span>
        <div className="area-grid">
          {EQUIPMENT.map((e) => <button key={e} className={`area-chip ${equipment === e ? 'is-active' : ''}`} onClick={() => setEquipment(e)}>{e}</button>)}
        </div>
      </div>
      <Button className="btn-block" style={{ marginTop: 'var(--space-5)' }} onClick={save} disabled={!name.trim() || !muscle}>
        Add and use this exercise
      </Button>
    </Sheet>
  )
}