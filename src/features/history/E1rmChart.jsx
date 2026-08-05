// Split into its own file so recharts — much the heaviest dependency here —
// only loads for people who open a lift's history (build-plan §1: "recharts
// — Phase 3+ only, lazy loaded"). ExerciseHistory imports this via
// React.lazy, not a plain import.
//
// Monochrome charting: PRs are marked with a larger filled dot plus a ring,
// not a colour change, since there is no second hue in this design.
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { format, parseISO } from 'date-fns'

const AXIS = { stroke: 'var(--text-faint)', fontSize: 10, tickLine: false, axisLine: false }

const Dot = ({ cx, cy, payload }) =>
  payload?.isPR
    ? <g><circle cx={cx} cy={cy} r={5} fill="var(--signal)" /><circle cx={cx} cy={cy} r={8} fill="none" stroke="var(--signal)" strokeWidth={1} /></g>
    : <circle cx={cx} cy={cy} r={2.5} fill="var(--text-faint)" />

export default function E1rmChart({ points }) {
  const data = points.map((p) => ({ ...p, dateLabel: format(parseISO(p.date), 'd MMM') }))

  return (
    <ResponsiveContainer width="100%" height={210}>
      <LineChart data={data} margin={{ top: 12, right: 14, bottom: 0, left: -14 }}>
        <XAxis dataKey="dateLabel" {...AXIS} />
        <YAxis {...AXIS} width={38} domain={['dataMin - 2', 'dataMax + 2']} />
        <Tooltip
          cursor={{ stroke: 'var(--line-strong)' }}
          contentStyle={{ background: 'var(--surface-alt)', border: '1px solid var(--line-strong)', borderRadius: 6, fontSize: 12 }}
          labelStyle={{ color: 'var(--text-muted)' }}
          formatter={(value) => [`${value.toFixed(1)} kg`, 'e1RM']}
        />
        <Line type="monotone" dataKey="e1rm" stroke="var(--signal)" strokeWidth={1.5} dot={<Dot />} activeDot={{ r: 5, fill: 'var(--signal)' }} isAnimationActive={false} />
      </LineChart>
    </ResponsiveContainer>
  )
}
