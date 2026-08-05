// A small mark, not a full logo — the app's whole visual identity is "scale
// readout" (build-plan §6a), so this echoes a loaded barbell rather than
// being a generic rounded-square app icon. Used on the login screen and,
// later, wherever the app needs to identify itself in one glance.
export default function Logomark({ size = 40 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none" aria-hidden>
      <rect width="40" height="40" rx="12" fill="var(--surface-alt)" />
      <rect x="6" y="18" width="28" height="4" rx="2" fill="var(--text-muted)" />
      <rect x="8" y="13" width="5" height="14" rx="1.5" fill="var(--signal)" />
      <rect x="27" y="13" width="5" height="14" rx="1.5" fill="var(--signal)" />
    </svg>
  )
}
