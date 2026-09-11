// The program's traffic-light rule, captured per exercise while you're on it:
//   GREEN   no pain, or stiffness that warms up  -> train normally
//   YELLOW  noticeable ache during a set         -> cut range, drop 20%, finish
//   RED     sharp pain, or pain into the next day -> skip it this week
//
// Deliberately three taps, not a 0–10 scale: mid-set you will not
// meaningfully distinguish a 4 from a 5, and a control you skip records
// nothing at all. Monochrome, so the levels read as fill (empty / half /
// full) plus a word, never as colour.
//
// When pain is reported (yellow or red), location chips appear so the
// correlation report can show WHERE it flared, not just that it did.
const LEVELS = [
  { key: 'green', label: 'Fine', hint: 'No pain, or stiffness that warms up. Train normally.' },
  { key: 'yellow', label: 'Ache', hint: 'Noticeable during a set. Cut the range, drop the weight 20%, finish.' },
  { key: 'red', label: 'Sharp', hint: 'Sharp, or lingering into tomorrow. Skip this exercise this week.' },
]

const PAIN_LOCATIONS = [
  { key: 'left_si', label: 'Left SI' },
  { key: 'right_si', label: 'Right SI' },
  { key: 'bilateral_si', label: 'Bilateral SI' },
  { key: 'lower_back', label: 'Lower back' },
  { key: 'left_hip', label: 'Left hip' },
  { key: 'right_hip', label: 'Right hip' },
  { key: 'groin', label: 'Groin' },
  { key: 'hamstring', label: 'Hamstring' },
]

export { PAIN_LOCATIONS }

export default function PainControl({ value, onChange, painLocations = [], onLocationsChange }) {
  const active = LEVELS.find((l) => l.key === value)
  const showLocations = value === 'yellow' || value === 'red'

  const toggleLocation = (key) => {
    if (!onLocationsChange) return
    const next = painLocations.includes(key)
      ? painLocations.filter((k) => k !== key)
      : [...painLocations, key]
    onLocationsChange(next)
  }

  return (
    <div className="pain-control">
      <div className="pain-row">
        <span className="label">SI joint</span>
        <div className="pain-buttons">
          {LEVELS.map((l) => (
            <button
              key={l.key}
              type="button"
              className={`pain-btn pressable is-${l.key} ${value === l.key ? 'is-active' : ''}`}
              aria-pressed={value === l.key}
              // Tapping the active level again clears it — otherwise a mis-tap
              // is permanent, and a wrong pain reading poisons the correlation.
              onClick={() => {
                if (value === l.key) { onChange(null); onLocationsChange?.([]) }
                else { onChange(l.key) }
              }}
            >
              <span className="pain-dot" />
              {l.label}
            </button>
          ))}
        </div>
      </div>
      {active && <p className="pain-hint">{active.hint}</p>}

      {showLocations && (
        <div className="pain-locations" style={{ marginTop: 'var(--space-3)' }}>
          <p className="label" style={{ marginBottom: 'var(--space-2)', fontSize: 12 }}>Where exactly?</p>
          <div className="area-grid">
            {PAIN_LOCATIONS.map((loc) => (
              <button
                key={loc.key}
                className={`area-chip ${painLocations.includes(loc.key) ? 'is-active' : ''}`}
                onClick={() => toggleLocation(loc.key)}
              >
                {loc.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}