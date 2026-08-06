// Conversions between ISO timestamps (what we store) and the value format
// <input type="datetime-local"> expects, which is local wall-clock time with
// no timezone — "2026-08-06T18:30".
//
// Doing this by hand rather than with toISOString(): that converts to UTC,
// so a 9pm session in Beirut comes back as 6pm and the picker shows the
// wrong time. Everything here stays in local time deliberately.

const pad = (n) => String(n).padStart(2, '0')

export const toLocalInputValue = (date) => {
  const d = date instanceof Date ? date : new Date(date)
  if (Number.isNaN(d.getTime())) return ''
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export const fromLocalInputValue = (value) => {
  if (!value) return null
  // `new Date('2026-08-06T18:30')` is parsed as LOCAL time by every current
  // browser, which is what we want. Guard anyway.
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? null : d
}

// build-plan §9: workout `date` is a local-date string, never a UTC
// timestamp — an 11pm session belongs to that calendar day.
export const localDateOf = (date) => {
  const d = date instanceof Date ? date : new Date(date)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}
