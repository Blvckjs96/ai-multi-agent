import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts'

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-argo-elevated border border-argo-border rounded-lg px-3 py-2 shadow-lg">
      <p className="text-[10px] text-argo-muted mb-1">{label}</p>
      <p className="text-xs font-semibold text-argo-cyan">{payload[0].value} conversations</p>
    </div>
  )
}

export default function UsageChart({ data }) {
  if (!data?.length) {
    return (
      <div className="flex items-center justify-center h-40 text-argo-muted text-xs">
        No data for this period
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={180}>
      <LineChart data={data} margin={{ top: 4, right: 8, left: -24, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
        <XAxis
          dataKey="date"
          tick={{ fontSize: 10, fill: 'var(--text-muted)' }}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v) => {
            const d = new Date(v)
            return `${d.getMonth() + 1}/${d.getDate()}`
          }}
        />
        <YAxis
          tick={{ fontSize: 10, fill: 'var(--text-muted)' }}
          tickLine={false}
          axisLine={false}
          allowDecimals={false}
        />
        <Tooltip content={<CustomTooltip />} cursor={{ stroke: 'var(--border)', strokeWidth: 1 }} />
        <Line
          type="monotone"
          dataKey="conversations"
          stroke="var(--accent-cyan)"
          strokeWidth={2}
          dot={{ r: 3, fill: 'var(--accent-cyan)', strokeWidth: 0 }}
          activeDot={{ r: 5, fill: 'var(--accent-cyan)' }}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}
