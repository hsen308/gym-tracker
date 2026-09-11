// The fortnightly dose date is a health obligation with a deadline, so it
// lives on Today right next to the daily routine — not buried in Settings
// with the sync controls. Only renders once a dose has been logged.
import { format, parseISO } from 'date-fns'
import { useProfile } from '../../app/ProfileProvider'
import { todayLocalDate } from '../../lib/format'
import { adalimumabCountdown } from '../../lib/medication'

export default function AdalimumabCard() {
  const { profile, save } = useProfile()
  const c = adalimumabCountdown(profile.adalimumab_last_injection, profile.adalimumab_interval_days)
  if (!c) return null

  const last = format(parseISO(profile.adalimumab_last_injection), 'd MMM')
  const state = c.days === 0
    ? 'Due today'
    : c.days < 0
      ? `${-c.days} day${-c.days === 1 ? '' : 's'} overdue`
      : `in ${c.days} day${c.days === 1 ? '' : 's'}`
  const due = c.overdue || c.days === 0

  return (
    <section className={`panel med-card ${due ? 'is-due' : ''}`}>
      <div className="med-top">
        <div>
          <p className="label label-strong">Adalimumab · 40 mg</p>
          <p className="readout med-count">{state}</p>
          <p className="muted" style={{ fontSize: 12, lineHeight: 1.4 }}>
            Last dose {last} · every {profile.adalimumab_interval_days} days
          </p>
        </div>
        <button className="btn btn-ghost pressable" style={{ alignSelf: 'center' }} onClick={() => save({ adalimumab_last_injection: todayLocalDate() })}>
          Just took it
        </button>
      </div>
    </section>
  )
}