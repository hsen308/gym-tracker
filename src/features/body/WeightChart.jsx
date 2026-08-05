// Lazy-loaded for the same reason as history's chart — recharts stays out
// of every screen that isn't this one. Raw points render faint behind the
// bold moving-average line (build-plan §7 Phase 4: "Never present raw
// daily weight as the headline number" — day-to-day swings are mostly
// water/food, not fat loss/gain).
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { format, parseISO } from 'date-fns'

export default function WeightChart({ points }) {
  const data = points.map((p) => ({ ...p, dateLabel: format(parseISO(p.date), 'MMM d') }))

  return (
    <ResponsiveContainer width="100%" height={200}>
      <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: -12 }}>
        <XAxis dataKey="dateLabel" stroke="var(--text-faint)" fontSize={11} tickLine={false} axisLine={false} />
        <YAxis stroke="var(--text-faint)" fontSize={11} tickLine={false} axisLine={false} width={40} domain={['dataMin - 1', 'dataMax + 1']} />
        <Tooltip
          contentStyle={{ background: 'var(--surface-alt)', border: '1px solid var(--line)', borderRadius: 8, fontSize: 13 }}
          labelStyle={{ color: 'var(--text)' }}
        />
        <Line type="monotone" dataKey="value" stroke="var(--text-faint)" strokeWidth={1} dot={false} name="Weight" />
        <Line type="monotone" dataKey="avg" stroke="var(--signal)" strokeWidth={2} dot={false} name="7-day avg" />
      </LineChart>
    </ResponsiveContainer>
  )
}
