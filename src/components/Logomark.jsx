// A barbell loaded on one side, drawn as a technical elevation rather than a
// friendly app icon — plates as stacked rules, the bar as a single hairline.
export default function Logomark({ size = 40 }) {
  return (
    <svg width={size * 1.6} height={size} viewBox="0 0 64 40" fill="none" aria-hidden>
      <path d="M2 20h60" stroke="var(--text-faint)" strokeWidth="1.5" />
      <rect x="8" y="8" width="4" height="24" fill="var(--text)" />
      <rect x="15" y="4" width="6" height="32" fill="var(--text)" />
      <rect x="43" y="4" width="6" height="32" fill="var(--text)" />
      <rect x="52" y="8" width="4" height="24" fill="var(--text)" />
    </svg>
  )
}
