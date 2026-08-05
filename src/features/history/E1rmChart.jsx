// Split into its own file so recharts — the heaviest dependency in the app
// — only ever loads for people who open a lift's history (build-plan §1:
// "recharts — charts (Phase 3+ only, lazy loaded)"). ExerciseHistory
// imports this via React.lazy, not a plain import.
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceDot } from 'recharts'
import { format, parseISO } from 'date-fns'

export default function E1rmChart({ points }) {
  const data = points.map((p) => ({ ...p, dateLabel: format(parseISO(p.date), 'MMM d') }))
  const prPoints = data.filter((p) => p.isPR)

  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: -12 }}>
        <XAxis dataKey="dateLabel" stroke="var(--text-faint)" fontSize={11} tickLine={false} axisLine={false} />
        <YAxis stroke="var(--text-faint)" fontSize={11} tickLine={false} axisLine={false} width={40} />
        <Tooltip
          contentStyle={{ background: 'var(--surface-alt)', border: '1px solid var(--line)', borderRadius: 8, fontSize: 13 }}
          labelStyle={{ color: 'var(--text)' }}
          formatter={(value) => [`${value.toFixed(1)}kg`, 'e1RM']}
        />
        <Line type="monotone" dataKey="e1rm" stroke="var(--signal)" strokeWidth={2} dot={{ r: 3, fill: 'var(--signal)' }} activeDot={{ r: 5 }} />
        {prPoints.map((p) => (
          <ReferenceDot key={p.date} x={p.dateLabel} y={p.e1rm} r={5} fill="var(--pr)" stroke="none" />
        ))}
      </LineChart>
    </ResponsiveContainer>
  )
}
