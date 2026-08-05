// Phase 4 (build-plan §7): bodyweight entry, 7-day moving average, body
// measurements, and a 21-day trend readout via linear regression.
import { lazy, Suspense, useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, newId, upsertRow } from '../../db/dexie'
import { useAuth } from '../../app/AuthProvider'
import { movingAverage, weightTrend } from '../../lib/calc'
import { todayLocalDate, formatWeight } from '../../lib/format'
import Stepper from '../../components/Stepper'
import Button from '../../components/Button'
import Field from '../../components/Field'

const WeightChart = lazy(() => import('./WeightChart'))

export default function BodyScreen() {
  const { user } = useAuth()
  const today = todayLocalDate()

  const logs = useLiveQuery(() => db.bodyweight_logs.filter((l) => !l.deleted_at).sortBy('date'), [])
  const measurements = useLiveQuery(() => db.measurements.filter((m) => !m.deleted_at).sortBy('date'), [])
  const todayLog = logs?.find((l) => l.date === today)

  const [draftWeight, setDraftWeight] = useState(0)
  const [measureDraft, setMeasureDraft] = useState({ waist_cm: '', chest_cm: '', arm_cm: '', thigh_cm: '' })
  const [savedMeasure, setSavedMeasure] = useState(false)

  // Seed the stepper from today's log if it exists, otherwise the most
  // recent prior entry — never start from 0, that's a guaranteed extra
  // twenty taps for someone whose weight sits around 80kg.
  const weight = draftWeight || todayLog?.weight_kg || logs?.[logs.length - 1]?.weight_kg || 70

  const chartData = useMemo(() => {
    if (!logs) return []
    const series = logs.map((l) => ({ date: l.date, value: l.weight_kg }))
    return movingAverage(series, 7)
  }, [logs])

  const trend = useMemo(() => (logs ? weightTrend(logs) : null), [logs])

  const logWeight = async () => {
    await upsertRow('bodyweight_logs', {
      id: todayLog?.id ?? newId(),
      user_id: user.id,
      date: today,
      weight_kg: weight,
      updated_at: new Date().toISOString(),
      deleted_at: null,
    })
  }

  const saveMeasurements = async () => {
    const existing = measurements?.find((m) => m.date === today)
    await upsertRow('measurements', {
      id: existing?.id ?? newId(),
      user_id: user.id,
      date: today,
      waist_cm: measureDraft.waist_cm ? Number(measureDraft.waist_cm) : null,
      chest_cm: measureDraft.chest_cm ? Number(measureDraft.chest_cm) : null,
      arm_cm: measureDraft.arm_cm ? Number(measureDraft.arm_cm) : null,
      thigh_cm: measureDraft.thigh_cm ? Number(measureDraft.thigh_cm) : null,
      notes: null,
      updated_at: new Date().toISOString(),
      deleted_at: null,
    })
    setSavedMeasure(true)
    setTimeout(() => setSavedMeasure(false), 2000)
  }

  if (!logs || !measurements) return null

  return (
    <div className="container body-screen">
      <header className="today-header"><span className="stepper-label">Body</span></header>

      <div className="card" style={{ padding: 'var(--space-5)', marginBottom: 'var(--space-4)' }}>
        <h2 className="section-label">Today's weight</h2>
        <Stepper value={weight} onChange={setDraftWeight} step={0.1} longPressStep={0.5} format={formatWeight} />
        <Button className="btn-block" style={{ marginTop: 'var(--space-4)' }} onClick={logWeight}>
          {todayLog ? 'Update' : 'Log'} weight
        </Button>
        {trend != null && (
          <p className="muted" style={{ marginTop: 'var(--space-3)', fontSize: 13 }}>
            {trend >= 0 ? '+' : ''}{trend.toFixed(2)} kg/week over the last 21 days
          </p>
        )}
      </div>

      {chartData.length >= 2 && (
        <div className="card" style={{ padding: 'var(--space-4)', marginBottom: 'var(--space-4)' }}>
          <Suspense fallback={<div style={{ height: 200 }} />}>
            <WeightChart points={chartData} />
          </Suspense>
        </div>
      )}

      <div className="card" style={{ padding: 'var(--space-5)' }}>
        <h2 className="section-label">Measurements</h2>
        <div className="stack-3">
          <Field label="Waist (cm)" type="number" inputMode="decimal" value={measureDraft.waist_cm} onChange={(e) => setMeasureDraft({ ...measureDraft, waist_cm: e.target.value })} />
          <Field label="Chest (cm)" type="number" inputMode="decimal" value={measureDraft.chest_cm} onChange={(e) => setMeasureDraft({ ...measureDraft, chest_cm: e.target.value })} />
          <Field label="Arm (cm)" type="number" inputMode="decimal" value={measureDraft.arm_cm} onChange={(e) => setMeasureDraft({ ...measureDraft, arm_cm: e.target.value })} />
          <Field label="Thigh (cm)" type="number" inputMode="decimal" value={measureDraft.thigh_cm} onChange={(e) => setMeasureDraft({ ...measureDraft, thigh_cm: e.target.value })} />
        </div>
        <Button variant="secondary" className="btn-block" style={{ marginTop: 'var(--space-4)' }} onClick={saveMeasurements}>
          {savedMeasure ? 'Saved ✓' : 'Save measurements'}
        </Button>
      </div>
    </div>
  )
}
