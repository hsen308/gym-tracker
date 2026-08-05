// The program's traffic-light rule, captured per exercise while you're on it:
//   GREEN   no pain, or stiffness that warms up  -> train normally
//   YELLOW  noticeable ache during a set         -> cut range, drop 20%, finish
//   RED     sharp pain, or pain into the next day -> skip it this week
//
// Deliberately three taps, not a 0–10 scale: mid-set you will not
// meaningfully distinguish a 4 from a 5, and a control you skip records
// nothing at all. Monochrome, so the levels read as fill (empty / half /
// full) plus a word, never as colour.
const LEVELS = [
  { key: 'green', label: 'Fine', hint: 'No pain, or stiffness that warms up. Train normally.' },
  { key: 'yellow', label: 'Ache', hint: 'Noticeable during a set. Cut the range, drop the weight 20%, finish.' },
  { key: 'red', label: 'Sharp', hint: 'Sharp, or lingering into tomorrow. Skip this exercise this week.' },
]

export default function PainControl({ value, onChange }) {
  const active = LEVELS.find((l) => l.key === value)
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
              onClick={() => onChange(value === l.key ? null : l.key)}
            >
              <span className="pain-dot" />
              {l.label}
            </button>
          ))}
        </div>
      </div>
      {active && <p className="pain-hint">{active.hint}</p>}
    </div>
  )
}
