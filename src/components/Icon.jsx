// Hand-drawn icon set on a 24px grid, 1.5px stroke, square caps.
// Deliberately geometric and slightly technical — drafting marks rather than
// friendly rounded pictograms, matching the instrument-panel direction.
// Replaces the unicode glyphs (●≡◐△◇⋯) that were standing in before: those
// render differently on every platform and never line up on a baseline.

const PATHS = {
  // A loaded barbell, viewed end-on — the app's home mark.
  today: <><path d="M3 12h18" /><path d="M6 8v8M9 6v12M15 6v12M18 8v8" /></>,
  // Stacked rules = a log of past sessions.
  history: <><path d="M4 7h16M4 12h16M4 17h10" /></>,
  // Body outline reduced to a torso + measuring line.
  body: <><path d="M12 4v16" /><path d="M6 9h12" /><path d="M8 4h8" /><path d="M8 20h8" /></>,
  // A rising trace on axes.
  insights: <><path d="M4 20V4" /><path d="M4 20h16" /><path d="M7 16l4-5 3 3 5-7" /></>,
  // A plate + utensil, abstracted to a square and a rule.
  meals: <><rect x="4" y="6" width="10" height="12" /><path d="M18 6v12M18 6c1.2 0 2 1 2 2.4S19.2 11 18 11" /></>,
  // Panel switches.
  settings: <><path d="M4 8h10M18 8h2M4 16h4M12 16h8" /><circle cx="16" cy="8" r="2" /><circle cx="10" cy="16" r="2" /></>,

  back: <path d="M15 5l-7 7 7 7" />,
  chevron: <path d="M9 5l7 7-7 7" />,
  close: <path d="M6 6l12 12M18 6L6 18" />,
  check: <path d="M4 12.5l5.5 5.5L20 7" />,
  plus: <path d="M12 5v14M5 12h14" />,
  minus: <path d="M5 12h14" />,
  // Hollow ring — the SI-caution marker. Hollow, not filled, because in a
  // monochrome system "outlined vs solid" is the only contrast available.
  caution: <><circle cx="12" cy="12" r="8" /><path d="M12 8v5M12 16v.5" /></>,
  timer: <><circle cx="12" cy="13" r="8" /><path d="M12 13V9M9 3h6" /></>,
  download: <><path d="M12 4v11M7.5 10.5L12 15l4.5-4.5" /><path d="M4 20h16" /></>,
  upload: <><path d="M12 15V4M7.5 8.5L12 4l4.5 4.5" /><path d="M4 20h16" /></>,
  swap: <><path d="M4 8h13l-3.5-3.5M20 16H7l3.5 3.5" /></>,
  info: <><circle cx="12" cy="12" r="8" /><path d="M12 11v5M12 8.5v.5" /></>,
  share: <><path d="M12 15V4M8 7.5L12 3.5l4 4" /><path d="M5 13v6a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-6" /></>,
}

export default function Icon({ name, size = 20, strokeWidth = 1.5, className = '', ...rest }) {
  const d = PATHS[name]
  if (!d) return null
  return (
    <svg
      width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={strokeWidth}
      strokeLinecap="square" strokeLinejoin="miter"
      className={className} aria-hidden focusable="false" {...rest}
    >
      {d}
    </svg>
  )
}
