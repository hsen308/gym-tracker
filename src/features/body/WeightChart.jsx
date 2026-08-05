// Lazy-loaded for the same reason as the e1RM chart. Raw daily points render
// faint behind the bold moving average (build-plan §7 Phase 4: "Never present
// raw daily weight as the headline number") — day-to-day swings are mostly
// water and food, not fat.
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { format, parseISO } from 'date-fns'

const AXIS = { stroke: 'var(--text-faint)', fontSize: 10, tickLine: false, axisLine: false }

export default function WeightChart({ points }) {
  const data = points.map((p) => ({ ...p, dateLabel: format(parseISO(p.date), 'd MMM') }))

  return (
    <ResponsiveContainer width="100%" height={200}>
      <LineChart data={data} margin={{ top: 12, right: 14, bottom: 0, left: -14 }}>
        <XAxis dataKey="dateLabel" {...AXIS} />
        <YAxis {...AXIS} width={38} domain={['dataMin - 1', 'dataMax + 1']} />
        <Tooltip
          cursor={{ stroke: 'var(--line-strong)' }}
          contentStyle={{ background: 'var(--surface-alt)', border: '1px solid var(--line-strong)', borderRadius: 6, fontSize: 12 }}
          labelStyle={{ color: 'var(--text-muted)' }}
          formatter={(value, name) => [`${Number(value).toFixed(1)} kg`, name]}
        />
        <Line type="linear" dataKey="value" name="Daily" stroke="var(--text-faint)" strokeWidth={1} dot={false} isAnimationActive={false} />
        <Line type="monotone" dataKey="avg" name="7-day avg" stroke="var(--signal)" strokeWidth={2} dot={false} isAnimationActive={false} />
      </LineChart>
    </ResponsiveContainer>
  )
}
