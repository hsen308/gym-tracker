// Presentation-only helpers — keep formatting logic out of components.

export const formatWeight = (kg) => (kg == null ? '—' : `${kg % 1 === 0 ? kg : kg.toFixed(1)}kg`)

// mm:ss — used by the rest timer and elapsed session time.
export const formatDuration = (totalSeconds) => {
  const s = Math.max(0, Math.round(totalSeconds))
  const m = Math.floor(s / 60)
  const rem = s % 60
  return `${m}:${String(rem).padStart(2, '0')}`
}

// Local-date string (YYYY-MM-DD), not a UTC timestamp — build-plan §9:
// an 11pm session must belong to that calendar day regardless of timezone.
export const todayLocalDate = () => {
  const d = new Date()
  const tzOffsetMs = d.getTimezoneOffset() * 60000
  return new Date(d - tzOffsetMs).toISOString().slice(0, 10)
}
