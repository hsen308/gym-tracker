import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../db/dexie'
import Sheet from '../../components/Sheet'
import Button from '../../components/Button'
import { getAiExerciseSwaps } from '../../lib/ai'

const PAIN_AREAS = [
  { key: 'sternum / clavicle', label: 'Sternum / clavicle' },
  { key: 'SI joint / pelvis', label: 'SI joint / pelvis' },
  { key: 'upper back', label: 'Upper back' },
]

export default function SwapSheet({
  open, onClose, exercise, onSwap, isSwapped, onRevert,
  defaultSwapId, onPersist, onClearDefault, onAddCustom,
}) {
  const alternatives = useLiveQuery(
    () => (exercise
      ? db.exercises
          .where('primary_muscle').equals(exercise.primary_muscle)
          .filter((e) => e.id !== exercise.id && !e.deleted_at)
          .sortBy('name')
      : []),
    [exercise?.id, exercise?.primary_muscle],
  )

  const hasDefault = isSwapped && defaultSwapId
  const [remember, setRemember] = useState(true)
  const [painArea, setPainArea] = useState('sternum / clavicle')
  const [aiSwaps, setAiSwaps] = useState(null)
  const [aiCaution, setAiCaution] = useState('')
  const [aiError, setAiError] = useState('')
  const [aiLoading, setAiLoading] = useState(false)

  useEffect(() => {
    if (!open) return
    setRemember(true)
    setPainArea(exercise?.sternal_risk === 'caution' ? 'sternum / clavicle' : 'SI joint / pelvis')
    setAiSwaps(null)
    setAiCaution('')
    setAiError('')
  }, [open, exercise?.id, exercise?.sternal_risk])

  const handleSwap = (alt) => {
    onSwap(alt)
    if (remember) onPersist(alt.id)
  }
  const handleRevert = () => {
    onRevert()
    if (remember) onClearDefault()
  }
  const askAi = async () => {
    if (!exercise || aiLoading) return
    setAiLoading(true)
    setAiError('')
    try {
      const result = await getAiExerciseSwaps(exercise.name, painArea)
      setAiSwaps(result.swaps ?? [])
      setAiCaution(result.caution ?? '')
    } catch (error) {
      setAiError(error.message || 'Could not get a swap suggestion.')
    } finally {
      setAiLoading(false)
    }
  }

  return (
    <Sheet open={open} onClose={onClose}>
      <h2 className="sheet-title">Swap exercise</h2>
      <p className="muted" style={{ fontSize: 13, marginBottom: 'var(--space-5)', lineHeight: 1.5 }}>
        Same muscle. {hasDefault ? 'Currently the default for this slot. Pick another, or revert below.' : 'Swap this session, or remember it for future sessions.'}
      </p>

      {isSwapped && (
        <Button variant="secondary" className="btn-block" style={{ marginBottom: 'var(--space-4)' }} onClick={handleRevert}>
          Back to {exercise?.name}
        </Button>
      )}

      <div className="panel rule-list">
        {(alternatives ?? []).map((alt) => (
          <button
            key={alt.id}
            className="day-row pressable"
            style={alt.id === defaultSwapId ? { boxShadow: 'inset 0 0 0 1px var(--pr)' } : undefined}
            onClick={() => handleSwap(alt)}
          >
            <span className="day-row-name">{alt.name}</span>
            {alt.si_risk === 'caution' && <span className="si-mark">SI</span>}
            {alt.sternal_risk === 'caution' && <span className="si-mark">SC</span>}
            <span className="mono faint" style={{ fontSize: 11 }}>{alt.equipment}</span>
          </button>
        ))}
        {alternatives?.length === 0 && (
          <p className="empty" style={{ padding: 'var(--space-5)' }}>
            No other exercise in the library targets {exercise?.primary_muscle?.replace(/_/g, ' ')}.
          </p>
        )}
      </div>

      <section style={{ marginTop: 'var(--space-5)' }}>
        <p className="label" style={{ marginBottom: 'var(--space-2)' }}>Need a different option?</p>
        <div className="area-grid" style={{ marginBottom: 'var(--space-3)' }}>
          {PAIN_AREAS.map((area) => (
            <button
              key={area.key}
              type="button"
              className={`area-chip ${painArea === area.key ? 'is-active' : ''}`}
              onClick={() => setPainArea(area.key)}
            >
              {area.label}
            </button>
          ))}
        </div>
        <Button variant="secondary" className="btn-block" disabled={aiLoading} onClick={askAi}>
          {aiLoading ? 'Finding options...' : 'Ask AI for joint-conscious swaps'}
        </Button>
        {aiError && <p className="field-hint" style={{ color: 'var(--danger)', marginTop: 'var(--space-2)' }}>{aiError}</p>}
        {aiSwaps?.length > 0 && (
          <div className="rule-list" style={{ marginTop: 'var(--space-3)' }}>
            {aiSwaps.map((swap) => (
              <div key={swap.name} className="day-row" style={{ alignItems: 'flex-start', gap: 'var(--space-3)' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p className="day-row-name">{swap.name}</p>
                  <p className="faint" style={{ fontSize: 12, lineHeight: 1.45, marginTop: 3 }}>{swap.why_safe}</p>
                  <p className="faint" style={{ fontSize: 12, lineHeight: 1.45, marginTop: 3 }}>Setup: {swap.setup_cue}</p>
                </div>
                <button
                  type="button"
                  className="btn btn-ghost pressable"
                  style={{ minHeight: 32, padding: '4px 8px' }}
                  onClick={() => onAddCustom({ name: swap.name, muscle: exercise?.primary_muscle })}
                >
                  Use
                </button>
              </div>
            ))}
          </div>
        )}
        {aiCaution && <p className="field-hint" style={{ marginTop: 'var(--space-3)' }}>{aiCaution}</p>}
      </section>

      <button
        type="button"
        className={`remember-toggle pressable ${remember ? 'is-on' : ''}`}
        onClick={() => setRemember((r) => !r)}
      >
        <span className="remember-check">{remember ? 'x' : ''}</span>
        Remember this swap for next time
      </button>

      <button type="button" className="link-action pressable" style={{ marginTop: 'var(--space-3)' }} onClick={() => onAddCustom()}>
        Don't see it? Add your own exercise
      </button>
    </Sheet>
  )
}