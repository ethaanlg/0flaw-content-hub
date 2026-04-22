'use client'

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'

type WeekPoint = { date: string; linkedin: number; instagram: number }

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: { color: string; name: string; value: number }[]
  label?: string
}) {
  if (!active || !payload?.length) return null
  return (
    <div style={{
      background: '#1a1f36',
      border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: '10px',
      padding: '10px 14px',
      fontFamily: 'Space Mono, monospace',
      fontSize: '12px',
    }}>
      <div style={{ color: 'var(--muted)', marginBottom: 6 }}>{label}</div>
      {payload.map((p) => (
        <div key={p.name} style={{ color: p.color, display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: p.color, display: 'inline-block', flexShrink: 0 }} />
          <span style={{ color: 'rgba(255,255,255,0.7)' }}>{p.name}:</span>
          <span style={{ color: '#fff', fontWeight: 700 }}>{p.value}</span>
        </div>
      ))}
    </div>
  )
}

export default function WeekLineChart({ data }: { data: WeekPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height={160}>
      <LineChart data={data} margin={{ top: 8, right: 16, bottom: 0, left: -20 }}>
        <XAxis
          dataKey="date"
          tick={{ fill: 'rgba(255,255,255,0.35)', fontSize: 11, fontFamily: 'Space Mono, monospace' }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tick={{ fill: 'rgba(255,255,255,0.25)', fontSize: 10, fontFamily: 'Space Mono, monospace' }}
          axisLine={false}
          tickLine={false}
          allowDecimals={false}
        />
        <Tooltip content={<CustomTooltip />} />
        <Legend
          wrapperStyle={{
            fontFamily: 'Space Mono, monospace',
            fontSize: 11,
            paddingTop: 8,
            color: 'var(--muted)',
          }}
        />
        <Line
          type="monotone"
          dataKey="linkedin"
          name="LinkedIn"
          stroke="#4da3d4"
          strokeWidth={2}
          dot={{ fill: '#4da3d4', r: 3, strokeWidth: 0 }}
          activeDot={{ r: 5, strokeWidth: 0 }}
        />
        <Line
          type="monotone"
          dataKey="instagram"
          name="Instagram"
          stroke="#e1306c"
          strokeWidth={2}
          dot={{ fill: '#e1306c', r: 3, strokeWidth: 0 }}
          activeDot={{ r: 5, strokeWidth: 0 }}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}
