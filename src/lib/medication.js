// Adalimumab (Humira) injection schedule. Dosing is a per-person rhythm
// (40 mg every 14–15 days), so the only inputs are the last-dose date and
// the interval — both stored on the synced profile, same as creatine.
import { addDays, differenceInCalendarDays, parseISO } from 'date-fns'
import { todayLocalDate } from './format'

export const ADALIMUMAB_DEFAULT_INTERVAL = 15

// Returns null until a dose has been logged. Otherwise { due, days, overdue }
// where `days` counts forward to the next dose (0 = today, negative = overdue).
export const adalimumabCountdown = (
  lastInjection,
  intervalDays = ADALIMUMAB_DEFAULT_INTERVAL,
  ref = todayLocalDate(),
) => {
  if (!lastInjection) return null
  const due = addDays(parseISO(lastInjection), intervalDays)
  const days = differenceInCalendarDays(due, parseISO(ref))
  return { due, days, overdue: days < 0 }
}