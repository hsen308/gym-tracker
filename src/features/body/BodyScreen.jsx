// Phase 4 (build-plan §7): bodyweight entry, 7-day moving average, body
// measurements, and a 21-day trend readout via linear regression.
import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, newId, upsertRow } from '../../db/dexie'
import { useAuth } from '../../app/AuthProvider'
import { movingAverage, weightTrend } from '../../lib/calc'
import { todayLocalDate } from '../../lib/format'
import StepperRow from '../../components/StepperRow'
import Button from '../../components/Button'
import Field from '../../components/Field'
import Toast from '../../components/Toast'
import DailyHabits from '../daily/DailyHabits'
import { useProfile } from '../../app/ProfileProvider'
import { toDisplay, fromDisplay, STEP, unitLabel } from '../../lib/units'

const WeightChart = lazy(() => import('./WeightChart'))
const BLANK_MEASURE = { waist_cm: '', chest_cm: '', arm_cm: '', thigh_cm: '' }

export default function BodyScreen() {
  const { user } = useAuth()
  const { profile } = useProfile()
  const unit = profile.unit_weight
  const bwStep = STEP[unit]
  const today = todayLocalDate()

  const logs = useLiveQuery(() => db.bodyweight_logs.filter((l) => !l.deleted_at).sortBy('date'), [])
  const measurements = useLiveQuery(() => db.measurements.filter((m) => !m.deleted_at).sortBy('date'), [])
  const todayLog = logs?.find((l) => l.date === today)
  const todayMeasure = measurements?.find((m) => m.date === today)

  // `null` means "not seeded yet" so that stepping the value down to 0 stays
  // 0 — an earlier version used `draft || fallback`, which made zero fall
  // back to the previous weight and appear to be a stuck stepper.
  const [weight, setWeight] = useState(null)
  const [measure, setMeasure] = useState(BLANK_MEASURE)
  const [toast, setToast] = useState('')

  // Seeds from today's entry, else the most recent one, else a sane default —
  // never 0, which would mean twenty taps to get back to a real bodyweight.
  useEffect(() => {
    if (weight !== null || !logs) return
    // Last entry, else the target they set at setup, else a neutral 70 kg —
    // never 0, which would mean twenty taps back to a real bodyweight.
    setWeight(todayLog?.weight_kg ?? logs[logs.length - 1]?.weight_kg ?? profile.target_weight_kg ?? 70)
  }, [logs, todayLog, weight])

  useEffect(() => {
    if (todayMeasure) {
      setMeasure({
        waist_cm: todayMeasure.waist_cm ?? '', chest_cm: todayMeasure.chest_cm ?? '',
        arm_cm: todayMeasure.arm_cm ?? '', thigh_cm: todayMeasure.thigh_cm ?? '',
      })
    }
  }, [todayMeasure?.id])

  const chartData = useMemo(
    () => (logs ? movingAverage(logs.map((l) => ({ date: l.date, value: l.weight_kg })), 7) : []),
    [logs],
  )
  const trend = useMemo(() => (logs ? weightTrend(logs) : null), [logs])

  if (!logs || !measurements || weight === null) return null

  const latestAvg = chartData.length ? chartData[chartData.length - 1].avg : null

  const logWeight = async () => {
    await upsertRow('bodyweight_logs', {
      id: todayLog?.id ?? newId(),
      user_id: user.id,
      date: today,
      weight_kg: weight,
      updated_at: new Date().toISOString(),
      deleted_at: null,
    })
    setToast(todayLog ? 'Weight updated.' : 'Weight logged.')
  }

  const num = (v) => (v === '' || v == null ? null : Number(v))
  const saveMeasurements = async () => {
    await upsertRow('measurements', {
      id: todayMeasure?.id ?? newId(),
      user_id: user.id,
      date: today,
      waist_cm: num(measure.waist_cm), chest_cm: num(measure.chest_cm),
      arm_cm: num(measure.arm_cm), thigh_cm: num(measure.thigh_cm),
      notes: null,
      updated_at: new Date().toISOString(),
      deleted_at: null,
    })
    setToast('Measurements saved.')
  }

  return (
    <div className="container screen">
      <header className="screen-head">
        <div>
          <p className="label">{logs.length} weigh-in{logs.length === 1 ? '' : 's'}</p>
          <h1 className="readout screen-title">BODY</h1>
        </div>
      </header>

      {/* The headline is the 7-day average, never today's raw number — that's
          the whole point of Phase 4. Today's reading sits underneath it. */}
      <div className="panel" style={{ padding: 'var(--space-5)', marginBottom: 'var(--space-4)' }}>
        <p className="label">7-day average</p>
        <p className="readout readout-lg" style={{ marginTop: 8 }}>
          {latestAvg != null ? toDisplay(latestAvg, unit) : '—'}<span className="faint" style={{ fontSize: 20 }}> {unitLabel(unit)}</span>
        </p>
        {trend != null && (
          <p className="mono faint" style={{ fontSize: 12, marginTop: 8 }}>
            {trend >= 0 ? '+' : ''}{toDisplay(trend, unit)} {unitLabel(unit)}/week over 21 days
          </p>
        )}
      </div>

      <div className="panel" style={{ padding: 'var(--space-5)', marginBottom: 'var(--space-4)' }}>
        <p className="label" style={{ marginBottom: 'var(--space-4)' }}>Today's weigh-in</p>
        <StepperRow
          label="Bodyweight" hint="first thing in the morning"
          value={toDisplay(weight, unit) ?? 0}
          onChange={(shown) => setWeight(fromDisplay(shown, unit))}
          step={bwStep.bodyweight} longPressStep={bwStep.bodyweightLarge} min={0}
          format={(v) => `${v} ${unitLabel(unit)}`}
        />
        <Button className="btn-block" style={{ marginTop: 'var(--space-4)' }} onClick={logWeight}>
          {todayLog ? 'Update weight' : 'Log weight'}
        </Button>
      </div>

      {chartData.length >= 2 && (
        <div className="panel chart-panel">
          <Suspense fallback={<div style={{ height: 200 }} />}>
            <WeightChart points={chartData} />
          </Suspense>
        </div>
      )}

      <h2 className="label section-label">Today</h2>
      <DailyHabits />

      <h2 className="label section-label">Measurements</h2>
      <div className="panel" style={{ padding: 'var(--space-5)' }}>
        <div className="stack-4" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          <Field label="Waist · cm — measure at the navel" type="number" inputMode="decimal" value={measure.waist_cm} onChange={(e) => setMeasure({ ...measure, waist_cm: e.target.value })} />
          <Field label="Chest · cm" type="number" inputMode="decimal" value={measure.chest_cm} onChange={(e) => setMeasure({ ...measure, chest_cm: e.target.value })} />
          <Field label="Arm · cm" type="number" inputMode="decimal" value={measure.arm_cm} onChange={(e) => setMeasure({ ...measure, arm_cm: e.target.value })} />
          <Field label="Thigh · cm" type="number" inputMode="decimal" value={measure.thigh_cm} onChange={(e) => setMeasure({ ...measure, thigh_cm: e.target.value })} />
        </div>
        <Button variant="secondary" className="btn-block" style={{ marginTop: 'var(--space-5)' }} onClick={saveMeasurements}>
          Save measurements
        </Button>
      </div>

      <Toast message={toast} onDismiss={() => setToast('')} />
    </div>
  )
}
