import { useState } from 'react'
import { useProfile } from '../../app/ProfileProvider'
import { TEMPLATES } from '../../db/seed'
import { feetInchesToCm, lbToKg, STEP, toDisplay, fromDisplay } from '../../lib/units'
import { suggestTargets } from '../../lib/targets'
import StepperRow from '../../components/StepperRow'
import Button from '../../components/Button'
import Logomark from '../../components/Logomark'

// Shown once, to an account with no profile. Everything it asks for used to
// be a constant in the source, which is why a second person couldn't use the
// app without inheriting someone else's calorie target and joint problem.
//
// Deliberately short: five questions, sensible defaults, and macros computed
// rather than asked for. Anything that can be changed later lives in Settings,
// not here.
const STEPS = ['you', 'body', 'goal', 'program']

export default function SetupScreen() {
  const { save } = useProfile()
  const [step, setStep] = useState(0)
  const [busy, setBusy] = useState(false)

  const [v, setV] = useState({
    display_name: '',
    unit_weight: 'kg',
    unit_height: 'cm',
    heightFt: 5, heightIn: 8, heightCm: 173,
    weightDisplay: 75,
    targetDisplay: 80,
    goal: 'recomp',
    has_si_joint: false,
    program_template: 'ppl_si_recomp',
  })

  const set = (patch) => setV((prev) => ({ ...prev, ...patch }))
  const imperial = v.unit_weight === 'lb'
  const step_ = STEP[v.unit_weight]

  const heightCm = imperial ? feetInchesToCm(v.heightFt, v.heightIn) : v.heightCm
  const weightKg = fromDisplay(v.weightDisplay, v.unit_weight)
  const targetKg = fromDisplay(v.targetDisplay, v.unit_weight)

  const finish = async () => {
    setBusy(true)
    const targets = suggestTargets({ weightKg, goal: v.goal })
    await save({
      display_name: v.display_name.trim() || null,
      unit_weight: v.unit_weight,
      unit_height: imperial ? 'ft' : 'cm',
      height_cm: Math.round(heightCm * 10) / 10,
      target_weight_kg: Math.round(targetKg * 100) / 100,
      goal: v.goal,
      has_si_joint: v.has_si_joint,
      program_template: v.program_template,
      ...targets,
    })
    // No navigation — the router swaps this screen out as soon as the profile
    // exists, and SyncProvider seeds the chosen programme off the back of it.
  }

  const preview = suggestTargets({ weightKg, goal: v.goal })

  return (
    <div className="container screen setup">
      <div className="setup-head">
        <Logomark size={28} />
        <p className="label" style={{ marginTop: 'var(--space-4)' }}>Step {step + 1} of {STEPS.length}</p>
        <div className="setup-progress"><div style={{ width: `${((step + 1) / STEPS.length) * 100}%` }} /></div>
      </div>

      {step === 0 && (
        <>
          <h1 className="readout setup-title">WHO'S<br />TRAINING?</h1>
          <label className="field" style={{ marginTop: 'var(--space-6)' }}>
            <span className="label">Name</span>
            <input value={v.display_name} onChange={(e) => set({ display_name: e.target.value })} placeholder="Optional" autoComplete="name" />
          </label>

          <p className="label section-label">Units</p>
          <div className="choice-row">
            {[['kg', 'Kilograms'], ['lb', 'Pounds']].map(([u, label]) => (
              <button
                key={u}
                className={`choice ${v.unit_weight === u ? 'is-active' : ''}`}
                onClick={() => set({
                  unit_weight: u,
                  // Re-express the numbers already entered so switching units
                  // doesn't silently reinterpret 75 kg as 75 lb.
                  weightDisplay: toDisplay(weightKg, u),
                  targetDisplay: toDisplay(targetKg, u),
                })}
              >
                <span className="choice-title">{label}</span>
                <span className="choice-sub">{u === 'kg' ? '20 kg bar, 2.5 kg jumps' : '45 lb bar, 5 lb jumps'}</span>
              </button>
            ))}
          </div>
        </>
      )}

      {step === 1 && (
        <>
          <h1 className="readout setup-title">YOUR<br />NUMBERS</h1>
          <div className="stack-5" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)', marginTop: 'var(--space-6)' }}>
            {imperial ? (
              <>
                <StepperRow label="Height — feet" value={v.heightFt} onChange={(heightFt) => set({ heightFt })} step={1} min={4} max={7} format={(n) => `${n} ft`} />
                <StepperRow label="Height — inches" value={v.heightIn} onChange={(heightIn) => set({ heightIn })} step={1} min={0} max={11} format={(n) => `${n} in`} />
              </>
            ) : (
              <StepperRow label="Height" value={v.heightCm} onChange={(heightCm) => set({ heightCm })} step={1} longPressStep={5} min={120} max={220} format={(n) => `${n} cm`} />
            )}
            <StepperRow
              label="Weight now" hint="today, roughly"
              value={v.weightDisplay} onChange={(weightDisplay) => set({ weightDisplay })}
              step={step_.bodyweightLarge} longPressStep={step_.bodyweightLarge * 4} min={30}
              format={(n) => `${n} ${v.unit_weight}`}
            />
            <StepperRow
              label="Target weight" hint="where you want to be"
              value={v.targetDisplay} onChange={(targetDisplay) => set({ targetDisplay })}
              step={step_.bodyweightLarge} longPressStep={step_.bodyweightLarge * 4} min={30}
              format={(n) => `${n} ${v.unit_weight}`}
            />
          </div>
        </>
      )}

      {step === 2 && (
        <>
          <h1 className="readout setup-title">WHAT<br />FOR?</h1>
          <div className="choice-col" style={{ marginTop: 'var(--space-6)' }}>
            {[
              ['gain', 'Gain weight', 'Build muscle in a surplus. Slow and steady beats fast and fat.'],
              ['recomp', 'Recomposition', 'Lose fat and build muscle at once. Slight deficit.'],
              ['lose', 'Lose fat', 'Deficit, with enough training to keep the muscle you have.'],
            ].map(([key, title, sub]) => (
              <button key={key} className={`choice ${v.goal === key ? 'is-active' : ''}`} onClick={() => set({ goal: key })}>
                <span className="choice-title">{title}</span>
                <span className="choice-sub">{sub}</span>
              </button>
            ))}
          </div>

          <p className="label section-label">Anything to work around?</p>
          <button className={`choice ${v.has_si_joint ? 'is-active' : ''}`} onClick={() => set({ has_si_joint: !v.has_si_joint })}>
            <span className="choice-title">Sacroiliac / lower back</span>
            <span className="choice-sub">
              Flags the lifts that load the pelvis, adds the daily stability routine, and lets you
              track pain per exercise.
            </span>
          </button>

          {weightKg > 0 && (
            <div className="panel setup-preview">
              <p className="label">Daily target</p>
              <p className="setup-preview-main">{preview.calories} kcal</p>
              <p className="setup-preview-sub">{preview.protein_g}g protein · {preview.carbs_g}g carbs · {preview.fat_g}g fat</p>
              <p className="setup-preview-note">Adjustable later in Setup.</p>
            </div>
          )}
        </>
      )}

      {step === 3 && (
        <>
          <h1 className="readout setup-title">PICK A<br />PROGRAM</h1>
          <div className="choice-col" style={{ marginTop: 'var(--space-6)' }}>
            {Object.entries(TEMPLATES).map(([key, t]) => (
              <button key={key} className={`choice ${v.program_template === key ? 'is-active' : ''}`} onClick={() => set({ program_template: key })}>
                <span className="choice-title">{t.label}</span>
                <span className="choice-sub">{t.blurb}</span>
                <span className="choice-meta">{t.days.length} sessions · {t.programExercises.length} programmed exercises</span>
              </button>
            ))}
          </div>
        </>
      )}

      <div className="setup-actions">
        {step > 0 && <Button variant="secondary" onClick={() => setStep(step - 1)}>Back</Button>}
        {step < STEPS.length - 1 ? (
          <Button className="btn-block" onClick={() => setStep(step + 1)}>Continue</Button>
        ) : (
          <Button className="btn-block" onClick={finish} disabled={busy}>
            {busy ? 'Setting up…' : 'Start training'}
          </Button>
        )}
      </div>
    </div>
  )
}
