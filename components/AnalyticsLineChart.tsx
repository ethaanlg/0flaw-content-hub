'use client'

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
} from 'recharts'

type ChartPoint = { name: string; Impressions: number; Reach: number }

function CustomTooltip({ active, payload, label }: {
  active?: boolean
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload?: any[]
  label?: string
}) {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: '#1a1f36', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: '10px 14px' }}>
      <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', marginBottom: 6 }}>{label}</p>
      {payload.map((p) => (
        <p key={p.dataKey} style={{ fontSize: 13, color: p.color, fontWeight: 700 }}>
          {p.name}: {p.value}
        </p>
      ))}
    </div>
  )
}

export default function AnalyticsLineChart({ data }: { data: ChartPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
        <XAxis dataKey="name" tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 10 }} tickLine={false} axisLine={false} />
        <YAxis tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 10 }} tickLine={false} axisLine={false} />
        <Tooltip content={<CustomTooltip />} />
        <Legend wrapperStyle={{ fontSize: 12, color: 'rgba(255,255,255,0.45)' }} />
        <Line type="monotone" dataKey="Impressions" stroke="#4f6fff" strokeWidth={2} dot={{ fill: '#4f6fff', r: 3 }} />
        <Line type="monotone" dataKey="Reach" stroke="#7a94ff" strokeWidth={2} dot={{ fill: '#7a94ff', r: 3 }} />
      </LineChart>
    </ResponsiveContainer>
  )
}
